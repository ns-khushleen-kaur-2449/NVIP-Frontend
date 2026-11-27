import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Check, Trash2 } from 'lucide-react';
import { deleteVoiceCampaign, getAgentInstance, getVoiceCampaigns } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { canCreateCampaigns, canDeleteCampaigns, featureOn } from '@/lib/rbac';
import usePolling from '@/hooks/usePolling';
import useApiAction, { errorMessage } from '@/hooks/useApiAction';
import StatusBadge, { CAMPAIGN_TONES } from '@/components/ops/StatusBadge';
import RelativeTime from '@/components/ops/RelativeTime';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import OpsButton from '@/components/ops/OpsButton';
import { EmptyState, ErrorState, ScrollTable, SkeletonRows } from '@/components/ops/States';

const REFRESH_MS = 30000;

/**
 * An id, click-to-copy, prefixed with what kind of id it is.
 *
 * Campaign ids are 36-char UUIDs, so the list view shows a shortened form with
 * the full value in the title attribute; the detail view passes full so the
 * whole id is readable. CSV process ids are short integers and are never
 * shortened. Copying is what this is actually for — a campaign id is what you
 * paste into a call-log filter, a CSV process id is what the CSV Call Campaign
 * tab's "Fetch Call History" box takes.
 *
 * Exported because VoiceCampaignDetail renders the same chip.
 */
export function IdChip({ id, label = 'id', full = false, className = '' }) {
  const [copied, setCopied] = useState(false);
  if (id === null || id === undefined || id === '') return null;

  const text = String(id);
  const shown = full || text.length <= 12 ? text : `${text.slice(0, 8)}…`;

  const copy = async (e) => {
    // Cards and rows are themselves clickable — copying must not also navigate.
    e.stopPropagation();
    e.preventDefault();
    try {
      // Undefined on an insecure origin (plain http on a LAN address), so this
      // is guarded rather than assumed.
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the id and copy manually.');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${text} (click to copy)`}
      className={`inline-flex items-center gap-1 rounded border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors ${className}`}
    >
      <span className="opacity-60">{label}</span>
      {shown}
      {copied
        ? <Check className="w-2.5 h-2.5 text-emerald-400" />
        : <Copy className="w-2.5 h-2.5 opacity-60" />}
    </button>
  );
}

/** The status chips the filter offers: every display label present, in list order. */
export function statusFilters(campaigns) {
  const seen = new Map();
  (campaigns || []).forEach((c) => {
    const label = c.display_label?.startsWith('Waiting') ? 'Waiting' : (c.display_label || c.status_label || c.status);
    if (!seen.has(label)) seen.set(label, 0);
    seen.set(label, seen.get(label) + 1);
  });
  return [...seen.entries()].map(([label, count]) => ({ label, count }));
}

const chipOf = (c) => (c.display_label?.startsWith('Waiting') ? 'Waiting' : (c.display_label || c.status_label || c.status));

export default function VoiceCampaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const newMode = featureOn(user, 'agent_instances');
  const [outboundActive, setOutboundActive] = useState(newMode ? null : true);

  useEffect(() => {
    if (!newMode) { setOutboundActive(true); return undefined; }
    let cancelled = false;
    getAgentInstance('sdr_outbound').then(({ data }) => { if (!cancelled) setOutboundActive(data?.published_version != null); })
      .catch((error) => { if (!cancelled) setOutboundActive(error?.response?.status === 403 ? null : false); });
    return () => { cancelled = true; };
  }, [newMode]);

  const load = useCallback(async () => {
    try {
      const res = await getVoiceCampaigns();
      setCampaigns(res.data.campaigns || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.status === 403 ? "You don't have permission" : errorMessage(err, 'Check your connection and try again.'));
    }
  }, []);
  usePolling(load, REFRESH_MS);

  const remove = useApiAction(() => deleteVoiceCampaign(deleting.id), {
    success: 'Campaign deleted', onSuccess: () => setCampaigns((prev) => prev.filter((c) => c.id !== deleting.id)),
    onConflict: load,
  });
  const filters = useMemo(() => statusFilters(campaigns), [campaigns]);
  const shown = useMemo(() => (campaigns || []).filter((c) => status === 'all' || chipOf(c) === status), [campaigns, status]);
  // Sales Reps and Super Admins delete nothing; the backend decides the rest (a Manager: own or team's).
  const canDelete = canDeleteCampaigns(user);
  const canCreate = canCreateCampaigns(user);

  return (
    <div className="ops space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{newMode ? 'Campaigns' : 'Voice campaigns'}</h1>
          <p className="text-sm text-muted-foreground">Every campaign, its state and its progress.</p>
        </div>
        {canCreate && (outboundActive !== false
          ? <OpsButton variant="primary" onClick={() => navigate('/voice-campaigns/new')}>New campaign</OpsButton>
          : <div className="text-right"><OpsButton variant="primary" disabled title="Set up your Outbound SDR agent first">New campaign</OpsButton><Link className="mt-1 block text-xs underline" to="/agents/sdr_outbound">Set up your Outbound SDR agent first</Link></div>)}
      </header>

      {campaigns && filters.length > 0 && (
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {[{ label: 'All', count: campaigns.length, id: 'all' }, ...filters].map((f) => {
            const id = f.id || f.label;
            return (
              <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${status === id
                  ? 'border-[var(--ops-accent)] bg-[var(--ops-accent)] text-white' : 'border-border hover:bg-[hsl(var(--surface-2))]'}`}>
                {f.label} <span className="ops-num">({f.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && campaigns === null && <SkeletonRows rows={5} label="Loading campaigns" />}
      {!error && campaigns?.length === 0 && (
        <EmptyState title="No campaigns yet." body={newMode ? 'Choose prospects and launch your first campaign.' : 'Pick leads in the Lead-to-Campaign Builder or upload a file to start one.'}
          action={canCreate && outboundActive !== false ? <OpsButton variant="primary" onClick={() => navigate('/voice-campaigns/new')}>New campaign</OpsButton> : null} />
      )}
      {!error && campaigns?.length > 0 && shown.length === 0 && <EmptyState title="No campaigns with this status." />}
      {!error && shown.length > 0 && (
        <ScrollTable label="Campaigns">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Scheduled / started</th>
              <th className="px-4 py-2">Leads</th><th className="px-4 py-2">Created by</th>
              {canDelete && <th className="px-4 py-2"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-[hsl(var(--surface-2))]">
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => navigate(`/voice-campaigns/${c.id}`)}
                    className="text-left font-semibold text-[color:var(--ops-accent-ink)] hover:underline">{c.name}</button>
                  <span className="mt-0.5 block"><IdChip id={c.id} label="id" /></span>
                </td>
                <td className="px-4 py-2.5"><StatusBadge label={c.display_label || c.status_label} tone={CAMPAIGN_TONES[c.status]} /></td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <RelativeTime iso={c.scheduled_at || c.started_at} mode="absolute" />
                </td>
                <td className="ops-num px-4 py-2.5">{c.processed_leads ?? 0} / {c.total_leads ?? 0}</td>
                <td className="px-4 py-2.5">{c.created_by_user?.name || '—'}</td>
                {canDelete && (
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      )}
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} danger confirmLabel="Delete"
        title={`Delete ${deleting?.name || 'this campaign'}?`}
        description="The campaign and its contact list are deleted. Call logs are kept."
        onConfirm={async () => Boolean(await remove.run())} />
    </div>
  );
}
