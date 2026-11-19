/**
 * The Real Estate agent's words and rules on the frontend (backend: app/agents/real_estate).
 *
 * A call's states and outcomes read exactly as Hiring's (the backend keeps them the same way), so those are shared
 * from lib/hiring. The backend enforces every rule; this only says how its values read and what the form checks.
 */
import {
  CALL_STATUS, callOutcome, isCallActive, isForbidden, isNotFound, newKey, statusOf,
} from '@/lib/hiring';

export { CALL_STATUS, callOutcome, isCallActive, isForbidden, isNotFound, newKey, statusOf };

// The agent's catalog key (backend MANIFEST.key). An agent key, not the real estate vertical preset.
export const REAL_ESTATE_AGENT_KEY = 'real_estate';
export const REAL_ESTATE_PATH = '/real_estate_agent';
export const NEW_CALL_PATH = `${REAL_ESTATE_PATH}/new`;
export const CALLS_PATH = `${REAL_ESTATE_PATH}/calls`;
export const callPath = (id) => `${CALLS_PATH}/${id}`;

export const NOT_AVAILABLE = 'Real Estate is not available to your organisation';

// The backend's limit (app/agents/real_estate/models.py MAX_KNOWLEDGE_BASE_CHARS).
export const MAX_KNOWLEDGE_BASE_CHARS = 20000;
// Files read into the knowledge base as text in the browser.
export const KNOWLEDGE_BASE_FILE_TYPES = '.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json';

export const PAGE_SIZE = 50;
export const MAX_ROWS = 200;
export const LIVE_REFRESH_MS = 5000;
export const IDLE_REFRESH_MS = 30000;

const NOT_SET_UP = 'Real Estate calls are not set up yet. Ask your platform administrator.';
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

// What to do after "Call now" is refused (POST /calls, detail.code). The message is the backend's.
const REFUSAL_HINT = Object.freeze({
  invalid_phone: 'Check the number. Without a country code, your organisation\'s region is used.',
  call_in_progress: 'Wait for that call to end: the Calls tab updates on its own.',
  calls_not_set_up: 'Ask your platform administrator to finish setting up Real Estate calls.',
  not_configured: 'Ask your platform administrator to finish setting up Real Estate calls.',
  call_context_unavailable: 'Ask your platform administrator to finish setting up Real Estate calls.',
  knowledge_base_too_long: `Shorten the knowledge base to ${MAX_KNOWLEDGE_BASE_CHARS.toLocaleString()} characters.`,
});

/** Why the call was not placed, is unconfirmed, or never ended properly; null when nothing went wrong. */
export function callProblem(call) {
  if (!call.failure_code) return null;
  return CALL_FAILURE[call.failure_code]
    || (call.status === 'unknown_dispatch' ? UNCONFIRMED : 'The call could not be placed.');
}

/** The form's problem before sending, or null. The backend checks the same and the phone number. */
export function formProblem(form) {
  if (!form.lead_name.trim()) return "Enter the lead's name.";
  if (!form.phone_number.trim()) return 'Enter a phone number.';
  if (form.knowledge_base.length > MAX_KNOWLEDGE_BASE_CHARS) {
    return `The knowledge base can be at most ${MAX_KNOWLEDGE_BASE_CHARS.toLocaleString()} characters.`;
  }
  return null;
}

/** A refused or failed call: `{ message, hint }`, from the backend's code and message. */
export function callRefusal(error) {
  const detail = error?.response?.data?.detail;
  const code = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.code : null;
  let message = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.message : detail;
  if (Array.isArray(detail)) message = 'Check the name, phone number and knowledge base.';
  return { message: message || CALL_FAILURE[code] || 'The call could not be placed.', hint: REFUSAL_HINT[code] || null };
}

/** The toast after "Call now" got an answer: 201 placed, 200 that submit's call again, 202 unconfirmed. */
export function callStarted(status, name) {
  if (status === 202) return { kind: 'warning', text: UNCONFIRMED };
  if (status === 200) return { kind: 'info', text: 'That call was already placed.' };
  return { kind: 'success', text: `Calling ${name}` };
}

export const refreshInterval = (call) => (call && isCallActive(call) ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);
