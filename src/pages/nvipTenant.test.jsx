// An NVIP tenant (agent_instances + shared_assistants + all_tools, backend tenants/nvip.py) never reaches the legacy
// Assistant builder: not in the menu, and its old address sends them to agent setup.
import { screen } from '@testing-library/react';
import { Route, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { VoiceAgentModeRedirect } from '@/components/auth/ModeRoutes';
import { featureOn } from '@/lib/rbac';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api');
jest.mock('@/pages/VoiceAgent', () => function VoiceAgentStub() { return <p>Assistant builder page</p>; });

const NVIP = { features: { agent_instances: true, shared_assistants: true, all_tools: true } };

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

beforeEach(() => {
  jest.resetAllMocks();
  api.getBillingSubscription.mockResolvedValue({ data: { plan: 'plus', plan_name: 'Plus' } });
});

test.each(['tenant_admin', 'manager', 'rep'])('an NVIP %s never sees the Assistant builder in the menu', (role) => {
  renderWithAuth(<Sidebar />, { user: { ...USERS[role], ...NVIP }, path: '/dashboard' });
  const names = screen.getAllByRole('link').map((link) => link.textContent.trim());
  expect(names).not.toContain('Assistant builder');
  expect(screen.queryByRole('link', { name: /Create Agent/ })).toBeNull();
});

test("the builder's old address sends an NVIP tenant to agent setup", () => {
  renderWithAuth(<VoiceAgentModeRedirect />, { user: { ...USERS.tenant_admin, ...NVIP }, path: '/voice_agent?tab=create',
    routes: [<Route key="a" path="/agents/sdr_outbound" element={<Where />} />] });
  expect(screen.getByTestId('where')).toHaveTextContent('/agents/sdr_outbound');
  expect(screen.queryByText('Assistant builder page')).toBeNull();
});

test('all_tools is an off-by-default feature: on only when the session says true', () => {
  expect(featureOn({ ...USERS.tenant_admin, ...NVIP }, 'all_tools')).toBe(true);
  expect(featureOn({ ...USERS.tenant_admin, features: {} }, 'all_tools')).toBe(false);
});
