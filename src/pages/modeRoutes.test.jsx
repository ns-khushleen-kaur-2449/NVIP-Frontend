import { screen } from '@testing-library/react';
import { Route, useLocation } from 'react-router-dom';
import { ModeRedirect, VoiceAgentModeRedirect, keepQuery } from '@/components/auth/ModeRoutes';
import { accountReadiness } from '@/lib/campaignRefusals';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/pages/VoiceAgent', () => function VoiceAgentStub() { return <p>Voice agent page</p>; });

const NEW = { features: { agent_instances: true } };
const SHARED = { features: { agent_instances: true, shared_assistants: true } };

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}{location.search}</p>;
}
const targets = ['/prospects', '/call-logs', '/voice-campaigns', '/voice-campaigns/new', '/single-call', '/agents',
  '/agents/sdr_outbound', '/leads'].map((path) => <Route key={path} path={path} element={<Where />} />);

const visit = (ui, path, user) => renderWithAuth(ui, { user, path, routes: targets });

describe('redirects keep the query string', () => {
  test('keepQuery', () => {
    expect(keepQuery('/prospects', { search: '?prospect=p-1', hash: '#x' })).toBe('/prospects?prospect=p-1#x');
    expect(keepQuery('/voice_agent?tab=logs', { search: '?assistant=a1&tab=old', hash: '' })).toBe('/voice_agent?assistant=a1&tab=logs');
    expect(keepQuery('/call-logs', { search: '', hash: '' })).toBe('/call-logs');
  });

  test('/leads?prospect=X opens /prospects?prospect=X in the new mode', () => {
    visit(<ModeRedirect instancesTo="/prospects"><p>old leads</p></ModeRedirect>, '/old-leads?prospect=p-9', { ...USERS.manager, ...NEW });
    expect(screen.getByTestId('where')).toHaveTextContent('/prospects?prospect=p-9');
  });

  test('legacy mode keeps the old page', () => {
    visit(<ModeRedirect instancesTo="/prospects"><p>old leads</p></ModeRedirect>, '/old-leads?prospect=p-9', { ...USERS.manager, features: {} });
    expect(screen.getByText('old leads')).toBeInTheDocument();
  });
});

describe('/voice_agent in the new mode', () => {
  test.each([
    ['?tab=logs&assistant=a1', '/call-logs?assistant=a1'],
    ['?view=logs', '/call-logs'],
    ['', '/voice-campaigns/new'],
    ['?tab=builder', '/voice-campaigns/new'],
    ['?tab=campaigns', '/voice-campaigns'],
    ['?tab=single', '/single-call'],
    ['?tab=kb', '/agents'],
  ])('%s goes to %s', (query, target) => {
    visit(<VoiceAgentModeRedirect />, `/va${query}`, { ...USERS.manager, ...NEW });
    expect(screen.getByTestId('where')).toHaveTextContent(target);
  });

  test('the Assistant builder stays while shared assistants are off', () => {
    visit(<VoiceAgentModeRedirect />, '/va?tab=create', { ...USERS.manager, ...NEW });
    expect(screen.getByText('Voice agent page')).toBeInTheDocument();
  });

  test('the Assistant builder gives way to agent setup once shared assistants are on', () => {
    visit(<VoiceAgentModeRedirect />, '/va?tab=create', { ...USERS.manager, ...SHARED });
    expect(screen.getByTestId('where')).toHaveTextContent('/agents/sdr_outbound');
  });

  test('Assistant requests stay reachable (Reps keep their change requests)', () => {
    visit(<VoiceAgentModeRedirect />, '/va?tab=requests', { ...USERS.rep, ...SHARED });
    expect(screen.getByText('Voice agent page')).toBeInTheDocument();
  });
});

describe('account readiness (Agents-page banner)', () => {
  const base = { sharedMode: true, outboundUsable: true, published: true, numbers: [{ id: 'n1', phone_number: null }],
    platformCallerId: false, campaigns: [], user: USERS.tenant_admin };

  test('a number without an E.164 value is not a problem', () => {
    expect(accountReadiness(base)).toEqual([]);
  });

  test('real blockers: unpublished agent, no number, paused campaigns', () => {
    const issues = accountReadiness({ ...base, published: false, numbers: [],
      campaigns: [{ status: 'paused', paused_by_kind: 'system', pause_reason_code: 'shared_assistants_off' },
        { status: 'paused', paused_by_kind: 'user', pause_reason_code: 'agent_not_ready' }] });
    expect(issues.map((i) => i.code)).toEqual(['not_published', 'no_caller_id', 'shared_assistants_off']);
  });

  test('a missing platform signing key paused a campaign: shown on the banner (F-03)', () => {
    const issues = accountReadiness({ ...base,
      campaigns: [{ status: 'paused', paused_by_kind: 'system', pause_reason_code: 'call_context_key_not_set' }] });
    expect(issues.map((i) => i.code)).toEqual(['call_context_key_not_set']);
  });

  test('the platform caller ID covers a tenant with no number; shared assistants off: nothing to check', () => {
    expect(accountReadiness({ ...base, numbers: [], platformCallerId: true })).toEqual([]);
    expect(accountReadiness({ ...base, sharedMode: false, published: false, numbers: [] })).toEqual([]);
  });
});
