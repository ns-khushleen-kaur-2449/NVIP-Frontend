// The campaign brief (backend schemas/requests/campaign_brief.py): what one Outbound SDR campaign pitches.
// POST/PATCH /api/campaigns take { goal, priority, brief }; the backend writes the brief into the old pitch fields
// too, and answers with the brief as calls get it plus `brief_sources` ("campaign" or "pitch", per field).

export const MAX_KEY_POINTS = 3;

// The backend's limits (BRIEF_CAPS, the variable builder's caps), used for the inputs' maxLength.
export const BRIEF_LIMITS = Object.freeze({
  name: 255, spokenName: 120, callPurpose: 300, valueProposition: 300, keyPoint: 200,
  objection: 200, response: 500, objections: 10, mustNotSay: 200, mustNotSayItems: 10, offerText: 300,
  whenToMention: 200, products: 8, question: 150, questions: 6,
});

export const GOALS = Object.freeze([
  { value: 'book_meeting', label: 'Book a meeting', help: 'The agent offers real calendar slots and books one.' },
  { value: 'send_brochure', label: 'Send a brochure', help: 'The agent offers to email the product brochure.' },
  { value: 'callback', label: 'Arrange a callback', help: 'The agent agrees a time for someone to call back.' },
  { value: 'qualify_only', label: 'Qualify only', help: 'The agent asks the qualification questions and notes the answers.' },
]);

export const goalLabel = (value) => GOALS.find((g) => g.value === value)?.label || value || '—';

const text = (value) => {
  const trimmed = (value ?? '').toString().trim();
  return trimmed || null;
};
const texts = (values = []) => (values || []).map(text).filter(Boolean);

/** An empty builder form; `questions` are the agent's default qualification questions (inherited). */
export function emptyBriefForm({ questions = [] } = {}) {
  return {
    name: '',
    spokenName: '',
    goal: 'book_meeting',
    priority: null,
    callPurpose: '',
    valueProposition: '',
    keyPoints: [''],
    objections: [],
    mustNotSay: [],
    offer: { enabled: false, text: '', validUntil: '', whenToMention: '' },
    featuredProductIds: [],
    qualification: questions.map((question) => ({ text: question, inherited: question })),
  };
}

/** Whether a qualification row differs from the agent's default at its place (an "Edited" marker). */
export const isOverridden = (row) => row.inherited == null || text(row.text) !== text(row.inherited);

/**
 * The campaign's own questions, in order: the full list when any differs from the agent's defaults (or rows were
 * added or removed), else [] (the agent's defaults apply).
 */
export function qualificationOverrides(rows = [], defaults = []) {
  const list = texts(rows.map((row) => row.text));
  const same = list.length === texts(defaults).length && rows.every((row) => !isOverridden(row));
  return same ? [] : list;
}

/** The brief as the API takes it. A disabled offer keeps its text, date and timing (calls get no offer while off). */
export function serializeBrief(form, { defaultQuestions = [] } = {}) {
  const offer = form.offer || {};
  return {
    spoken_name: text(form.spokenName),
    call_purpose: text(form.callPurpose),
    value_proposition: text(form.valueProposition),
    key_points: texts(form.keyPoints).slice(0, MAX_KEY_POINTS),
    objections: (form.objections || [])
      .map((o) => ({ objection: text(o.objection), answer: text(o.response) }))
      .filter((o) => o.objection && o.answer),
    must_not_say: texts(form.mustNotSay),
    offer: { enabled: Boolean(offer.enabled), text: text(offer.text), valid_until: offer.validUntil || null,
      when_to_mention: text(offer.whenToMention) },
    featured_product_ids: [...(form.featuredProductIds || [])],
    qualification_overrides: qualificationOverrides(form.qualification || [], defaultQuestions),
  };
}

/** The campaign fields for this form: { goal, priority, brief }. */
export function campaignBriefFields(form, options) {
  return { goal: form.goal, priority: form.priority ?? null, brief: serializeBrief(form, options) };
}

/** Required values for a launch, as a checklist: [{ key, label, done }]. */
export function requiredChecklist(form, { leadCount = 0, assistantId = '' } = {}) {
  const items = [
    { key: 'leads', label: 'Leads selected', done: leadCount > 0 },
    { key: 'name', label: 'Campaign name', done: Boolean(text(form.name)) },
    { key: 'goal', label: 'Goal', done: GOALS.some((g) => g.value === form.goal) },
    { key: 'callPurpose', label: 'Call purpose', done: Boolean(text(form.callPurpose)) },
    { key: 'assistant', label: 'Assistant that places the calls', done: Boolean(assistantId) },
  ];
  if (form.offer?.enabled) items.push({ key: 'offerText', label: 'Offer text', done: Boolean(text(form.offer.text)) });
  return items;
}

/** "from old pitch" for brief fields the backend derived from the old pitch columns (`brief_sources`). */
export const fromOldPitch = (sources, field) => sources?.[field] === 'pitch';

const minutes = (hhmm) => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * Where the campaign goes beyond its agent's calling limits (the agent's published `calling`), mirroring the
 * backend's agent_instances.service.calling_limit_conflicts. [] when there are no limits.
 */
export function callingLimitConflicts({ window, attempts }, limits) {
  if (!limits) return [];
  const found = [];
  const allowed = limits.window;
  if (allowed?.days?.length) {
    if (!window?.days?.length) {
      found.push(`The agent calls only ${allowed.days.join(', ')} ${allowed.start_time}–${allowed.end_time}; set a calling window inside it.`);
    } else {
      const extra = window.days.filter((day) => !allowed.days.includes(day));
      if (extra.length) found.push(`Days outside the agent's calling window: ${extra.join(', ')}.`);
      if (minutes(window.start_time) < minutes(allowed.start_time) || minutes(window.end_time) > minutes(allowed.end_time)) {
        found.push(`Hours ${window.start_time}–${window.end_time} go outside the agent's ${allowed.start_time}–${allowed.end_time}.`);
      }
    }
  }
  if (Number.isInteger(attempts) && Number.isInteger(limits.max_attempts_per_lead) && attempts > limits.max_attempts_per_lead) {
    found.push(`${attempts} attempts per lead is more than the agent's ${limits.max_attempts_per_lead}.`);
  }
  return found;
}
