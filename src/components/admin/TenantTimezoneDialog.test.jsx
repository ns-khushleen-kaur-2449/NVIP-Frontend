import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resetTimezoneCache } from '@/components/shared/TimezoneSelect';
import TenantTimezoneDialog from './TenantTimezoneDialog';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const api = require('@/lib/api');

const ZONES = [
  { id: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time – Asia/Kolkata', offset_minutes: 330, common: true },
  { id: 'America/Chicago', label: '(UTC−06:00) Central Time – America/Chicago', offset_minutes: -360, common: true },
];
const TENANT = { tenant_id: 't-9', name: 'Acme', default_timezone: 'Asia/Kolkata' };

beforeEach(() => {
  resetTimezoneCache();
  api.getTimezones.mockResolvedValue({ data: ZONES });
});

const pickChicago = async () => {
  const picker = await screen.findByRole('combobox', { name: 'Default time zone' });
  await waitFor(() => expect(picker).toHaveTextContent('India Standard Time'));
  fireEvent.click(picker);
  fireEvent.click(await screen.findByRole('option', { name: /Central Time/ }));
};

it('sends the IANA id with the reason (the step-up is asked for by the API client)', async () => {
  const onSaved = jest.fn();
  const onOpenChange = jest.fn();
  api.setTenantTimezone.mockResolvedValue({ data: { ...TENANT, default_timezone: 'America/Chicago' } });
  render(<TenantTimezoneDialog tenant={TENANT} onOpenChange={onOpenChange} onSaved={onSaved} />);
  await pickChicago();
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled(); // a reason first
  fireEvent.change(screen.getByPlaceholderText(/platform audit trail/), { target: { value: 'Moved to Chicago' } });
  fireEvent.click(save);
  await waitFor(() => expect(api.setTenantTimezone).toHaveBeenCalledWith('t-9', 'America/Chicago', 'Moved to Chicago'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("shows the backend's refusal inline and stays open", async () => {
  const onOpenChange = jest.fn();
  api.setTenantTimezone.mockRejectedValue({ response: { status: 422, data: { detail: [{ msg: 'reason too short' }] } } });
  render(<TenantTimezoneDialog tenant={TENANT} onOpenChange={onOpenChange} />);
  await pickChicago();
  fireEvent.change(screen.getByPlaceholderText(/platform audit trail/), { target: { value: 'Why not' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('reason too short');
  expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
