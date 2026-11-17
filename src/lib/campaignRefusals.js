// Why a campaign paused or skipped leads before dialling, in plain words with where to fix it.
// Codes from the backend's dialer (calls/dialer.py): agent_not_ready and no_caller_id pause the campaign
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
