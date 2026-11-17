import { screen } from '@testing-library/react';
import CampaignRefusals from '@/components/voice/CampaignRefusals';
import { campaignRefusals } from '@/lib/campaignRefusals';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

const paused = (code, reason) => ({
  status: 'paused', paused_by_kind: 'system', pause_reason_code: code,
  last_transition: { reason_text: reason },
});

describe('refusal reasons', () => {
  test('agent_not_ready: plain words, the server detail, a link to the agent', () => {
    renderWithAuth(<CampaignRefusals user={USERS.manager}
      campaign={paused('agent_not_ready', 'The agent is missing details every call needs: company_name, agent_name')} contacts={[]} />,
    { user: USERS.manager });
    expect(screen.getByText(/Your agent isn't ready/)).toBeInTheDocument();
    expect(screen.getByText('The agent is missing details every call needs: company_name, agent_name')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open agent configuration' })).toHaveAttribute('href', '/agents/sdr_outbound');
  });

  test('agent_not_ready for a Sales Rep: no link they could not use', () => {
    renderWithAuth(<CampaignRefusals user={USERS.rep} campaign={paused('agent_not_ready', 'x')} contacts={[]} />, { user: USERS.rep });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Ask a Manager or Tenant Admin/)).toBeInTheDocument();
  });

  test('no_caller_id: tells a tenant user to contact the administrator', () => {
    renderWithAuth(<CampaignRefusals user={USERS.tenant_admin} campaign={paused('no_caller_id', null)} contacts={[]} />,
      { user: USERS.tenant_admin });
    expect(screen.getByText('No caller ID number is set for this account')).toBeInTheDocument();
    expect(screen.getByText(/Contact your platform administrator/)).toBeInTheDocument();
  });

  test('missing_call_details on contacts: counted, with their errors and a link to prospects', () => {
    const contacts = [
      { skip_reason: 'missing_call_details', last_error: 'Missing call details the assistant needs: lead_first_name' },
      { skip_reason: 'missing_call_details', last_error: 'Missing call details the assistant needs: lead_first_name' },
      { skip_reason: null },
    ];
    renderWithAuth(<CampaignRefusals user={USERS.manager} campaign={{ status: 'running' }} contacts={contacts} />, { user: USERS.manager });
    expect(screen.getByText(/Some leads were skipped because details are missing \(2 leads\)/)).toBeInTheDocument();
    expect(screen.getByText('Missing call details the assistant needs: lead_first_name')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open prospects' })).toHaveAttribute('href', '/leads');
  });

  test('a user pause or another reason shows nothing here', () => {
    expect(campaignRefusals({ ...paused('agent_not_ready', 'x'), paused_by_kind: 'user' }, [])).toEqual([]);
    expect(campaignRefusals(paused('vapi_credits', 'x'), [])).toEqual([]);
    expect(campaignRefusals(null)).toEqual([]);
  });
});
