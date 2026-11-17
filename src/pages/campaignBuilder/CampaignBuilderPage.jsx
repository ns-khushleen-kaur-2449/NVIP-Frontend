import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import OpsButton from '@/components/ops/OpsButton';
import { EmptyState } from '@/components/ops/States';
import ImportLeadsDialog from '@/components/voice/ImportLeadsDialog';
import { OfferPreview, PreflightProblems } from '@/components/voice/CampaignOfferFields';
import {
  CallingConfigFields, CallingWindowFields, DEFAULT_CONFIG, ScheduleWarnings, TimeZoneField, announceCalendarSync,
  apiErrorMessage, browserTimeZone, configErrors, useScheduleCheck, validateSettings, withRetryDefaults, zonedToIso,
} from '@/components/voice/CampaignSettingsFields';
import { CheckChip, LockedRules, Panel, Pill, SetupHeader, StepPills } from '@/components/setup/SetupUi';
import useOfferPreview from '@/hooks/useOfferPreview';
import { useAuth } from '@/lib/AuthContext';
import { createVoiceCampaign, getAgentInstance, getAgentInstanceVersion, getAssistants, getCatalogItems, getProspects } from '@/lib/api';
import { toLeadRow } from '@/lib/prospects';
import { offerSaveError, preflightProblems, previewBody } from '@/lib/campaignOffer';
import {
  BRIEF_LIMITS, GOALS, MAX_KEY_POINTS, callingLimitConflicts, campaignBriefFields, emptyBriefForm, goalLabel,
  isOverridden, requiredChecklist,
} from '@/lib/campaignBrief';
import { PLATFORM_RULES, PREVIEW_NOTE, greetingValues, renderGreeting } from '@/lib/agentInstances';
import { agentInstancesAvailable, canCreateCampaigns, featureOn } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { ChoiceField, ListField, SelectField, TextField } from '@/pages/agentConfig/fields';

const PAGE = 50;
const PRIORITIES = [{ value: '', label: 'Normal' }, { value: '3', label: 'Low' }, { value: '8', label: 'High' }];

const leadFirstName = (lead) => lead?.first_name || (lead?.name || '').split(' ')[0] || '';
const leadCompany = (lead) => lead?.company || lead?.custom_fields?.company || '';
/** Ready, or why the backend will skip the lead (no phone number). */
const leadStatus = (lead) => (lead?.phone ? 'ready' : 'no_phone');

/** The agent's published Outbound SDR version: calling limits, default questions and opener (agent instances only). */
function useAgentDefaults(user) {
  const [defaults, setDefaults] = useState({ loaded: false });
  const enabled = agentInstancesAvailable(user);
  useEffect(() => {
    if (!enabled) { setDefaults({ loaded: true }); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const instance = (await getAgentInstance('sdr_outbound')).data;
        const version = instance.published_version != null
          ? (await getAgentInstanceVersion('sdr_outbound', instance.published_version)).data : null;
        if (!cancelled) setDefaults({ loaded: true, active: instance.published_version != null, version: version?.version ?? null, payload: version?.payload || null });
      } catch {
        if (!cancelled) setDefaults({ loaded: true, active: false });
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);
  return defaults;
}

// ── Step 1: select leads ──

function LeadPicker({ leads, loading, selected, setSelected, onImported }) {
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState(null); // null: every source
  const [contacted, setContacted] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState(false);
  const allSources = useMemo(() => [...new Set(leads.map((l) => l.source).filter(Boolean))].sort(), [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return leads.filter((l) => {
      if (q && ![l.name, leadCompany(l), l.phone, l.email].some((v) => (v || '').toLowerCase().includes(q))) return false;
      if (sources && !sources.includes(l.source)) return false;
      if (contacted !== 'all') {
        const at = l.contacted_at ? new Date(l.contacted_at).getTime() : null;
        if (contacted === 'never' && at) return false;
        if (contacted === 'old' && (!at || now - at < 30 * 864e5)) return false;
        if (contacted === 'recent' && (!at || now - at >= 30 * 864e5)) return false;
      }
      return true;
    });
  }, [leads, search, sources, contacted]);

  const chosen = leads.filter((l) => selected.has(l.id));
  const ready = chosen.filter((l) => leadStatus(l) === 'ready').length;
  const allShown = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggle = (id) => setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((cur) => {
    const next = new Set(cur);
    filtered.forEach((l) => (allShown ? next.delete(l.id) : next.add(l.id)));
    return next;
  });
  const toggleSource = (source) => setSources((cur) => {
    const list = cur || allSources;
    const next = list.includes(source) ? list.filter((s) => s !== source) : [...list, source];
    return next.length === allSources.length ? null : next;
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel title="Find prospects">
        <label className="block text-sm font-medium">Search
          <Input className="mt-1" placeholder="Name, company or phone" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} />
        </label>
        {allSources.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">Source</legend>
            <div className="mt-2 space-y-2">
              {allSources.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!sources || sources.includes(source)}
                    onChange={() => toggleSource(source)} />
                  {source}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <SelectField label="Last contacted" value={contacted} onChange={(v) => setContacted(v || 'all')} options={[
          { value: 'all', label: 'Any time' }, { value: 'never', label: 'Never contacted' },
          { value: 'recent', label: 'Within 30 days' }, { value: 'old', label: 'More than 30 days ago' },
        ]} />
        <div className="border-t border-border pt-4">
          <OpsButton variant="outline" className="w-full" onClick={() => setImporting(true)}>Upload CSV</OpsButton>
          <p className="mt-2 text-xs text-muted-foreground">Needs: name and phone. Other columns are optional.</p>
        </div>
      </Panel>

      <div className="min-w-0 space-y-4">
        <Panel>
          <div className="flex flex-wrap items-baseline justify-between gap-2" role="status" aria-live="polite">
            <p className="text-lg font-semibold">{chosen.length} prospect{chosen.length === 1 ? '' : 's'} selected</p>
            <p className="text-sm">
              <span className="font-semibold text-emerald-600">{ready} ready to call</span>
              {chosen.length - ready > 0 && <span className="text-muted-foreground"> · {chosen.length - ready} need attention</span>}
            </p>
          </div>
          {chosen.length - ready > 0 && (
            <div className="ops-tone ops-tone-warn flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm">
              <span><strong>{chosen.length - ready}</strong> have no phone number and will be skipped</span>
              <Link to="/leads" className="font-semibold underline">Fix in prospects</Link>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Do-not-call numbers and duplicates are removed when the campaign is created.</p>
        </Panel>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto" role="region" aria-label="Prospects" tabIndex={0}>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all shown" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={allShown} onChange={toggleAll} /></th>
                  <th className="px-3 py-3">Name</th><th className="px-3 py-3">Company</th><th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">City</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading prospects…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No prospects match these filters.</td></tr>}
                {filtered.slice(0, shown).map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${l.name || l.phone}`} className="h-4 w-4 accent-[hsl(var(--primary))]" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td className="px-3 py-3 font-semibold">{l.name || '—'}</td>
                    <td className="px-3 py-3">{leadCompany(l) || '—'}</td>
                    <td className="px-3 py-3">{l.phone || <span className="text-amber-600">Missing</span>}</td>
                    <td className="px-3 py-3">{l.city || '—'}</td>
                    <td className="px-3 py-3">{l.source || '—'}</td>
                    <td className="px-3 py-3">{leadStatus(l) === 'ready' ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">No phone</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>Showing {Math.min(shown, filtered.length)} of {filtered.length}</span>
            {shown < filtered.length && <button type="button" className="font-semibold text-primary underline" onClick={() => setShown(shown + PAGE)}>Load more</button>}
          </div>
        </div>
      </div>
      <ImportLeadsDialog open={importing} onOpenChange={setImporting} onImported={onImported} />
    </div>
  );
}

// ── Step 2: configure ──

function PreviewColumn({ form, leads, assistant, defaults, checklist, assistantId, sharedMode, timeZone }) {
  const [leadId, setLeadId] = useState('');
  const lead = leads.find((l) => String(l.id) === leadId) || leads[0];
  const opener = defaults.payload?.opener?.first_message || assistant?.first_message || '';
  const values = greetingValues({ payload: defaults.payload, lead: { ...lead, first_name: leadFirstName(lead) }, callPurpose: form.callPurpose });
  const offerOn = form.offer.enabled && Boolean(form.offer.text.trim());
  const { preview, loading, error } = useOfferPreview(
    previewBody({ offer: { offering_name: form.spokenName, offer_text: form.offer.text, valid_until: form.offer.validUntil },
      assistantId, name: form.name.trim(), timeZone }),
    offerOn && (Boolean(assistantId) || sharedMode),
  );
  const missing = checklist.filter((i) => !i.done);
  const facts = [leadCompany(lead), lead?.job_title, lead?.city].filter(Boolean).join(' · ');
  return (
    <aside className="space-y-4 lg:sticky lg:top-4" aria-label="Preview">
      <Panel title="Live preview" action={leads.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Lead
          <select className="h-9 max-w-[160px] rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={leadId || String(lead?.id || '')}
            onChange={(e) => setLeadId(e.target.value)}>
            {leads.slice(0, 50).map((l) => <option key={l.id} value={String(l.id)}>{l.name || l.phone || l.id}</option>)}
          </select>
        </label>
      )}>
        <div aria-live="polite" className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opening line</p>
            <p className="mt-1 rounded-xl bg-muted px-3 py-2.5 text-sm" data-testid="opening-preview">
              {opener ? `“${renderGreeting(opener, values)}”` : "The agent's own opening line."}
            </p>
          </div>
          {form.offer.enabled && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offer the agent receives</p>
              {!assistantId ? <p className="text-sm text-muted-foreground">Choose an assistant to see it.</p>
                : !offerOn ? <p className="text-sm text-muted-foreground">Write the offer to see it.</p>
                  : error ? <p role="alert" className="text-sm text-red-600">{error}</p>
                    : preview ? <OfferPreview preview={preview} /> : loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            </div>
          )}
          {lead && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it knows about {leadFirstName(lead) || 'this lead'}</p>
              <p className="mt-1 text-sm">{facts || 'Name and phone only.'}</p>
            </div>
          )}
          <div data-testid="required-checklist" className={cn('flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
            missing.length ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
            {missing.length ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{missing.length ? `Still needed: ${missing.map((i) => i.label.toLowerCase()).join(', ')}` : 'All required details are filled'}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{PREVIEW_NOTE}</p>
        </div>
      </Panel>
      <Panel title="Locked by the platform"><LockedRules rules={PLATFORM_RULES} /></Panel>
    </aside>
  );
}

function ConfigureStep({ form, setForm, settings, setSettings, assistants, sharedMode, catalog, defaults, errors, limitConflicts }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setOffer = (patch) => setForm((f) => ({ ...f, offer: { ...f.offer, ...patch } }));
  const limits = defaults.payload?.calling;
  const questions = form.qualification.map((row) => row.text);
  const setQuestions = (list) => set({
    qualification: list.map((text, i) => ({ text, inherited: defaults.payload?.qualification_questions?.[i] ?? null })),
  });
  const chosen = new Set(form.featuredProductIds);
  const edited = form.qualification.filter((row) => row.inherited != null && isOverridden(row)).length;

  return (
    <div className="space-y-5">
      <Panel title="Campaign basics" subtitle="When it runs and what a successful call looks like.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Campaign name" path="name" required maxLength={BRIEF_LIMITS.name} value={form.name}
            onChange={(name) => set({ name })} error={errors.name} />
          <TextField label="How the agent names it" path="spokenName" maxLength={BRIEF_LIMITS.spokenName} value={form.spokenName}
            onChange={(spokenName) => set({ spokenName })} hint="Spoken on the call, e.g. “our festive bulk-order offer”." />
        </div>
        <ChoiceField label="Goal of the call" path="goal" cards value={form.goal} onChange={(goal) => set({ goal })} error={errors.goal}
          options={GOALS.map((g) => ({ value: g.value, label: g.label, help: g.help }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5" data-field="assistant">
            <label htmlFor="campaign-assistant" className="text-sm font-medium">Assistant that places the calls <span aria-hidden="true">*</span></label>
            {sharedMode ? (
              <div id="campaign-assistant" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">Outbound SDR</span>
                <span className="ml-2 text-muted-foreground">Platform shared assistant · configured by your platform admin</span>
              </div>
            ) : (
              <select id="campaign-assistant" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={settings.assistantId} aria-invalid={Boolean(errors.assistant)}
                onChange={(e) => setSettings((s) => ({ ...s, assistantId: e.target.value }))}>
                <option value="">{assistants.length ? 'Select an assistant' : 'No assistants available'}</option>
                {assistants.map((a) => <option key={a.vapi_assistant_id} value={a.vapi_assistant_id}>{a.name}</option>)}
              </select>
            )}
            {errors.assistant && <p role="alert" className="text-xs text-red-600">{errors.assistant}</p>}
            {!sharedMode && assistants.length === 0 && (
              <p className="text-xs text-muted-foreground">
                SDR access is separate from assistant setup. Ask your platform admin to enable Shared assistants (outbound) for your organisation, or add a tenant assistant.
              </p>
            )}
          </div>
          <SelectField label="Priority" path="priority" value={form.priority == null ? '' : String(form.priority)}
            onChange={(v) => set({ priority: v ? Number(v) : null })} options={PRIORITIES} />
        </div>
        <TimeZoneField value={settings.timeZone} onChange={(timeZone) => setSettings((s) => ({ ...s, timeZone }))} />
        <div data-field="callingWindow" tabIndex={-1}>
          <CallingWindowFields value={settings.callingWindow} onChange={(callingWindow) => setSettings((s) => ({ ...s, callingWindow }))} />
          {limits?.window && (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="agent-limits">
              Agent limit: {limits.window.days.join(', ')} {limits.window.start_time}–{limits.window.end_time}, at most {limits.max_attempts_per_lead} attempts.
            </p>
          )}
        </div>
        {limitConflicts.length > 0 && (
          <ul role="alert" className="ops-tone ops-tone-warn list-disc space-y-0.5 rounded-xl py-2 pl-8 pr-3 text-sm">
            {limitConflicts.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        <div data-field="config" tabIndex={-1}>
          <CallingConfigFields value={settings.config} onChange={(config) => setSettings((s) => ({ ...s, config }))} errors={configErrors(settings.config)} />
        </div>
      </Panel>

      <Panel title="What to pitch" subtitle="What the agent says in this campaign. Short and specific works best.">
        <TextField label="Why are we calling?" path="callPurpose" required multiline maxLength={BRIEF_LIMITS.callPurpose} counter
          value={form.callPurpose} onChange={(callPurpose) => set({ callPurpose })} error={errors.callPurpose} />
        <TextField label="Value proposition" path="valueProposition" maxLength={BRIEF_LIMITS.valueProposition}
          value={form.valueProposition} onChange={(valueProposition) => set({ valueProposition })} />
        <ListField label="Key points" path="keyPoints" max={MAX_KEY_POINTS} addLabel="Add a point" maxLength={BRIEF_LIMITS.keyPoint}
          values={form.keyPoints} onChange={(keyPoints) => set({ keyPoints })} />
        <fieldset data-field="objections" tabIndex={-1}>
          <legend className="text-sm font-medium">Objections and answers</legend>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {form.objections.map((o, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={i} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex gap-2">
                  <Input aria-label={`Objection ${i + 1}`} placeholder="“We already have a supplier”" maxLength={BRIEF_LIMITS.objection} value={o.objection}
                    onChange={(e) => set({ objections: form.objections.map((x, j) => (j === i ? { ...x, objection: e.target.value } : x)) })} />
                  <button type="button" className="rounded p-1 hover:bg-muted" aria-label={`Remove objection ${i + 1}`}
                    onClick={() => set({ objections: form.objections.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
                </div>
                <Input aria-label={`Answer ${i + 1}`} placeholder="The approved answer" maxLength={BRIEF_LIMITS.response} value={o.response}
                  onChange={(e) => set({ objections: form.objections.map((x, j) => (j === i ? { ...x, response: e.target.value } : x)) })} />
              </li>
            ))}
          </ul>
          {form.objections.length < BRIEF_LIMITS.objections && (
            <button type="button" className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              onClick={() => set({ objections: [...form.objections, { objection: '', response: '' }] })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add objection
            </button>
          )}
        </fieldset>
        <ListField label="Never say" path="mustNotSay" addLabel="Add a phrase" max={BRIEF_LIMITS.mustNotSayItems} maxLength={BRIEF_LIMITS.mustNotSay}
          values={form.mustNotSay} onChange={(mustNotSay) => set({ mustNotSay })} />
      </Panel>

      <Panel title="Tell leads about an offer" subtitle="When off, the agent mentions no offer or discount."
        action={<Switch aria-label="Mention an offer on these calls" checked={form.offer.enabled} onCheckedChange={(enabled) => setOffer({ enabled })} />}>
        {form.offer.enabled ? (
          <div className="space-y-4">
            <TextField label="Offer" path="offerText" required maxLength={BRIEF_LIMITS.offerText} value={form.offer.text}
              onChange={(text) => setOffer({ text })} error={errors.offerText} hint="The agent says it as written." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Valid until" path="offerValidUntil" type="date" value={form.offer.validUntil}
                onChange={(validUntil) => setOffer({ validUntil })} />
              <TextField label="When to mention it" path="whenToMention" maxLength={BRIEF_LIMITS.whenToMention} value={form.offer.whenToMention}
                onChange={(whenToMention) => setOffer({ whenToMention })} placeholder="Once, after understanding their needs" />
            </div>
          </div>
        ) : form.offer.text ? <p className="text-sm text-muted-foreground">Kept for later: “{form.offer.text}”.</p> : null}
      </Panel>

      <Panel title="Products to feature" subtitle="The agent leads with these. During the call it can still search your full catalog.">
        {catalog === null ? <p className="text-sm text-muted-foreground">The catalog could not be loaded.</p>
          : catalog.length === 0 ? <p className="text-sm text-muted-foreground">Your catalog has no active products.</p> : (
            <div className="flex flex-wrap gap-2">
              {catalog.map((item) => (
                <CheckChip key={item.id} checked={chosen.has(item.id)} disabled={!chosen.has(item.id) && chosen.size >= BRIEF_LIMITS.products}
                  onChange={() => set({ featuredProductIds: chosen.has(item.id) ? form.featuredProductIds.filter((x) => x !== item.id) : [...form.featuredProductIds, item.id] })}>
                  {item.name}
                </CheckChip>
              ))}
            </div>
          )}
      </Panel>

      <Panel title="Qualification questions" subtitle="Asked naturally, one at a time. Answers are saved to the lead."
        badge={defaults.payload ? `From agent defaults${edited ? ` · ${edited} edited` : ''}` : null}>
        <ListField label="Questions the agent asks" path="qualification" reorder max={BRIEF_LIMITS.questions}
          addLabel="Add a question" maxLength={BRIEF_LIMITS.question} values={questions} onChange={setQuestions}
          markers={form.qualification.map((row) => (row.inherited == null ? 'Added' : isOverridden(row) ? 'Edited' : null))}
          hint={defaults.payload ? "Any change makes this list the campaign's own." : "Leave empty to use the agent's own questions."} />
      </Panel>
    </div>
  );
}

// ── Step 3: review and launch ──

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ReviewStep({ form, settings, leads, defaults, assistant, checklist, limitConflicts, check, start, setStart, submitting, onSubmit, problems, error }) {
  const opener = defaults.payload?.opener?.first_message || assistant?.first_message || '';
  const samples = leads.slice(0, 3);
  const [sample, setSample] = useState(0);
  const lead = samples[sample];
  const ready = leads.filter((l) => leadStatus(l) === 'ready').length;
  const callWindow = settings.callingWindow;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Campaign" value={form.name || '—'} sub={`Goal: ${goalLabel(form.goal).toLowerCase()}`} />
        <Stat label="Leads" value={`${ready} ready`} sub={leads.length - ready ? `${leads.length - ready} skipped (no phone)` : 'none skipped'} />
        <Stat label="Calling hours" value={callWindow ? `${callWindow.start_time}–${callWindow.end_time}` : 'Any time in the bound'}
          sub={callWindow ? `${callWindow.days.join(', ')} · ${settings.timeZone}` : settings.timeZone} />
        <Stat label="Attempts" value={`Up to ${settings.config.max_attempts_per_lead} per lead`} sub={`Concurrency ${settings.config.max_concurrent_calls}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Checks before launch">
            <ul className="space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  {item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> : <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />}
                  <span>{item.label}{item.done ? '' : ' — missing'}</span>
                </li>
              ))}
              {limitConflicts.map((c) => (
                <li key={c} className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />{c}</li>
              ))}
            </ul>
            <ScheduleWarnings check={check} />
          </Panel>
          <Panel title="How the first calls will open" subtitle="Rendered for real leads from your list.">
            {samples.length > 1 && (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sample leads">
                {samples.map((l, i) => (
                  <button key={l.id} type="button" role="tab" aria-selected={i === sample} onClick={() => setSample(i)}
                    className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', i === sample ? 'border-foreground bg-foreground text-background' : 'border-border')}>
                    {[leadFirstName(l), leadCompany(l)].filter(Boolean).join(' · ') || l.phone}
                  </button>
                ))}
              </div>
            )}
            {samples.map((l) => (
              <p key={l.id} data-testid="sample-opening" className={cn('rounded-xl bg-muted px-4 py-3 text-sm', l !== lead && 'sr-only')}>
                {opener ? `“${renderGreeting(opener, greetingValues({ payload: defaults.payload, lead: { ...l, first_name: leadFirstName(l) }, callPurpose: form.callPurpose }))}”`
                  : "The agent's own opening line."}
              </p>
            ))}
            <p className="text-[11px] text-muted-foreground">{PREVIEW_NOTE}</p>
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel title="Test call" subtitle="The agent calls you as if you were a lead.">
            <p className="text-sm text-muted-foreground">Test calls aren't available yet.</p>
          </Panel>
          <Panel title="Launch" tone="accent" subtitle="You can pause any time; the pitch and offer stay editable while it runs.">
            <ChoiceField label="When" path="start" value={start.mode} onChange={(mode) => setStart((s) => ({ ...s, mode }))} options={[
              { value: 'now', label: 'Launch now' }, { value: 'scheduled', label: 'Schedule' }, { value: 'draft', label: 'Save as draft' },
            ]} />
            {start.mode === 'scheduled' && (
              <div className="grid grid-cols-2 gap-3" data-field="scheduledAt">
                <TextField label="Date" type="date" value={start.date} onChange={(date) => setStart((s) => ({ ...s, date }))} />
                <TextField label={`Time (${settings.timeZone})`} type="time" value={start.time} onChange={(time) => setStart((s) => ({ ...s, time }))} />
              </div>
            )}
            <PreflightProblems problems={problems} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <OpsButton variant="primary" className="w-full" busy={submitting} onClick={onSubmit}>
              {{ now: 'Launch now', scheduled: 'Schedule campaign', draft: 'Save as draft' }[start.mode]}
            </OpsButton>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/**
 * The Outbound SDR campaign builder: 1 Select leads → 2 Configure campaign → 3 Review and launch.
 * POST /api/campaigns takes { goal, priority, brief } (the backend also writes the old pitch fields) and enforces who
 * may create and start campaigns.
 */
export default function CampaignBuilderPage() {
  const { user } = useAuth();
  const sharedMode = featureOn(user, 'shared_assistants');
  const navigate = useNavigate();
  const location = useLocation();
  const defaults = useAgentDefaults(user);
  const [step, setStep] = useState(0);
  const [allLeads, setAllLeads] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [form, setForm] = useState(() => emptyBriefForm());
  const [settings, setSettings] = useState({ assistantId: '', timeZone: browserTimeZone(), callingWindow: null, config: DEFAULT_CONFIG });
  const [start, setStart] = useState({ mode: 'now', date: '', time: '' });
  const [errors, setErrors] = useState({});
  const [problems, setProblems] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const incoming = location.state?.fromProspecting;
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    const rows = incoming.map(toLeadRow);
    const ids = new Set(rows.map((row) => row.id));
    setAllLeads((current) => [...current.filter((row) => !ids.has(row.id)), ...rows]);
    setSelected((current) => new Set([...current, ...ids]));
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const loadLeads = async () => {
    const res = await getProspects({ leads_only: true, limit: 1000, include: 'score_summary' });
    const fetched = (res.data?.prospects || []).map(toLeadRow);
    setAllLeads((current) => {
      const byId = new Map(current.map((lead) => [lead.id, lead]));
      fetched.forEach((lead) => byId.set(lead.id, lead));
      return [...byId.values()];
    });
  };
  useEffect(() => {
    (async () => {
      const [leadsRes, assistantsRes] = await Promise.allSettled([
        getProspects({ leads_only: true, limit: 1000, include: 'score_summary' }), getAssistants(),
      ]);
      const fetched = leadsRes.status === 'fulfilled' ? (leadsRes.value.data?.prospects || []).map(toLeadRow) : [];
      setAllLeads((current) => {
        const byId = new Map(current.map((lead) => [lead.id, lead]));
        fetched.forEach((lead) => byId.set(lead.id, lead));
        return [...byId.values()];
      });
      setAssistants(assistantsRes.status === 'fulfilled' ? (assistantsRes.value.data || []) : []);
      setLoading(false);
    })();
    getCatalogItems().then((r) => setCatalog(r.data?.items || [])).catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    const questions = defaults.payload?.qualification_questions;
    if (questions?.length) setForm((f) => (f.qualification.length ? f : { ...f, qualification: questions.map((q) => ({ text: q, inherited: q })) }));
  }, [defaults.payload]);

  const callable = useMemo(() => assistants.filter((a) => a.vapi_assistant_id), [assistants]);
  useEffect(() => {
    setSettings((s) => (s.assistantId || !callable.length ? s : { ...s, assistantId: (callable.find((a) => a.is_live) || callable[0]).vapi_assistant_id }));
  }, [callable]);
  const assistant = callable.find((a) => a.vapi_assistant_id === settings.assistantId);

  let plannedStart = null;
  try { plannedStart = start.mode === 'scheduled' ? zonedToIso(start.date, start.time, settings.timeZone.trim()) : null; } catch { plannedStart = null; }
  const check = useScheduleCheck({ scheduledAt: plannedStart, timeZone: settings.timeZone.trim(), callingWindow: settings.callingWindow, enabled: step > 0 });
  useEffect(() => {
    if (check.retryDefaults) setSettings((s) => ({ ...s, config: withRetryDefaults(s.config, check.retryDefaults) }));
  }, [check.retryDefaults]);

  const leads = allLeads.filter((l) => selected.has(l.id));
  const checklist = requiredChecklist(form, { leadCount: leads.length, assistantId: sharedMode ? 'shared-sdr' : settings.assistantId });
  const limitConflicts = callingLimitConflicts({ window: settings.callingWindow, attempts: settings.config.max_attempts_per_lead },
    defaults.payload?.calling);

  if (!canCreateCampaigns(user)) {
    return <EmptyState title="Campaigns are created by Tenant Admins, Managers and Sales Reps" action={<Link className="underline" to="/voice-campaigns">Back to campaigns</Link>} />;
  }

  if (agentInstancesAvailable(user) && defaults.loaded && defaults.active === false) {
    return <EmptyState title="Set up your Outbound SDR agent first" body="Publish your Outbound SDR agent before creating a campaign."
      action={<Link className="font-semibold underline" to="/agents/sdr_outbound">Set up Outbound SDR</Link>} />;
  }

  const configureProblems = () => {
    const found = {};
    if (!form.name.trim()) found.name = 'Give the campaign a name.';
    if (!GOALS.some((g) => g.value === form.goal)) found.goal = 'Choose a goal.';
    if (!sharedMode && !settings.assistantId) found.assistant = 'Pick the assistant that will make the calls.';
    if (!form.callPurpose.trim()) found.callPurpose = 'Say why the agent is calling.';
    if (form.offer.enabled && !form.offer.text.trim()) found.offerText = 'Write the offer, or turn it off.';
    const settingsProblem = validateSettings({ window: settings.callingWindow, config: settings.config, timeZone: settings.timeZone });
    if (settingsProblem) found.config = settingsProblem;
    return found;
  };
  const block = (found) => {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (!first) return false;
    toast.error(found[first]);
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${first}"]`);
      const target = el?.matches('input,textarea,select,[tabindex]') ? el : el?.querySelector('input,textarea,select,button');
      target?.focus();
    }, 0);
    return true;
  };
  const goTo = (next) => {
    if (next > 0 && !leads.length) { toast.error('Select at least one prospect.'); return; }
    if (next === 2 && block(configureProblems())) { setStep(1); return; }
    setStep(next);
    setTimeout(() => document.getElementById('setup-title')?.focus(), 0);
  };

  const submit = async () => {
    const found = configureProblems();
    if (Object.keys(found).length) { setStep(1); block(found); return; }
    let scheduledAt = null;
    if (start.mode === 'scheduled') {
      try { scheduledAt = zonedToIso(start.date, start.time, settings.timeZone.trim()); } catch { scheduledAt = null; }
      if (!scheduledAt || new Date(scheduledAt) <= new Date()) { block({ scheduledAt: 'Pick a start date and time in the future.' }); return; }
    }
    const body = {
      ...campaignBriefFields(form, { defaultQuestions: defaults.payload?.qualification_questions || [] }),
      name: form.name.trim(),
      // The campaign API requires a description: the call purpose is what the campaign is about.
      description: form.callPurpose.trim(),
      ...(!sharedMode ? { assistant_id: settings.assistantId } : {}),
      timezone: settings.timeZone.trim(),
      calling_window: settings.callingWindow,
      calling_config: settings.config,
      start: start.mode,
      ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      prospect_ids: leads.map((l) => l.id),
    };
    setSubmitting(true);
    setProblems(null);
    try {
      const campaign = (await createVoiceCampaign(body)).data;
      toast.success({ now: 'Campaign started', scheduled: 'Campaign scheduled', draft: 'Campaign saved as a draft' }[start.mode]
        + ` with ${campaign.total_leads} contact${campaign.total_leads === 1 ? '' : 's'}`);
      announceCalendarSync(campaign.calendar_sync);
      navigate(`/voice-campaigns/${campaign.id}`);
    } catch (e) {
      const refused = preflightProblems(e);
      setProblems(refused);
      toast.error(refused ? refused.title : offerSaveError(e, apiErrorMessage(e, 'Failed to create campaign')));
    } finally {
      setSubmitting(false);
    }
  };

  const persona = defaults.payload?.persona?.name;
  const title = step === 2 ? 'Review & launch' : step === 1 && form.name.trim() ? form.name.trim() : 'New campaign';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" data-testid="campaign-builder">
      <SetupHeader crumbs={[{ label: 'Campaigns', to: '/voice-campaigns' }, { label: 'New campaign' }]} title={title}
        aside={defaults.version != null && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Agent: Outbound SDR{persona ? ` · ${persona}` : ''} · v{defaults.version}
          </span>
        )} />
      <StepPills current={step} onSelect={goTo} label="Campaign steps" steps={[
        { label: 'Select leads', summary: `${leads.length} lead${leads.length === 1 ? '' : 's'}` },
        { label: 'Configure campaign', summary: 'Configured', disabled: !leads.length },
        { label: 'Review & launch', disabled: !leads.length },
      ]} />

      {step === 0 && (
        <>
          <LeadPicker leads={allLeads} loading={loading} selected={selected} setSelected={setSelected}
            onImported={async (result) => {
              await loadLeads();
              const ids = result?.prospect_ids || [];
              if (ids.length) setSelected((cur) => new Set([...cur, ...ids]));
            }} />
          <div className="flex justify-end">
            <OpsButton variant="primary" disabled={!leads.length} onClick={() => goTo(1)}>Next: Configure campaign</OpsButton>
          </div>
        </>
      )}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <ConfigureStep form={form} setForm={setForm} settings={settings} setSettings={setSettings} assistants={callable} sharedMode={sharedMode}
              catalog={catalog} defaults={defaults} errors={errors} limitConflicts={limitConflicts} />
            <div className="flex flex-wrap justify-between gap-2">
              <OpsButton variant="outline" onClick={() => goTo(0)}>Back</OpsButton>
              <OpsButton variant="primary" onClick={() => goTo(2)}>Next: Review and launch</OpsButton>
            </div>
          </div>
          <PreviewColumn form={form} leads={leads} assistant={assistant} defaults={defaults} checklist={checklist}
            assistantId={settings.assistantId} sharedMode={sharedMode} timeZone={settings.timeZone.trim()} />
        </div>
      )}

      {step === 2 && (
        <>
          <ReviewStep form={form} settings={settings} leads={leads} defaults={defaults} assistant={assistant} checklist={checklist}
            limitConflicts={limitConflicts} check={check} start={start} setStart={setStart} submitting={submitting}
            onSubmit={submit} problems={problems} error={errors.scheduledAt} />
          <OpsButton variant="outline" onClick={() => goTo(1)}>Back</OpsButton>
        </>
      )}
    </div>
  );
}
