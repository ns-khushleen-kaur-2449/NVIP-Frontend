import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleCallPage from './SingleCallPage';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  getAssistants: jest.fn(), getProspects: jest.fn(), getVoiceCampaigns: jest.fn(), initiateSmartsdrCall: jest.fn(),
  getAgentInstance: jest.fn(), listAvailableAgentTypes: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const SHARED = { features: { agent_instances: true, shared_assistants: true } };
const OWN = { features: { agent_instances: true } };

beforeEach(() => {
  jest.clearAllMocks();
  api.getProspects.mockResolvedValue({ data: { prospects: [{ prospect_id: 'p1', full_name: 'Alex Prospect', phone: '+15551234567' }] } });
  api.getVoiceCampaigns.mockResolvedValue({ data: { campaigns: [{ id: 'c1', name: 'Spring launch' }] } });
  // What /api/v1/assistants really returns: no agent type.
  api.getAssistants.mockResolvedValue({ data: [{ id: 7, name: 'Main agent', vapi_assistant_id: 'own-1', is_live: true }] });
  api.listAvailableAgentTypes.mockResolvedValue({ data: [{ key: 'sdr', agent_type: 'sdr_outbound', usable: true, has_screen: true }] });
  api.getAgentInstance.mockResolvedValue({ data: { published_version: 2 } });
  api.initiateSmartsdrCall.mockResolvedValue({ data: { id: 'call-1' } });
});

const pickProspect = async (user) => {
  await screen.findByRole('option', { name: 'Alex Prospect' });
  await user.selectOptions(screen.getByLabelText('Prospect'), 'p1');
};

test('shared assistants on: the shared Outbound SDR calls, no tenant assistant is sent', async () => {
  const user = userEvent.setup();
  renderWithAuth(<SingleCallPage />, { user: { ...USERS.manager, ...SHARED } });
  await pickProspect(user);
  const button = await screen.findByRole('button', { name: 'Call with Outbound SDR' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(api.initiateSmartsdrCall).toHaveBeenCalledWith({
    phone_number: '+15551234567', user_name: 'Alex Prospect', assistant_id: undefined, prospect_id: 'p1',
  }));
  expect(api.getAssistants).not.toHaveBeenCalled();
});

test('shared assistants on but Outbound SDR not published: the call waits for setup', async () => {
  api.getAgentInstance.mockResolvedValue({ data: { published_version: null } });
  renderWithAuth(<SingleCallPage />, { user: { ...USERS.tenant_admin, ...SHARED } });
  expect(await screen.findByRole('link', { name: 'Set up Outbound SDR' })).toHaveAttribute('href', '/agents/sdr_outbound');
  expect(screen.getByRole('button', { name: 'Call with Outbound SDR' })).toBeDisabled();
});

test('shared assistants off: the call uses one of the tenant\'s own assistants, as before', async () => {
  const user = userEvent.setup();
  renderWithAuth(<SingleCallPage />, { user: { ...USERS.manager, ...OWN } });
  await pickProspect(user);
  await screen.findByRole('option', { name: 'Main agent' });
  await user.click(screen.getByRole('button', { name: 'Start call' }));
  await waitFor(() => expect(api.initiateSmartsdrCall).toHaveBeenCalledWith({
    phone_number: '+15551234567', user_name: 'Alex Prospect', assistant_id: 'own-1', prospect_id: 'p1',
  }));
  expect(api.listAvailableAgentTypes).not.toHaveBeenCalled();
});
