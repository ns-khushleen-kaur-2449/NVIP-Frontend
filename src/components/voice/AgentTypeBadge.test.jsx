import { render, renderHook, screen, waitFor } from '@testing-library/react';
import AgentTypeBadge, { CallAgentVersion } from '@/components/voice/AgentTypeBadge';
import { useCallLogs } from '@/hooks/useCallLogs';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({ getCallLogs: jest.fn(), getCallLogDetail: jest.fn() }));

test('the agent type and version come from the call-log API', () => {
  render(<><AgentTypeBadge log={{ agent_type: 'sdr_inbound' }} /><CallAgentVersion log={{ agent_version: 3 }} /></>);
  expect(screen.getByTestId('call-agent-type')).toHaveTextContent('Inbound SDR');
  expect(screen.getByTestId('call-agent-version')).toHaveTextContent('Agent version 3');
});

test('no version: nothing shown', () => {
  render(<CallAgentVersion log={{ agent_version: null, agent_version_id: null }} />);
  expect(screen.queryByTestId('call-agent-version')).not.toBeInTheDocument();
});

test('the agent-type filter is sent as ?agent_type=', async () => {
  api.getCallLogs.mockResolvedValue({ data: { logs: [], total: 0, total_pages: 1 } });
  renderHook(() => useCallLogs({ agentType: 'sdr_outbound', autoRefresh: false }));
  await waitFor(() => expect(api.getCallLogs).toHaveBeenCalledWith(expect.objectContaining({ agent_type: 'sdr_outbound' })));
});
