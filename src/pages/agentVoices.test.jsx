import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentsAdminPage from '@/pages/admin/AgentsAdmin';
import { cellsFrom, errorsByCell, voicesFrom, withBuilderVoices } from '@/components/admin/AgentVoicesDialog';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAgents: jest.fn(),
  createAgent: jest.fn(),
  updateAgent: jest.fn(),
  getAgentAccess: jest.fn(),
  setAgentAccess: jest.fn(),
  listAgentAssistants: jest.fn(),
  registerAgentAssistant: jest.fn(),
  removeAgentAssistant: jest.fn(),
  replaceAgentAssistant: jest.fn(),
  getAgentHealth: jest.fn(),
  getAgentBuilderVoices: jest.fn(),
  setAgentVoices: jest.fn(),
}));

const BUILDER = { provider: '11labs', voiceId: 'builder-voice', model: 'eleven_turbo_v2_5' };
const LANGUAGES = [
  { code: 'en', name: 'English', gendered: false, female: BUILDER, male: BUILDER },
  { code: 'hi', name: 'Hindi', gendered: false, female: BUILDER, male: BUILDER },
  { code: 'ar', name: 'Arabic', gendered: true, female: { provider: 'azure', voiceId: 'ar-f' }, male: null },
];
const AGENT = {
  id: 'a-in', key: 'sdr_inbound', name: 'Inbound SDR', status: 'active', access_scope: 'all', follows: 'sdr',
  settings: { follows: 'sdr', screen: null, voices: { en: { male: { provider: 'azure', voiceId: 'en-m' } } } },
};

beforeEach(() => {
  jest.clearAllMocks();
  api.listAgents.mockResolvedValue({ data: [AGENT] });
  api.getAgentHealth.mockResolvedValue({ data: { key: 'sdr_inbound', has_code: true, ok: true, problems: [], notices: [] } });
  api.listAgentAssistants.mockResolvedValue({ data: [] });
  api.getAgentBuilderVoices.mockResolvedValue({ data: { languages: LANGUAGES, providers: ['11labs', 'azure', 'cartesia'] } });
  api.setAgentVoices.mockResolvedValue({ data: AGENT });
});

async function openVoices(user) {
  renderWithAuth(<AgentsAdminPage />, { user: USERS.super_admin });
  await user.click(within(await screen.findByTestId('agent-row-sdr_inbound')).getByRole('button', { name: 'Voices' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByTestId('voices-row-en');
  return dialog;
}

describe('voice helpers', () => {
  test('copying fills only empty cells, and English/Hindi only Female', () => {
    const cells = cellsFrom({ en: { male: { provider: 'azure', voiceId: 'en-m' } } }, ['en', 'hi', 'ar']);
    const [next, filled] = withBuilderVoices(cells, LANGUAGES);
    expect(filled).toBe(3);
    expect(next.en.female).toEqual({ provider: '11labs', voiceId: 'builder-voice', model: 'eleven_turbo_v2_5' });
    expect(next.en.male.voiceId).toBe('en-m'); // kept
    expect(next.hi.male.voiceId).toBe(''); // not gendered: Male stays empty
    expect(next.ar.female.voiceId).toBe('ar-f');
    expect(next.ar.male.voiceId).toBe(''); // no builder voice
    expect(withBuilderVoices(next, LANGUAGES)[1]).toBe(0);
  });

  test('saving sends filled cells only; errors map to their cell', () => {
    const cells = cellsFrom({}, ['en', 'hi']);
    cells.en.female = { provider: '11labs', voiceId: ' v-1 ', model: '' };
    cells.hi.male = { provider: 'azure', voiceId: 'v-1', model: 'neural' }; // the same voice twice is fine
    expect(voicesFrom(cells)).toEqual({ en: { female: { provider: '11labs', voiceId: 'v-1' } },
      hi: { male: { provider: 'azure', voiceId: 'v-1', model: 'neural' } } });
    const [byCell, other] = errorsByCell([
      { loc: ['body', 'voices', 'en', 'male', 'voiceId'], msg: 'Required' },
      { loc: ['body', 'voices', 'de'], msg: 'Unknown language' },
    ]);
    expect(byCell).toEqual({ 'en.male': ['voice ID: Required'] });
    expect(other).toEqual(['de: Unknown language']);
  });
});

describe('Voices dialog (Super Admin)', () => {
  test('shows each language with its saved voices and the fallback for empty cells', async () => {
    const user = userEvent.setup();
    const dialog = await openVoices(user);
    expect(dialog).toHaveTextContent('Voices of Inbound SDR');
    expect(within(dialog).getByTestId('voices-row-hi')).toHaveTextContent('Hindi');
    expect(within(dialog).getByLabelText('English male voice ID')).toHaveValue('en-m');
    expect(within(dialog).getByTestId('voice-cell-en-female')).toHaveTextContent("Falls back to the assistant's default voice");
    expect(within(dialog).getByTestId('voice-cell-en-male')).not.toHaveTextContent('Falls back');
    const providers = within(within(dialog).getByTestId('voice-cell-hi-male')).getByLabelText('Hindi male provider');
    expect([...providers.options].map((o) => o.value)).toEqual(['', '11labs', 'azure', 'cartesia']);
  });

  test('copy builder voices fills empty cells and saves only on Save', async () => {
    const user = userEvent.setup();
    const dialog = await openVoices(user);
    await user.click(within(dialog).getByRole('button', { name: 'Copy builder voices' }));
    expect(within(dialog).getByLabelText('English female voice ID')).toHaveValue('builder-voice');
    expect(within(dialog).getByLabelText('Hindi male voice ID')).toHaveValue('');
    expect(within(dialog).getByTestId('voices-note')).toHaveTextContent('Filled 3 empty cells');
    expect(api.setAgentVoices).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.setAgentVoices).toHaveBeenCalledWith('a-in', {
      en: { female: BUILDER, male: { provider: 'azure', voiceId: 'en-m' } },
      hi: { female: BUILDER },
      ar: { female: { provider: 'azure', voiceId: 'ar-f' } },
    }));
  });

  test('a 422 is shown next to its cell', async () => {
    api.setAgentVoices.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'voices', 'en', 'male', 'voiceId'], msg: 'Required' }] } } });
    const user = userEvent.setup();
    const dialog = await openVoices(user);
    await user.clear(within(dialog).getByLabelText('English male voice ID'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(within(dialog).getByTestId('voice-cell-en-male')).findByRole('alert'))
      .toHaveTextContent('voice ID: Required');
    expect(within(dialog).getByTestId('voices-error')).toHaveTextContent('Fix the marked voices');
  });
});
