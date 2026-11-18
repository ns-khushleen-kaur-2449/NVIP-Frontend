import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { RealEstateRoute } from '@/pages/realEstate/RealEstateAgent';
import * as api from '@/lib/api';
import { callRefusal, formProblem } from '@/lib/realEstate';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listRealEstateCalls: jest.fn(),
  getRealEstateCall: jest.fn(),
  startRealEstateCall: jest.fn(),
  getRealEstateCallTranscript: jest.fn(),
  getRealEstateCallRecording: jest.fn(),
}));

const AT = '2026-11-18T09:00:00Z';
const CALL = {
  id: 'r-1', lead_name: 'Asha Rao', phone_number: '+919812345670', has_knowledge_base: true, status: 'ended',
  outcome: 'answered', failure_code: null, requested_by: 2, dialed_at: AT, ended_at: AT, created_at: AT, updated_at: AT,
  has_transcript: true, has_recording: false, knowledge_base: 'Palm Springs villas from 1.2 Cr.',
  site_visit: { label: 'Saturday, 22 November at 11 AM', start: '2026-11-22T11:00:00+05:30', executive_name: 'Ravi' },
};

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-3', key: 'real_estate', name: 'Real Estate' }] });
  api.listRealEstateCalls.mockResolvedValue({ data: [CALL] });
  api.getRealEstateCall.mockResolvedValue({ data: CALL });
  api.startRealEstateCall.mockResolvedValue({ status: 201, data: { ...CALL, id: 'r-2', status: 'in_progress' } });
  api.getRealEstateCallTranscript.mockResolvedValue({ data: { call_id: 'r-1', transcript: 'AI: Hi Asha', summary: 'Wants a visit.' } });
});

function open(role, path = '/real_estate_agent') {
  return renderWithAuth(
    <Routes>
      <Route path="/real_estate_agent/*" element={<RealEstateRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path },
  );
}

describe('Real Estate: who may open it', () => {
  test('a Tenant Admin lands on New call', async () => {
    open('tenant_admin');
    expect(await screen.findByLabelText(/Lead's name/)).toBeInTheDocument();
  });

  test('a rep reads the calls but has no New call', async () => {
    open('rep');
    expect(await screen.findByTestId('call-row-r-1')).toHaveTextContent('Asha Rao');
    expect(screen.queryByRole('link', { name: 'New call' })).not.toBeInTheDocument();
  });

  test('a Super Admin gets 403 and nothing is loaded', () => {
    open('super_admin');
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(api.listAvailableAgents).not.toHaveBeenCalled();
  });

  test('an organisation without the agent is told so', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [] });
    open('tenant_admin');
    expect(await screen.findByText('Real Estate is not available to your organisation')).toBeInTheDocument();
    expect(api.listRealEstateCalls).not.toHaveBeenCalled();
  });
});

describe('Real Estate: placing a call', () => {
  test('name, phone and knowledge base are sent with one key, and the call page opens', async () => {
    const user = userEvent.setup();
    open('manager');
    await user.type(await screen.findByLabelText(/Lead's name/), 'Asha Rao');
    await user.type(screen.getByLabelText(/Phone number/), '9812345670');
    await user.type(screen.getByLabelText(/Knowledge base/), 'Palm Springs villas');
    await user.click(screen.getByRole('button', { name: /Call now/ }));
    await waitFor(() => expect(api.startRealEstateCall).toHaveBeenCalledTimes(1));
    const body = api.startRealEstateCall.mock.calls[0][0];
    expect(body).toMatchObject({ lead_name: 'Asha Rao', phone_number: '9812345670', knowledge_base: 'Palm Springs villas' });
    expect(body.idempotency_key).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
  });

  test('without a knowledge base none is sent', async () => {
    const user = userEvent.setup();
    open('tenant_admin');
    await user.type(await screen.findByLabelText(/Lead's name/), 'Ravi');
    await user.type(screen.getByLabelText(/Phone number/), '+919800000000');
    await user.click(screen.getByRole('button', { name: /Call now/ }));
    await waitFor(() => expect(api.startRealEstateCall).toHaveBeenCalled());
    expect(api.startRealEstateCall.mock.calls[0][0].knowledge_base).toBeNull();
  });

  test("a refusal shows the backend's message and what to do", async () => {
    api.startRealEstateCall.mockRejectedValue({ response: { status: 409, data: { detail: {
      code: 'call_in_progress', message: 'A call to this number is already in progress' } } } });
    const user = userEvent.setup();
    open('tenant_admin');
    await user.type(await screen.findByLabelText(/Lead's name/), 'Ravi');
    await user.type(screen.getByLabelText(/Phone number/), '+919800000000');
    await user.click(screen.getByRole('button', { name: /Call now/ }));
    expect(await screen.findByText('A call to this number is already in progress')).toBeInTheDocument();
  });

  test('the form is checked before sending', () => {
    expect(formProblem({ lead_name: '', phone_number: '1', knowledge_base: '' })).toMatch(/name/);
    expect(formProblem({ lead_name: 'A', phone_number: ' ', knowledge_base: '' })).toMatch(/phone/);
    expect(formProblem({ lead_name: 'A', phone_number: '1', knowledge_base: 'x'.repeat(20001) })).toMatch(/at most/);
    expect(formProblem({ lead_name: 'A', phone_number: '1', knowledge_base: '' })).toBeNull();
    expect(callRefusal({ response: { data: { detail: [{ msg: 'x' }] } } }).message).toMatch(/Check/);
  });
});

describe('Real Estate: a call page', () => {
  test('shows the knowledge base and the transcript on request, and no site visit panel', async () => {
    const user = userEvent.setup();
    open('rep', '/real_estate_agent/calls/r-1');
    expect(await screen.findByText('Palm Springs villas from 1.2 Cr.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Site visit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Call again/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show transcript' }));
    expect(await screen.findByText('AI: Hi Asha')).toBeInTheDocument();
  });

  test('what the lead said is shown', async () => {
    api.getRealEstateCall.mockResolvedValue({ data: { ...CALL, site_visit: null, lead_facts: {
      site_visit_requested: true, site_visit_time: 'tomorrow at 5 PM', purpose: 'investment',
      property_type: 'commercial space', budget: null, callback_time: null } } });
    open('rep', '/real_estate_agent/calls/r-1');
    expect(await screen.findByText('commercial space')).toBeInTheDocument();
    expect(screen.queryByText(/Requested:/)).not.toBeInTheDocument();
  });

  test('Call again opens New call with the same details', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/real_estate_agent/calls/r-1');
    await user.click(await screen.findByRole('button', { name: /Call again/ }));
    expect(await screen.findByLabelText(/Lead's name/)).toHaveValue('Asha Rao');
    expect(screen.getByLabelText(/Knowledge base/)).toHaveValue('Palm Springs villas from 1.2 Cr.');
  });
});
