import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import AgentsAdminPage from '@/pages/admin/AgentsAdmin';
import AgentsPage from '@/pages/Agents';
import RequirePermission from '@/components/auth/RequirePermission';
import { Sidebar } from '@/components/layout/Sidebar';
import { PERMISSIONS } from '@/lib/rbac';
import { PLATFORM_NAV, visibleNavItems } from '@/lib/adminNav';
import { agentRoute, accessSummary, healthState, problemLabel } from '@/lib/agents';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  getAgentAccess: jest.fn(),
  setAgentAccess: jest.fn(),
  listAgentAssistants: jest.fn(),
  registerAgentAssistant: jest.fn(),
  removeAgentAssistant: jest.fn(),
  replaceAgentAssistant: jest.fn(),
  listAvailableAgents: jest.fn(),
  getAgentHealth: jest.fn(),
}));

const HEALTH = {
  'a-1': { key: 'sdr', has_code: true, contract_version: 1, ok: false, problems: ['campaign_runner_disabled', 'something_new'] },
  'a-2': { key: 'hiring', has_code: false, contract_version: null, ok: false, problems: ['no_code_pack'] },
};

const AGENTS = [
  { id: 'a-1', key: 'sdr', name: 'SmartSDR', industry: 'Sales', description: 'Outbound sales calls', status: 'active', access_scope: 'all' },
  { id: 'a-2', key: 'hiring', name: 'Hiring', industry: 'HR', description: null, status: 'draft', access_scope: 'selected' },
];

beforeEach(() => {
  jest.clearAllMocks();
  api.listAgents.mockResolvedValue({ data: AGENTS });
  api.updateAgent.mockResolvedValue({ data: {} });
  api.createAgent.mockResolvedValue({ data: {} });
  api.setAgentAccess.mockResolvedValue({ data: {} });
  api.getAgentAccess.mockResolvedValue({ data: [
    { tenant_id: 't-1', name: 'Apex Motors', granted: true, granted_at: null },
    { tenant_id: 't-2', name: 'Bright Homes', granted: false, granted_at: null },
  ] });
  api.listAgentAssistants.mockResolvedValue({ data: [] });
  api.registerAgentAssistant.mockResolvedValue({ data: {} });
  api.listAvailableAgents.mockResolvedValue({ data: [AGENTS[0], AGENTS[1]] });
  api.getAgentHealth.mockImplementation((id) => Promise.resolve({ data: HEALTH[id] }));
});

describe('agent permissions', () => {
  const guarded = (perm) => <RequirePermission perm={perm}><p>Allowed</p></RequirePermission>;
  const routes = [<Route key="403" path="/403" element={<p>Forbidden</p>} />];

  test.each([
    ['super_admin', 'Allowed'], ['tenant_admin', 'Forbidden'], ['manager', 'Forbidden'], ['rep', 'Forbidden'],
  ])('%s opening the catalog admin sees %s', (role, text) => {
    renderWithAuth(guarded(PERMISSIONS.AGENTS_MANAGE), { user: USERS[role], path: '/x', routes });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test.each(['super_admin', 'tenant_admin', 'manager', 'rep'])('%s may view the agents list', (role) => {
    renderWithAuth(guarded(PERMISSIONS.AGENTS_VIEW), { user: USERS[role], path: '/x', routes });
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  test('only the Super Admin gets the catalog admin link (platform area); tenant users see Agents', () => {
    // Since the sdr-merge the Super Admin works only in /admin, so the catalog link is in PLATFORM_NAV.
    const catalog = (user) => visibleNavItems(user, PLATFORM_NAV).some((item) => item.path === '/admin/agent-catalog');
    expect(catalog(USERS.super_admin)).toBe(true);
    ['tenant_admin', 'manager', 'rep'].forEach((role) => expect(catalog(USERS[role])).toBe(false));
    renderWithAuth(<Sidebar />, { user: USERS.rep, path: '/dashboard' });
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });
});

describe('lib/agents', () => {
  test('only agents with a screen can be opened', () => {
    expect(agentRoute({ key: 'sdr' })).toBe('/voice_agent');
    expect(agentRoute({ key: 'hiring' })).toBe('/hiring_agent');
    expect(agentRoute({ key: 'insurance' })).toBeNull();
    expect(agentRoute(null)).toBeNull();
  });

  test('access summary', () => {
    expect(accessSummary({ access_scope: 'all' })).toBe('All organisations');
    expect(accessSummary({ access_scope: 'selected' })).toBe('Selected organisations');
  });

  test('health state and problem words', () => {
    expect(healthState({ has_code: true, ok: true, problems: [] })).toBe('ready');
    expect(healthState({ has_code: true, ok: false, problems: ['vapi_not_configured'] })).toBe('attention');
    expect(healthState({ has_code: false, ok: false, problems: ['no_code_pack'] })).toBe('no_code');
    expect(healthState(null)).toBe('unknown');
    expect(problemLabel('vapi_not_configured')).toBe('Vapi is not configured');
    expect(problemLabel('brand_new_code')).toBe('brand_new_code');
  });
});

describe('Agents (tenant view)', () => {
  test('lists the available agents and opens only those with a screen', async () => {
    const noScreen = { id: 'a-3', key: 'insurance', name: 'Insurance', industry: null, description: null, status: 'active', access_scope: 'all' };
    api.listAvailableAgents.mockResolvedValue({ data: [AGENTS[0], AGENTS[1], noScreen] });
    renderWithAuth(<AgentsPage />, { user: USERS.manager });
    const sdr = await screen.findByTestId('agent-card-sdr');
    expect(within(sdr).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/voice_agent');
    expect(within(screen.getByTestId('agent-card-hiring')).getByRole('link', { name: 'Open' }))
      .toHaveAttribute('href', '/hiring_agent');
    const insurance = screen.getByTestId('agent-card-insurance');
    expect(within(insurance).queryByRole('link')).not.toBeInTheDocument();
    expect(within(insurance).getByText(/coming soon/i)).toBeInTheDocument();
  });

  test('says so when nothing is available', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [] });
    renderWithAuth(<AgentsPage />, { user: USERS.rep });
    expect(await screen.findByText(/no agents are available/i)).toBeInTheDocument();
  });

  test('never shows Vapi details', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [{ ...AGENTS[0], vapi_assistant_id: 'secret-id' }] });
    renderWithAuth(<AgentsPage />, { user: USERS.tenant_admin });
    await screen.findByTestId('agent-card-sdr');
    expect(screen.queryByText(/secret-id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/vapi/i)).not.toBeInTheDocument();
  });
});

describe('Agent catalog admin (Super Admin)', () => {
  test('lists agents with status and who may use them', async () => {
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const sdr = await screen.findByTestId('agent-row-sdr');
    expect(within(sdr).getByText('Active')).toBeInTheDocument();
    expect(within(sdr).getByText('All organisations')).toBeInTheDocument();
    expect(within(screen.getByTestId('agent-row-hiring')).getByText('Draft')).toBeInTheDocument();
  });

  test('shows each agent\'s health with its problems in words', async () => {
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const sdr = await screen.findByTestId('agent-health-sdr');
    expect(await within(sdr).findByText('Needs attention')).toBeInTheDocument();
    expect(within(sdr).getByText('Campaign runner is off on this server')).toBeInTheDocument();
    expect(within(sdr).getByText('something_new')).toBeInTheDocument();
    const hiring = screen.getByTestId('agent-health-hiring');
    expect(await within(hiring).findByText('No code on this server')).toBeInTheDocument();
    expect(within(hiring).queryByRole('listitem')).not.toBeInTheDocument();
    expect(api.getAgentHealth).toHaveBeenCalledWith('a-1');
    expect(api.getAgentHealth).toHaveBeenCalledWith('a-2');
  });

  test('a ready agent, and one whose check failed, without hiding the others', async () => {
    api.getAgentHealth.mockImplementation((id) => (id === 'a-1'
      ? Promise.resolve({ data: { key: 'sdr', has_code: true, contract_version: 1, ok: true, problems: [] } })
      : Promise.reject(new Error('network'))));
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    expect(await within(await screen.findByTestId('agent-health-sdr')).findByText('Ready')).toBeInTheDocument();
    expect(await within(screen.getByTestId('agent-health-hiring')).findByText("Couldn't check")).toBeInTheDocument();
  });

  test('health can be checked again', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    await within(await screen.findByTestId('agent-health-sdr')).findByText('Needs attention');
    await user.click(screen.getByRole('button', { name: /check health again/i }));
    await waitFor(() => expect(api.getAgentHealth).toHaveBeenCalledTimes(4));
  });

  test('activating a draft changes its status', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(api.updateAgent).toHaveBeenCalledWith('a-2', { status: 'active' }));
  });

  test('adding a catalog entry needs a code pack key and a name', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    await screen.findByTestId('agent-row-sdr');
    await user.click(screen.getByRole('button', { name: /new agent/i }));
    expect(screen.getByText(/does not create the agent’s calling behaviour or Vapi assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/existing Outbound SDR/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add catalog entry/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('A key and a name are required');
    expect(api.createAgent).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/code pack key/i), 'finance');
    await user.type(screen.getByLabelText(/^name/i), 'Finance');
    await user.click(screen.getByRole('button', { name: /add catalog entry/i }));
    await waitFor(() => expect(api.createAgent).toHaveBeenCalledWith(
      { key: 'finance', name: 'Finance', industry: null, description: null }));
  });

  test('access: choosing selected organisations sends exactly the ticked ones', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Access' }));
    const dialog = await screen.findByTestId('agent-access-dialog');
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Bright Homes' }));
    await user.click(within(dialog).getByRole('button', { name: /save access/i }));
    await waitFor(() => expect(api.setAgentAccess).toHaveBeenCalledWith('a-2', 'selected', expect.arrayContaining(['t-1', 't-2'])));
    expect(api.setAgentAccess.mock.calls[0][2]).toHaveLength(2);
  });

  test('access: all organisations sends no tenant list', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Access' }));
    const dialog = await screen.findByTestId('agent-access-dialog');
    await user.click(within(dialog).getByRole('button', { name: 'All organisations' }));
    await user.click(within(dialog).getByRole('button', { name: /save access/i }));
    await waitFor(() => expect(api.setAgentAccess).toHaveBeenCalledWith('a-2', 'all', []));
  });

  test('registering a shared assistant needs an id and a name, then refreshes the list', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const hiring = await screen.findByTestId('agent-row-hiring');
    await user.click(within(hiring).getByRole('button', { name: 'Assistants' }));
    const dialog = await screen.findByTestId('agent-assistants-dialog');
    await user.click(within(dialog).getByRole('button', { name: /register assistant/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A Vapi assistant id and a name are required');
    expect(api.registerAgentAssistant).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/vapi assistant id/i), 'vapi-123');
    await user.type(within(dialog).getByLabelText(/^name/i), 'Intake');
    await user.click(within(dialog).getByRole('button', { name: /register assistant/i }));
    await waitFor(() => expect(api.registerAgentAssistant).toHaveBeenCalledWith('a-2',
      { vapi_assistant_id: 'vapi-123', name: 'Intake' }));
    await waitFor(() => expect(api.listAgentAssistants).toHaveBeenCalledTimes(2));
    expect(within(dialog).queryByLabelText(/purpose/i)).not.toBeInTheDocument();
  });

  const LIVE = { id: 'r-1', name: 'Outbound SDR shared', vapi_assistant_id: 'vapi-live', published_version: 3, replaced_at: null };
  const REPLACED = { id: 'r-0', name: 'Old', vapi_assistant_id: 'vapi-old', published_version: 2, replaced_at: '2026-11-01T00:00:00Z' };

  async function openAssistants(user, row = 'agent-row-sdr') {
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    const agent = await screen.findByTestId(row);
    await user.click(within(agent).getByRole('button', { name: 'Assistants' }));
    return screen.findByTestId('agent-assistants-dialog');
  }

  test('a registered assistant is shown alone, with versions and replace, and no register form', async () => {
    api.listAgentAssistants.mockResolvedValue({ data: [LIVE, REPLACED] });
    const user = userEvent.setup();
    const dialog = await openAssistants(user);
    expect(within(dialog).getByText('Shared assistant of SmartSDR')).toBeInTheDocument();
    const live = await within(dialog).findByTestId('live-assistant');
    expect(within(live).getByText('Outbound SDR shared')).toBeInTheDocument();
    expect(within(live).getByText('vapi-live')).toBeInTheDocument();
    expect(within(live).getByRole('button', { name: 'Versions of Outbound SDR shared' })).toHaveTextContent('Versions (live: 3)');
    expect(within(dialog).queryByText('vapi-old')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /register assistant/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/purpose/i)).not.toBeInTheDocument();
  });

  test('replacing the assistant warns every organisation switches and needs a reason', async () => {
    api.listAgentAssistants.mockResolvedValue({ data: [LIVE] });
    api.replaceAgentAssistant.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    const dialog = await openAssistants(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Replace assistant' }));
    const confirm = await screen.findByRole('dialog', { name: /replace the shared assistant of smartsdr/i });
    expect(confirm).toHaveTextContent('Every organisation on this agent switches to the new assistant');
    const button = within(confirm).getByRole('button', { name: 'Replace assistant' });
    await user.type(within(confirm).getByLabelText(/new vapi assistant id/i), 'vapi-new');
    await user.type(within(confirm).getByLabelText(/^name/i), 'New');
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText(/reason/i), 'Moved Vapi account');
    await user.click(button);
    await waitFor(() => expect(api.replaceAgentAssistant).toHaveBeenCalledWith('a-1',
      { vapi_assistant_id: 'vapi-new', name: 'New', reason: 'Moved Vapi account' }));
  });

  test('deleting an assistant in use explains it and offers delete anyway with a reason', async () => {
    api.listAgentAssistants.mockResolvedValue({ data: [LIVE] });
    api.removeAgentAssistant.mockRejectedValueOnce({ response: { status: 409, data: { detail: {
      code: 'assistant_in_use', message: 'server text' } } } }).mockResolvedValueOnce({});
    const user = userEvent.setup();
    const dialog = await openAssistants(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Remove Outbound SDR shared' }));
    const confirm = await screen.findByRole('dialog', { name: /delete outbound sdr shared/i });
    expect(confirm).toHaveTextContent('Organisations are calling through this assistant. Replace it instead, or delete anyway with a reason.');
    const anyway = within(confirm).getByRole('button', { name: 'Delete anyway' });
    expect(anyway).toBeDisabled();
    await user.type(within(confirm).getByLabelText(/reason/i), 'Account closed');
    await user.click(anyway);
    await waitFor(() => expect(api.removeAgentAssistant).toHaveBeenLastCalledWith('a-1', 'r-1',
      { force: true, reason: 'Account closed' }));
  });

  test('a second catalog row for an existing agent type is a form error', async () => {
    api.createAgent.mockRejectedValue({ response: { status: 422, data: { detail: {
      code: 'pack_already_has_agent', message: 'This agent type already exists in the catalog.' } } } });
    const user = userEvent.setup();
    renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
    await user.click(await screen.findByRole('button', { name: /new agent/i }));
    await user.type(screen.getByLabelText(/code pack key/i), 'sdr_outbound');
    await user.type(screen.getByLabelText(/^name/i), 'SDR again');
    await user.click(screen.getByRole('button', { name: /add catalog entry/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This agent type already exists in the catalog.');
  });
});
