// Agent instances: a tenant's configured agent per agent type, with versions
// (backend app/features/agent_instances, routes /api/v1/agent-instances). Pure helpers; the screens live in
// pages/agentConfig. Every rule here mirrors the backend; the backend enforces them.

import { isSharedMode } from '@/lib/rbac';

// ── State of an agent type on the Agents page ──

export const INSTANCE_STATES = Object.freeze({
  NOT_SET_UP: 'not_set_up',
  DRAFT: 'draft',
  ACTIVE: 'active',
  NOT_IN_PLAN: 'not_in_plan',
});

export const INSTANCE_STATE_LABELS = Object.freeze({
  not_set_up: 'Not set up',
  draft: 'Draft',
  active: 'Active',
  not_in_plan: 'Not in your plan',
});

/** No instance: not set up; a published version: active; only a draft: draft. */
export function instanceState(instance) {
  if (!instance) return INSTANCE_STATES.NOT_SET_UP;
  if (instance.published_version != null || instance.published_version_id) return INSTANCE_STATES.ACTIVE;
  if (instance.draft_version != null) return INSTANCE_STATES.DRAFT;
  return INSTANCE_STATES.NOT_SET_UP;
}

/** First setup is a wizard; once a version was published, the same fields are tabs. */
export const configMode = (instance) => (instance?.published_version != null ? 'tabs' : 'wizard');

export const VERSION_STATUS_LABELS = Object.freeze({ draft: 'Draft', published: 'Published', superseded: 'Superseded' });

/** The message after a publish, from the tenant's shared_assistants flag (never assumed). */
export function publishedModeMessage(user) {
  return isSharedMode(user)
    ? 'Live on your next calls.'
    : 'Saved. Your calls still use the Assistant builder configuration.';
}

// ── Paths into a payload ──

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `obj` at `path` ("persona.name" or ["persona", "name"]); undefined when any step is missing. */
export function getPath(obj, path) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  return parts.reduce((value, key) => (value == null ? undefined : value[key]), obj);
}

/** A copy of `obj` with `value` at `path`; missing objects on the way are created. */
export function setPath(obj, path, value) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  if (parts.length === 0) return value;
  const [head, ...rest] = parts;
  const base = isPlainObject(obj) ? obj : {};
  return { ...base, [head]: rest.length ? setPath(base[head], rest, value) : value };
}

/** Whether every step of `path` exists in `obj` (the key itself may hold null). */
export function hasPath(obj, path) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let value = obj;
  for (const key of parts) {
    if (!isPlainObject(value) || !Object.prototype.hasOwnProperty.call(value, key)) return false;
    value = value[key];
  }
  return true;
}

/** Every leaf path of `obj` (arrays and scalars are leaves), as dotted strings. */
export function leafPaths(obj, prefix = '') {
  if (!isPlainObject(obj)) return prefix ? [prefix] : [];
  const keys = Object.keys(obj);
  if (keys.length === 0) return prefix ? [prefix] : [];
  return keys.flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isPlainObject(obj[key]) && Object.keys(obj[key]).length ? leafPaths(obj[key], path) : [path];
  });
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Paths the server writes or that describe the version itself, never re-applied from an old draft.
const NOT_REAPPLIED = ['source', 'schema_version'];

/**
 * After a rebase: the user's edits re-applied onto the new draft.
 *
 * base: the payload the old draft was made from (its base_version; {} when there was none);
 * previous: the old draft's payload (RebaseResponse.previous_payload);
 * latest: the new draft's payload (a copy of the latest published version).
 *
 * An edit is a leaf where `previous` differs from `base`. It is applied when its path still exists in `latest`
 * (else listed in `dropped`). When `latest` also changed that leaf to something else, the user's value is applied and
 * the path is listed in `conflicts` with both values, so the screen can highlight it.
 */
export function reapplyEdits({ base = {}, previous = {}, latest = {} }) {
  const paths = [...new Set([...leafPaths(previous), ...leafPaths(base)])]
    .filter((path) => !NOT_REAPPLIED.includes(path.split('.')[0]));
  let payload = latest;
  const applied = [];
  const conflicts = [];
  const dropped = [];
  paths.forEach((path) => {
    const yours = getPath(previous, path);
    const original = getPath(base, path);
    if (yours === undefined || same(yours, original)) return;
    if (!hasPath(latest, path)) {
      dropped.push(path);
      return;
    }
    const theirs = getPath(latest, path);
    if (same(theirs, yours)) return;
    payload = setPath(payload, path, yours);
    if (same(theirs, original)) applied.push(path);
    else conflicts.push({ path, yours, theirs, base: original });
  });
  return { payload, applied, conflicts, dropped };
}

// ── Server answers ──

/** The 409 stale-draft refusal's detail ({ code, base_version, published_version, message }), or null. */
export function staleDraft(error) {
  const detail = error?.response?.data?.detail;
  return error?.response?.status === 409 && detail?.code === 'stale_draft' ? detail : null;
}

/** 422 validation errors by field path ("persona.name"), with the server's own message. */
export function fieldErrors(error) {
  const detail = error?.response?.data?.detail;
  if (error?.response?.status !== 422 || !Array.isArray(detail)) return {};
  return detail.reduce((errors, item) => {
    const path = (item.loc || []).filter((part) => part !== 'body' && part !== 'payload').join('.');
    if (path && !errors[path]) errors[path] = item.msg || 'Invalid value';
    return errors;
  }, {});
}

// ── What the platform always does (shown as fixed chips, not editable) ──

export const PLATFORM_RULES = Object.freeze([
  'Do-not-call enforced',
  'No invented prices or dates',
  "Honest if asked 'are you AI?'",
  'Books only real calendar slots',
]);

// Greetings and openings are never rendered here: the server preview builds them (F-08).

// ── Checks before publishing (the backend validates again; these only point at the field) ──

// What a call carries (backend agent_instances/schema.py publish_problems): 3 to 6 questions, 600 characters of extra
// instructions. Older versions may hold more: they still open, with a warning, and cannot be published until trimmed.
export const QUALIFICATION_LIMITS = Object.freeze({ min: 3, max: 6 });
export const MAX_CUSTOM_INSTRUCTIONS = 600;
export const QUESTIONS_OVER_NOTE = `Only the first ${QUALIFICATION_LIMITS.max} are asked on calls. Remove the extra ones to publish.`;

/** Non-blank questions of a list (what a call would ask, before the cap). */
export const askedQuestions = (list) => (list || []).filter((q) => (q || '').trim());

/** { path: message } for what a publish needs; empty when it can go. */
export function publishProblems(payload, agentType) {
  const problems = {};
  if (!(payload?.persona?.name || '').trim()) problems['persona.name'] = 'Give the agent a name';
  if (!payload?.languages?.primary) problems['languages.primary'] = 'Choose the primary language';
  if (agentType === 'sdr_outbound' || agentType === 'sdr_inbound') {
    const questions = (payload?.qualification_questions || []).filter((q) => (q || '').trim());
    const { min, max } = QUALIFICATION_LIMITS;
    if (questions.length < min || questions.length > max) {
      problems.qualification_questions = `Add ${min} to ${max} qualification questions (now ${questions.length})`;
    }
  }
  const instructions = payload?.guardrails?.custom_instructions || '';
  if (instructions.length > MAX_CUSTOM_INSTRUCTIONS) {
    problems['guardrails.custom_instructions'] = `Shorten the extra instructions to ${MAX_CUSTOM_INSTRUCTIONS} characters (now ${instructions.length})`;
  }
  const seconds = payload?.call_behaviour?.max_duration_seconds;
  if (seconds != null && seconds !== '' && !(Number(seconds) >= 60 && Number(seconds) <= 1800)) {
    problems['call_behaviour.max_duration_seconds'] = 'Set the maximum call length between 60 and 1800 seconds, or leave it empty';
  }
  if (agentType === 'sdr_inbound') {
    const overflow = payload?.inbound?.overflow || {};
    if (overflow.mode === 'transfer' && !(overflow.transfer_number || '').trim()) {
      problems['inbound.overflow.transfer_number'] = 'Add the number to transfer to';
    }
  }
  return problems;
}

/** "Hindi, English" from language codes, with the builder's language list when known. */
export function languageNames(codes = [], languages = []) {
  return codes.filter(Boolean).map((code) => {
    const known = languages.find((l) => l.code === code);
    return known?.english_name || known?.name || code;
  }).join(', ');
}

/** The published version's summary for an Agents card: persona, languages, version, last edited. */
export function activeSummary(instance, payload) {
  const langs = [payload?.languages?.primary, ...(payload?.languages?.supported || [])];
  return {
    persona: payload?.persona?.name || null,
    languages: [...new Set(langs.filter(Boolean))],
    version: instance?.published_version ?? null,
    editedAt: instance?.updated_at || null,
  };
}
