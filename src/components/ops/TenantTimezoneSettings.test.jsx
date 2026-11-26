import { fireEvent, screen, waitFor } from '@testing-library/react';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { resetTimezoneCache } from '@/components/shared/TimezoneSelect';
import TenantTimezoneSettings from './TenantTimezoneSettings';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = require('@/lib/api');

const ZONES = [
  { id: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time – Asia/Kolkata', offset_minutes: 330, common: true },
  { id: 'America/Los_Angeles', label: '(UTC−08:00) Pacific Time – America/Los_Angeles', offset_minutes: -480, common: true },
];
const ADMIN = { ...USERS.tenant_admin, tenant: { tenant_id: 't-1', name: 'Acme', default_timezone: 'Asia/Kolkata' } };

beforeEach(() => {
  resetTimezoneCache();
  api.getTimezones.mockResolvedValue({ data: ZONES });
});

const pickLosAngeles = async () => {
  const picker = await screen.findByRole('combobox', { name: 'Organisation time zone' });
  await waitFor(() => expect(picker).toHaveTextContent('India Standard Time'));
  fireEvent.click(picker);
  fireEvent.click(await screen.findByRole('option', { name: /Pacific Time/ }));
};

it("saves the tenant's timezone, re-reads /me and says existing campaigns keep theirs", async () => {
  const refreshMe = jest.fn();
  api.updateOwnTenantTimezone.mockResolvedValue({ data: { tenant_id: 't-1', default_timezone: 'America/Los_Angeles' } });
  renderWithAuth(<TenantTimezoneSettings />, { user: ADMIN, auth: { refreshMe } });
  expect(screen.getByText(/doesn't change existing campaigns/)).toBeInTheDocument();
  const save = screen.getByRole('button', { name: /Save time zone/ });
  expect(save).toBeDisabled();
  await pickLosAngeles();
  fireEvent.click(save);
  await waitFor(() => expect(api.updateOwnTenantTimezone).toHaveBeenCalledWith('America/Los_Angeles'));
  await waitFor(() => expect(refreshMe).toHaveBeenCalled());
});

it("shows the backend's refusal inline", async () => {
  api.updateOwnTenantTimezone.mockRejectedValue({ response: { status: 400,
    data: { detail: 'default_timezone must be a valid timezone name, for example Asia/Kolkata' } } });
  renderWithAuth(<TenantTimezoneSettings />, { user: ADMIN });
  await pickLosAngeles();
  fireEvent.click(screen.getByRole('button', { name: /Save time zone/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('default_timezone must be a valid timezone name');
});
