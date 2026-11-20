/**
 * Where each catalog agent lives in the app.
 *
 * The backend decides which agents a user may use (`GET /api/v1/agents/available`); this only says which
 * screen opens an agent. An agent with no entry here is listed but cannot be opened yet, so a newly added
 * agent never produces a broken link.
 */
export const AGENT_ROUTES = Object.freeze({
  // Outbound SDR: its catalog row keeps the legacy key `sdr`; the agent type is `sdr_outbound`.
  sdr: '/voice_agent',
  sdr_outbound: '/voice_agent',
  // Inbound SDR runs on SDR's pack but has its own configuration screen (no campaigns).
  sdr_inbound: '/agents/sdr_inbound',
  hiring: '/hiring_agent',
  real_estate: '/real_estate_agent',
});

export const agentRoute = (agent) => AGENT_ROUTES[agent?.key] || null;

/** Old agent keys the backend still accepts for an agent type (registry `legacy_keys`). */
export const LEGACY_AGENT_KEYS = Object.freeze({ sdr: 'sdr_outbound' });

/** The agent type for a catalog key or agent type key: `sdr` -> `sdr_outbound`; anything else as it is. */
export const canonicalAgentType = (key) => (key ? LEGACY_AGENT_KEYS[key] || key : null);

export const AGENT_TYPE_LABELS = Object.freeze({
  sdr_outbound: 'Outbound SDR',
  sdr_inbound: 'Inbound SDR',
  hiring: 'Hiring',
  real_estate: 'Real Estate',
});

/** "Outbound SDR" for `sdr` or `sdr_outbound`; an unknown type is shown as it is. */
export const agentTypeLabel = (key) => AGENT_TYPE_LABELS[canonicalAgentType(key)] || key || 'Unknown';

/** Agent types configured through agent instances (Hiring and Real Estate keep their own screens). */
export const CONFIGURABLE_AGENT_TYPES = Object.freeze(['sdr_outbound', 'sdr_inbound']);
export const isConfigurableAgentType = (key) => CONFIGURABLE_AGENT_TYPES.includes(canonicalAgentType(key));

/** Where an agent type's configuration opens. */
export const agentConfigRoute = (key) => `/agents/${canonicalAgentType(key)}`;

/** Shared assistants built from a pack template (`.../versions/from-template`): SDR's two agent types. */
export const hasSharedAssistantTemplate = (agent) => isConfigurableAgentType(agent?.key);

/**
 * The agent type of a call log: its `agent_type` when the API sends it, else the old `agent` key, else (only SDR's
 * calls are listed on /api/call-logs) the backend's own backfill rule: inbound -> Inbound SDR, otherwise Outbound SDR.
 */
export function callAgentType(log) {
  if (!log) return null;
  if (log.agent_type) return canonicalAgentType(log.agent_type);
  if (log.agent) return canonicalAgentType(log.agent);
  return log.direction === 'inbound' ? 'sdr_inbound' : 'sdr_outbound';
}

/** The catalog row of Outbound SDR that Inbound SDR follows (`AgentResponse.follows`). */
export const FOLLOWED_AGENT_LABELS = Object.freeze({ sdr: 'Outbound SDR' });
export const followsLabel = (agent) => (agent?.follows ? `Follows ${FOLLOWED_AGENT_LABELS[agent.follows] || agent.follows}` : null);

/** Inbound SDR can follow Outbound SDR again once its access was set directly. */
export const canFollowAgain = (agent) => agent?.key === 'sdr_inbound' && !agent?.follows;

export const AGENT_STATUS_LABELS = Object.freeze({ draft: 'Draft', active: 'Active', retired: 'Retired' });

/** What a Super Admin may change a status to; an agent only reaches tenants while it is active. */
export const AGENT_STATUS_ACTIONS = Object.freeze({
  draft: ['active'],
  active: ['draft', 'retired'],
  retired: ['active'],
});

/** `GET /api/v1/agents/{id}/health` problem codes, in words.  An unknown code is shown as it is. */
export const AGENT_PROBLEM_LABELS = Object.freeze({
  no_code_pack: 'No code for this agent on this server',
  vapi_not_configured: 'Vapi is not configured',
  phone_number_not_configured: 'No calling phone number is configured',
  server_url_not_public_https: 'The server URL is not a public HTTPS address, so Vapi cannot reach it',
  webhook_secret_not_set: 'The Vapi webhook secret is not set',
  campaign_runner_disabled: 'Campaign runner is off on this server',
  call_context_key_not_set: 'The call-context signing key is not set',
  intake_assistant_not_registered: 'No intake assistant is registered',
  recovery_not_running: 'Call recovery is not running (the campaign runner is off)',
  outbound_assistant_not_registered: 'No outbound assistant is registered',
  assistant_version_not_imported: "The assistant's version 1 has not been imported",
});

export const problemLabel = (code) => AGENT_PROBLEM_LABELS[code] || code;

/** One health answer as the catalog shows it: `ready`, `attention`, `no_code`, or `unknown` (the check failed). */
export const healthState = (health) => {
  if (!health) return 'unknown';
  if (!health.has_code) return 'no_code';
  return health.ok ? 'ready' : 'attention';
};

export const accessSummary =(agent) => (agent?.access_scope === 'all' ? 'All organisations' : 'Selected organisations');

/** Shared assistant version statuses, as the versions dialog shows them. */
export const VERSION_STATUS_LABELS = Object.freeze({ published: 'Live', draft: 'Draft', superseded: 'Earlier live' });

/** The editor's text as a draft payload: `{ payload }`, or `{ error }` saying why it can't be saved. */
/** The ``model.toolIds`` of the assistant JSON in ``text``, or null when the text is not a JSON object. */
export const toolIdsIn = (text) => {
  const parsed = parseAssistantJson(text);
  if (parsed.error) return null;
  const ids = parsed.payload.model?.toolIds;
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
};

/** ``text`` with ``vapiToolId`` added to (``on``) or removed from ``model.toolIds``; null when not valid JSON.
 * The rest of the JSON is kept as it is (re-indented). */
export const withToolId = (text, vapiToolId, on) => {
  const parsed = parseAssistantJson(text);
  if (parsed.error) return null;
  const payload = parsed.payload;
  const model = payload.model && typeof payload.model === 'object' && !Array.isArray(payload.model) ? payload.model : {};
  const current = Array.isArray(model.toolIds) ? model.toolIds : [];
  const toolIds = on ? (current.includes(vapiToolId) ? current : [...current, vapiToolId])
    : current.filter((id) => id !== vapiToolId);
  return JSON.stringify({ ...payload, model: { ...model, toolIds } }, null, 2);
};

export const parseAssistantJson = (text) => {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    return { error: "That isn't valid JSON" };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { error: 'The assistant must be a JSON object' };
  if (Object.keys(payload).length === 0) return { error: 'The assistant JSON is empty' };
  return { payload };
};
