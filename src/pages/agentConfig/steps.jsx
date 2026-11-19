// The agent configuration steps. The first setup walks them as a wizard; later edits show the same panels as tabs.
// Field paths are the instance payload's (backend agent_instances/schema.py InstancePayload).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import OpsButton from '@/components/ops/OpsButton';
import { errorMessage } from '@/hooks/useApiAction';
import { getAgentInstance, getAgentInstanceVersion, previewAgentInstance, updateBusinessProfile } from '@/lib/api';
import { canEditBusinessProfile } from '@/lib/rbac';
import { displayTimeZone, formatDateTime } from '@/lib/ops';
import {
  MAX_CUSTOM_INSTRUCTIONS, PLATFORM_RULES, QUALIFICATION_LIMITS, QUESTIONS_OVER_NOTE,
  askedQuestions, fieldErrors, getPath, languageNames,
  publishProblems,
} from '@/lib/agentInstances';
import {
  ChoiceField, FieldUseProvider, GapNote, ListField, ReadOnlyValue, SelectField, SwitchField, TextField, WindowField,
} from './fields';
import { CheckChip, Panel as SetupPanel } from '@/components/setup/SetupUi';
import CallPreviewView from '@/components/voice/CallPreview';
import useCallPreview from '@/hooks/useCallPreview';

const BOTH = ['sdr_outbound', 'sdr_inbound'];

/** The steps, in order. `paths`: payload prefixes a step owns (a refused field opens its step). */
export const STEPS = Object.freeze([
  { id: 'business', label: 'Business details', types: BOTH, paths: [] },
  { id: 'catalog', label: 'Product catalog', types: BOTH, paths: ['inbound.featured_product_ids'] },
  { id: 'identity', label: 'Agent identity', types: BOTH, paths: ['persona', 'voice', 'languages', 'tone', 'opener'] },
  { id: 'campaign_defaults', label: 'Campaign defaults', types: ['sdr_outbound'], paths: ['qualification_questions', 'dispositions', 'extraction_fields'] },
  { id: 'inbound', label: 'Inbound calls', types: ['sdr_inbound'], paths: ['inbound', 'qualification_questions'] },
  { id: 'actions', label: 'Actions and integrations', types: BOTH, paths: ['calendar', 'call_behaviour.tools', 'call_behaviour.transfer_numbers'] },
  { id: 'rules', label: 'Rules and guardrails', types: BOTH, paths: ['calling', 'guardrails'] },
  { id: 'behaviour', label: 'Call behaviour', advanced: true, types: BOTH, paths: ['call_behaviour', 'goal', 'sales_approach', 'conversation_length', 'target_customer'] },
  { id: 'review', label: 'Review and test', types: BOTH, paths: [] },
]);

export const stepsFor = (agentType) => STEPS.filter((s) => s.types.includes(agentType));

/** The step that owns `path` (the longest matching prefix), or null. */
export function stepForPath(path, steps) {
  let best = null;
  let length = -1;
  steps.forEach((step) => step.paths.forEach((prefix) => {
    if ((path === prefix || path.startsWith(`${prefix}.`)) && prefix.length > length) {
      best = step;
      length = prefix.length;
    }
  }));
  return best;
}

const TONES = [
  { value: 'friendly', label: 'Friendly' }, { value: 'professional', label: 'Professional' },
  { value: 'energetic', label: 'Energetic' }, { value: 'calm', label: 'Calm' },
];
const APPROACHES = [
  { value: 'consultative', label: 'Consultative' }, { value: 'direct', label: 'Direct' }, { value: 'soft', label: 'Soft' },
];
const LENGTHS = [{ value: 'concise', label: 'Concise' }, { value: 'balanced', label: 'Balanced' }, { value: 'detailed', label: 'Detailed' }];
const withCurrent = (options, value) => (value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options);
const DESCRIPTION_MAX = 300;

// Tool types in call_behaviour.tools that this screen turns on and off (the SDR manifest's types).
const TOOL_BROCHURE = 'send_brochure';
const TOOL_CALLBACK = 'request_callback';

// Each step's card: title, one-line explanation, optional badge (components/setup/SetupUi Panel).
const SUBTITLES = {
  'Business details': 'The agent uses these on every call to introduce your company.',
  'Product catalog': 'What the agent may talk about. Prices always come from the catalog, never from the agent.',
  'Agent identity': 'Who your leads will hear. Every campaign uses this agent.',
  'Campaign defaults': 'What every campaign starts from; a campaign can change them for its own calls.',
  'Inbound calls': 'How the agent answers calls to your numbers.',
  'Actions and integrations': 'What the agent can do during a call.',
  'Rules and guardrails': 'Limits the agent always respects.',
  'Review and test': 'Check the setup, then publish.',
};

function Section({ title, badge, action, children, note }) {
  return (
    <SetupPanel title={title} subtitle={SUBTITLES[title]} badge={badge} action={action}>
      {note}
      {children}
    </SetupPanel>
  );
}

/** Builds the props every field needs from the form context. */
export function fieldPropsFor({ payload, update, errors, conflicts, readOnly }) {
  const conflictFor = (path) => conflicts?.find((c) => c.path === path || c.path.startsWith(`${path}.`)) || null;
  return (path) => ({
    path, value: getPath(payload, path), onChange: (value) => update(path, value), error: errors?.[path],
    conflict: conflictFor(path), readOnly,
  });
}

// ── 1. Business details (GET/PUT /api/v1/business-profile; the tenant's numbers from /api/v1/phone-numbers) ──

const PROFILE_FIELDS = ['company_name', 'company_description', 'industry', 'location', 'locations', 'website',
  'business_hours', 'brochure'];
const profileForm = (business) => Object.fromEntries(PROFILE_FIELDS.map((k) => [k, business?.[k] ?? (k === 'locations' ? [] : null)]));
const MODE_LABELS = { fixed: 'Fixed assistant', shared: 'Shared via NVIP' };

/** The business profile: Tenant Admins edit it (Save replaces it), Managers read it. Not part of the agent version. */
export function BusinessStep({ context, user }) {
  const editable = canEditBusinessProfile(user);
  const [form, setForm] = useState(() => profileForm(context.business));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(profileForm(context.business)); }, [context.business]);
  const field = (path) => ({
    path, value: form[path], readOnly: !editable, error: errors[path],
    onChange: (value) => setForm((f) => ({ ...f, [path]: value })),
  });
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, locations: (form.locations || []).filter((l) => (l || '').trim()) };
      const saved = (await updateBusinessProfile(body)).data;
      setErrors({});
      context.onBusinessSaved?.(saved);
      toast.success('Business details saved');
    } catch (e) {
      const byField = fieldErrors(e);
      setErrors(byField);
      const first = Object.keys(byField)[0];
      if (first) document.querySelector(`[data-field="${first}"]`)?.focus();
      toast.error(errorMessage(e, 'Could not save the business details'));
    } finally {
      setSaving(false);
    }
  };
  const business = context.business;
  return (
    // The profile's own metadata (GET /api/v1/business-profile `fields`): which details reach calls.
    <FieldUseProvider value={business?.fields || null}>
    <Section title="Business details" badge="Shared with all your agents" action={editable && (
      <OpsButton variant="primary" busy={saving} onClick={save}>Save business details</OpsButton>
    )} note={business?.updated_at && (
      <p className="text-xs text-muted-foreground" data-testid="business-updated">
        Last changed {business.updated_by_name ? `by ${business.updated_by_name} ` : ''}
        {formatDateTime(business.updated_at, displayTimeZone(user))}
        {business.source === 'assistant_builder' ? ' (from the Assistant builder)' : ''}
      </p>
    )}>
      {context.businessError && <p role="alert" className="text-sm text-red-600">{context.businessError}</p>}
      {!editable && <p className="text-xs text-muted-foreground">Your Tenant Admin edits these details.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Company name" maxLength={120} {...field('company_name')} />
        <TextField label="Industry" maxLength={50} {...field('industry')} />
        <div className="sm:col-span-2">
          <TextField label="Description" multiline counter maxLength={DESCRIPTION_MAX} {...field('company_description')} />
        </div>
        <TextField label="Location" maxLength={200} {...field('location')} />
        <TextField label="Website" type="url" placeholder="https://" maxLength={255} {...field('website')} />
        <div className="sm:col-span-2">
          <ListField label="Other locations" max={50} maxLength={120} addLabel="Add a location" {...field('locations')}
            values={form.locations || []} />
        </div>
        <div className="sm:col-span-2">
          <WindowField label="Business hours" emptyLabel="Not set" {...field('business_hours')} />
        </div>
        <div className="sm:col-span-2">
          <TextField label="Company brochure (link)" type="url" maxLength={500} {...field('brochure')} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Caller ID numbers</p>
        {context.numbersError && <p className="mt-1 text-sm text-muted-foreground">{context.numbersError}</p>}
        {context.numbers && context.numbers.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">No number yet: your platform administrator assigns them.</p>
        )}
        {context.numbers?.length > 0 && (
          <ul className="mt-1 space-y-1 text-sm" data-testid="own-numbers">
            {context.numbers.map((n) => (
              <li key={n.id}>
                {n.phone_number || <span className="text-muted-foreground">number not synced yet</span>}
                {n.label ? ` · ${n.label}` : ''} · {MODE_LABELS[n.inbound_mode] || n.inbound_mode}
                {n.assistant_name ? ` · ${n.assistant_name}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
    </FieldUseProvider>
  );
}

// ── 2. Product catalog ──

export function CatalogStep({ agentType, context, field, readOnly }) {
  const items = context.catalog;
  const featured = field('inbound.featured_product_ids');
  const chosen = new Set(featured.value || []);
  const toggle = (id) => featured.onChange(chosen.has(id) ? [...chosen].filter((x) => x !== id) : [...chosen, id]);
  return (
    <Section title="Product catalog">
      <p className="text-sm text-muted-foreground">
        The agent talks only about active products in your catalog and never invents prices.{' '}
        <Link to="/catalog" className="underline">Manage the catalog</Link>
      </p>
      {context.catalogError && <p className="text-sm text-muted-foreground">{context.catalogError}</p>}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">Your catalog has no active products yet.</p>}
      {items && items.length > 0 && agentType === 'sdr_outbound' && (
        <p className="text-sm">{items.length} active product{items.length === 1 ? '' : 's'}. Choose featured products per campaign.</p>
      )}
      {items && items.length > 0 && agentType === 'sdr_inbound' && (
        <fieldset data-field="inbound.featured_product_ids" tabIndex={-1}>
          <legend className="text-sm font-medium">Featured products (mentioned first to callers)</legend>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={chosen.has(item.id)} disabled={readOnly} onChange={() => toggle(item.id)}
                    className="h-4 w-4" />
                  {item.name}{item.category ? <span className="text-xs text-muted-foreground"> · {item.category}</span> : null}
                </label>
              </li>
            ))}
          </ul>
          {featured.error && <p role="alert" className="mt-1 text-xs text-red-600">{featured.error}</p>}
        </fieldset>
      )}
    </Section>
  );
}

// ── 3. Agent identity ──

export function IdentityStep({ agentType, payload, context, field }) {
  const languageOptions = withCurrent((context.languages || []).map((l) => ({ value: l.code, label: l.english_name || l.code })),
    payload?.languages?.primary);
  const supported = field('languages.supported');
  const voice = payload?.voice || {};
  return (
    <Section title="Agent identity">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Agent name" required maxLength={60} {...field('persona.name')} />
        <ChoiceField label="Speaks as" cards options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
          hint="Tells the agent to match its voice and to refer to itself this way on calls." {...field('persona.gender')} />
      </div>
      <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm" data-testid="voice-card">
        <p className="font-semibold">Voice</p>
        <p className="text-muted-foreground">
          {voice.voice_id ? `${voice.provider || 'Voice'} · ${voice.voice_id}` : "The shared assistant's default voice"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Choosing from tested voices arrives with the voice list.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Primary language" options={languageOptions} placeholder="Choose a language" {...field('languages.primary')} />
        <fieldset data-field="languages.supported" tabIndex={-1}>
          <legend className="text-sm font-medium">Can switch to</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {languageOptions.filter((l) => l.value !== payload?.languages?.primary).map((l) => {
              const list = supported.value || [];
              return (
                <CheckChip key={l.value} checked={list.includes(l.value)} disabled={supported.readOnly}
                  onChange={() => supported.onChange(list.includes(l.value) ? list.filter((c) => c !== l.value) : [...list, l.value])}>
                  {l.label}
                </CheckChip>
              );
            })}
          </div>
        </fieldset>
      </div>
      <ChoiceField label="Tone" cards options={withCurrent(TONES, payload?.tone)} {...field('tone')} />
      {agentType === 'sdr_outbound' && (
        <div className="space-y-2">
          <TextField label="Opening line" multiline maxLength={500} counter
            hint="Placeholders: {{lead_first_name}}, {{agent_name}}, {{company_name}}, {{call_purpose}}."
            {...field('opener.first_message')} />
          <PreviewPointer />
        </div>
      )}
    </Section>
  );
}

/** Openings are shown by the server preview (the panel on the right), built by the code that places calls. */
export function PreviewPointer() {
  return (
    <p className="text-xs text-muted-foreground" data-testid="preview-pointer">
      How calls will open, as the server builds them, is in the preview panel (saved changes show within a second).
    </p>
  );
}

// ── 4. Campaign defaults (Outbound SDR) ──

export function CampaignDefaultsStep({ payload, field }) {
  const { min, max } = QUALIFICATION_LIMITS;
  const questions = field('qualification_questions');
  return (
    <Section title="Campaign defaults">
      <ListField label="Default qualification questions" min={min} max={max} reorder addLabel="Add a question" maxLength={200}
        hint="Every campaign starts from these; a campaign can change them for its own calls." {...questions}
        values={questions.value || []} />
      <QuestionsOver list={questions.value} />
      <ReadOnlyValue label="Dispositions"
        value={payload?.dispositions ? JSON.stringify(payload.dispositions) : "Outbound SDR's standard dispositions"}
        note="Editing dispositions is not available yet." />
      <ReadOnlyValue label="Extraction fields"
        value={payload?.extraction_fields ? Object.keys(payload.extraction_fields).join(', ') : "Outbound SDR's standard fields"}
        note="Editing extraction fields is not available yet." />
    </Section>
  );
}

// ── 4b. Inbound calls (Inbound SDR) ──

/** A saved version with more questions than a call asks (older versions allowed 7). */
function QuestionsOver({ list }) {
  return askedQuestions(list).length > QUALIFICATION_LIMITS.max
    ? <p role="status" className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="questions-over">{QUESTIONS_OVER_NOTE}</p>
    : null;
}

/** Outbound SDR's qualification questions (its draft, else its published version), or [] when it has none. */
async function outboundQuestions() {
  const instance = (await getAgentInstance('sdr_outbound')).data;
  const number = instance?.draft_version ?? instance?.published_version;
  if (number == null) return [];
  const version = (await getAgentInstanceVersion('sdr_outbound', number)).data;
  return (version?.payload?.qualification_questions || []).filter((q) => (q || '').trim());
}

export function InboundStep({ payload, context, field, readOnly }) {
  const overflowMode = payload?.inbound?.overflow?.mode || 'message';
  const questions = field('qualification_questions');
  const { min, max } = QUALIFICATION_LIMITS;
  const empty = !(questions.value || []).length;
  // A new Inbound SDR starts from Outbound SDR's questions (once, while the list is empty and editable).
  useEffect(() => {
    if (readOnly || !empty) return undefined;
    let cancelled = false;
    outboundQuestions().then((list) => { if (!cancelled && list.length) questions.onChange(list.slice(0, max)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [readOnly, empty]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Section title="Inbound calls">
      <ListField label="Qualification questions" min={min} max={max} reorder addLabel="Add a question" maxLength={200}
        hint="Asked one at a time when a caller is interested in buying. Starts from your Outbound SDR's questions."
        {...questions} values={questions.value || []} />
      <QuestionsOver list={questions.value} />
      <WindowField label="Business hours" emptyLabel="Uses your business profile's hours"
        hint="In your organisation's time zone." {...field('inbound.business_hours')} />
      <TextField label="After hours" multiline maxLength={1000} counter
        hint="What the agent does when someone calls outside business hours." {...field('inbound.after_hours_instruction')} />
      <TextField label="Callers who are not buying" multiline maxLength={1000} counter
        hint="Job seekers, suppliers, complaints." {...field('inbound.non_sales_instruction')} />
      <ChoiceField label="When every line is busy" options={[
        { value: 'message', label: 'Play a message' }, { value: 'transfer', label: 'Transfer the call' },
      ]} {...field('inbound.overflow.mode')} />
      {overflowMode === 'transfer' ? (
        <TextField label="Transfer to" placeholder="+919876543210" hint="In international format (E.164)." maxLength={20}
          {...field('inbound.overflow.transfer_number')} />
      ) : (
        <TextField label="Busy message" multiline maxLength={500} {...field('inbound.overflow.message')} />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <TextField label="Greeting for a known caller" multiline maxLength={500}
            hint="{{caller_first_name}}, {{company_name}}, {{agent_name}}" {...field('inbound.known_caller_greeting')} />
          <PreviewPointer />
        </div>
        <div className="space-y-2">
          <TextField label="Greeting for a new caller" multiline maxLength={500}
            hint="{{company_name}}, {{agent_name}}" {...field('inbound.new_caller_greeting')} />
          <PreviewPointer />
        </div>
      </div>
    </Section>
  );
}

// ── 5. Actions and integrations ──

export function ActionsStep({ payload, field, readOnly }) {
  const tools = payload?.call_behaviour?.tools || [];
  const toolsField = field('call_behaviour.tools');
  const setTool = (type, on) => toolsField.onChange(on ? [...new Set([...tools, type])] : tools.filter((t) => t !== type));
  const booking = field('calendar.booking_enabled');
  const transfers = field('call_behaviour.transfer_numbers');
  return (
    <Section title="Actions and integrations">
      <SwitchField label="Book meetings in the calendar" checked={booking.value} onChange={booking.onChange} readOnly={readOnly}
        path="calendar.booking_enabled" hint="Books only real free slots from your connected calendar." />
      <p className="text-sm"><Link to="/settings/calendar" className="underline">Calendar connection</Link></p>
      {payload?.calendar?.booking_enabled && (
        <TextField label="Meeting length (minutes)" type="number" {...field('calendar.meeting_length_minutes')} />
      )}
      <SwitchField label="Send the product brochure when asked" checked={tools.includes(TOOL_BROCHURE)} readOnly={readOnly}
        path="call_behaviour.tools" onChange={(on) => setTool(TOOL_BROCHURE, on)} />
      <SwitchField label="Arrange callbacks" checked={tools.includes(TOOL_CALLBACK)} readOnly={readOnly}
        path="call_behaviour.tools" onChange={(on) => setTool(TOOL_CALLBACK, on)} />
      <ListField label="Human transfer numbers" max={3} addLabel="Add a number" placeholder="+919876543210" maxLength={20}
        hint="In international format (E.164)." {...transfers} values={transfers.value || []} />
    </Section>
  );
}

// ── 6. Rules and guardrails ──

export function RulesStep({ agentType, field }) {
  return (
    <Section title="Rules and guardrails">
      <div>
        <p className="text-sm font-medium">Always on</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Platform rules">
          {PLATFORM_RULES.map((rule) => (
            <li key={rule}><Badge variant="outline" className="text-xs">{rule}</Badge></li>
          ))}
        </ul>
      </div>
      {agentType === 'sdr_outbound' && (
        <>
          <WindowField label="Calling window" emptyLabel="Only your organisation's outer calling bound applies"
            hint="Campaigns must call inside it." {...field('calling.window')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Maximum attempts per lead" type="number" {...field('calling.max_attempts_per_lead')} />
            <TextField label="Minimum gap after no answer (minutes)" type="number" hint="Between 120 and 240."
              {...field('calling.retry_no_answer_minutes')} />
          </div>
        </>
      )}
      <TextField label="Recording disclosure" multiline maxLength={300}
        hint="What the agent says about the call being recorded." {...field('guardrails.recording_disclosure')} />
      <ListField label="Never say" addLabel="Add a phrase" maxLength={200} max={20} {...field('guardrails.never_say')}
        values={field('guardrails.never_say').value || []} />
    </Section>
  );
}

// ── 7. Call behaviour (Advanced) ──

export function BehaviourStep({ payload, field, platform }) {
  const silence = platform?.silence_timeout_seconds;
  return (
    <details className="rounded-2xl border border-border bg-card p-5 sm:p-6" open={false}>
      <summary className="cursor-pointer text-sm font-semibold">Advanced: call behaviour</summary>
      <div className="mt-4 space-y-4">
        <TextField label="Voicemail message" multiline maxLength={500} {...field('call_behaviour.voicemail_message')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Maximum call length (seconds)" type="number" hint="60 to 1800. Empty: the platform's default."
            {...field('call_behaviour.max_duration_seconds')} />
          <div data-testid="silence-timeout">
            <ReadOnlyValue label="Hang up after silence" value={silence != null ? `${silence} seconds` : null}
              note="Set by the platform" />
          </div>
          <SelectField label="Sales approach" options={withCurrent(APPROACHES, payload?.sales_approach)} placeholder="Not set"
            {...field('sales_approach')} />
          <SelectField label="Conversation length" options={withCurrent(LENGTHS, payload?.conversation_length)} placeholder="Not set"
            {...field('conversation_length')} />
        </div>
        <TextField label="Target customer" maxLength={300} {...field('target_customer')} />
        <TextField label="End-of-call message" maxLength={300} {...field('call_behaviour.end_call_message')} />
        <TextField label="Extra instructions" multiline maxLength={MAX_CUSTOM_INSTRUCTIONS} counter
          hint={`At most ${MAX_CUSTOM_INSTRUCTIONS} characters: what a call carries.`} {...field('guardrails.custom_instructions')} />
        {(payload?.guardrails?.custom_instructions || '').length > MAX_CUSTOM_INSTRUCTIONS && (
          <p role="status" className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="instructions-over">
            Calls use only the first {MAX_CUSTOM_INSTRUCTIONS} characters (now {(payload.guardrails.custom_instructions || '').length}). Shorten it to publish.
          </p>
        )}
      </div>
    </details>
  );
}

// ── 8. Review and test ──

/** Step 8's preview: the server's, for this version (none for a version that is neither draft nor published). */
function ReviewPreview({ agentType, versionNumber, refreshKey }) {
  const state = useCallPreview(() => previewAgentInstance(agentType, { version_n: versionNumber }),
    `${agentType}:${versionNumber}:${refreshKey}`, { enabled: versionNumber != null });
  if (versionNumber == null) return null;
  return <CallPreviewView {...state} title={agentType === 'sdr_outbound' ? 'Opening line' : 'New-caller greeting'} />;
}

export function ReviewStep({ agentType, payload, context, versionNumber, refreshKey }) {
  const problems = Object.values(publishProblems(payload, agentType));
  return (
    <Section title="Review and test">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Company</dt><dd>{context.business?.company_name || '—'}</dd>
        <dt className="text-muted-foreground">Persona</dt>
        <dd>{payload?.persona?.name || '—'}{payload?.persona?.gender ? ` (${payload.persona.gender})` : ''}</dd>
        <dt className="text-muted-foreground">Languages</dt>
        <dd>{languageNames([payload?.languages?.primary, ...(payload?.languages?.supported || [])].filter((v, i, a) => v && a.indexOf(v) === i), context.languages) || '—'}</dd>
        <dt className="text-muted-foreground">Tone</dt><dd>{payload?.tone || '—'}</dd>
        {agentType === 'sdr_outbound' && (
          <>
            <dt className="text-muted-foreground">Qualification</dt>
            <dd>{(payload?.qualification_questions || []).filter(Boolean).length} questions</dd>
            <dt className="text-muted-foreground">Calling window</dt>
            <dd>{payload?.calling?.window ? `${payload.calling.window.days.join(', ')} ${payload.calling.window.start_time}–${payload.calling.window.end_time}` : 'Outer bound only'}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Calendar booking</dt><dd>{payload?.calendar?.booking_enabled ? 'On' : 'Off'}</dd>
      </dl>
      <ReviewPreview agentType={agentType} versionNumber={versionNumber} refreshKey={refreshKey} />
      <div>
        <p className="text-sm font-medium">Checks</p>
        {problems.length === 0 ? (
          <p className="mt-1 text-sm text-emerald-600">Everything needed to publish is filled in.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-red-600" data-testid="publish-problems">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
      <GapNote>Test calls (“Call me”) are not available yet.</GapNote>
    </Section>
  );
}

export const STEP_PANELS = {
  business: BusinessStep, catalog: CatalogStep, identity: IdentityStep, campaign_defaults: CampaignDefaultsStep,
  inbound: InboundStep, actions: ActionsStep, rules: RulesStep, behaviour: BehaviourStep, review: ReviewStep,
};
