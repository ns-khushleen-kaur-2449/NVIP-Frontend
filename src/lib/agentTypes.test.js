import {
  AGENT_ROUTES, agentConfigRoute, agentRoute, agentTypeLabel, callAgentType, canFollowAgain, canonicalAgentType,
  followsLabel, hasSharedAssistantTemplate, isConfigurableAgentType,
} from '@/lib/agents';

describe('agent key -> screen', () => {
  test.each([
    ['sdr', '/voice_agent'],
    ['sdr_outbound', '/voice_agent'],
    ['sdr_inbound', '/agents/sdr_inbound'],
    ['hiring', '/hiring_agent'],
  ])('%s opens %s', (key, route) => {
    expect(agentRoute({ key })).toBe(route);
  });

  test('an agent with no screen yet opens nothing', () => {
    expect(agentRoute({ key: 'real_estate' })).toBeNull();
    expect(agentRoute(null)).toBeNull();
  });

  test('Hiring keeps its own screen', () => {
    expect(AGENT_ROUTES.hiring).toBe('/hiring_agent');
    expect(isConfigurableAgentType('hiring')).toBe(false);
  });
});

describe('agent types', () => {
  test('the legacy key sdr is Outbound SDR', () => {
    expect(canonicalAgentType('sdr')).toBe('sdr_outbound');
    expect(canonicalAgentType('sdr_inbound')).toBe('sdr_inbound');
    expect(agentTypeLabel('sdr')).toBe('Outbound SDR');
    expect(agentTypeLabel('sdr_inbound')).toBe('Inbound SDR');
    expect(agentTypeLabel('hiring')).toBe('Hiring');
    expect(agentTypeLabel('something_new')).toBe('something_new');
  });

  test('configuration routes use the canonical key', () => {
    expect(agentConfigRoute('sdr')).toBe('/agents/sdr_outbound');
    expect(isConfigurableAgentType('sdr')).toBe(true);
    expect(hasSharedAssistantTemplate({ key: 'sdr' })).toBe(true);
    expect(hasSharedAssistantTemplate({ key: 'sdr_inbound' })).toBe(true);
    expect(hasSharedAssistantTemplate({ key: 'hiring' })).toBe(false);
  });
});

describe('a call log\'s agent type', () => {
  test('agent_type when the API sends it', () => {
    expect(callAgentType({ agent_type: 'hiring', direction: 'outbound' })).toBe('hiring');
    expect(callAgentType({ agent_type: 'sdr', direction: 'inbound' })).toBe('sdr_outbound');
  });

  test('else the old agent field', () => {
    expect(callAgentType({ agent_type: null, agent: 'sdr', direction: 'inbound' })).toBe('sdr_outbound');
  });

  test('else the direction, as the backend backfills SDR calls', () => {
    expect(callAgentType({ direction: 'inbound' })).toBe('sdr_inbound');
    expect(callAgentType({ direction: 'outbound' })).toBe('sdr_outbound');
    expect(callAgentType({ direction: null })).toBe('sdr_outbound');
  });
});

describe('Inbound SDR follows Outbound SDR', () => {
  test('the badge and the follow-again action', () => {
    expect(followsLabel({ key: 'sdr_inbound', follows: 'sdr' })).toBe('Follows Outbound SDR');
    expect(followsLabel({ key: 'sdr_inbound', follows: null })).toBeNull();
    expect(canFollowAgain({ key: 'sdr_inbound', follows: null })).toBe(true);
    expect(canFollowAgain({ key: 'sdr_inbound', follows: 'sdr' })).toBe(false);
    expect(canFollowAgain({ key: 'sdr', follows: null })).toBe(false);
  });
});
