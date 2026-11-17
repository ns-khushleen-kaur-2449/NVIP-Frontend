import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignBuilderPage from '@/pages/campaignBuilder/CampaignBuilderPage';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

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

const toConfigure = async () => {
  renderWithAuth(<CampaignBuilderPage />, { user: USERS.manager });
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Select Asha Verma' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Ravi Kumar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next: Configure campaign' }));
  await screen.findByRole('heading', { name: 'Campaign basics' });
};

test('Next with nothing filled in: the error is shown and focus moves to the first field', async () => {
  await toConfigure();
  await userEvent.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  expect(await screen.findByText('Give the campaign a name.')).toBeInTheDocument();
  await waitFor(() => expect(document.activeElement).toHaveAttribute('data-field', 'name'));
  expect(screen.queryByRole('heading', { name: 'Checks before launch' })).not.toBeInTheDocument();
});

test('offer off: its fields are hidden; launch sends goal, priority and the brief with the offer disabled', async () => {
  await toConfigure();
  expect(screen.queryByLabelText(/^Offer/)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Campaign name/), 'Diwali camp');
  await userEvent.type(screen.getByLabelText(/Why are we calling/), 'You asked about a service.');
  await userEvent.type(screen.getByLabelText('Key points 1'), 'Free inspection');
  await userEvent.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  expect(await screen.findByRole('heading', { name: 'Checks before launch' })).toBeInTheDocument();
  expect(screen.getAllByTestId('sample-opening')).toHaveLength(2);
  expect(screen.getByText('2 ready')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Launch now' }));
  await waitFor(() => expect(api.createVoiceCampaign).toHaveBeenCalled());
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
  expect(mockNavigate).toHaveBeenCalledWith('/voice-campaigns/c-9');
});

test('all four goals can be chosen; the goal is sent', async () => {
  await toConfigure();
  for (const name of [/Send a brochure/, /Arrange a callback/, /Qualify only/]) {
    expect(screen.getByRole('radio', { name })).toBeEnabled();
  }
  expect(screen.getByRole('radio', { name: /Book a meeting/ })).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: /Arrange a callback/ }));
  await userEvent.type(screen.getByLabelText(/Campaign name/), 'Callbacks');
  await userEvent.type(screen.getByLabelText(/Why are we calling/), 'Following up.');
  await userEvent.click(screen.getByRole('button', { name: 'Next: Review and launch' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Launch now' }));
  await waitFor(() => expect(api.createVoiceCampaign).toHaveBeenCalled());
  expect(api.createVoiceCampaign.mock.calls[0][0].goal).toBe('callback');
});
