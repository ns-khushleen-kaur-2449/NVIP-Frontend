import { screen, waitFor } from '@testing-library/react';
import AgentsPage from '@/pages/Agents';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listAgentInstances: jest.fn(),
  listAvailableAgentTypes: jest.fn(),
  getAgentCatalog: jest.fn(),
  getAgentInstanceVersion: jest.fn(),
  getBuilderLanguages: jest.fn(),
  listOwnPhoneNumbers: jest.fn(),
}));

const SDR = { id: 'a-1', key: 'sdr', name: 'SmartSDR', industry: 'Sales', description: 'Outbound sales calls' };
const HIRING = { id: 'a-2', key: 'hiring', name: 'Hiring', industry: 'HR', description: 'Screens candidates' };
const ON = { features: { agent_instances: true } };

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [SDR, HIRING] });
  api.listAgentInstances.mockResolvedValue({ data: [
    { id: 'i-1', agent_type: 'sdr_outbound', published_version: 3, draft_version: null, updated_at: '2026-11-17T10:00:00Z' },
  ] });
  api.getAgentInstanceVersion.mockResolvedValue({ data: { payload: { persona: { name: 'Riya' }, languages: { primary: 'hi', supported: ['en'] } } } });
  api.listAvailableAgentTypes.mockResolvedValue({ data: [
    { ...SDR, agent_type: 'sdr_outbound', usable: true, follows: null, has_screen: true },
    { id: 'a-3', key: 'sdr_inbound', name: 'Inbound SDR', agent_type: 'sdr_inbound', usable: true, follows: 'sdr', has_screen: false },
    { ...HIRING, agent_type: 'hiring', usable: true, follows: null, has_screen: true },
  ] });
  api.getAgentCatalog.mockResolvedValue({ data: [
    { ...SDR, agent_type: 'sdr_outbound', usable: true }, { ...HIRING, agent_type: 'hiring', usable: true },
    { id: 'a-9', key: 'real_estate', name: 'Real estate', agent_type: null, usable: false, has_screen: true },
  ] });
  api.getBuilderLanguages.mockResolvedValue({ data: [{ code: 'hi', english_name: 'Hindi' }, { code: 'en', english_name: 'English' }] });
  api.listOwnPhoneNumbers.mockResolvedValue({ data: [{ id: 'number-1', phone_number: '+15550000000', inbound_mode: 'fixed' }] });
});

test('agent_instances off: the cards open the agents\' screens as before, nothing new is asked', async () => {
  renderWithAuth(<AgentsPage />, { user: { ...USERS.manager, features: {} } });
  expect(await screen.findByTestId('agent-card-sdr')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Open' }).map((a) => a.getAttribute('href'))).toEqual(['/voice_agent', '/hiring_agent']);
  expect(api.listAgentInstances).not.toHaveBeenCalled();
  expect(screen.queryByTestId('agent-card-sdr_inbound')).not.toBeInTheDocument();
});

test('a Sales Rep sees the new agent cards without configuration controls', async () => {
  renderWithAuth(<AgentsPage />, { user: { ...USERS.rep, ...ON } });
  expect(await screen.findByTestId('agent-card-sdr_outbound')).toBeInTheDocument();
  expect(screen.getByTestId('agent-state-sdr_outbound')).toHaveTextContent('Managed by your admin');
  expect(screen.queryByRole('link', { name: 'Set up agent' })).not.toBeInTheDocument();
  expect(api.listAgentInstances).not.toHaveBeenCalled();
});

test('agent_instances on: a state per agent type; Hiring unchanged', async () => {
  renderWithAuth(<AgentsPage />, { user: { ...USERS.manager, ...ON } });
  expect(await screen.findByTestId('agent-state-sdr_outbound')).toHaveTextContent('Active');
  const outbound = screen.getByTestId('agent-card-sdr_outbound');
  expect(outbound).toHaveTextContent('Riya');
  expect(outbound).toHaveTextContent('Hindi, English');
  expect(outbound).toHaveTextContent('v3');
  expect(screen.getByRole('link', { name: 'Edit configuration' })).toHaveAttribute('href', '/agents/sdr_outbound');
  expect(screen.getByRole('link', { name: 'New campaign' })).toHaveAttribute('href', '/voice-campaigns/new');

  expect(screen.getByTestId('agent-state-sdr_inbound')).toHaveTextContent('Not set up');
  expect(screen.getByRole('link', { name: 'Set up agent' })).toHaveAttribute('href', '/agents/sdr_inbound');

  expect(screen.getByTestId('agent-card-hiring')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/hiring_agent');
  expect(api.getAgentInstanceVersion).toHaveBeenCalledWith('sdr_outbound', 3);
});

test('a draft only: Continue setup', async () => {
  api.listAgentInstances.mockResolvedValue({ data: [{ id: 'i-2', agent_type: 'sdr_inbound', published_version: null, draft_version: 1 }] });
  renderWithAuth(<AgentsPage />, { user: { ...USERS.tenant_admin, ...ON } });
  expect(await screen.findByTestId('agent-state-sdr_inbound')).toHaveTextContent('Draft');
  expect(screen.getByRole('link', { name: 'Continue setup' })).toHaveAttribute('href', '/agents/sdr_inbound');
  expect(screen.getByTestId('agent-state-sdr_outbound')).toHaveTextContent('Not set up');
});

test('an agent-instance API refusal does not mix legacy cards into the new mode', async () => {
  api.listAgentInstances.mockRejectedValue({ response: { status: 403 } });
  renderWithAuth(<AgentsPage />, { user: { ...USERS.manager, ...ON } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Agent setup couldn't be loaded"));
  expect(screen.queryByTestId('agent-state-sdr_outbound')).not.toBeInTheDocument();
  expect(screen.queryByTestId('agent-card-sdr')).not.toBeInTheDocument();
});

test('Not in plan: an unusable Inbound SDR and catalog agents the tenant cannot use', async () => {
  api.listAvailableAgentTypes.mockResolvedValue({ data: [
    { ...SDR, agent_type: 'sdr_outbound', usable: true, has_screen: true },
    { id: 'a-3', key: 'sdr_inbound', name: 'Inbound SDR', agent_type: 'sdr_inbound', usable: false, follows: null, has_screen: false },
  ] });
  renderWithAuth(<AgentsPage />, { user: { ...USERS.tenant_admin, ...ON } });
  expect(await screen.findByTestId('agent-card-sdr_inbound')).toHaveTextContent('Not in your plan');
  expect(screen.getByText('Real estate').closest('[data-testid]')).toHaveTextContent('Not in your plan');
  expect(screen.getAllByRole('link', { name: 'See plans' })[0]).toHaveAttribute('href', '/billing');
});
