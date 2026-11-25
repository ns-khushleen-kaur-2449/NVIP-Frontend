// The NVIP catalog cards (config/agents.js, from predev) wired to the SDR app: the card <-> backend agent mapping,
// the brochure page's "In your workspace" panel, and the Coming soon cards on the signed-in Agents page.
import { screen, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import AgentsPage from '@/pages/Agents';
import AgentDetail from '@/pages/public/AgentDetail';
import { AGENTS, getAgentByBackendKey, runsOnBackend } from '@/config/agents';
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

const SDR = { id: 'a-1', key: 'sdr', name: 'SmartSDR', industry: 'Sales', description: null };
const INBOUND = { id: 'a-3', key: 'sdr_inbound', name: 'Inbound SDR', industry: null, description: null };
const HIRING = { id: 'a-2', key: 'hiring', name: 'Hiring', industry: 'HR', description: null };

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [SDR, HIRING] });
  api.getAgentCatalog.mockResolvedValue({ data: [
    { ...SDR, agent_type: 'sdr_outbound', usable: true, has_screen: true },
    { ...INBOUND, agent_type: 'sdr_inbound', usable: false, has_screen: false },
    { ...HIRING, agent_type: 'hiring', usable: true, has_screen: true },
  ] });
  api.listAgentInstances.mockResolvedValue({ data: [] });
  api.listAvailableAgentTypes.mockResolvedValue({ data: [] });
  api.getBuilderLanguages.mockResolvedValue({ data: [] });
  api.listOwnPhoneNumbers.mockResolvedValue({ data: [] });
});

const slugOf = (type) => AGENTS.find((a) => a.type === type).slug;

describe('catalog card <-> backend agent', () => {
  test('backend keys and agent types find their card; the inbound/outbound names do not cross', () => {
    expect(getAgentByBackendKey('sdr').type).toBe('outbound');
    expect(getAgentByBackendKey('sdr_outbound').type).toBe('outbound');
    expect(getAgentByBackendKey('sdr_inbound').type).toBe('sdr');
    expect(getAgentByBackendKey('hiring').type).toBe('hiring');
    expect(getAgentByBackendKey('insurance')).toBeUndefined();
    expect(getAgentByBackendKey(null)).toBeUndefined();
  });

  test('only agents with a backend agent type run in the workspace', () => {
    expect(AGENTS.filter(runsOnBackend).map((a) => a.type).sort()).toEqual(['hiring', 'outbound', 'real_estate', 'sdr']);
  });
});

describe('brochure page: In your workspace', () => {
  const at = (type) => `/marketplace/${slugOf(type)}`;
  const routes = [<Route key="d" path="/marketplace/:slug" element={<AgentDetail />} />];
  const panel = () => screen.findByTestId('workspace-access');

  test('a guest is sent to the real sign-in', async () => {
    renderWithAuth(<p>other</p>, { user: null, path: at('outbound'), routes });
    expect(within(await panel()).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(api.getAgentCatalog).not.toHaveBeenCalled();
  });

  test('a tenant user whose plan includes it opens the Agents page', async () => {
    renderWithAuth(<p>other</p>, { user: USERS.manager, path: at('outbound'), routes });
    const link = await within(await panel()).findByRole('link', { name: /open in your workspace/i });
    expect(link).toHaveAttribute('href', '/agents');
    expect(screen.getByText(/included in your plan/i)).toBeInTheDocument();
  });

  test('not in the plan: a Tenant Admin is offered the plans', async () => {
    api.getAgentCatalog.mockResolvedValue({ data: [{ ...HIRING, agent_type: 'hiring', usable: false, has_screen: true }] });
    renderWithAuth(<p>other</p>, { user: USERS.tenant_admin, path: at('hiring'), routes });
    expect(await within(await panel()).findByText(/not in your organisation's plan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/billing');
    expect(screen.queryByRole('link', { name: /open in your workspace/i })).not.toBeInTheDocument();
  });

  test('a catalog read failure still offers the Agents page', async () => {
    api.getAgentCatalog.mockRejectedValue(new Error('network'));
    renderWithAuth(<p>other</p>, { user: USERS.rep, path: at('hiring'), routes });
    expect(await within(await panel()).findByRole('link', { name: /open in your workspace/i })).toHaveAttribute('href', '/agents');
  });

  test('Inbound Voice SDR is held back as Coming soon: not in the workspace yet, and nothing is asked', async () => {
    renderWithAuth(<p>other</p>, { user: USERS.tenant_admin, path: at('sdr'), routes });
    expect(await within(await panel()).findByText(/isn't in the NVIP workspace yet/i)).toBeInTheDocument();
    expect(api.getAgentCatalog).not.toHaveBeenCalled();
  });

  test('Real Estate runs on the backend: the catalog decides, a manager whose plan lacks it sees Not in plan', async () => {
    renderWithAuth(<p>other</p>, { user: USERS.manager, path: at('real_estate'), routes });
    await within(await panel()).findByText(/not in your organisation's plan/i);
    expect(api.getAgentCatalog).toHaveBeenCalled();
  });
});

describe('Agents page: the rest of the NVIP lineup', () => {
  test('every catalog agent runs on the backend: no Coming soon cards, and no AI Receptionist', async () => {
    renderWithAuth(<AgentsPage />, { user: { ...USERS.manager, features: {} } });
    await screen.findByTestId('agent-card-sdr');
    expect(screen.queryByTestId('nvip-coming-soon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-card-nvip-real_estate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-card-nvip-receptionist')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Receptionist')).not.toBeInTheDocument();
  });

  test('a catalog agent the backend lists is left to the backend (no duplicate Coming soon card)', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [SDR, { id: 'a-9', key: 'real_estate', name: 'Real estate' }] });
    renderWithAuth(<AgentsPage />, { user: { ...USERS.manager, features: {} } });
    await screen.findByTestId('agent-card-real_estate');
    expect(screen.queryByTestId('agent-card-nvip-real_estate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nvip-coming-soon')).not.toBeInTheDocument();
  });
});
