import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import AgentConfigPage, { AgentConfigEditor } from '@/pages/agentConfig/AgentConfigPage';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';
import { resetOpeningLineGuides } from '@/lib/openingLines';

jest.mock('@/lib/api', () => ({
  getAgentInstance: jest.fn(),
  getAgentInstanceVersion: jest.fn(),
  createAgentInstanceDraft: jest.fn(),
  updateAgentInstanceDraft: jest.fn(),
  discardAgentInstanceDraft: jest.fn(),
  publishAgentInstanceVersion: jest.fn(),
  rebaseAgentInstanceDraft: jest.fn(),
  restoreAgentInstanceVersion: jest.fn(),
  getBusinessProfile: jest.fn(),
  updateBusinessProfile: jest.fn(),
  listOwnPhoneNumbers: jest.fn(),
  getCatalogItems: jest.fn(),
  getCatalogSettings: jest.fn(),
  getBuilderLanguages: jest.fn(),
  previewAgentInstance: jest.fn(),
  suggestOpeningLine: jest.fn(),
  getOpeningLineGuide: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const ON = { features: { agent_instances: true, shared_assistants: false } };
const admin = { ...USERS.tenant_admin, ...ON };
const manager = { ...USERS.manager, ...ON };

const payload = (patch = {}) => ({
  schema_version: 1, source: {}, persona: { name: 'Riya', gender: 'female' }, languages: { primary: 'en', supported: [] },
  tone: 'friendly', qualification_questions: ['Budget?', 'Timeline?', 'Decision maker?'],
  opener: { first_message: 'Hi {{lead_first_name}}' }, calendar: { booking_enabled: false, meeting_types: [] },
  guardrails: {}, call_behaviour: {}, calling: { window: null, max_attempts_per_lead: 3 }, ...patch,
});

const VERSIONS = {
  2: { id: 'v2', version: 2, status: 'superseded', payload: payload() },
  4: { id: 'v4', version: 4, status: 'published', payload: payload({ tone: 'calm' }) },
  // The user's draft, made from version 2: gender and tone edited.
  5: { id: 'v5', version: 5, status: 'draft', base_version: 2, payload: payload({ tone: 'energetic', persona: { name: 'Riya', gender: 'male' } }) },
};
const at = '2026-11-17T10:00:00Z';
const INSTANCE = {
  id: 'i-1', agent_type: 'sdr_outbound', status: 'active', current_version: 5, published_version: 4, published_version_id: 'v4',
  draft_version: 5, created_at: at, updated_at: at,
  versions: [5, 4, 2].map((n) => ({ ...VERSIONS[n], payload: undefined, created_at: at, created_by: 2, created_by_name: 'Tara Admin' })),
};
// What the server preview answers (POST /api/v1/agent-instances/{type}/preview): shown as is, never rendered here.
const SERVER_PREVIEW = {
  mode: 'shared', first_message: 'Hi Asha, this is Riya from Acme Motors. Is now a good time?',
  tenant_sections: { agent_name: { label: 'Agent name', value: 'Riya' } },
  call_settings: { transcriber: { language: 'en' }, maxDurationSeconds: 480 },
  caller_id: { source: 'tenant_number', number: '+911234567890' },
  missing_required: [{ code: 'agent_not_ready', label: 'The agent is missing details every call needs', fields: ['call_purpose'] }],
  warnings: ['Sample lead: Asha at Sample Traders (made up).'],
};
const STALE = { response: { status: 409, data: { detail: { code: 'stale_draft', base_version: 2, published_version: 4, message: 'stale' } } } };

beforeEach(() => {
  jest.clearAllMocks();
  resetOpeningLineGuides(); // the guide is cached per session
  api.getAgentInstance.mockResolvedValue({ data: INSTANCE });
  api.getAgentInstanceVersion.mockImplementation((type, n) => Promise.resolve({ data: { ...VERSIONS[n], created_at: at } }));
  api.getBusinessProfile.mockResolvedValue({ data: { company_name: 'Acme Motors', locations: [], source: 'api',
    updated_at: at, updated_by_name: 'Tara Admin' } });
  api.listOwnPhoneNumbers.mockResolvedValue({ data: [
    { id: 'n-1', vapi_phone_number_id: 'pn-1', phone_number: null, label: 'Sales', inbound_mode: 'fixed', assistant_name: null },
  ] });
  api.getCatalogItems.mockResolvedValue({ data: { items: [] } });
  api.getCatalogSettings.mockResolvedValue({ data: { currency: 'INR', price_format: 'indian' } });
  // As GET /api/v1/assistant-builder/languages answers: `name` is the English name (there is no english_name).
  api.getBuilderLanguages.mockResolvedValue({ data: [
    { code: 'en', name: 'English', native_name: 'English', status: 'approved', direction: 'ltr' },
    { code: 'fr', name: 'French', native_name: 'Français', status: 'approved', direction: 'ltr' },
  ] });
  api.previewAgentInstance.mockResolvedValue({ data: SERVER_PREVIEW });
  api.updateAgentInstanceDraft.mockImplementation((type, n, p) => Promise.resolve({ data: { version: n, payload: p } }));
  api.getOpeningLineGuide.mockResolvedValue({ data: { language: 'en', tips: { target: ['Say who is calling first.'], en: [] },
    example: 'Hi Sam', template: 'Hi', allowed_variables: ['lead_first_name'], recommended_variables: ['lead_first_name'], max_length: 500 } });
});

describe('the suggested opening line', () => {
  test('the languages are named: the select and the "Can switch to" chips say French, not fr', async () => {
    renderEditor(admin);
    const nav = await screen.findByRole('navigation', { name: /Configuration|Setup steps/ });
    await userEvent.click(within(nav).getByRole('button', { name: /Agent identity/ }));
    const select = await screen.findByLabelText('Primary language');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'French' })).toHaveValue('fr'));
    expect(within(select).getByRole('option', { name: 'English' })).toHaveValue('en');
    expect(within(select).queryByRole('option', { name: 'fr' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'French' })).toBeInTheDocument();
  });

  test('opening an existing draft on the identity step asks for no suggestion (the guide only)', async () => {
    renderEditor(admin);
    const nav = await screen.findByRole('navigation', { name: /Configuration|Setup steps/ });
    await userEvent.click(within(nav).getByRole('button', { name: /Agent identity/ }));
    expect(await screen.findByLabelText('Opening line')).toHaveValue('Hi {{lead_first_name}}');
    await waitFor(() => expect(api.getOpeningLineGuide).toHaveBeenCalledWith('sdr_outbound', 'en'));
    await act(() => new Promise((r) => setTimeout(r, 400))); // past the suggestion debounce
    expect(api.suggestOpeningLine).not.toHaveBeenCalled();
    expect(api.updateAgentInstanceDraft).not.toHaveBeenCalled();
  });
});

const renderEditor = (user) => renderWithAuth(<AgentConfigEditor agentType="sdr_outbound" user={user} />, { user });

describe('publishing a stale draft', () => {
  test('409 stale_draft opens the dialog with both version numbers', async () => {
    api.publishAgentInstanceVersion.mockRejectedValueOnce(STALE);
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByTestId('stale-draft-dialog');
    expect(dialog).toHaveTextContent('This agent was published elsewhere (version 4) after you started this draft (based on version 2).');
    expect(api.publishAgentInstanceVersion).toHaveBeenCalledWith('sdr_outbound', 5, { force: false });
  });

  test('Rebase: a fresh draft, the user\'s edits re-applied, fields changed in both highlighted', async () => {
    api.publishAgentInstanceVersion.mockRejectedValueOnce(STALE);
    api.rebaseAgentInstanceDraft.mockResolvedValue({ data: {
      draft: { id: 'v6', version: 6, status: 'draft', base_version: 4, payload: VERSIONS[4].payload },
      replaced_version: 5, previous_payload: VERSIONS[5].payload,
    } });
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await userEvent.click(within(await screen.findByTestId('stale-draft-dialog')).getByRole('button', { name: 'Rebase' }));

    await waitFor(() => expect(api.rebaseAgentInstanceDraft).toHaveBeenCalledWith('sdr_outbound', 5));
    // The old draft's base (version 2) tells which fields the user edited.
    expect(api.getAgentInstanceVersion).toHaveBeenCalledWith('sdr_outbound', 2);
    await waitFor(() => expect(api.updateAgentInstanceDraft).toHaveBeenCalledWith('sdr_outbound', 6, expect.objectContaining({
      tone: 'energetic', persona: { name: 'Riya', gender: 'male' },
    })));
    expect(await screen.findByTestId('rebase-note')).toHaveTextContent('Your draft now starts from version 4');
    expect(screen.getByTestId('rebase-note')).toHaveTextContent('1 were also changed in that version');
    // The tone was changed in version 4 too: highlighted on the identity step, which opens.
    expect(await screen.findByTestId('field-conflict')).toHaveTextContent('calm');
    expect(api.publishAgentInstanceVersion).toHaveBeenCalledTimes(1);
  });

  test('Publish anyway (Tenant Admin): confirms the overwritten version, then force=true', async () => {
    api.publishAgentInstanceVersion.mockRejectedValueOnce(STALE).mockResolvedValueOnce({ data: VERSIONS[5] });
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByTestId('stale-draft-dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish anyway' }));
    expect(await screen.findByText('Overwrite version 4?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Overwrite version 4' }));
    await waitFor(() => expect(api.publishAgentInstanceVersion).toHaveBeenLastCalledWith('sdr_outbound', 5, { force: true }));
    // shared_assistants is off for this tenant.
    expect(await screen.findByText('Saved. Your calls still use the Assistant builder configuration.')).toBeInTheDocument();
  });

  test('a Manager may rebase but is not offered Publish anyway', async () => {
    api.publishAgentInstanceVersion.mockRejectedValueOnce(STALE);
    renderEditor(manager);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByTestId('stale-draft-dialog');
    expect(within(dialog).getByRole('button', { name: 'Rebase' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Publish anyway' })).not.toBeInTheDocument();
  });

  test('Cancel closes the dialog and publishes nothing', async () => {
    api.publishAgentInstanceVersion.mockRejectedValueOnce(STALE);
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await userEvent.click(within(await screen.findByTestId('stale-draft-dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('stale-draft-dialog')).not.toBeInTheDocument());
    expect(api.publishAgentInstanceVersion).toHaveBeenCalledTimes(1);
    expect(api.rebaseAgentInstanceDraft).not.toHaveBeenCalled();
  });
});

describe('publishing', () => {
  test('shared_assistants on: "Live on your next calls"', async () => {
    api.publishAgentInstanceVersion.mockResolvedValue({ data: VERSIONS[5] });
    renderEditor({ ...admin, features: { agent_instances: true, shared_assistants: true } });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Live on your next calls.')).toBeInTheDocument();
  });

  test('a 422 is shown on its field, with the server\'s message, and focus moves there', async () => {
    api.publishAgentInstanceVersion.mockRejectedValue({ response: { status: 422, data: { detail: [
      { loc: ['body', 'payload', 'persona', 'name'], msg: 'String should have at most 60 characters' },
    ] } } });
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('String should have at most 60 characters')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-field', 'persona.name'));
  });

  test('version history: gaps in the numbers are fine; author names come from the API', async () => {
    renderEditor(admin);
    // The compact list: the open draft is "Editing", the published version "Live"; while a draft is open an older
    // version cannot be restored, so it shows as superseded.
    expect(await screen.findByTestId('version-5')).toHaveTextContent('Draft 5');
    expect(screen.getByTestId('version-5')).toHaveTextContent('Editing');
    expect(screen.getByTestId('version-4')).toHaveTextContent('Live');
    expect(screen.getByTestId('version-2')).toHaveTextContent('Superseded');
    expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('version-3')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('version-4')).toHaveTextContent('Tara Admin'));
  });
});

describe('feature gating', () => {
  const route = (user) => renderWithAuth(<p>other</p>, {
    user, path: '/agents/sdr_outbound',
    routes: [<Route key="c" path="/agents/:agentType" element={<AgentConfigPage />} />],
  });

  test('agent_instances off: the Assistant builder path, no API call', () => {
    route({ ...USERS.tenant_admin, features: { agent_instances: false } });
    expect(screen.getByText("Agent configuration isn't enabled for your account")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the Assistant builder' })).toHaveAttribute('href', '/voice_agent?tab=create');
    expect(api.getAgentInstance).not.toHaveBeenCalled();
  });

  test('a Sales Rep is told who sets up agents', () => {
    route({ ...USERS.rep, ...ON });
    expect(screen.getByText('Managers and Tenant Admins set up agents')).toBeInTheDocument();
    expect(api.getAgentInstance).not.toHaveBeenCalled();
  });

  test('a 403 from the routes shows "not enabled", not a broken page', async () => {
    api.getAgentInstance.mockRejectedValue({ response: { status: 403, data: { detail: 'This feature is switched off for your organisation' } } });
    route(admin);
    expect(await screen.findByText("Agent configuration isn't enabled for your account")).toBeInTheDocument();
    expect(screen.getByText('This feature is switched off for your organisation')).toBeInTheDocument();
  });

  test('Start setup: a 403 from creating the draft means the agent type is not in the plan', async () => {
    api.getAgentInstance.mockRejectedValue({ response: { status: 404 } });
    api.createAgentInstanceDraft.mockRejectedValue({ response: { status: 403, data: { detail: 'Your tenant may not use this agent type' } } });
    renderWithAuth(<AgentConfigEditor agentType="sdr_inbound" user={admin} />, { user: admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Start setup' }));
    expect(await screen.findByText("Inbound SDR isn't in your plan")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/billing');
  });

  test('Start setup: a 409 opens the draft that is already open', async () => {
    api.getAgentInstance.mockResolvedValueOnce({ data: { ...INSTANCE, draft_version: null, versions: INSTANCE.versions.slice(1) } });
    api.createAgentInstanceDraft.mockRejectedValue({ response: { status: 409, data: { detail: 'This agent already has an open draft' } } });
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit configuration' }));
    expect(await screen.findByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
    expect(screen.getByText(/Editing draft 5 \(from v2\)/)).toBeInTheDocument();
  });
});

describe('product catalog (step 2)', () => {
  const ITEMS = [1, 2, 3, 4, 5].map((n) => ({ id: `p-${n}`, name: `Model ${n}`, category: 'SUV', price: n * 1000000, active: true }));

  test('outbound: the price note, the count, the first three products with prices, then all of them', async () => {
    api.getCatalogItems.mockResolvedValue({ data: { items: [...ITEMS, { id: 'old', name: 'Retired', price: 1, active: false }] } });
    renderEditor(admin);
    await userEvent.click(await screen.findByRole('button', { name: 'Product catalog' }));
    expect(screen.getByTestId('catalog-price-note')).toHaveTextContent('Prices always come from your catalog');
    const card = await screen.findByTestId('catalog-products');
    await waitFor(() => expect(card).toHaveTextContent('5 active products'));
    expect(card).toHaveTextContent('You pick which ones to feature in each campaign.');
    expect(screen.getByRole('link', { name: /Manage catalog/ })).toHaveAttribute('href', '/catalog');
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3);
    expect(card).toHaveTextContent('₹10,00,000');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all 5' }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    expect(card).not.toHaveTextContent('Retired');
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
  });

  test('inbound: products are ticked as featured', async () => {
    api.getCatalogItems.mockResolvedValue({ data: { items: ITEMS } });
    renderWithAuth(<AgentConfigEditor agentType="sdr_inbound" user={admin} />, { user: admin });
    await userEvent.click(await screen.findByRole('button', { name: 'Product catalog' }));
    const box = await screen.findByRole('checkbox', { name: 'Feature Model 1' });
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId('catalog-products')).toHaveTextContent('1 featured');
  });
});

describe('business details (step 1)', () => {
  const openBusiness = async (user) => {
    renderEditor(user);
    await userEvent.click(await screen.findByRole('button', { name: 'Business details' }));
  };

  test('a Tenant Admin edits and saves the profile; who changed it last is shown', async () => {
    api.updateBusinessProfile.mockResolvedValue({ data: { company_name: 'Apex Motors', locations: [], source: 'api',
      updated_at: at, updated_by_name: 'Tara Admin' } });
    await openBusiness(admin);
    expect(screen.getByTestId('agent-config')).toHaveClass('ops');
    expect(await screen.findByTestId('business-updated')).toHaveTextContent('by Tara Admin');
    const name = screen.getByLabelText('Company name');
    expect(screen.getByRole('button', { name: 'Save business details' })).toBeInTheDocument();
    await waitFor(() => expect(name).toHaveValue('Acme Motors'));
    await userEvent.clear(name);
    await userEvent.type(name, 'Apex Motors');
    await userEvent.click(screen.getByRole('button', { name: 'Save business details' }));
    await waitFor(() => expect(api.updateBusinessProfile).toHaveBeenCalledWith(expect.objectContaining({ company_name: 'Apex Motors' })));
  });

  test('edits are saved when the user moves on without pressing Save; a refused save stays on the step', async () => {
    api.updateBusinessProfile
      .mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Invalid website' } } })
      .mockResolvedValue({ data: { company_name: 'Apex Motors', locations: [], source: 'api', updated_at: at } });
    await openBusiness(admin);
    const name = screen.getByLabelText('Company name');
    await waitFor(() => expect(name).toHaveValue('Acme Motors'));
    expect(screen.queryByTestId('business-unsaved')).not.toBeInTheDocument();
    await userEvent.clear(name);
    await userEvent.type(name, 'Apex Motors');
    expect(screen.getByTestId('business-unsaved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Next:/ }));
    await waitFor(() => expect(api.updateBusinessProfile).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Company name')).toHaveValue('Apex Motors'); // refused: still here, edits kept
    await userEvent.click(screen.getByRole('button', { name: /^Next:/ }));
    await waitFor(() => expect(api.updateBusinessProfile).toHaveBeenLastCalledWith(expect.objectContaining({ company_name: 'Apex Motors' })));
    await waitFor(() => expect(screen.queryByLabelText('Company name')).not.toBeInTheDocument());
  });

  test('Save draft also saves unsaved business details', async () => {
    api.updateBusinessProfile.mockResolvedValue({ data: { company_name: 'Apex Motors', locations: [], source: 'api', updated_at: at } });
    await openBusiness(admin);
    const name = screen.getByLabelText('Company name');
    await waitFor(() => expect(name).toHaveValue('Acme Motors'));
    await userEvent.clear(name);
    await userEvent.type(name, 'Apex Motors');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.updateBusinessProfile).toHaveBeenCalledWith(expect.objectContaining({ company_name: 'Apex Motors' })));
  });

  test('a Manager reads it; numbers not synced from Vapi say so', async () => {
    await openBusiness(manager);
    expect(await screen.findByText('Your Tenant Admin edits these details.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save business details' })).not.toBeInTheDocument();
    expect(await screen.findByTestId('own-numbers')).toHaveTextContent('number not synced yet');
  });
});

describe('full-screen layout', () => {
  test('steps, versions and the preview of what the agent will say', async () => {
    renderEditor(admin);
    expect(await screen.findByRole('link', { name: /Agents/ })).toHaveAttribute('href', '/agents');
    expect(screen.getByRole('button', { name: 'Business details' })).toBeInTheDocument(); // "1 · " is not read out
    const preview = screen.getByTestId('agent-preview');
    expect(preview).toHaveTextContent('What the agent will say');
    expect(preview).toHaveTextContent('Draft 5');
    // The server's preview of the open draft, shown as it came: opener, settings, checklist, warnings.
    await waitFor(() => expect(api.previewAgentInstance).toHaveBeenCalledWith('sdr_outbound', { version_n: 5 }), { timeout: 2000 });
    expect(await within(preview).findByText('“Hi Asha, this is Riya from Acme Motors. Is now a good time?”')).toBeInTheDocument();
    expect(within(preview).getByText('8 min')).toBeInTheDocument();
    expect(within(preview).getByText(/The agent is missing details every call needs: call_purpose/)).toBeInTheDocument();
    expect(within(preview).getByText('Sample lead: Asha at Sample Traders (made up).')).toBeInTheDocument();
  });
});
