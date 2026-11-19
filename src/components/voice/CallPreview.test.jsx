// F-08: the call preview shows the server's output as is; the hook asks once per pause in editing; nothing in the
// app renders an opening or a prompt locally any more.
import fs from 'fs';
import path from 'path';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import CallPreviewView from '@/components/voice/CallPreview';
import useCallPreview, { PREVIEW_DELAY_MS } from '@/hooks/useCallPreview';

const SHARED = {
  mode: 'shared', first_message: 'Hi Rohan, this is Neha from Acme Textiles.', rendered_prompt: 'You are Neha.\nRules: ...',
  variable_values: { campaign_section: 'Current offer: 10% off' },
  call_settings: { voice: { provider: '11labs', voiceId: 'neha' }, transcriber: { language: 'en' }, maxDurationSeconds: 480, voicemailMessage: 'x' },
  caller_id: { source: 'tenant_number', number: '+911234567890' },
  missing_required: [{ code: 'missing_call_details', label: 'Missing call details the assistant needs', fields: ['lead_first_name'] }],
  warnings: ['Sample lead: Asha (made up).'],
};

describe('the view', () => {
  test('shows what the server built, the checklist and the warnings', () => {
    render(<CallPreviewView preview={SHARED} loading={false} error={null} />);
    expect(screen.getByTestId('server-first-message')).toHaveTextContent('“Hi Rohan, this is Neha from Acme Textiles.”');
    expect(screen.getByText('Current offer: 10% off')).toBeInTheDocument();
    const sent = screen.getByRole('list', { name: 'Still needed' });
    expect(within(sent).getByText(/Missing call details the assistant needs: lead_first_name/)).toBeInTheDocument();
    expect(screen.getByText('11labs · neha')).toBeInTheDocument();
    expect(screen.getByText('8 min')).toBeInTheDocument();
    expect(screen.getByText('+911234567890')).toBeInTheDocument();
    expect(screen.getByTestId('rendered-prompt')).toHaveTextContent('You are Neha.');
    expect(screen.getByText('Sample lead: Asha (made up).')).toBeInTheDocument();
  });

  test('own assistant: no settings block, the extra form gaps join the checklist', () => {
    render(<CallPreviewView preview={{ mode: 'own_assistant', first_message: null, missing_required: [], warnings: [] }}
      extraMissing={[{ code: 'name', label: 'Campaign name' }]} />);
    expect(screen.getByTestId('server-first-message')).toHaveTextContent("The assistant's own opening line.");
    expect(screen.queryByLabelText('Sent with the call')).not.toBeInTheDocument();
    expect(screen.queryByText('Max length')).not.toBeInTheDocument();
    expect(screen.getByText('Campaign name')).toBeInTheDocument();
  });

  test('nothing missing; an error; loading', () => {
    const { rerender } = render(<CallPreviewView preview={{ ...SHARED, missing_required: [] }} />);
    expect(screen.getByText('Nothing missing for calls')).toBeInTheDocument();
    rerender(<CallPreviewView error="Could not load the preview" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the preview');
    rerender(<CallPreviewView loading />);
    expect(screen.getByText('Loading the preview…')).toBeInTheDocument();
  });
});

describe('the hook', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test(`asks once, ${PREVIEW_DELAY_MS} ms after the last change, and keeps only the newest answer`, async () => {
    const request = jest.fn((n) => Promise.resolve({ data: { first_message: `answer ${n}` } }));
    const { result, rerender } = renderHook(({ n }) => useCallPreview(() => request(n), `key-${n}`), { initialProps: { n: 1 } });
    rerender({ n: 2 });
    rerender({ n: 3 });
    expect(request).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(PREVIEW_DELAY_MS); });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(3);
    expect(result.current.preview).toEqual({ first_message: 'answer 3' });
  });

  test('disabled: never asks', async () => {
    const request = jest.fn();
    renderHook(() => useCallPreview(request, 'k', { enabled: false }));
    await act(async () => { jest.advanceTimersByTime(PREVIEW_DELAY_MS * 2); });
    expect(request).not.toHaveBeenCalled();
  });
});

test('no screen renders an opening or a prompt in the browser any more', () => {
  const root = path.join(__dirname, '..', '..');
  const offenders = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return undefined;
    const source = fs.readFileSync(full, 'utf8');
    if (/\b(renderGreeting|greetingValues|GreetingPreview)\b/.test(source)) offenders.push(path.relative(root, full));
    return undefined;
  });
  walk(root);
  expect(offenders).toEqual([]);
});
