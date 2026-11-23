// Tools page: importing a tool that already exists in Vapi by its id.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import ToolsManager from './ToolsManager';

jest.mock('@/lib/api');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
const api = require('@/lib/api');

const TYPES = [
  { type_key: 'request_callback', vapi_type: 'function', label: 'Request callback', summary: '', contract: [], default_definition: {}, sample_data: {} },
  { type_key: 'end_call', vapi_type: 'endCall', label: 'End call', summary: '', contract: [], default_definition: {}, sample_data: {} },
];
const FETCHED = {
  vapi_tool_id: 'vt-1', vapi_type: 'function', type_key: 'request_callback', type_matched_by: 'name',
  definition: {
    name: 'request_callback', description: 'Schedules a callback.',
    request_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
    response_template: null, messages: [{ type: 'request-start', content: 'One moment.', blocking: false }],
    settings: { async: false, timeout_seconds: 20, server_path: 'api/v1/tools/vapi/tool-calls' },
  },
  valid: true, errors: [], warnings: ['Vapi sends this tool\'s calls to a server at other.example.org'],
  differences: [{ field: 'server.url', vapi: 'https://other.example.org/hook', platform: 'https://api.example.com/api/v1/tools/vapi/tool-calls' }],
  in_sync: false, existing_tool_id: null,
};

beforeEach(() => {
  jest.resetAllMocks();
  api.listTools.mockResolvedValue({ data: [] });
  api.listToolTypes.mockResolvedValue({ data: TYPES });
  api.fetchVapiTool.mockResolvedValue({ data: FETCHED });
  api.importVapiTool.mockResolvedValue({ data: { tool: { id: 't1', name: 'request_callback', sync_status: 'pending' }, fetched: FETCHED } });
});

async function openDialog() {
  render(<ToolsManager />);
  const button = await screen.findByRole('button', { name: /import from vapi/i });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  return screen.findByTestId('import-vapi-tool-dialog');
}

test('fetches a Vapi tool by id and shows everything that will be saved', async () => {
  const dialog = await openDialog();
  expect(within(dialog).getByRole('button', { name: /^import$/i })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Vapi tool id'), { target: { value: '  vt-1 ' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /fetch/i }));

  const preview = await screen.findByTestId('vapi-tool-preview');
  expect(api.fetchVapiTool).toHaveBeenCalledWith('vt-1', null);
  expect(within(preview).getByText('request_callback')).toBeInTheDocument();
  expect(within(preview).getByText(/found from the tool's name/)).toBeInTheDocument();
  expect(within(preview).getByText('Schedules a callback.')).toBeInTheDocument();
  expect(within(preview).getByText(/"reason"/)).toBeInTheDocument();
  expect(within(preview).getByText('One moment.')).toBeInTheDocument();
  expect(within(preview).getByText(/timeout: 20s/)).toBeInTheDocument();
  expect(within(preview).getByText('Needs a sync after import')).toBeInTheDocument();
  expect(within(preview).getByText('server.url')).toBeInTheDocument();
  expect(within(preview).getByText(/other\.example\.org/, { selector: 'p' })).toBeInTheDocument();
});

test('imports the fetched tool and reloads the list', async () => {
  const dialog = await openDialog();
  fireEvent.change(within(dialog).getByLabelText('Vapi tool id'), { target: { value: 'vt-1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /fetch/i }));
  await screen.findByTestId('vapi-tool-preview');
  fireEvent.click(within(dialog).getByRole('button', { name: /^import$/i }));

  await waitFor(() => expect(api.importVapiTool).toHaveBeenCalledWith('vt-1', null));
  await waitFor(() => expect(api.listTools).toHaveBeenCalledTimes(2));
  expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Re-sync/));
  await waitFor(() => expect(screen.queryByTestId('import-vapi-tool-dialog')).not.toBeInTheDocument());
});

test('a tool that cannot be imported lists why and keeps Import off', async () => {
  api.fetchVapiTool.mockResolvedValue({ data: { ...FETCHED, valid: false, errors: ["A tool named 'request_callback' already exists"] } });
  const dialog = await openDialog();
  fireEvent.change(within(dialog).getByLabelText('Vapi tool id'), { target: { value: 'vt-1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /fetch/i }));
  expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: /^import$/i })).toBeDisabled();
});

test('asks for the tool type when it cannot be detected, and shows Vapi errors', async () => {
  api.fetchVapiTool.mockRejectedValueOnce({ response: { data: { detail: {
    message: "Choose the tool type: no platform tool type is named 'my_tool'", type_keys: ['request_callback'] } } } });
  const dialog = await openDialog();
  fireEvent.change(within(dialog).getByLabelText('Vapi tool id'), { target: { value: 'vt-2' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /fetch/i }));
  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent('Choose the tool type');
  expect(alert).toHaveTextContent('Pick one of: Request callback.');

  api.fetchVapiTool.mockRejectedValueOnce({ response: { data: { detail: 'Vapi cannot find this tool; it may not exist or may belong to another Vapi account' } } });
  fireEvent.click(within(dialog).getByRole('button', { name: /fetch/i }));
  expect(await within(dialog).findByText(/Vapi cannot find this tool/)).toBeInTheDocument();
});

describe('tenant access for several tools at once', () => {
  const TOOLS = [
    { id: 't-1', name: 'search_products', type_key: 'search_products', sync_status: 'active', vapi_tool_id: 'v1' },
    { id: 't-2', name: 'send_brochure', type_key: 'send_brochure', sync_status: 'active', vapi_tool_id: 'v2' },
    { id: 't-3', name: 'end_call', type_key: 'end_call', sync_status: 'active', vapi_tool_id: 'v3' },
  ];
  const TENANTS = [{ tenant_id: 'a', name: 'Aditi', granted: false, assistant_count: 0 },
    { tenant_id: 'n', name: 'Nets Info', granted: true, assistant_count: 0 }];

  beforeEach(() => {
    api.listTools.mockResolvedValue({ data: TOOLS });
    api.getToolTenants.mockResolvedValue({ data: { tenants: TENANTS } });
    api.setManyToolsTenants.mockResolvedValue({ data: { tools: [
      { tool_id: 't-1', name: 'search_products', changed: true, detach_errors: [] },
      { tool_id: 't-2', name: 'send_brochure', changed: false, detach_errors: [] }] } });
  });

  it('gives the ticked tenants every selected tool in one save', async () => {
    render(<ToolsManager />);
    const bulk = await screen.findByRole('button', { name: /Tenant access for/ });
    expect(bulk).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select search_products' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select send_brochure' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tenant access for 2 tools/ }));
    const dialog = await screen.findByTestId('bulk-access-dialog');
    expect(dialog).toHaveTextContent('search_products, send_brochure');
    const save = within(dialog).getByRole('button', { name: 'Give access' });
    expect(save).toBeDisabled(); // no tenant, no reason yet
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Aditi' }));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Pilot rollout' } });
    fireEvent.click(save);
    await waitFor(() => expect(api.setManyToolsTenants).toHaveBeenCalledWith(['t-1', 't-2'], ['a'], true, 'Pilot rollout'));
    expect(toast.success).toHaveBeenCalledWith('Access given on 1 of 2 tool(s)');
  });

  it('select all, then remove access', async () => {
    render(<ToolsManager />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all tools' }));
    fireEvent.click(screen.getByRole('button', { name: /Tenant access for 3 tools/ }));
    const dialog = await screen.findByTestId('bulk-access-dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Remove access' }));
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Nets Info' }));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Offboarding' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove access' }));
    await waitFor(() => expect(api.setManyToolsTenants).toHaveBeenCalledWith(['t-1', 't-2', 't-3'], ['n'], false, 'Offboarding'));
  });
});
