import { render, screen, waitFor } from '@testing-library/react';
import CallHandoffs from './CallHandoffs';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

test('shows each handoff: status (never "connected"), target, reason and summary', async () => {
  api.getCallHandoffs.mockResolvedValue({ data: [
    { id: 'h1', status: 'transfer_started', target_label: 'Sales desk', target_number_last4: '0001', reason: 'pricing',
      summary: 'Lead name: Riya. Wants a demo.' },
    { id: 'h2', status: 'callback_created', target_label: null, reason: null, summary: null },
  ] });
  render(<CallHandoffs callId={7} />);
  const first = await screen.findByTestId('handoff-h1');
  expect(first).toHaveTextContent('Transfer started');
  expect(first).toHaveTextContent('Sales desk (…0001)');
  expect(first).toHaveTextContent('Reason: pricing');
  expect(first).toHaveTextContent('Wants a demo.');
  expect(screen.getByTestId('handoff-h2')).toHaveTextContent('callback task created');
  expect(screen.getByTestId('call-handoffs')).not.toHaveTextContent(/connected/i);
  expect(api.getCallHandoffs).toHaveBeenCalledWith(7);
});

test('nothing when the call had no handoff', async () => {
  api.getCallHandoffs.mockResolvedValue({ data: [] });
  const { container } = render(<CallHandoffs callId={8} />);
  await waitFor(() => expect(api.getCallHandoffs).toHaveBeenCalledWith(8));
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
