// F-07: every setup field says whether it reaches calls, from the server's `fields` metadata (no list here).
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as api from '@/lib/api';
import { FieldUseProvider, ListField, NOT_USED_NOTE, SelectField, SwitchField, TextField } from '@/pages/agentConfig/fields';
import { BehaviourStep, BusinessStep, CampaignDefaultsStep, IdentityStep, InboundStep, fieldPropsFor } from '@/pages/agentConfig/steps';
import { USERS } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  getAgentInstance: jest.fn(), getAgentInstanceVersion: jest.fn(), updateBusinessProfile: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const FIELDS = {
  tone: { applied_to_calls: true },
  'calling.window': { applied_to_calls: false },
  'call_behaviour.max_duration_seconds': { applied_to_calls: true },
  'call_behaviour.voicemail_message': { applied_to_calls: true },
  'call_behaviour.end_call_message': { applied_to_calls: true },
  'call_behaviour.silence_timeout_seconds': { applied_to_calls: false, read_only: true, set_by: 'platform' },
  target_customer: { applied_to_calls: true },
  sales_approach: { applied_to_calls: true },
  conversation_length: { applied_to_calls: true },
  'guardrails.custom_instructions': { applied_to_calls: true },
  qualification_questions: { applied_to_calls: true },
};

const field = (payload = {}, update = jest.fn()) => fieldPropsFor({ payload, update, errors: {}, conflicts: [], readOnly: false });
const withUse = (ui, meta = FIELDS) => render(<MemoryRouter><FieldUseProvider value={meta}>{ui}</FieldUseProvider></MemoryRouter>);
const badgeOf = (container) => within(container).queryByTestId('use-badge')?.textContent || null;

beforeEach(() => jest.clearAllMocks());

describe('the badge comes from the metadata', () => {
  test('used, not used (with its note), not listed, and no provider at all', () => {
    withUse(<>
      <div data-testid="a"><SelectField label="Tone" path="tone" options={[]} value="" /></div>
      <div data-testid="b"><TextField label="Window" path="calling.window" value="" /></div>
      <div data-testid="c"><TextField label="Unknown" path="something.else" value="" /></div>
    </>);
    expect(badgeOf(screen.getByTestId('a'))).toBe('Used on calls');
    expect(badgeOf(screen.getByTestId('b'))).toBe('Not used on calls yet');
    expect(within(screen.getByTestId('b')).getByText(NOT_USED_NOTE)).toBeInTheDocument();
    expect(within(screen.getByTestId('a')).queryByText(NOT_USED_NOTE)).not.toBeInTheDocument();
    expect(badgeOf(screen.getByTestId('c'))).toBeNull();
  });

  test('every field kind shows it; outside a provider (the campaign builder) nothing is shown', () => {
    const meta = { 'x.list': { applied_to_calls: false }, 'x.switch': { applied_to_calls: true } };
    withUse(<>
      <div data-testid="list"><ListField label="L" path="x.list" values={[]} onChange={() => {}} /></div>
      <div data-testid="switch"><SwitchField label="S" path="x.switch" checked={false} onChange={() => {}} /></div>
    </>, meta);
    expect(badgeOf(screen.getByTestId('list'))).toBe('Not used on calls yet');
    expect(badgeOf(screen.getByTestId('switch'))).toBe('Used on calls');
    render(<TextField label="Plain" path="tone" value="" />);
    expect(screen.getAllByTestId('use-badge')).toHaveLength(2);  // only the two inside the provider
  });
});

describe('the steps', () => {
  test('call behaviour: badges on the wired fields; silence is the platform value, read-only', () => {
    withUse(<BehaviourStep payload={{}} field={field()} platform={{ silence_timeout_seconds: 20 }} />);
    const box = (label) => screen.getByLabelText(label).parentElement;  // the field's own container
    expect(badgeOf(box('Voicemail message'))).toBe('Used on calls');
    expect(badgeOf(box('Maximum call length (seconds)'))).toBe('Used on calls');
    const silence = screen.getByTestId('silence-timeout');
    expect(silence).toHaveTextContent('20 seconds');
    expect(silence).toHaveTextContent('Set by the platform');
    expect(within(silence).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/not every setting is applied/i)).not.toBeInTheDocument();
  });

  test('silence with no published shared assistant: not set', () => {
    withUse(<BehaviourStep payload={{}} field={field()} platform={{}} />);
    expect(screen.getByTestId('silence-timeout')).toHaveTextContent('Not set');
  });

  test('gender: says what it does today, no verb-form claim', () => {
    withUse(<IdentityStep agentType="sdr_outbound" payload={{}} context={{ languages: [] }} field={field()} />);
    expect(screen.getByText(/match its voice and to refer to itself/i)).toBeInTheDocument();
    expect(screen.queryByText(/verb forms/i)).not.toBeInTheDocument();
  });

  test('business details use the profile’s own metadata', () => {
    const business = { company_name: 'Acme', locations: [], fields: {
      industry: { applied_to_calls: true, used_by: ['sdr_inbound', 'sdr_outbound'] },
      brochure: { applied_to_calls: false, used_by: [] } } };
    render(<MemoryRouter><BusinessStep context={{ business }} user={USERS.tenant_admin} /></MemoryRouter>);
    expect(badgeOf(screen.getByLabelText('Industry').parentElement)).toBe('Used on calls');
    const brochure = screen.getByLabelText('Company brochure (link)').parentElement;
    expect(badgeOf(brochure)).toBe('Not used on calls yet');
    expect(within(brochure).getByText(NOT_USED_NOTE)).toBeInTheDocument();
  });

  test('inbound: its own questions list, starting from Outbound SDR’s', async () => {
    api.getAgentInstance.mockResolvedValue({ data: { draft_version: null, published_version: 3 } });
    api.getAgentInstanceVersion.mockResolvedValue({ data: { payload: { qualification_questions: ['Budget?', 'When?', 'Who decides?'] } } });
    const update = jest.fn();
    withUse(<InboundStep payload={{}} context={{}} field={field({}, update)} readOnly={false} />);
    expect(screen.getByText('Qualification questions')).toBeInTheDocument();
    await waitFor(() => expect(update).toHaveBeenCalledWith('qualification_questions', ['Budget?', 'When?', 'Who decides?']));
    expect(api.getAgentInstanceVersion).toHaveBeenCalledWith('sdr_outbound', 3);
  });

  test('inbound with questions of its own, or read-only: nothing is copied', () => {
    const update = jest.fn();
    withUse(<InboundStep payload={{ qualification_questions: ['Mine?'] }} context={{}} field={field({ qualification_questions: ['Mine?'] }, update)} readOnly={false} />);
    withUse(<InboundStep payload={{}} context={{}} field={field({}, update)} readOnly />);
    expect(api.getAgentInstance).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('limits a call can carry', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  test('a saved version with 7 questions warns on both screens; 6 does not', () => {
    const { unmount } = withUse(<CampaignDefaultsStep payload={{ qualification_questions: seven }} field={field({ qualification_questions: seven })} />);
    expect(screen.getByTestId('questions-over')).toHaveTextContent('Only the first 6 are asked on calls');
    expect(screen.getByText('Qualification questions', { exact: false })).toBeInTheDocument();
    unmount();
    withUse(<InboundStep payload={{ qualification_questions: seven }} context={{}} field={field({ qualification_questions: seven })} readOnly />);
    expect(screen.getByTestId('questions-over')).toBeInTheDocument();
  });

  test('six questions: no warning, and no button to add a seventh', () => {
    const six = seven.slice(0, 6);
    withUse(<CampaignDefaultsStep payload={{ qualification_questions: six }} field={field({ qualification_questions: six })} />);
    expect(screen.queryByTestId('questions-over')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add a question/ })).not.toBeInTheDocument();
  });

  test('extra instructions: 600-character field with a counter; a longer saved value warns with its length', () => {
    const long = 'x'.repeat(750);
    withUse(<BehaviourStep payload={{ guardrails: { custom_instructions: long } }} field={field({ guardrails: { custom_instructions: long } })} platform={{}} />);
    expect(screen.getByLabelText('Extra instructions')).toHaveAttribute('maxLength', '600');
    expect(screen.getByText('750/600')).toBeInTheDocument();
    expect(screen.getByTestId('instructions-over')).toHaveTextContent('Calls use only the first 600 characters (now 750)');
  });
});
