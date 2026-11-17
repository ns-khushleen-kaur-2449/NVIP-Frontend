import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignBuilderPage from '@/pages/campaignBuilder/CampaignBuilderPage';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { pickToProspect } from '@/pages/Prospecting';

jest.mock('@/lib/api', () => ({
  getProspects: jest.fn(),
  getAssistants: jest.fn(),
  getCatalogItems: jest.fn(),
  checkCampaignSchedule: jest.fn(),
  previewCampaignOffer: jest.fn(),
  createVoiceCampaign: jest.fn(),
  getAgentInstance: jest.fn(),
  getAgentInstanceVersion: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

beforeEach(() => {
  jest.clearAllMocks();
  api.getProspects.mockResolvedValue({ data: { prospects: [
    { prospect_id: 'p-1', full_name: 'Asha Verma', phone: '+919876543210', source: 'Trade fair' },
    { prospect_id: 'p-2', full_name: 'Ravi Kumar', phone: '+919876543211', source: 'CRM import' },
  ] } });
  api.getAssistants.mockResolvedValue({ data: [{ id: 1, name: 'Main agent', vapi_assistant_id: 'va-1', is_live: true }] });
  api.getCatalogItems.mockResolvedValue({ data: { items: [] } });
  api.checkCampaignSchedule.mockResolvedValue({ data: { warnings: [], retry_defaults: null } });
  api.createVoiceCampaign.mockResolvedValue({ data: { id: 'c-9', total_leads: 2 } });
});

// Text is set with one change event (not typed key by key) and every step waits for what it needs, so the tests
// do not depend on how fast the machine is.
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const toConfigure = async () => {
  const user = userEvent.setup();
  renderWithAuth(<CampaignBuilderPage />, { user: USERS.manager });
  await user.click(await screen.findByRole('checkbox', { name: 'Select Asha Verma' }));
  await user.click(screen.getByRole('checkbox', { name: 'Select Ravi Kumar' }));
  await user.click(screen.getByRole('button', { name: 'Next: Configure campaign' }));
  await screen.findByRole('heading', { name: 'Campaign basics' });
  // The assistant list has loaded and the live one is chosen before anything is validated.
  await waitFor(() => expect(screen.getByLabelText(/Assistant that places the calls/)).toHaveValue('va-1'));
  return user;
};

test('prospects sent from the finder stay preselected while the campaign prospect list loads', async () => {
  // What Prospecting really hands over: its picks (lib/prospectSelection), mapped at the hand-off.
  const picks = [{ id: 'p-3', name: 'Maya Prospect', phone: '+919876543212', email: null, city: 'Pune', stage: null, created_at: null }];
  renderWithAuth(<CampaignBuilderPage />, {
    user: USERS.manager,
    path: { pathname: '/voice-campaigns/new', state: { fromProspecting: picks.map(pickToProspect) } },
  });
  expect(await screen.findByRole('checkbox', { name: 'Select Maya Prospect' })).toBeChecked();
  expect(await screen.findByRole('checkbox', { name: 'Select Asha Verma' })).not.toBeChecked();
});

test('Next with nothing filled in: the error is shown and focus moves to the first field', async () => {
  const user = await toConfigure();
  await user.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  expect(await screen.findByText('Give the campaign a name.')).toBeInTheDocument();
  await waitFor(() => expect(document.activeElement).toHaveAttribute('data-field', 'name'));
  expect(screen.queryByRole('heading', { name: 'Checks before launch' })).not.toBeInTheDocument();
});

test('offer off: its fields are hidden; launch sends goal, priority and the brief with the offer disabled', async () => {
  const user = await toConfigure();
  expect(screen.queryByLabelText(/^Offer/)).not.toBeInTheDocument();
  fill(/Campaign name/, 'Diwali camp');
  fill(/Why are we calling/, 'You asked about a service.');
  fill('Key points 1', 'Free inspection');
  await user.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  expect(await screen.findByRole('heading', { name: 'Checks before launch' })).toBeInTheDocument();
  expect(screen.getAllByTestId('sample-opening')).toHaveLength(2);
  expect(screen.getByText('2 ready')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Launch now' }));
  const body = api.createVoiceCampaign.mock.calls[0][0];
  expect(body).toMatchObject({
    name: 'Diwali camp', description: 'You asked about a service.', assistant_id: 'va-1', start: 'now',
    prospect_ids: ['p-1', 'p-2'], goal: 'book_meeting', priority: null,
    brief: { call_purpose: 'You asked about a service.', key_points: ['Free inspection'], qualification_overrides: [],
      offer: { enabled: false, text: null, valid_until: null, when_to_mention: null } },
  });
  // The backend writes the old pitch fields from the brief.
  expect(body).not.toHaveProperty('pitch');
  expect(body).not.toHaveProperty('announce_to_leads');
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/voice-campaigns/c-9'));
});

test('all four goals can be chosen; the goal is sent', async () => {
  const user = await toConfigure();
  for (const name of [/Send a brochure/, /Arrange a callback/, /Qualify only/]) {
    expect(screen.getByRole('radio', { name })).toBeEnabled();
  }
  expect(screen.getByRole('radio', { name: /Book a meeting/ })).toBeChecked();
  await user.click(screen.getByRole('radio', { name: /Arrange a callback/ }));
  fill(/Campaign name/, 'Callbacks');
  fill(/Why are we calling/, 'Following up.');
  await user.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  await user.click(await screen.findByRole('button', { name: 'Launch now' }));
  await waitFor(() => expect(api.createVoiceCampaign).toHaveBeenCalled());
  expect(api.createVoiceCampaign.mock.calls[0][0].goal).toBe('callback');
});

test('Prospecting hands over its picks in the builder\'s prospect shape', () => {
  expect(pickToProspect({ id: 'p-3', name: 'Maya Prospect', phone: '+91', email: 'm@x.co', city: 'Pune', stage: 'new', created_at: 't' }))
    .toEqual({ prospect_id: 'p-3', full_name: 'Maya Prospect', phone: '+91', email: 'm@x.co', city: 'Pune', stage: 'new', created_at: 't' });
});

test('shared assistants on: no assistant is chosen or sent', async () => {
  const user = userEvent.setup();
  api.getAgentInstance.mockResolvedValue({ data: { published_version: 1 } });
  api.getAgentInstanceVersion.mockResolvedValue({ data: { version: 1, payload: { persona: { name: 'Riya' } } } });
  renderWithAuth(<CampaignBuilderPage />, { user: { ...USERS.manager, features: { agent_instances: true, shared_assistants: true } } });
  await user.click(await screen.findByRole('checkbox', { name: 'Select Asha Verma' }));
  await user.click(screen.getByRole('button', { name: 'Next: Configure campaign' }));
  await screen.findByRole('heading', { name: 'Campaign basics' });
  fill(/Campaign name/, 'Shared');
  fill(/Why are we calling/, 'Hello.');
  await user.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  await user.click(await screen.findByRole('button', { name: 'Launch now' }));
  await waitFor(() => expect(api.createVoiceCampaign).toHaveBeenCalled());
  expect(api.createVoiceCampaign.mock.calls[0][0]).not.toHaveProperty('assistant_id');
});
