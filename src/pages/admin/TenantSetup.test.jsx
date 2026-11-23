// The Super Admin setup wizard: create (saves at once), resume at the saved step, plan read-only, tool grants through
// the bulk Tenant access route, and the review's readiness list.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TenantSetupPage from './TenantSetup';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
const api = require('@/lib/api');

const PLAN = { key: null, name: 'Free', status: 'none', interval: null, cancel_at_period_end: false };
const info = (onboarding) => ({ data: { tenant_id: 't-1', name: 'Acme', status: 'active', default_timezone: 'Asia/Kolkata',
  plan: PLAN, steps: ['details', 'admin', 'settings', 'phone', 'tools', 'review'], onboarding } });

const open = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/tenants/new" element={<TenantSetupPage />} />
      <Route path="/admin/tenants/:tenantId/setup" element={<TenantSetupPage />} />
      <Route path="/admin/tenants" element={<p>tenants-list</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  jest.resetAllMocks();
  api.saveTenantOnboarding.mockImplementation((id, step, completed) => Promise.resolve({ data: { step, completed, finished: step === 'review' && completed.includes('review') } }));
  api.listTenantInvitations.mockResolvedValue({ data: [] });
  api.listTenantPhoneNumbers.mockResolvedValue({ data: [] });
  api.getTenantSettings.mockResolvedValue({ data: { status: 'active', limits: { manager_seats: null }, seat_overrides: {},
    features: [{ key: 'shared_assistants', label: 'Shared assistants', enabled: false }], tenant_admins: [] } });
});

test('the first step creates the tenant at once, then the wizard continues on its own page', async () => {
  api.createTenant.mockResolvedValue({ data: { tenant_id: 't-1', name: 'Acme' } });
  api.getTenantOnboarding.mockResolvedValue(info({ step: 'admin', completed: ['details'], finished: false }));
  open('/admin/tenants/new');
  fireEvent.click(screen.getByRole('button', { name: /Create tenant/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A tenant name is required');
  fireEvent.change(screen.getByLabelText('Tenant name'), { target: { value: '  Acme ' } });
  fireEvent.click(screen.getByRole('button', { name: /Create tenant/ }));
  await waitFor(() => expect(api.createTenant).toHaveBeenCalledWith({ name: 'Acme', default_timezone: 'Asia/Kolkata', start_onboarding: true }));
  expect(await screen.findByRole('heading', { name: 'First admin' })).toBeInTheDocument();
  expect(api.getTenantOnboarding).toHaveBeenCalledWith('t-1');
  expect(screen.getByText(/No email is sent/)).toBeInTheDocument();
});

test('Continue setup resumes at the saved step and records each step done', async () => {
  api.getTenantOnboarding.mockResolvedValue(info({ step: 'phone', completed: ['details', 'admin', 'settings'], finished: false }));
  open('/admin/tenants/t-1/setup');
  expect(await screen.findByRole('heading', { name: 'Phone number' })).toBeInTheDocument();
  await waitFor(() => expect(api.listTenantPhoneNumbers).toHaveBeenCalledWith('t-1'));
  api.listTools.mockResolvedValue({ data: [] });
  api.getTenantReadiness.mockResolvedValue({ data: { items: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(api.saveTenantOnboarding).toHaveBeenCalledWith('t-1', 'tools', ['details', 'admin', 'settings', 'phone']));
  expect(await screen.findByRole('heading', { name: 'Tool grants' })).toBeInTheDocument();
  // Back moves without marking anything done.
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(api.saveTenantOnboarding).toHaveBeenLastCalledWith('t-1', 'phone', ['details', 'admin', 'settings', 'phone']));
});

test('the settings step reuses the audited settings panel (no admins list)', async () => {
  api.getTenantOnboarding.mockResolvedValue(info({ step: 'settings', completed: ['details', 'admin'], finished: false }));
  open('/admin/tenants/t-1/setup');
  expect(await screen.findByRole('switch', { name: 'Shared assistants' })).toBeInTheDocument();
  expect(screen.queryByText('Tenant admins')).toBeNull();
});

test('tool grants go through the bulk Tenant access route for this tenant', async () => {
  api.getTenantOnboarding.mockResolvedValue(info({ step: 'tools', completed: ['details'], finished: false }));
  api.listTools.mockResolvedValue({ data: [{ id: 'tool-a', name: 'Book meeting', type_key: 'book_meeting' },
    { id: 'tool-b', name: 'Search products', type_key: 'search_products' }] });
  api.getToolTenants.mockImplementation((id) => Promise.resolve({ data: { tenants: [{ tenant_id: 't-1', granted: id === 'tool-a' }] } }));
  api.getTenantReadiness.mockResolvedValue({ data: { items: [{ key: 'tool_grants', status: 'missing', severity: 'recommended',
    message: 'Grant these tools: search_products.', fix: {} }] } });
  api.setManyToolsTenants.mockResolvedValue({ data: { tools: [{ tool_id: 'tool-b', changed: true }] } });
  open('/admin/tenants/t-1/setup');
  expect(await screen.findByTestId('tool-grants-hint')).toHaveTextContent('Grant these tools: search_products.');
  const granted = within(screen.getByTestId('setup-tool-tool-a'));
  expect(granted.getByText('Granted')).toBeInTheDocument();
  expect(granted.getByRole('checkbox')).toBeDisabled();
  fireEvent.click(within(screen.getByTestId('setup-tool-tool-b')).getByRole('checkbox'));
  const give = screen.getByRole('button', { name: /Give access/ });
  expect(give).toBeDisabled(); // a reason first
  fireEvent.change(screen.getByLabelText('Reason for giving access'), { target: { value: ' New customer setup ' } });
  fireEvent.click(give);
  await waitFor(() => expect(api.setManyToolsTenants).toHaveBeenCalledWith(['tool-b'], ['t-1'], true, 'New customer setup'));
});

test('the review shows the plan read-only and the readiness list, blocking first; Finish records it', async () => {
  api.getTenantOnboarding.mockResolvedValue(info({ step: 'phone', completed: ['details'], finished: false }));
  api.getTenantReadiness.mockResolvedValue({ data: { items: [
    { key: 'test_call', status: 'missing', severity: 'recommended', message: 'Make a test call.', fix: { path: '/single-call', label: 'Single call', by: 'tenant_admin' } },
    { key: 'caller_id', status: 'missing', severity: 'blocking', message: 'The organisation has no number.', fix: { path: '/admin/tenants', label: 'Tenants → Phone numbers', by: 'super_admin' } },
    { key: 'calendar', status: 'not_applicable', severity: 'recommended', message: 'Calendar', fix: {} },
    { key: 'signing_key', status: 'done', severity: 'blocking', message: 'Signing key set.', fix: {} },
  ] } });
  open('/admin/tenants/t-1/setup?step=review');
  const list = await screen.findByTestId('readiness-list');
  expect(api.saveTenantOnboarding).not.toHaveBeenCalled(); // opening a step by link saves nothing
  expect(within(list).getAllByRole('listitem').map((li) => li.dataset.testid))
    .toEqual(['readiness-caller_id', 'readiness-test_call', 'readiness-signing_key']);
  expect(within(screen.getByTestId('readiness-caller_id')).getByRole('link', { name: 'Tenants → Phone numbers' })).toHaveAttribute('href', '/admin/tenants');
  expect(within(screen.getByTestId('readiness-test_call')).queryByRole('link')).toBeNull(); // the tenant's own page
  const plan = screen.getByTestId('setup-plan');
  expect(plan).toHaveTextContent('Free');
  expect(plan).toHaveTextContent("It can't be changed here.");
  expect(within(plan).queryByRole('button')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Finish setup/ }));
  await waitFor(() => expect(api.saveTenantOnboarding).toHaveBeenCalledWith('t-1', 'review', ['details', 'review']));
  expect(await screen.findByText('tenants-list')).toBeInTheDocument();
});
