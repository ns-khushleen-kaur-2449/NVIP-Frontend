import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/components/admin/userBits';
import SharedAssistantVersionsDialog from '@/components/admin/SharedAssistantVersionsDialog';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import {
  createAgent, getAgentAccess, getAgentHealth, listAgentAssistants, listAgents, registerAgentAssistant,
  removeAgentAssistant, replaceAgentAssistant, setAgentAccess, updateAgent,
} from '@/lib/api';
import {
  AGENT_STATUS_ACTIONS, AGENT_STATUS_LABELS, FOLLOWED_AGENT_LABELS, accessSummary, canFollowAgain, followsLabel, healthState,
  problemLabel,
} from '@/lib/agents';

const STATUS_STYLE = {
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  retired: 'bg-red-500/10 text-red-600 border-red-500/25',
};

const field = 'block text-xs font-medium text-muted-foreground';

const HEALTH = {
  ready: { label: 'Ready', style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' },
  attention: { label: 'Needs attention', style: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  no_code: { label: 'No code on this server', style: 'bg-red-500/10 text-red-600 border-red-500/25' },
  unknown: { label: "Couldn't check", style: 'text-muted-foreground' },
};

/** ``health`` is undefined while loading, null when the check failed, else the endpoint's answer. */
function HealthCell({ health }) {
  if (health === undefined) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Checking" />;
  const state = healthState(health);
  // "no_code_pack" is what the badge already says.
  const problems = state === 'attention' ? health.problems : [];
  return (
    <div className="space-y-1">
      <Badge variant="outline" className={`text-[11px] ${HEALTH[state].style}`}>{HEALTH[state].label}</Badge>
      {problems.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4">
          {problems.map((code) => <li key={code}>{problemLabel(code)}</li>)}
        </ul>
      )}
    </div>
  );
}

function NewAgentDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ key: '', name: '', industry: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setForm({ key: '', name: '', industry: '', description: '' }); setError(null); }
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    if (!form.key.trim() || !form.name.trim()) { setError('A key and a name are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await createAgent({
        key: form.key.trim(), name: form.name.trim(),
        industry: form.industry.trim() || null, description: form.description.trim() || null,
      });
      toast.success(`${form.name.trim()} created as a draft`);
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      setError(errorText(e, 'Could not create the agent'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add an agent to the catalog</DialogTitle>
          <DialogDescription>
            This creates a draft catalog entry. It does not create the agent’s calling behaviour or Vapi assistant.
            The code pack key must match an agent pack installed on this server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className={field}>Code pack key
            <Input value={form.key} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} className="mt-1" placeholder="sdr" aria-describedby="agent-pack-key-help" />
          </label>
          <p id="agent-pack-key-help" className="-mt-2 text-xs text-muted-foreground">
            Use the key of a pack already installed on this server, such as <code>sdr</code> or <code>hiring</code>.
          </p>
          <label className={field}>Name
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
          </label>
          <details className="rounded-md border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Additional catalog details (optional)</summary>
            <div className="mt-3 space-y-3">
              <label className={field}>Industry
                <Input value={form.industry} onChange={(e) => set({ industry: e.target.value })} className="mt-1" />
              </label>
              <label className={field}>Description
                <Input value={form.description} onChange={(e) => set({ description: e.target.value })} className="mt-1" />
              </label>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">
            To set up outbound calling, use the existing Outbound SDR (<code>sdr</code>) entry and configure its shared assistant. A new catalog row alone cannot place calls.
          </p>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Add catalog entry
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({ agent, onClose, onSaved }) {
  const [scope, setScope] = useState('selected');
  const [tenants, setTenants] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // An agent that follows another (Inbound SDR follows Outbound SDR): saving its access directly detaches it.
  const [confirmDetach, setConfirmDetach] = useState(false);
  const followed = agent?.follows ? FOLLOWED_AGENT_LABELS[agent.follows] || agent.follows : null;

  useEffect(() => {
    if (!agent) return undefined;
    let cancelled = false;
    setConfirmDetach(false);
    setScope(agent.access_scope);
    setTenants(null);
    setError(null);
    getAgentAccess(agent.id).then((response) => {
      if (cancelled) return;
      setTenants(response.data);
      setSelected(new Set(response.data.filter((t) => t.granted).map((t) => t.tenant_id)));
    }).catch((e) => { if (!cancelled) setError(errorText(e, 'Could not load organisations')); });
    return () => { cancelled = true; };
  }, [agent]);

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setAgentAccess(agent.id, scope, scope === 'selected' ? [...selected] : []);
      toast.success(followed ? `Access updated; ${agent.name} no longer follows ${followed}` : 'Access updated');
      onSaved?.();
      onClose();
      return true;
    } catch (e) {
      setError(errorText(e, 'Could not update access'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]" data-testid="agent-access-dialog">
        <DialogHeader>
          <DialogTitle>Who can use {agent?.name}</DialogTitle>
          <DialogDescription>Only active agents reach organisations. Revoking takes effect at once.</DialogDescription>
        </DialogHeader>
        {followed && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {agent.name} follows {followed}: it gets {followed}'s access and status automatically. Saving access here detaches it.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant={scope === 'all' ? 'default' : 'outline'} aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}>All organisations</Button>
          <Button type="button" variant={scope === 'selected' ? 'default' : 'outline'} aria-pressed={scope === 'selected'}
            onClick={() => setScope('selected')}>Selected organisations</Button>
        </div>
        {scope === 'selected' && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {!tenants ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">There are no organisations yet.</p>
            ) : tenants.map((tenant) => (
              <label key={tenant.tenant_id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                <Checkbox checked={selected.has(tenant.tenant_id)} onCheckedChange={() => toggle(tenant.tenant_id)}
                  aria-label={tenant.name} />
                {tenant.name}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <DialogFooter>
          <Button onClick={() => (followed ? setConfirmDetach(true) : save())} disabled={saving || (scope === 'selected' && !tenants)}
            className="bg-primary text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save access
          </Button>
        </DialogFooter>
        <ConfirmDialog open={confirmDetach} onOpenChange={setConfirmDetach} danger
          title={`Detach ${agent?.name} from ${followed}?`}
          description={`From now on ${agent?.name}'s access and status are managed on their own; changes to ${followed} no longer reach it. You can make it follow ${followed} again later.`}
          confirmLabel="Detach and save" onConfirm={save} />
      </DialogContent>
    </Dialog>
  );
}

const IN_USE = 'assistant_in_use';
const inUseMessage = 'Organisations are calling through this assistant. Replace it instead, or delete anyway with a reason.';
const codeOf = (e) => e?.response?.data?.detail?.code;

/** An agent row has exactly one shared Vapi assistant (plus replaced ones, kept as read-only history). */
function AssistantsDialog({ agent, onClose, onVersions }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ vapi_assistant_id: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceForm, setReplaceForm] = useState({ vapi_assistant_id: '', name: '', reason: '' });
  const [replaceError, setReplaceError] = useState(null);
  const [forceRow, setForceRow] = useState(null);
  const [forceReason, setForceReason] = useState('');
  const [forceError, setForceError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows((await listAgentAssistants(agent.id)).data);
    } catch (e) {
      setError(errorText(e, 'Could not load the assistant'));
      setRows([]);
    }
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    setRows(null);
    setError(null);
    setForm({ vapi_assistant_id: '', name: '' });
    load();
  }, [agent, load]);

  const live = rows?.find((row) => !row.replaced_at) || null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setReplace = (patch) => setReplaceForm((f) => ({ ...f, ...patch }));

  const add = async () => {
    if (!form.vapi_assistant_id.trim() || !form.name.trim()) { setError('A Vapi assistant id and a name are required'); return; }
    setSaving(true);
    setError(null);
    try {
      await registerAgentAssistant(agent.id, { vapi_assistant_id: form.vapi_assistant_id.trim(), name: form.name.trim() });
      setForm({ vapi_assistant_id: '', name: '' });
      await load();
    } catch (e) {
      setError(errorText(e, 'Could not register the assistant'));
    } finally {
      setSaving(false);
    }
  };

  const openReplace = () => {
    setReplaceForm({ vapi_assistant_id: '', name: '', reason: '' });
    setReplaceError(null);
    setReplacing(true);
  };
  const replace = async () => {
    setReplaceError(null);
    try {
      await replaceAgentAssistant(agent.id, {
        vapi_assistant_id: replaceForm.vapi_assistant_id.trim(), name: replaceForm.name.trim(),
        reason: replaceForm.reason.trim(),
      });
      toast.success(`${agent.name} now calls through the new assistant. Import its version 1 next.`);
      await load();
      return true;
    } catch (e) {
      setReplaceError(errorText(e, 'Could not replace the assistant'));
      return false;
    }
  };

  const remove = async (row) => {
    try {
      await removeAgentAssistant(agent.id, row.id);
      await load();
    } catch (e) {
      if (codeOf(e) === IN_USE) {
        setForceRow(row);
        setForceReason('');
        setForceError(null);
      } else {
        toast.error(errorText(e, 'Could not remove the assistant'));
      }
    }
  };
  const forceRemove = async () => {
    setForceError(null);
    try {
      await removeAgentAssistant(agent.id, forceRow.id, { force: true, reason: forceReason.trim() });
      await load();
      return true;
    } catch (e) {
      setForceError(errorText(e, 'Could not remove the assistant'));
      return false;
    }
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]" data-testid="agent-assistants-dialog">
        <DialogHeader>
          <DialogTitle>Shared assistant of {agent?.name}</DialogTitle>
          <DialogDescription>
            The one Vapi assistant every organisation using this agent calls through. Only you see its id;
            organisations cannot import or edit it.
          </DialogDescription>
        </DialogHeader>
        {!rows ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : live ? (
          <div className="rounded-lg border border-border p-3 space-y-3" data-testid="live-assistant">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{live.name}</p>
                <code className="text-xs break-all">{live.vapi_assistant_id}</code>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" aria-label={`Versions of ${live.name}`} onClick={() => onVersions(live)}>
                  Versions{live.published_version ? ` (live: ${live.published_version})` : ''}
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${live.name}`} onClick={() => remove(live)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={openReplace}>Replace assistant</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No shared assistant registered yet.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className={field}>Vapi assistant id
                <Input value={form.vapi_assistant_id} onChange={(e) => set({ vapi_assistant_id: e.target.value })} className="mt-1" />
              </label>
              <label className={field}>Name
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
              </label>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        {rows && !live && (
          <DialogFooter>
            <Button onClick={add} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Register assistant
            </Button>
          </DialogFooter>
        )}

        <ConfirmDialog open={replacing} onOpenChange={setReplacing} danger confirmLabel="Replace assistant"
          title={`Replace the shared assistant of ${agent?.name}?`}
          description="Every organisation on this agent switches to the new assistant on its next call. The old assistant's versions are kept as read-only history."
          canConfirm={Boolean(replaceForm.vapi_assistant_id.trim() && replaceForm.name.trim() && replaceForm.reason.trim())}
          onConfirm={replace}>
          <div className="space-y-2">
            <label className={field}>New Vapi assistant id
              <Input value={replaceForm.vapi_assistant_id} onChange={(e) => setReplace({ vapi_assistant_id: e.target.value })} className="mt-1" />
            </label>
            <label className={field}>Name
              <Input value={replaceForm.name} onChange={(e) => setReplace({ name: e.target.value })} className="mt-1" />
            </label>
            <label className={field}>Reason (required)
              <Input value={replaceForm.reason} onChange={(e) => setReplace({ reason: e.target.value })} className="mt-1" />
            </label>
            {replaceError && <p className="text-xs text-red-600" role="alert">{replaceError}</p>}
          </div>
        </ConfirmDialog>

        <ConfirmDialog open={Boolean(forceRow)} onOpenChange={(open) => !open && setForceRow(null)} danger
          confirmLabel="Delete anyway" title={`Delete ${forceRow?.name}?`} description={inUseMessage}
          canConfirm={Boolean(forceReason.trim())} onConfirm={forceRemove}>
          <label className={field}>Reason (required)
            <Input value={forceReason} onChange={(e) => setForceReason(e.target.value)} className="mt-1" />
          </label>
          {forceError && <p className="text-xs text-red-600" role="alert">{forceError}</p>}
        </ConfirmDialog>
      </DialogContent>
    </Dialog>
  );
}

/** Super Admin: author the platform's agents, decide who may use them, and register their shared Vapi assistants. */
export default function AgentsAdminPage() {
  const [agents, setAgents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [accessFor, setAccessFor] = useState(null);
  const [assistantsFor, setAssistantsFor] = useState(null);
  const [versionsFor, setVersionsFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [health, setHealth] = useState({});
  const [refollow, setRefollow] = useState(null);

  const load = useCallback(async () => {
    try {
      setAgents((await listAgents()).data);
    } catch (e) {
      toast.error(errorText(e, 'Failed to load agents'));
      setAgents([]);
    }
  }, []);

  // One check per agent; a failed check marks only that agent.
  const checkHealth = useCallback(async (list) => {
    setHealth({});
    const results = await Promise.allSettled(list.map((agent) => getAgentHealth(agent.id)));
    setHealth(Object.fromEntries(list.map((agent, i) => [
      agent.id, results[i].status === 'fulfilled' ? results[i].value.data : null,
    ])));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (agents?.length) checkHealth(agents); }, [agents, checkHealth]);

  const changeStatus = async (agent, status) => {
    setBusyId(agent.id);
    try {
      await updateAgent(agent.id, { status });
      toast.success(`${agent.name} is now ${AGENT_STATUS_LABELS[status].toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(errorText(e, 'Could not change the status'));
    } finally {
      setBusyId(null);
    }
  };

  // Re-attach Inbound SDR to Outbound SDR: the backend copies SDR's scope, grants and status at once.
  const followAgain = async () => {
    try {
      await updateAgent(refollow.id, { settings: { ...(refollow.settings || {}), follows: 'sdr' } });
      toast.success(`${refollow.name} follows ${FOLLOWED_AGENT_LABELS.sdr} again`);
      await load();
      return true;
    } catch (e) {
      toast.error(errorText(e, 'Could not change it'));
      return false;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="agents-admin-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Bot className="w-6 h-6 text-primary" /> Agent catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The agents the platform offers. Organisations only see an agent that is active and open to them, never its Vapi setup.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" /> New agent</Button>
      </div>

      <Card className="card-base p-4">
        {!agents ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No agents yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead>Available to</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">Health
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Check health again"
                        onClick={() => checkHealth(agents)}><RefreshCw className="w-3 h-3" /></Button>
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id} data-testid={`agent-row-${agent.key}`}>
                    <TableCell>
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.key}{agent.industry ? ` · ${agent.industry}` : ''}</p>
                      {followsLabel(agent) && (
                        <Badge variant="outline" className="mt-1 text-[11px]" data-testid={`agent-follows-${agent.key}`}>{followsLabel(agent)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] ${STATUS_STYLE[agent.status] || ''}`}>{AGENT_STATUS_LABELS[agent.status] || agent.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{accessSummary(agent)}</TableCell>
                    <TableCell data-testid={`agent-health-${agent.key}`}><HealthCell health={health[agent.id]} /></TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      {(AGENT_STATUS_ACTIONS[agent.status] || []).map((status) => (
                        <Button key={status} variant="outline" size="sm" disabled={busyId === agent.id}
                          onClick={() => changeStatus(agent, status)}>
                          {status === 'active' ? 'Activate' : status === 'retired' ? 'Retire' : 'Back to draft'}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setAccessFor(agent)}>Access</Button>
                      {canFollowAgain(agent) && (
                        <Button variant="outline" size="sm" onClick={() => setRefollow(agent)}>Follow {FOLLOWED_AGENT_LABELS.sdr} again</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setAssistantsFor(agent)}>Assistants</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <NewAgentDialog open={creating} onOpenChange={setCreating} onCreated={load} />
      <ConfirmDialog open={Boolean(refollow)} onOpenChange={(open) => !open && setRefollow(null)}
        title={`Make ${refollow?.name} follow ${FOLLOWED_AGENT_LABELS.sdr} again?`}
        description={`It takes ${FOLLOWED_AGENT_LABELS.sdr}'s current access, grants and status now, and follows every later change.`}
        confirmLabel="Follow again" onConfirm={followAgain} />
      <AccessDialog agent={accessFor} onClose={() => setAccessFor(null)} onSaved={load} />
      <AssistantsDialog agent={assistantsFor} onClose={() => setAssistantsFor(null)}
        onVersions={(row) => { setVersionsFor({ agent: assistantsFor, assistant: row }); setAssistantsFor(null); }} />
      <SharedAssistantVersionsDialog agent={versionsFor?.agent} assistant={versionsFor?.assistant}
        onClose={() => setVersionsFor(null)} />
    </div>
  );
}
