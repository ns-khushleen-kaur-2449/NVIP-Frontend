import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import ConfirmDialog from '@/components/ops/ConfirmDialog';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '@/components/ops/States';
import { errorMessage } from '@/hooks/useApiAction';
import { useAuth } from '@/lib/AuthContext';
import {
  createAgentInstanceDraft, discardAgentInstanceDraft, getAgentInstance, getAgentInstanceVersion, getBuilderLanguages,
  getBusinessProfile, getCatalogItems, listOwnPhoneNumbers, publishAgentInstanceVersion, rebaseAgentInstanceDraft,
  restoreAgentInstanceVersion, updateAgentInstanceDraft,
} from '@/lib/api';
import { agentTypeLabel, canonicalAgentType, isConfigurableAgentType } from '@/lib/agents';
import {
  configMode, fieldErrors, publishProblems, publishedModeMessage, reapplyEdits, setPath, staleDraft,
} from '@/lib/agentInstances';
import { canConfigureAgents, canForcePublish, canManageBilling, featureOn } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { ReviewStep, STEP_PANELS, fieldPropsFor, stepForPath, stepsFor } from './steps';
import StaleDraftDialog from './StaleDraftDialog';
import VersionHistory from './VersionHistory';
import PreviewPanel from './PreviewPanel';

export const AUTOSAVE_MS = 1000;
const BUILDER_LINK = '/voice_agent?tab=create';

/** Move focus to the first field with an error (after its step has rendered). */
function focusField(path) {
  setTimeout(() => {
    const el = document.querySelector(`[data-field="${CSS.escape ? CSS.escape(path) : path}"]`);
    if (el && typeof el.focus === 'function') el.focus();
  }, 0);
}


function SaveIndicator({ status, error }) {
  const text = { saving: 'Saving…', saved: 'Saved', unsaved: 'Unsaved changes', error: error || 'Could not save' }[status];
  if (!text) return null;
  return (
    <span role="status" aria-live="polite" data-testid="save-indicator"
      className={cn('inline-flex items-center gap-1 text-xs', status === 'error' ? 'text-red-600' : 'text-muted-foreground')}>
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {status === 'saved' && <Check className="h-3 w-3" aria-hidden="true" />}
      {text}
    </span>
  );
}

/** One agent type's configuration: wizard on first setup, tabs afterwards; drafts autosave; versions on the side. */
export function AgentConfigEditor({ agentType, user }) {
  const steps = useMemo(() => stepsFor(agentType), [agentType]);
  const [state, setState] = useState('loading'); // loading | ready | error | not_in_plan | disabled
  const [stateMessage, setStateMessage] = useState(null);
  const [instance, setInstance] = useState(null);
  const [draft, setDraft] = useState(null);
  const [payload, setPayload] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [errors, setErrors] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [rebaseNote, setRebaseNote] = useState(null);
  const [stale, setStale] = useState(null);
  const [publishedNote, setPublishedNote] = useState(null);
  const [stepId, setStepId] = useState(steps[0].id);
  const [visited, setVisited] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [discarding, setDiscarding] = useState(false);
  const [context, setContext] = useState({});

  const payloadRef = useRef(payload);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  draftRef.current = draft;

  const loadInstance = useCallback(async () => {
    try {
      const row = (await getAgentInstance(agentType)).data;
      setInstance(row);
      return row;
    } catch (e) {
      if (e?.response?.status === 404) { setInstance(null); return null; }
      throw e;
    }
  }, [agentType]);

  const load = useCallback(async () => {
    try {
      const row = await loadInstance();
      const [d, p] = await Promise.all([
        row?.draft_version != null ? getAgentInstanceVersion(agentType, row.draft_version) : null,
        row?.published_version != null ? getAgentInstanceVersion(agentType, row.published_version) : null,
      ]);
      const next = d?.data?.payload ?? p?.data?.payload ?? {};
      setDraft(d?.data || null);
      setPayload(next);
      payloadRef.current = next;
      dirtyRef.current = false;
      setState('ready');
    } catch (e) {
      if (e?.response?.status === 403) { setState('disabled'); setStateMessage(errorMessage(e, null)); return; }
      setState('error');
      setStateMessage(errorMessage(e, 'Check your connection and try again.'));
    }
  }, [agentType, loadInstance]);

  useEffect(() => { load(); }, [load]);

  // What the steps show besides the payload. Each part fails on its own, with its own note.
  useEffect(() => {
    let cancelled = false;
    const set = (patch) => { if (!cancelled) setContext((c) => ({ ...c, ...patch })); };
    const loadBusiness = () => getBusinessProfile().then((r) => set({ business: r.data, businessError: null }))
      .catch((e) => set({ business: null, businessError: errorMessage(e, 'Your business details could not be loaded.') }));
    set({ reloadBusiness: loadBusiness, onBusinessSaved: (profile) => set({ business: profile }) });
    loadBusiness();
    listOwnPhoneNumbers().then((r) => set({ numbers: r.data || [] }))
      .catch((e) => set({ numbers: null, numbersError: errorMessage(e, 'Your phone numbers could not be loaded.') }));
    getCatalogItems().then((r) => set({ catalog: r.data?.items || [] }))
      .catch((e) => set({ catalog: null, catalogError: errorMessage(e, 'The catalog could not be loaded.') }));
    getBuilderLanguages().then((r) => set({ languages: r.data || [] })).catch(() => set({ languages: [] }));
    return () => { cancelled = true; };
  }, []);

  // ── Autosave ──

  const save = useCallback(async () => {
    clearTimeout(timerRef.current);
    const current = draftRef.current;
    if (!dirtyRef.current || !current) return true;
    dirtyRef.current = false;
    setSaveStatus('saving');
    try {
      await updateAgentInstanceDraft(agentType, current.version, payloadRef.current);
      setSaveStatus('saved');
      setSavedAt(new Date());
      setSaveError(null);
      setErrors({});
      return true;
    } catch (e) {
      const byField = fieldErrors(e);
      if (Object.keys(byField).length) setErrors(byField);
      setSaveStatus('error');
      setSaveError(errorMessage(e, 'Could not save'));
      dirtyRef.current = true;
      if (e?.response?.status === 409) await load();
      return false;
    }
  }, [agentType, load]);

  const saveRef = useRef(save);
  saveRef.current = save;
  // Leaving the page saves what is pending.
  useEffect(() => () => { if (dirtyRef.current) saveRef.current(); }, []);

  const update = useCallback((path, value) => {
    if (!draftRef.current) return;
    setPayload((prev) => {
      const next = setPath(prev, path, value);
      payloadRef.current = next;
      return next;
    });
    dirtyRef.current = true;
    setSaveStatus('unsaved');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
  }, []);

  const showErrors = useCallback((byField) => {
    setErrors(byField);
    const first = steps.flatMap((s) => Object.keys(byField).filter((p) => stepForPath(p, steps)?.id === s.id))[0]
      || Object.keys(byField)[0];
    const step = first && stepForPath(first, steps);
    if (step) setStepId(step.id);
    if (first) focusField(first);
  }, [steps]);

  // ── Life cycle ──

  const startEditing = async () => {
    setBusy('start');
    try {
      const created = (await createAgentInstanceDraft(agentType, {})).data;
      await loadInstance();
      setDraft(created);
      setPayload(created.payload);
      payloadRef.current = created.payload;
      setPublishedNote(null);
    } catch (e) {
      const status = e?.response?.status;
      // 409: a draft is already open (someone else, or another tab): open it.
      if (status === 409) { toast.info('A draft is already open; opening it.'); await load(); }
      // The routes answered before, so the feature is on: a 403 here is the agent type not being in the plan.
      else if (status === 403) { setState('not_in_plan'); setStateMessage(errorMessage(e, null)); }
      else toast.error(errorMessage(e, 'Could not start a draft'));
    } finally {
      setBusy(null);
    }
  };

  const publish = async ({ force = false } = {}) => {
    const current = draftRef.current;
    if (!current) return;
    if (!(await save())) { toast.error('Fix the highlighted fields first'); return; }
    const problems = publishProblems(payloadRef.current, agentType);
    if (Object.keys(problems).length) { showErrors(problems); toast.error('Some required fields are missing'); return; }
    setBusy('publish');
    try {
      await publishAgentInstanceVersion(agentType, current.version, { force });
      setStale(null);
      setConflicts([]);
      setRebaseNote(null);
      setPublishedNote(publishedModeMessage(user));
      toast.success(`Version ${current.version} published`);
      await load();
    } catch (e) {
      const refused = staleDraft(e);
      if (refused && !force) { setStale(refused); return; }
      const byField = fieldErrors(e);
      if (Object.keys(byField).length) showErrors(byField);
      else toast.error(errorMessage(e, 'Could not publish'));
    } finally {
      setBusy(null);
    }
  };

  const rebase = async () => {
    const old = draftRef.current;
    try {
      const result = (await rebaseAgentInstanceDraft(agentType, old.version)).data;
      let base = {};
      if (old.base_version != null) {
        try { base = (await getAgentInstanceVersion(agentType, old.base_version)).data.payload || {}; } catch { base = {}; }
      }
      const merged = reapplyEdits({ base, previous: result.previous_payload, latest: result.draft.payload });
      setDraft(result.draft);
      draftRef.current = result.draft;
      setPayload(merged.payload);
      payloadRef.current = merged.payload;
      if (merged.applied.length || merged.conflicts.length) {
        dirtyRef.current = true;
        await save();
      }
      setConflicts(merged.conflicts);
      setRebaseNote({ version: result.draft.base_version ?? stale?.published_version, ...merged });
      setStale(null);
      await loadInstance();
      if (merged.conflicts[0]) {
        const step = stepForPath(merged.conflicts[0].path, steps);
        if (step) setStepId(step.id);
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Could not rebase the draft'));
    }
  };

  const discard = async () => {
    try {
      clearTimeout(timerRef.current);
      dirtyRef.current = false;
      await discardAgentInstanceDraft(agentType, draftRef.current.version);
      toast.success('Draft discarded');
      setConflicts([]);
      setRebaseNote(null);
      setSaveStatus(null);
      await load();
      return true;
    } catch (e) {
      toast.error(errorMessage(e, 'Could not discard the draft'));
      return false;
    }
  };

  const restore = async (version) => {
    setBusy('restore');
    try {
      const created = (await restoreAgentInstanceVersion(agentType, version.version)).data;
      toast.success(`Version ${version.version} restored as draft version ${created.version}`);
      setViewing(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not restore that version'));
    } finally {
      setBusy(null);
    }
  };

  const view = async (version) => {
    try {
      setViewing((await getAgentInstanceVersion(agentType, version.version)).data);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not open that version'));
    }
  };

  // ── Render ──

  const label = agentTypeLabel(agentType);
  if (state === 'loading') return <Framed><div className="space-y-3"><Skeleton className="h-16" /><SkeletonRows rows={4} label="Loading the agent" /></div></Framed>;
  if (state === 'error') return <Framed><ErrorState message={stateMessage} onRetry={load} /></Framed>;
  if (state === 'disabled') {
    return <Framed><EmptyState title="Agent configuration isn't enabled for your account" body={stateMessage}
      action={<Link className="underline" to={BUILDER_LINK}>Use the Assistant builder</Link>} /></Framed>;
  }
  if (state === 'not_in_plan') {
    return (
      <Framed>
        <EmptyState title={`${label} isn't in your plan`} body={stateMessage}
          action={canManageBilling(user) ? <Link className="underline" to="/billing">See plans</Link> : 'Ask your Tenant Admin about plans.'} />
      </Framed>
    );
  }

  const mode = configMode(instance);
  const editing = Boolean(draft);
  const readOnly = !editing;
  const field = fieldPropsFor({ payload, update, errors, conflicts, readOnly });
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index];
  const StepPanel = STEP_PANELS[step.id];
  const panelProps = { agentType, payload, context, field, readOnly, errors, user };
  const go = (id) => {
    setVisited((v) => new Set([...v, step.id]));
    setStepId(id);
    setTimeout(() => document.getElementById('setup-title')?.focus(), 0);
  };
  const published = instance?.published_version != null;
  const status = editing
    ? `Editing draft ${draft.version}${draft.base_version ? ` (from v${draft.base_version})` : ''}`
    : published ? `Version ${instance.published_version} is live` : 'Not set up yet';
  const savedTime = savedAt ? savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    // Full screen (App.js shows no app sidebar here): steps and versions | the step | what the agent will say.
    <div className="ops min-h-screen lg:grid lg:grid-cols-[270px_minmax(0,1fr)_380px]" data-testid="agent-config">
      <aside className="border-b border-border px-5 py-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link to="/agents" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Agents
        </Link>
        <h1 id="setup-title" tabIndex={-1} className="mt-5 text-xl font-bold tracking-tight focus:outline-none">
          {mode === 'wizard' ? `Set up ${label}` : label}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {status}{editing && savedTime && saveStatus === 'saved' ? ` · autosaved ${savedTime}` : ''}
        </p>
        <div className="mt-1 min-h-[1rem]">{saveStatus !== 'saved' && <SaveIndicator status={saveStatus} error={saveError} />}</div>
        {editing && mode === 'tabs' && (
          <OpsButton variant="primary" size="sm" className="mt-3" busy={busy === 'publish'} onClick={() => publish()}>Publish</OpsButton>
        )}

        <nav aria-label={mode === 'wizard' ? 'Setup steps' : 'Configuration'} className="mt-5">
          <ol className="space-y-0.5">
            {steps.map((s, i) => {
              const active = s.id === step.id;
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => go(s.id)} aria-current={active ? 'step' : undefined}
                    className={cn('flex w-full items-center rounded-lg px-3 py-2 text-left text-[0.95rem] transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                      active ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground/85 hover:bg-muted')}>
                    <span aria-hidden="true">{i + 1} ·&nbsp;</span>{s.label}
                    {visited.has(s.id) && !active && <Check className="ml-auto h-3.5 w-3.5 text-emerald-500" aria-label="done" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-6 border-t border-border pt-5" data-testid="version-history">
          <h2 className="text-sm font-semibold text-muted-foreground">Versions</h2>
          <VersionHistory versions={instance?.versions || []} user={user} busy={Boolean(busy)}
            canRestore={!editing} editingVersion={draft?.version} onView={view} onRestore={restore} />
          {editing && instance?.versions?.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground">Publish or discard the open draft to restore another version.</p>
          )}
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {publishedNote && <div role="status" className="ops-tone ops-tone-good rounded-2xl px-4 py-3 text-sm font-semibold">{publishedNote}</div>}
          {rebaseNote && (
            <div role="status" className="ops-tone ops-tone-info rounded-2xl px-4 py-3 text-sm" data-testid="rebase-note">
              Your draft now starts from version {rebaseNote.version}.{' '}
              {rebaseNote.applied.length + rebaseNote.conflicts.length} of your edits were re-applied
              {rebaseNote.conflicts.length ? `; ${rebaseNote.conflicts.length} were also changed in that version and are highlighted` : ''}
              {rebaseNote.dropped.length ? `; ${rebaseNote.dropped.length} no longer exist (${rebaseNote.dropped.join(', ')})` : ''}.
            </div>
          )}
          {!editing && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
              <p className="text-sm">
                {published
                  ? 'You are viewing the live version. Editing makes a draft; it goes live only when you publish it.'
                  : 'Start setup creates a draft. Nothing reaches calls until you publish.'}
              </p>
              <OpsButton variant="primary" busy={busy === 'start'} onClick={startEditing}>
                {published ? 'Edit configuration' : 'Start setup'}
              </OpsButton>
            </div>
          )}

          <div aria-label={step.label}>
            <StepPanel {...panelProps} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
            <div className="flex gap-2">
              {index > 0 && <OpsButton variant="outline" onClick={() => go(steps[index - 1].id)}>Back</OpsButton>}
              {editing && <OpsButton variant="outline" onClick={() => save().then((ok) => ok && toast.success('Draft saved'))}>Save draft</OpsButton>}
              {editing && <OpsButton variant="quiet" onClick={() => setDiscarding(true)}>Discard draft</OpsButton>}
            </div>
            {index < steps.length - 1 ? (
              <OpsButton variant="primary" onClick={() => go(steps[index + 1].id)}>Next: {steps[index + 1].label}</OpsButton>
            ) : editing && (
              <OpsButton variant="primary" busy={busy === 'publish'} onClick={() => publish()}>Publish</OpsButton>
            )}
          </div>
        </div>
      </main>

      <aside className="border-t border-border px-5 py-8 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-l lg:border-t-0"
        aria-label="Preview">
        <PreviewPanel agentType={agentType} payload={payload} context={context}
          versionLabel={editing ? `Draft ${draft.version}` : published ? `Version ${instance.published_version}` : null} />
      </aside>

      <StaleDraftDialog stale={stale} draftVersion={draft?.version} canForce={canForcePublish(user)}
        onRebase={rebase} onForce={() => publish({ force: true })} onCancel={() => setStale(null)} />
      <ConfirmDialog open={discarding} onOpenChange={setDiscarding} danger title={`Discard draft version ${draft?.version}?`}
        description="Your unpublished changes are lost. The published version stays as it is." confirmLabel="Discard draft"
        onConfirm={discard} />
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="ops max-h-[85vh] max-w-2xl overflow-y-auto rounded-[14px]">
          <DialogHeader>
            <DialogTitle>Version {viewing?.version}</DialogTitle>
            <DialogDescription>Read-only. Restoring it makes a new draft; nothing changes until that draft is published.</DialogDescription>
          </DialogHeader>
          {viewing && <ReviewStep agentType={agentType} payload={viewing.payload} context={context} />}
          {viewing && !editing && viewing.status !== 'draft' && (
            <OpsButton variant="outline" disabled={Boolean(busy)} onClick={() => restore(viewing)}>Restore as a draft</OpsButton>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A page that is not the editor (a refusal, loading): centred, with the way back (there is no app sidebar here). */
function Framed({ children }) {
  return (
    <div className="ops mx-auto max-w-3xl px-5 py-8">
      <Link to="/agents" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Agents
      </Link>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** /agents/:agentType — gated by agent type, the agent_instances feature and the role. */
export default function AgentConfigPage() {
  const { agentType: raw } = useParams();
  const agentType = canonicalAgentType(raw);
  const { user } = useAuth();
  let body;
  if (!isConfigurableAgentType(agentType)) {
    body = <EmptyState title="This agent has no configuration here" action={<Link className="underline" to="/agents">Back to agents</Link>} />;
  } else if (!featureOn(user, 'agent_instances')) {
    body = (
      <EmptyState title="Agent configuration isn't enabled for your account"
        body="Your agent is set up in the Assistant builder for now."
        action={<Link className="underline" to={BUILDER_LINK}>Open the Assistant builder</Link>} />
    );
  } else if (!canConfigureAgents(user)) {
    body = <EmptyState title="Managers and Tenant Admins set up agents" action={<Link className="underline" to="/agents">Back to agents</Link>} />;
  } else {
    return <AgentConfigEditor key={agentType} agentType={agentType} user={user} />;
  }
  return <Framed>{body}</Framed>;
}
