// The Human handoff section of the agent setup: versioned on the payload (`handoff`), E.164 checked before it saves.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import HandoffSection, { E164 } from './HandoffSection';
import { fieldPropsFor } from './steps';
import { getPath } from '@/lib/agentInstances';

const setPath = (obj, path, value) => {
  const out = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let node = out;
  keys.slice(0, -1).forEach((k) => { node[k] = node[k] ?? {}; node = node[k]; });
  node[keys.at(-1)] = value;
  return out;
};

function Harness({ initial, onSave, errors }) {
  const [payload, setPayload] = useState(initial);
  const update = (path, value) => { const next = setPath(payload, path, value); setPayload(next); onSave(next); };
  return <HandoffSection field={fieldPropsFor({ payload, update, errors })} readOnly={false} />;
}

const renderSection = (initial = { handoff: { enabled: false } }, errors) => {
  const onSave = jest.fn();
  render(<Harness initial={initial} onSave={onSave} errors={errors} />);
  return onSave;
};

test('E.164 rule', () => {
  expect(E164.test('+919876543210')).toBe(true);
  ['98765', '+0123456789', '919876543210', '+91 98'].forEach((n) => expect(E164.test(n)).toBe(false));
});

test('off: only the switch; on: numbers, after hours and the summary toggle', () => {
  const onSave = renderSection();
  expect(screen.queryByText(/Transfer numbers/)).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: /Hand over to a person/ }));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ handoff: expect.objectContaining({ enabled: true }) }));
  expect(screen.getByText(/Add at least one number to publish/)).toBeInTheDocument();
  expect(screen.getByRole('radiogroup', { name: 'After hours' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: /Brief the person/ })).toBeInTheDocument();
});

test('a number is saved only once it is valid E.164, and says why otherwise', () => {
  const onSave = renderSection({ handoff: { enabled: true, targets: [{ label: 'Desk', number: null, priority: 1 }] } });
  const target = within(screen.getByTestId('handoff-target-0'));
  const number = target.getByLabelText('Number');
  fireEvent.change(number, { target: { value: '98765' } });
  expect(target.getByRole('alert')).toHaveTextContent('E.164');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(number, { target: { value: '+91 98765 43210' } });
  expect(target.queryByRole('alert')).toBeNull();
  expect(getPath(onSave.mock.lastCall[0], 'handoff.targets')[0].number).toBe('+919876543210');
});

test('at most 5 numbers; a server error shows on its number', () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ label: `T${i}`, number: `+91980000000${i}`, priority: i + 1 }));
  renderSection({ handoff: { enabled: true, targets: five } }, { 'handoff.targets.2.number': 'Use the international format' });
  expect(screen.queryByRole('button', { name: 'Add a number' })).toBeNull();
  expect(within(screen.getByTestId('handoff-target-2')).getByRole('alert')).toHaveTextContent('international format');
});

test('backup asks for a backup number; message asks for the message', () => {
  renderSection({ handoff: { enabled: true, targets: [], after_hours: 'backup' } });
  expect(screen.getByTestId('handoff-backup')).toBeInTheDocument();
});

test('message mode shows the after-hours message', () => {
  renderSection({ handoff: { enabled: true, targets: [], after_hours: 'message' } });
  expect(screen.getByLabelText(/After-hours message/)).toBeInTheDocument();
  expect(screen.queryByTestId('handoff-backup')).toBeNull();
});
