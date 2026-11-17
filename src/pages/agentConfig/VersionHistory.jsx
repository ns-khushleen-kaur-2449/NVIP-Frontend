import { Badge } from '@/components/ui/badge';
import OpsButton from '@/components/ops/OpsButton';
import { VERSION_STATUS_LABELS } from '@/lib/agentInstances';
import { displayTimeZone, formatDateTime } from '@/lib/ops';

const STATUS_STYLE = {
  published: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  superseded: 'text-muted-foreground',
};

/**
 * Every version of the agent, newest first (GET /api/v1/agent-instances/{type} → versions). A discarded draft leaves
 * its number unused, so gaps are normal. Author names come from the API (created_by_name / published_by_name).
 */
export default function VersionHistory({ versions = [], user, canRestore, busy, onView, onRestore }) {
  const zone = displayTimeZone(user);
  const who = (id, name) => (id == null ? 'the system' : name || `user #${id}`);
  if (!versions.length) return <p className="text-sm text-muted-foreground">No versions yet.</p>;
  return (
    <ol className="space-y-2" aria-label="Versions">
      {versions.map((v) => (
        <li key={v.id} className="rounded-lg border border-border p-3 text-sm" data-testid={`version-${v.version}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Version {v.version}</span>
            <Badge variant="outline" className={`text-[11px] ${STATUS_STYLE[v.status] || ''}`}>{VERSION_STATUS_LABELS[v.status] || v.status}</Badge>
            {v.restored_from_version && <span className="text-xs text-muted-foreground">restored from v{v.restored_from_version}</span>}
            {v.source?.kind === 'assistant_builder' && <span className="text-xs text-muted-foreground">from the Assistant builder</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Created by {who(v.created_by, v.created_by_name)} · {formatDateTime(v.created_at, zone)}
            {v.published_at && <> · published by {who(v.published_by, v.published_by_name)} · {formatDateTime(v.published_at, zone)}</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <OpsButton size="sm" variant="quiet" onClick={() => onView(v)}>View</OpsButton>
            {canRestore && v.status !== 'draft' && (
              <OpsButton size="sm" variant="outline" disabled={busy} onClick={() => onRestore(v)}>Restore as a draft</OpsButton>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
