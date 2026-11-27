// The suggested opening line in the Agent identity step (sdr_outbound): language change -> suggestion, notice, tips,
// warnings. The API is mocked; the step runs with a real form state (fieldPropsFor + setPath), as on the page.
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as api from '@/lib/api';
import { setPath } from '@/lib/agentInstances';
import { resetOpeningLineGuides } from '@/lib/openingLines';
import { IdentityStep, fieldPropsFor } from '@/pages/agentConfig/steps';

jest.mock('@/lib/api', () => ({
  suggestOpeningLine: jest.fn(), getOpeningLineGuide: jest.fn(),
  getAgentInstance: jest.fn(), getAgentInstanceVersion: jest.fn(), previewAgentInstance: jest.fn(), updateBusinessProfile: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const voice = (ready, problem) => ({ needs_persona_gender: false, voices: { neutral: { ready, problem } } });
const LANGUAGES = [
  { code: 'en', name: 'English', direction: 'ltr', voice: voice(true) },
  { code: 'fr', name: 'French', direction: 'ltr', voice: voice(true) },
  { code: 'es', name: 'Spanish', direction: 'ltr', voice: voice(true) },
  { code: 'ar', name: 'Arabic', direction: 'rtl',
    voice: { needs_persona_gender: true, voices: { female: { ready: false, problem: 'No tested Arabic female voice yet.' } } } },
];
const EN_DEFAULT = 'Hi {{lead_first_name}}, this is {{agent_name}} from {{company_name}}. {{call_purpose}} Is now a good time?';
const FR_DEFAULT = 'Bonjour {{lead_first_name}}, ici {{agent_name}}, de {{company_name}}. {{call_purpose}} Est-ce un bon moment pour vous ?';
const CUSTOM = 'Hey {{lead_first_name}}! {{agent_name}} here from {{company_name}} about your sofa.';
const FR_CUSTOM = 'Bonjour {{lead_first_name}} ! Ici {{agent_name}}, de {{company_name}}, au sujet de votre canapé.';
const ALLOWED = ['lead_first_name', 'agent_name', 'company_name', 'call_purpose', 'pitch', 'objection_handling'];
const RECOMMENDED = ['lead_first_name', 'agent_name', 'company_name', 'call_purpose'];

// As the backend sends them: an English guide's English tips are its own tips (the same list twice).
const tipsFor = (code) => {
  const target = [`${code} tip one`, `${code} tip two`];
  return { target, en: code === 'en' ? target : [`English tip one (${code})`, `English tip two (${code})`] };
};
const TEMPLATES = { en: EN_DEFAULT, fr: FR_DEFAULT };
const guide = (code) => ({ language: code, tips: tipsFor(code), example: `${code} example line`, template: TEMPLATES[code] || `${code} template`,
  allowed_variables: ALLOWED, recommended_variables: RECOMMENDED, max_length: 500 });
const answer = (patch) => ({ data: { language: 'fr', opening_line: FR_DEFAULT, source: 'template', fallback_reason: null,
  current_is_default: true, variables: RECOMMENDED, unknown_variables: [], tips: tipsFor(patch?.language || 'fr'),
  example: 'example', ...patch } });
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function Harness({ line = EN_DEFAULT, primary = 'en', agentType = 'sdr_outbound', update = () => {} }) {
  const [payload, setPayload] = useState({
    persona: { name: 'Riya', gender: 'female' }, languages: { primary, supported: [] }, opener: { first_message: line },
  });
  const onUpdate = (path, value) => { update(path, value); setPayload((p) => setPath(p, path, value)); };
  return (
    <MemoryRouter>
      <IdentityStep agentType={agentType} payload={payload} context={{ languages: LANGUAGES }}
        field={fieldPropsFor({ payload, update: onUpdate, errors: {}, conflicts: [], readOnly: false })} />
    </MemoryRouter>
  );
}

const box = () => screen.getByLabelText('Opening line');
const pick = (code) => userEvent.selectOptions(screen.getByLabelText('Primary language'), code);

beforeEach(() => {
  resetOpeningLineGuides();
  api.getOpeningLineGuide.mockImplementation((type, code) => Promise.resolve({ data: guide(code) }));
  api.suggestOpeningLine.mockResolvedValue(answer());
});

describe('changing the primary language', () => {
  test('a default line is replaced by the suggestion through the form, with the badge', async () => {
    const update = jest.fn();
    render(<Harness update={update} />);
    await pick('fr');
    await waitFor(() => expect(box()).toHaveValue(FR_DEFAULT));
    expect(api.suggestOpeningLine).toHaveBeenCalledTimes(1);
    expect(api.suggestOpeningLine).toHaveBeenCalledWith('sdr_outbound', { language: 'fr', current_opening_line: EN_DEFAULT });
    expect(update).toHaveBeenCalledWith('opener.first_message', FR_DEFAULT); // the normal path: autosave runs
    expect(screen.getByTestId('opening-line-suggested')).toHaveTextContent('Suggested — review before publishing');
    expect(screen.queryByTestId('opening-line-notice')).not.toBeInTheDocument();

    // Editing the line takes the badge away.
    await userEvent.type(box(), '!');
    expect(screen.queryByTestId('opening-line-suggested')).not.toBeInTheDocument();
  });

  test('no label during the debounce; "Loading suggestion…" for a default line once the request is sent', async () => {
    const wait = deferred();
    api.suggestOpeningLine.mockReturnValue(wait.promise);
    render(<Harness />);
    await screen.findByText('en tip one'); // the English guide (and its default line) has arrived
    await pick('fr');
    expect(api.suggestOpeningLine).not.toHaveBeenCalled();
    expect(screen.queryByTestId('opening-line-pending')).not.toBeInTheDocument();
    expect(box()).not.toHaveAttribute('aria-busy');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalled());
    expect(screen.getByTestId('opening-line-pending')).toHaveTextContent('Loading suggestion…');
    expect(box()).toHaveAttribute('aria-busy', 'true');
    await act(async () => wait.resolve(answer()));
    expect(screen.queryByTestId('opening-line-pending')).not.toBeInTheDocument();
  });

  test.each([['an empty line', ''], ['a custom line', CUSTOM]])('%s: the label says what is happening', async (what, line) => {
    api.suggestOpeningLine.mockReturnValue(new Promise(() => {}));
    render(<Harness line={line} />);
    await pick('fr');
    expect(await screen.findByTestId('opening-line-pending'))
      .toHaveTextContent(line ? 'Translating…' : 'Loading suggestion…');
  });

  test('a line the user wrote is kept; the notice offers the suggestion: Replace fills it, Keep mine leaves it', async () => {
    api.suggestOpeningLine.mockResolvedValue(answer({ opening_line: FR_CUSTOM, source: 'translated', current_is_default: false }));
    const update = jest.fn();
    render(<Harness line={CUSTOM} update={update} />);
    await pick('fr');
    const notice = await screen.findByTestId('opening-line-notice');
    expect(notice).toHaveTextContent('Your opening line is in English. Use the suggested French version?');
    expect(within(notice).getByTestId('opening-line-suggestion')).toHaveTextContent(FR_CUSTOM);
    expect(screen.queryByTestId('opening-line-fallback')).not.toBeInTheDocument();
    expect(box()).toHaveValue(CUSTOM);
    expect(update).not.toHaveBeenCalledWith('opener.first_message', expect.anything());

    await userEvent.click(within(notice).getByRole('button', { name: 'Replace' }));
    expect(box()).toHaveValue(FR_CUSTOM);
    expect(update).toHaveBeenCalledWith('opener.first_message', FR_CUSTOM);
    expect(screen.getByTestId('opening-line-suggested')).toBeInTheDocument();
    expect(screen.queryByTestId('opening-line-notice')).not.toBeInTheDocument();
  });

  test('Keep mine closes the notice and leaves the line', async () => {
    api.suggestOpeningLine.mockResolvedValue(answer({ opening_line: FR_CUSTOM, source: 'translated', current_is_default: false }));
    render(<Harness line={CUSTOM} />);
    await pick('fr');
    await userEvent.click(within(await screen.findByTestId('opening-line-notice')).getByRole('button', { name: 'Keep mine' }));
    expect(screen.queryByTestId('opening-line-notice')).not.toBeInTheDocument();
    expect(box()).toHaveValue(CUSTOM);
    expect(screen.queryByTestId('opening-line-suggested')).not.toBeInTheDocument();
  });

  test('a default line the user edits while the suggestion is on its way is theirs: notice, no overwrite', async () => {
    const wait = deferred();
    api.suggestOpeningLine.mockReturnValue(wait.promise);
    render(<Harness />);
    await pick('fr');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalled());
    fireEvent.change(box(), { target: { value: CUSTOM } });
    await act(async () => wait.resolve(answer()));
    expect(box()).toHaveValue(CUSTOM);
    expect(await screen.findByTestId('opening-line-notice')).toBeInTheDocument();
  });

  test('variables_changed with unknown variables names them in the notice', async () => {
    api.suggestOpeningLine.mockResolvedValue(answer({ current_is_default: false, fallback_reason: 'variables_changed',
      unknown_variables: ['lead_nam'] }));
    render(<Harness line="Hi {{lead_nam}}, this is {{agent_name}}." />);
    await pick('fr');
    expect(await screen.findByTestId('opening-line-fallback')).toHaveTextContent(
      'Your line has unknown variables ({{lead_nam}}), so this is the standard French line. Fix them and change the language again to get a translation.');
  });

  test('any other fallback: the "couldn\'t translate" note', async () => {
    api.suggestOpeningLine.mockResolvedValue(answer({ current_is_default: false, fallback_reason: 'timeout' }));
    render(<Harness line={CUSTOM} />);
    await pick('fr');
    expect(await screen.findByTestId('opening-line-fallback')).toHaveTextContent(
      "We couldn't translate your line, so this is the standard French opening line.");
  });
});

describe('when suggest is called', () => {
  test('never on load, and never for the "Can switch to" languages', async () => {
    render(<Harness />);
    await waitFor(() => expect(api.getOpeningLineGuide).toHaveBeenCalledWith('sdr_outbound', 'en'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'French' }));
    await new Promise((r) => setTimeout(r, 400)); // past the debounce
    expect(api.suggestOpeningLine).not.toHaveBeenCalled();
  });

  test('a fast double change asks once, for the last language', async () => {
    render(<Harness />);
    await pick('fr');
    await pick('es');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalledTimes(1));
    expect(api.suggestOpeningLine).toHaveBeenCalledWith('sdr_outbound', expect.objectContaining({ language: 'es' }));
  });

  test('a change while a request is in flight: only the last answer applies', async () => {
    const first = deferred();
    const second = deferred();
    api.suggestOpeningLine.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<Harness />);
    await pick('fr');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalledTimes(1));
    await pick('es');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalledTimes(2));
    const spanish = 'Hola, {{lead_first_name}}, le habla {{agent_name}}, de {{company_name}}. {{call_purpose}} ¿Es un buen momento?';
    await act(async () => second.resolve(answer({ language: 'es', opening_line: spanish })));
    await act(async () => first.resolve(answer()));
    expect(box()).toHaveValue(spanish);
  });

  test('a network failure leaves the line and offers Try again', async () => {
    api.suggestOpeningLine.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(answer());
    render(<Harness />);
    await pick('fr');
    expect(await screen.findByTestId('opening-line-error')).toHaveTextContent("Couldn't get a suggested opening line");
    expect(box()).toHaveValue(EN_DEFAULT);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(box()).toHaveValue(FR_DEFAULT));
    expect(screen.queryByTestId('opening-line-error')).not.toBeInTheDocument();
  });

  test('a language with no suggestion yet: a quiet note under the box', async () => {
    api.suggestOpeningLine.mockRejectedValue({ response: { status: 422,
      data: { detail: { code: 'opening_line_language_not_supported', message: 'no' } } } });
    render(<Harness />);
    await pick('fr');
    expect(await screen.findByTestId('opening-line-unavailable')).toHaveTextContent(
      'No suggested opening line for this language yet. Write your own, or pick another language.');
    expect(screen.queryByTestId('opening-line-error')).not.toBeInTheDocument();
    expect(box()).toHaveValue(EN_DEFAULT);
    // Another language clears it.
    api.suggestOpeningLine.mockResolvedValue(answer({ language: 'es', opening_line: 'Hola' }));
    await pick('es');
    expect(screen.queryByTestId('opening-line-unavailable')).not.toBeInTheDocument();
  });

  test.each([
    ['403', { status: 403 }],
    ['404', { status: 404 }],
    ['422 opening_line_not_supported', { status: 422, data: { detail: { code: 'opening_line_not_supported' } } }],
  ])('%s shows nothing', async (what, response) => {
    api.suggestOpeningLine.mockRejectedValue({ response });
    render(<Harness />);
    await pick('fr');
    await waitFor(() => expect(api.suggestOpeningLine).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('opening-line-pending')).not.toBeInTheDocument());
    expect(screen.queryByTestId('opening-line-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('opening-line-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('opening-line-unavailable')).not.toBeInTheDocument();
    expect(box()).toHaveValue(EN_DEFAULT);
  });
});

describe('the tips panel', () => {
  test('target tips, the English toggle, and only the recommended variables as chips', async () => {
    render(<Harness primary="fr" line={FR_DEFAULT} />);
    const panel = screen.getByTestId('opening-line-tips');
    expect(within(panel).getByText('How to write the opening line')).toBeInTheDocument();
    expect(await within(panel).findByText('fr tip one')).toBeInTheDocument();
    expect(within(panel).getByTestId('opening-line-example')).toHaveTextContent('fr example line');
    await userEvent.click(within(panel).getByRole('button', { name: 'Show in English' }));
    expect(within(panel).getByText('English tip one (fr)')).toBeInTheDocument();
    expect(within(panel).queryByText('fr tip one')).not.toBeInTheDocument();

    const chips = within(screen.getByTestId('opening-line-variables')).getAllByRole('button').map((b) => b.textContent);
    expect(chips).toEqual(RECOMMENDED.map((v) => `{{${v}}}`));
    expect(screen.getByText(/is spoken exactly as written in the campaign/)).toBeInTheDocument();
    // The box's hint comes from the guide too.
    expect(screen.getByText(`Placeholders: ${RECOMMENDED.map((v) => `{{${v}}}`).join(', ')}.`)).toBeInTheDocument();
  });

  test('English has no English toggle', async () => {
    render(<Harness />);
    expect(await screen.findByText('en tip one')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show in English' })).not.toBeInTheDocument();
  });

  test('a chip inserts {{name}} at the cursor', async () => {
    render(<Harness line="Hi , welcome" />);
    const el = box();
    el.setSelectionRange(3, 3);
    await userEvent.click(within(screen.getByTestId('opening-line-variables')).getByRole('button', { name: '{{lead_first_name}}' }));
    expect(box()).toHaveValue('Hi {{lead_first_name}}, welcome');
  });

  test('at the character limit a chip inserts nothing and says so, until the next edit', async () => {
    const full = 'x'.repeat(490);
    render(<Harness line={full} />);
    await screen.findByText('en tip one');
    await userEvent.click(within(screen.getByTestId('opening-line-variables')).getByRole('button', { name: '{{agent_name}}' }));
    expect(box()).toHaveValue(full);
    expect(screen.getByTestId('opening-line-no-room')).toHaveTextContent(
      'No room for this variable — the opening line is at the 500-character limit.');
    fireEvent.change(box(), { target: { value: 'x'.repeat(480) } });
    expect(screen.queryByTestId('opening-line-no-room')).not.toBeInTheDocument();
  });

  test('the guide is read once per language for the session', async () => {
    const { unmount } = render(<Harness />);
    await screen.findByText('en tip one');
    unmount();
    render(<Harness />);
    await screen.findByText('en tip one');
    expect(api.getOpeningLineGuide).toHaveBeenCalledTimes(1);
  });
});

describe('text direction and warnings', () => {
  test('Arabic: the box, the notice and the example are right-to-left', async () => {
    const arabic = 'مرحبا {{lead_first_name}}، معكم {{agent_name}} من {{company_name}}.';
    api.suggestOpeningLine.mockResolvedValue(answer({ language: 'ar', opening_line: arabic, source: 'translated', current_is_default: false }));
    render(<Harness line={CUSTOM} />);
    expect(box()).toHaveAttribute('dir', 'ltr');
    await pick('ar');
    expect(await screen.findByTestId('opening-line-suggestion')).toHaveAttribute('dir', 'rtl');
    expect(box()).toHaveAttribute('dir', 'rtl');
    expect(await screen.findByTestId('opening-line-example')).toHaveAttribute('dir', 'rtl');
  });

  test('an unknown variable typed in the box is flagged (save is not blocked)', async () => {
    render(<Harness />);
    await screen.findByText('en tip one'); // the allowed list has arrived
    fireEvent.change(box(), { target: { value: 'Hi {{lead_nam}}, this is {{agent_name}}.' } });
    expect(screen.getByTestId('opening-line-unknown')).toHaveTextContent('Unknown variable: {{lead_nam}}.');
    fireEvent.change(box(), { target: { value: 'Hi {{lead_first_name}}.' } });
    expect(screen.queryByTestId('opening-line-unknown')).not.toBeInTheDocument();
  });

  test('a voice that is not ready for the primary language is flagged under the select', async () => {
    api.suggestOpeningLine.mockResolvedValue(answer({ language: 'ar', opening_line: 'مرحبا' }));
    render(<Harness />);
    expect(screen.queryByTestId('voice-status')).not.toBeInTheDocument();
    await pick('ar');
    expect(screen.getByTestId('voice-status')).toHaveTextContent('No tested Arabic female voice yet.');
  });
});

test('none of it is on an agent type without an opening line', async () => {
  render(<Harness agentType="sdr_inbound" primary="en" line="" />);
  await pick('ar');
  await new Promise((r) => setTimeout(r, 400));
  expect(api.suggestOpeningLine).not.toHaveBeenCalled();
  expect(api.getOpeningLineGuide).not.toHaveBeenCalled();
  expect(screen.queryByTestId('opening-line')).not.toBeInTheDocument();
  expect(screen.queryByTestId('voice-status')).not.toBeInTheDocument();
});
