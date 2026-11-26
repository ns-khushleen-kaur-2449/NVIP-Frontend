import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TimezoneSelect, { loadTimezones, resetTimezoneCache } from './TimezoneSelect';

jest.mock('@/lib/api');
const api = require('@/lib/api');

const ZONES = [
  { id: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time – Asia/Kolkata', offset_minutes: 330, common: true },
  { id: 'Asia/Dubai', label: '(UTC+04:00) Gulf Standard Time – Asia/Dubai', offset_minutes: 240, common: true },
  { id: 'America/Los_Angeles', label: '(UTC−08:00) Pacific Time – America/Los_Angeles', offset_minutes: -480, common: true },
  { id: 'Pacific/Midway', label: '(UTC−11:00) Pacific/Midway', offset_minutes: -660, common: false },
  { id: 'Europe/Paris', label: '(UTC+01:00) Europe/Paris', offset_minutes: 60, common: false },
];

beforeEach(() => {
  resetTimezoneCache();
  api.getTimezones.mockReset();
  api.getTimezones.mockResolvedValue({ data: ZONES });
});

function Harness({ initial = '', onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return <TimezoneSelect value={value} onChange={(next) => { setValue(next); onChange(next); }} {...props} />;
}

const openPicker = async () => {
  const trigger = await screen.findByRole('combobox', { name: 'Timezone' });
  await waitFor(() => expect(trigger).not.toBeDisabled());
  fireEvent.click(trigger);
  return screen.findByRole('listbox');
};

it('lists the common zones in their own group above the rest', async () => {
  render(<Harness />);
  const list = await openPicker();
  const groups = within(list).getAllByRole('group');
  expect(groups.map((g) => within(g).getAllByRole('option').length)).toEqual([3, 2]);
  const options = within(list).getAllByRole('option').map((o) => o.textContent);
  expect(options.slice(0, 3)).toEqual(ZONES.filter((z) => z.common).map((z) => z.label));
  expect(screen.getByText('Common')).toBeInTheDocument();
  expect(screen.getByText('All timezones')).toBeInTheDocument();
});

it.each([
  ['pacific', ['America/Los_Angeles', 'Pacific/Midway']],
  ['los angeles', ['America/Los_Angeles']],
  ['DUBAI', ['Asia/Dubai']],
])('search "%s" matches label and id', async (search, ids) => {
  render(<Harness />);
  const list = await openPicker();
  fireEvent.change(screen.getByRole('combobox', { name: 'Search timezones' }), { target: { value: search } });
  await waitFor(() => expect(within(list).getAllByRole('option').map((o) => o.getAttribute('data-value')))
    .toEqual(ids));
});

it('shows the label and hands back only the IANA id', async () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  await openPicker();
  fireEvent.click(screen.getByRole('option', { name: /Pacific Time/ }));
  expect(onChange).toHaveBeenCalledWith('America/Los_Angeles');
  expect(screen.getByRole('combobox', { name: 'Timezone' })).toHaveTextContent('(UTC−08:00) Pacific Time – America/Los_Angeles');
});

it('keeps a stored value that is not in the list', async () => {
  render(<Harness initial="Asia/Calcutta" />);
  const trigger = await screen.findByRole('combobox', { name: 'Timezone' });
  await waitFor(() => expect(trigger).not.toBeDisabled());
  expect(trigger).toHaveTextContent('Asia/Calcutta');
  fireEvent.click(trigger);
  expect(await screen.findByRole('option', { name: 'Asia/Calcutta' })).toHaveAttribute('aria-selected');
});

it('offers a clearing entry when asked', async () => {
  const onChange = jest.fn();
  render(<Harness initial="Asia/Dubai" onChange={onChange} clearLabel="Company default" />);
  await openPicker();
  fireEvent.click(screen.getByRole('option', { name: 'Company default' }));
  expect(onChange).toHaveBeenCalledWith('');
});

it('shows the current value read-only with an error when the list fails, never a text box', async () => {
  api.getTimezones.mockRejectedValue(new Error('offline'));
  render(<Harness initial="Europe/Paris" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('The timezone list could not be loaded.');
  expect(screen.getByTestId('timezone-select-error')).toHaveTextContent('Europe/Paris');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  // Try again reads the list once more.
  api.getTimezones.mockResolvedValue({ data: ZONES });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('combobox', { name: 'Timezone' })).toHaveTextContent('Europe/Paris');
});

it('reads the list once per session, whatever the number of pickers', async () => {
  render(<><Harness /><Harness /></>);
  await waitFor(() => expect(screen.getAllByRole('combobox', { name: 'Timezone' })[1]).not.toBeDisabled());
  await loadTimezones();
  expect(api.getTimezones).toHaveBeenCalledTimes(1);
});
