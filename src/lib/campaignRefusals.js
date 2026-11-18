// Why a campaign paused or skipped leads before dialling, in plain words with where to fix it.
// Codes from the backend's dialer (calls/dialer.py): agent_not_ready, no_caller_id and call_context_key_not_set pause
// the campaign
// (campaigns.pause_reason_code); call_variables_missing skips a contact (skip_reason missing_call_details).
// The detail ("missing: company_name, agent_name") is always the server's own text.

import { agentConfigRoute } from '@/lib/agents';
import { canConfigureAgents, isSuperAdmin } from '@/lib/rbac';

export const REFUSALS = Object.freeze({
  agent_not_ready: {
    title: "Your agent isn't ready",
    fix: (user) => (canConfigureAgents(user)
      ? { label: 'Open agent configuration', to: agentConfigRoute('sdr_outbound') }
      : { label: 'Ask a Manager or Tenant Admin to finish the agent setup' }),
  },
  no_caller_id: {
    title: 'No caller ID number is set for this account',
    fix: (user) => (isSuperAdmin(user)
      ? { label: 'Open phone numbers', to: '/admin/tenants' }
      : { label: 'Contact your platform administrator to assign a phone number' }),
  },
  shared_assistants_off: {
    title: 'Shared assistants were turned off for this account',
    fix: () => ({ label: 'Choose an assistant for this campaign, or ask your admin to turn shared assistants back on' }),
  },
  // CALL_CONTEXT_KEYS is not set on the platform: nothing the tenant can fix.
  call_context_key_not_set: {
    title: "Calls can't be placed: the platform's call signing isn't set up",
    fix: () => ({ label: 'Contact your platform administrator, then Resume the campaign' }),
  },
  missing_call_details: {
    title: 'Some leads were skipped because details are missing',
    fix: () => ({ label: 'Open prospects', to: '/leads' }),
  },
});

// call_variables_missing (the dial refusal) is recorded on the contact as missing_call_details.
const CODE_ALIASES = Object.freeze({ call_variables_missing: 'missing_call_details' });
const canonical = (code) => CODE_ALIASES[code] || code;

/**
 * The refusals to show for a campaign and its contacts: [{ code, title, detail, count?, fix }].
 * `detail` is the server's text (the latest transition's reason, or the contacts' last errors).
 */
export function campaignRefusals(campaign, contacts = [], user = null) {
  if (!campaign) return [];
  const found = [];
  const pause = canonical(campaign.pause_reason_code);
  if (campaign.status === 'paused' && campaign.paused_by_kind !== 'user' && REFUSALS[pause] && pause !== 'missing_call_details') {
    found.push({ code: pause, title: REFUSALS[pause].title, detail: campaign.last_transition?.reason_text || null,
      fix: REFUSALS[pause].fix(user) });
  }
  const skipped = (contacts || []).filter((c) => canonical(c.skip_reason) === 'missing_call_details');
  if (skipped.length) {
    const details = [...new Set(skipped.map((c) => c.last_error).filter(Boolean))];
    found.push({ code: 'missing_call_details', title: REFUSALS.missing_call_details.title, count: skipped.length,
      detail: details.join(' · ') || null, fix: REFUSALS.missing_call_details.fix(user) });
  }
  return found;
}

// Pause reasons that mean no call of the tenant can be placed until someone fixes the account (Agents-page banner).
export const ACCOUNT_REFUSALS = Object.freeze(['agent_not_ready', 'no_caller_id', 'shared_assistants_off',
  'call_context_key_not_set']);

/**
 * Why calling is blocked for the account right now, from real facts only: [{ code, title, fix }].
 *
 * sharedMode: the tenant's shared_assistants switch; outboundUsable: Outbound SDR is in the plan; published: the
 * Outbound SDR setup is published (true / false, or null when the role cannot read it); numbers: the tenant's numbers
 * (null: not loaded); platformCallerId: allow_platform_caller_id; campaigns: the campaign list (pause_reason_code).
 * A number without an E.164 value is not a problem (Vapi still knows it by id).
 */
export function accountReadiness({ sharedMode, outboundUsable, published, numbers, platformCallerId, campaigns = [], user }) {
  const issues = [];
  const add = (code, title, fix) => { if (!issues.some((i) => i.code === code)) issues.push({ code, title, fix }); };
  if (sharedMode && outboundUsable) {
    if (published === false) {
      add('not_published', 'Publish your Outbound SDR agent to start calling',
        canConfigureAgents(user) ? { label: 'Open agent setup', to: agentConfigRoute('sdr_outbound') } : { label: 'Ask a Manager or Tenant Admin to publish it' });
    }
    if (Array.isArray(numbers) && numbers.length === 0 && !platformCallerId) {
      add('no_caller_id', REFUSALS.no_caller_id.title, REFUSALS.no_caller_id.fix(user));
    }
  }
  (campaigns || []).forEach((c) => {
    const code = c.pause_reason_code;
    if (c.status === 'paused' && c.paused_by_kind !== 'user' && ACCOUNT_REFUSALS.includes(code)) {
      add(code, REFUSALS[code].title, REFUSALS[code].fix(user));
    }
  });
  return issues;
}
