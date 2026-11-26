/**
 * The Hiring agent's words and rules on the frontend (backend: app/agents/hiring).
 *
 * The backend enforces every rule; this only says how its values read and what a form checks before sending.
 */

export const MAX_INTAKE_QUESTIONS = 8;
export const MAX_SCREENING_QUESTIONS = 15;
// The longest job description the backend takes (characters).
export const JD_MAX_CHARS = 20000;
// Lists load this many rows at a time, up to the backend's cap.
export const PAGE_SIZE = 50;
export const MAX_ROWS = 200;

/** The resume sections an intake question can fill (backend app/agents/hiring/resume_spec.py), in resume order. */
export const RESUME_SECTIONS = Object.freeze([
  { key: 'introduction', label: 'Profile & Career Overview' },
  { key: 'education', label: 'Education & Learning' },
  { key: 'experience', label: 'Work & Professional Experience' },
  { key: 'projects', label: 'Projects, Assignments & Key Contributions' },
  { key: 'skills', label: 'Skills & Competencies' },
  { key: 'achievements', label: 'Achievements & Recognition' },
  { key: 'certifications_and_awards', label: 'Certifications, Licenses & Credentials' },
]);
export const sectionLabel = (key) => RESUME_SECTIONS.find((section) => section.key === key)?.label || null;

/** The four categories a resume is scored on, with what each looks at. Weights are percent and add up to 100. */
export const RESUME_CATEGORIES = Object.freeze([
  { key: 'skills_match', label: 'Skills match', hint: 'Skills the job asks for that the resume shows' },
  { key: 'experience_match', label: 'Experience match', hint: 'Roles and years that fit the job' },
  { key: 'qualifications', label: 'Qualifications', hint: 'Education, licences and certificates' },
  { key: 'keyword_presence', label: 'Keyword presence', hint: "The job description's key terms" },
]);
export const equalWeights = () => Object.fromEntries(RESUME_CATEGORIES.map(({ key }) => [key, 25]));
export const weightsTotal = (weights) => RESUME_CATEGORIES.reduce((sum, { key }) => sum + (Number(weights?.[key]) || 0), 0);
export const sameWeights = (a, b) => RESUME_CATEGORIES.every(({ key }) => Number(a?.[key]) === Number(b?.[key]));

/** `total` split over `values` in proportion to them (equally when they are all zero), as whole numbers adding up to
 *  `total` exactly: each share is rounded down, then the leftovers go to the largest fractions, first come first. */
function distribute(total, values) {
  if (values.length === 0) return [];
  const sum = values.reduce((acc, value) => acc + value, 0);
  const exact = values.map((value) => (sum > 0 ? (value * total) / sum : total / values.length));
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((acc, share) => acc + share, 0);
  exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => { if (left > 0) { shares[index] += 1; left -= 1; } });
  return shares;
}

/**
 * The weights after the user sets `key` to `value`: whole numbers from 0 to 100 that always add up to exactly 100.
 *
 * Weights the user has already set (`fixed`) stay as they are; the ones not set yet share what is left, in
 * proportion to what they hold now, so 40/30/20/10 can be reached by setting the first three. When nothing is free
 * (all four have been set, or the fixed ones leave nothing for the rest), the other three are scaled in proportion
 * instead and only `key` stays set. Returns `{ weights, fixed }`; pass `fixed` back with the next change.
 */
export function rebalanceWeights(weights, key, value, fixed = []) {
  const keys = RESUME_CATEGORIES.map((category) => category.key);
  const own = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  const others = keys.filter((other) => other !== key);
  const held = others.filter((other) => fixed.includes(other));
  const free = others.filter((other) => !fixed.includes(other));
  const current = (other) => Math.max(0, Number(weights?.[other]) || 0);
  const remaining = 100 - own - held.reduce((sum, other) => sum + current(other), 0);
  const next = { [key]: own };
  if (free.length > 0 && remaining >= 0) {
    held.forEach((other) => { next[other] = current(other); });
    distribute(remaining, free.map(current)).forEach((share, index) => { next[free[index]] = share; });
    return { weights: next, fixed: [...new Set([...held, key])] };
  }
  distribute(100 - own, others.map(current)).forEach((share, index) => { next[others[index]] = share; });
  return { weights: next, fixed: [key] };
}

/** A weights form's problem before sending, or null. The backend checks the same. */
export function weightsProblem(weights) {
  for (const { key, label } of RESUME_CATEGORIES) {
    const value = Number(weights?.[key]);
    if (weights?.[key] === '' || !Number.isInteger(value) || value < 0 || value > 100) {
      return `${label} must be a whole number from 0 to 100.`;
    }
  }
  const total = weightsTotal(weights);
  return total === 100 ? null : `The weights add up to ${total}; they must add up to 100.`;
}

/** label + tone (components/ops/StatusBadge) for each backend value. An unknown value is shown as it is. */
export const JOB_STATUS = Object.freeze({
  open: { label: 'Open', tone: 'good' },
  closed: { label: 'Closed', tone: 'neutral' },
});

export const CONSENT_STATUS = Object.freeze({
  unknown: { label: 'Not recorded', tone: 'warn' },
  granted: { label: 'Granted', tone: 'good' },
  withdrawn: { label: 'Withdrawn', tone: 'bad' },
});

export const BOOKING_STATUS = Object.freeze({
  draft: { label: 'Not called yet', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'accent' },
  incomplete: { label: 'Incomplete', tone: 'warn' },
  needs_review: { label: 'Needs review', tone: 'warn' },
  completed: { label: 'Completed', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'bad' },
  no_show: { label: 'No show', tone: 'warn' },
});

export const statusOf = (map, value) => map[value] || { label: value, tone: 'neutral' };

export const candidateName = (candidate) =>
  [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ');

/** A fresh key for one user action (create a booking, place a call), kept across retries of that same action. */
export function newKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context (https or localhost); a dev server on a LAN address has none.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The question set as the backend takes it: trimmed, 1 to 8, none blank. `{ questions }` or `{ error }`. */
export function checkQuestions(texts) {
  const questions = texts.map((text) => text.trim());
  if (questions.length === 0) return { error: 'Add at least one question.' };
  if (questions.length > MAX_INTAKE_QUESTIONS) return { error: `At most ${MAX_INTAKE_QUESTIONS} questions.` };
  if (questions.some((text) => !text)) return { error: 'A question cannot be empty.' };
  return { questions };
}

/** Screening questions as the backend takes them: trimmed, up to 15, none blank, and an empty set is allowed. */
export function checkScreeningQuestions(texts) {
  const questions = texts.map((text) => text.trim());
  if (questions.length > MAX_SCREENING_QUESTIONS) return { error: `At most ${MAX_SCREENING_QUESTIONS} questions.` };
  if (questions.some((text) => !text)) return { error: 'A question cannot be empty.' };
  return { questions };
}

/**
 * A candidate form's problem before sending, or null. The backend checks the same and the phone number.
 * A candidate made from a resume with no usable number may be edited without one (`phoneOptional`): they cannot be
 * called until it is added.
 */
export function candidateProblem(form, phoneOptional = false) {
  if (!form.first_name.trim()) return 'First name is required.';
  if (!phoneOptional && !form.phone_number.trim()) return 'Phone number is required.';
  if (form.consent_status === 'granted' && !form.consent_source.trim()) {
    return 'Say how consent was given (for example "application form").';
  }
  return null;
}

/** A 403 from a Hiring route: the backend's reason (agent not available, or no permission). */
export const isForbidden = (error) => error?.response?.status === 403;
export const isNotFound = (error) => error?.response?.status === 404;

export const HIRING_BOOKINGS_PATH = '/hiring_agent/bookings';
export const bookingPath = (id) => `${HIRING_BOOKINGS_PATH}/${id}`;

// ── Calls (backend app/agents/hiring/calls.py, results.py, recovery.py) ──

// Calls per booking that may reach the candidate; a call that was definitely not placed does not count.
export const MAX_CALL_ATTEMPTS = 3;
const CALLABLE_BOOKING_STATUSES = ['draft', 'scheduled', 'incomplete', 'needs_review'];
const ACTIVE_CALL_STATUSES = ['dialing', 'in_progress', 'unknown_dispatch'];

// A booking page refreshes every 5 s while a call runs or its summary is awaited, otherwise as the lists do.
export const LIVE_REFRESH_MS = 5000;
export const IDLE_REFRESH_MS = 30000;

/** One call attempt. */
export const CALL_STATUS = Object.freeze({
  dialing: { label: 'Dialling', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  dial_failed: { label: 'Not placed', tone: 'bad' },
  unknown_dispatch: { label: 'Not confirmed yet', tone: 'warn' },
});

/** How the call went (the platform's call outcome), and the live states while it runs. */
const CALL_OUTCOME = Object.freeze({
  answered: { label: 'Answered', tone: 'good' },
  no_answer: { label: 'No answer', tone: 'warn' },
  busy: { label: 'Busy', tone: 'warn' },
  voicemail: { label: 'Voicemail', tone: 'warn' },
  not_reachable: { label: 'Not reachable', tone: 'bad' },
  error: { label: 'Call error', tone: 'bad' },
  unknown: { label: 'Outcome unknown', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  ringing: { label: 'Ringing', tone: 'info' },
  'in-progress': { label: 'On the call', tone: 'info' },
});

/**
 * The interview result, only from the backend's decision: an answered call is never shown as a completed
 * interview unless the result says so.
 */
export const INTERVIEW_RESULT = Object.freeze({
  completed: { label: 'Interview completed', tone: 'good' },
  incomplete: { label: 'Interview incomplete', tone: 'warn' },
  not_interviewed: { label: 'Not interviewed', tone: 'neutral' },
  needs_review: { label: 'Needs review', tone: 'warn' },
});
const AWAITING_RESULT = Object.freeze({ label: 'Waiting for the summary', tone: 'info' });

export const QUESTION_RESULT = Object.freeze({
  answered: { label: 'Answered', tone: 'good' },
  declined: { label: 'Declined', tone: 'neutral' },
  not_asked: { label: 'Not asked', tone: 'warn' },
});

// Why a result needs a person (as the backend's notifications word it, app/agents/hiring/notices.py).
const RESULT_PROBLEM = Object.freeze({
  summary_missing: 'The call summary has no answers.',
  summary_unreadable: 'The call summary could not be read.',
  unknown_question: "The call summary does not match the call's questions.",
  duplicate_question: "The call summary does not match the call's questions.",
  summary_timeout: 'No call summary arrived.',
  snapshot_missing: "The call's questions were not saved.",
});

const NOT_SET_UP = 'Hiring calls are not set up yet. Ask your platform administrator.';
const UNCONFIRMED = 'The call was sent but is not confirmed yet. It is being checked and is never dialled again on its own.';
// A call's failure_code, as words. Codes only: the backend never sends the provider's own message.
const CALL_FAILURE = Object.freeze({
  provider_rejected: 'The phone provider refused the call.',
  provider_unreachable: 'The phone provider could not be reached.',
  no_call_id: 'The phone provider did not confirm the call.',
  not_configured: NOT_SET_UP,
  call_context_unavailable: NOT_SET_UP,
  not_found_at_provider: 'The phone provider has no record of this call, so it was not placed.',
  recovery_gave_up: 'The phone provider never reported how this call ended.',
  timeout: UNCONFIRMED,
  provider_error: UNCONFIRMED,
  unexpected: UNCONFIRMED,
  call_id_conflict: UNCONFIRMED,
});

// What to do after "Call candidate" is refused (POST .../calls, detail.code). The message is the backend's.
const REFUSAL_HINT = Object.freeze({
  consent_required: "Record the candidate's consent on the Candidates tab, then call.",
  invalid_phone: "Correct the candidate's phone number on the Candidates tab.",
  no_questions: 'Add the questions for this round to the job on the Jobs tab, then call.',
  screening_not_set_up: 'Ask your platform administrator to set up the audio screening call.',
  job_closed: 'Reopen the job on the Jobs tab to call.',
  call_in_progress: 'Wait for it to end: this page updates on its own.',
  calls_not_set_up: 'Ask your platform administrator to finish setting up Hiring calls.',
  not_configured: 'Ask your platform administrator to finish setting up Hiring calls.',
  call_context_unavailable: 'Ask your platform administrator to finish setting up Hiring calls.',
});

export const isCallActive = (call) => ACTIVE_CALL_STATUSES.includes(call.status);
export const awaitingResult = (call) => call.status === 'ended' && !call.interview_outcome;

/** The call's outcome badge: how an ended call went, or its live state while it runs; null otherwise. */
export function callOutcome(call) {
  if (call.status !== 'ended' && call.status !== 'in_progress') return null;
  const outcome = CALL_OUTCOME[call.outcome];
  if (!outcome) return null;
  const live = outcome.tone === 'info';
  return call.status === 'ended' ? (live ? null : outcome) : (live ? outcome : null);
}

/** The interview result badge: the backend's result, "waiting" for an ended call without one, else null. */
export function interviewResult(call) {
  if (call.interview_outcome) return statusOf(INTERVIEW_RESULT, call.interview_outcome);
  return awaitingResult(call) ? AWAITING_RESULT : null;
}

/** Why the call was not placed, is unconfirmed, or never ended properly; null when nothing went wrong. */
export function callProblem(call) {
  if (!call.failure_code) return null;
  return CALL_FAILURE[call.failure_code]
    || (call.status === 'unknown_dispatch' ? UNCONFIRMED : 'The call could not be placed.');
}

/** Why a result needs review, in words; null unless it does. */
export function resultProblem(call) {
  if (call.interview_outcome !== 'needs_review') return null;
  return RESULT_PROBLEM[call.result_problem] || 'The call result needs someone to look at it.';
}

export const callsUsed = (calls = []) => calls.filter((call) => call.status !== 'dial_failed').length;

/**
 * Why "Call candidate" is off right now, or null. Only what the page already knows; the backend checks the rest
 * (consent, job, questions, phone number, calling hours) and its refusal is shown.
 */
export function callBlocker(booking, calls = []) {
  if (booking.status === 'completed') return 'This interview is already completed.';
  if (!CALLABLE_BOOKING_STATUSES.includes(booking.status)) {
    return `A ${statusOf(BOOKING_STATUS, booking.status).label.toLowerCase()} booking cannot be called.`;
  }
  if (calls.some((call) => call.status === 'unknown_dispatch')) return 'The last call is still being confirmed.';
  if (calls.some(isCallActive)) return 'A call is in progress.';
  if (callsUsed(calls) >= MAX_CALL_ATTEMPTS) return `This booking has had ${MAX_CALL_ATTEMPTS} calls already.`;
  return null;
}

/** How often a booking page refreshes: often while a call runs or its summary is awaited. */
export const refreshInterval = (calls = []) =>
  (calls.some((call) => isCallActive(call) || awaitingResult(call)) ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);

/** A refused or failed "Call candidate": `{ message, hint }`, from the backend's code and message. */
export function callRefusal(error) {
  const detail = error?.response?.data?.detail;
  const code = detail && typeof detail === 'object' ? detail.code : null;
  const message = (detail && typeof detail === 'object' ? detail.message : detail)
    || CALL_FAILURE[code] || 'The call could not be placed.';
  return { message, hint: REFUSAL_HINT[code] || null };
}

/** The toast after "Call candidate" got an answer: 201 placed, 200 that click's call again, 202 unconfirmed. */
export function callStarted(status, candidate) {
  if (status === 202) return { kind: 'warning', text: UNCONFIRMED };
  if (status === 200) return { kind: 'info', text: 'That call was already placed.' };
  return { kind: 'success', text: `Calling ${candidate}` };
}

// ── Resumes and scores (backend app/agents/hiring/resumes.py, resume_pipeline.py) ──

export const MAX_RESUME_FILES = 30;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const RESUME_EXTENSIONS = ['.pdf', '.docx'];

/** An uploaded resume file's state. It is read in the background, so a new one is "waiting" for a few seconds. */
export const RESUME_STATUS = Object.freeze({
  pending: { label: 'Waiting to be read', tone: 'info' },
  reading: { label: 'Reading…', tone: 'info' },
  read: { label: 'Read', tone: 'good' },
  failed: { label: 'Could not be read', tone: 'bad' },
});

/** A score's state. `failed` and `blocked` carry the backend's reason in words (`failure_message`). */
export const SCORE_STATUS = Object.freeze({
  pending: { label: 'Waiting to score', tone: 'info' },
  scoring: { label: 'Scoring…', tone: 'info' },
  scored: { label: 'Scored', tone: 'good' },
  failed: { label: 'Not scored', tone: 'warn' },
  blocked: { label: 'Not scored', tone: 'bad' },
});

/** What each kind of score is about, in the order a profile shows them. */
export const SCORE_KIND = Object.freeze({
  overall: 'Overall',
  resume: 'Resume',
  ai_resume: 'AI resume (from the intake call)',
  intake: 'Intake call',
  consistency: 'Call matches resume',
  screening: 'Audio screening call',
});

/** Every score is out of 5, as in CFP. */
export const formatScore = (score) => (score === null || score === undefined ? '—' : `${Number(score).toFixed(1)} / 5`);
/** A score's colour: 4 or more is good, 2.5 or more middling, below that poor. */
export const scoreTone = (score) => {
  if (score === null || score === undefined) return 'neutral';
  if (score >= 4) return 'good';
  return score >= 2.5 ? 'warn' : 'bad';
};

/** Still being read or scored: the list refreshes itself until this is false for every row. */
export const resumeBusy = (candidate) => ['pending', 'reading'].includes(candidate?.resume_status)
  || ['pending', 'scoring'].includes(candidate?.resume_score_status);

/** True when a detail was read from the resume by the AI and not typed by a person (so it should be checked). */
export const readFromResume = (candidate, field) => candidate?.detail_sources?.[field] === 'resume';

/**
 * Resume files as the backend takes them: PDF or Word, not empty, up to 5 MB, at most 30 at a time. Returns the
 * usable files and, for each other one, why it was left out. The backend checks the content itself.
 */
export function checkResumeFiles(files) {
  const accepted = [];
  const problems = [];
  Array.from(files).forEach((file) => {
    const lower = file.name.toLowerCase();
    if (!RESUME_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      problems.push({ name: file.name, message: 'Only PDF and Word (.docx) files can be uploaded.' });
    } else if (file.size === 0) {
      problems.push({ name: file.name, message: 'The file is empty.' });
    } else if (file.size > MAX_RESUME_BYTES) {
      problems.push({ name: file.name, message: `The file is larger than ${MAX_RESUME_BYTES / (1024 * 1024)} MB.` });
    } else if (accepted.length >= MAX_RESUME_FILES) {
      problems.push({ name: file.name, message: `At most ${MAX_RESUME_FILES} files at a time.` });
    } else {
      accepted.push(file);
    }
  });
  return { accepted, problems };
}

// ── The pipeline (backend app/agents/hiring/pipeline.py) ──

/** A candidate's round, with the badge to show for it. */
export const STAGE = Object.freeze({
  applied: { label: 'Resume stage', tone: 'neutral' },
  intake_call: { label: 'Intake call', tone: 'info' },
  audio_screening: { label: 'Audio screening', tone: 'accent' },
  selected: { label: 'Selected', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
});

/** The steps a candidate moves through, left to right. The last is a person's decision, not a call. */
export const PIPELINE_STEPS = Object.freeze([
  { id: 'applied', label: 'Resume' },
  { id: 'intake_call', label: 'Intake call' },
  { id: 'audio_screening', label: 'Audio screening' },
  { id: 'decision', label: 'Decision' },
]);

/** Which step a stage is on: a final decision counts as the last step. */
export const stepOf = (stage) => (stage === 'selected' || stage === 'rejected' ? 'decision' : stage);
export const isFinalStage = (stage) => stage === 'selected' || stage === 'rejected';

export const candidatePath = (id) => `/hiring_agent/candidates/${id}`;

/** What a booking's calls are called: its interview type, as the backend names it. */
export const ROUND_LABEL = Object.freeze({ audio: 'Intake call', audio_screening: 'Audio screening call' });

/** Why the pipeline's last action was refused, in the backend's words. */
export const pipelineRefusal = (error) => {
  const detail = error?.response?.data?.detail;
  return (detail && typeof detail === 'object' ? detail.message : detail) || 'That could not be done. Try again.';
};

/** Score states that mean "still being worked out". */
export const WORKING_SCORE = Object.freeze(['pending', 'scoring']);

/** The AI resume's state while it is written from the intake call, and after. */
export const AI_RESUME_STATUS = Object.freeze({
  pending: { label: 'Waiting to be written', tone: 'info' },
  building: { label: 'Writing…', tone: 'info' },
  ready: { label: 'Ready', tone: 'good' },
  failed: { label: 'Not written', tone: 'warn' },
  blocked: { label: 'Not written', tone: 'bad' },
});

/** Scores that come from the intake call: when one fails, writing the AI resume again tries them all again. */
export const CALL_SCORE_KINDS = Object.freeze(['ai_resume', 'intake', 'consistency']);

/** Whether the AI resume is still being written (the screen refreshes until it is not). */
export const aiResumeBusy = (resume) => Boolean(resume) && ['pending', 'building'].includes(resume.status);
