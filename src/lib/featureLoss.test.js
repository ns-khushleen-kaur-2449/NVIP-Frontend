import { featureLossNotice, featureLossTarget, lostPageFeatures, pageFeatures } from '@/lib/featureLoss';

const user = (features, id = 1) => ({ id, features });

test('pages and the features they need', () => {
  expect(pageFeatures('/agents/sdr_outbound')).toEqual(['agent_instances']);
  expect(pageFeatures('/agents')).toEqual([]);
  expect(pageFeatures('/prospects')).toEqual(['agent_instances']);
  expect(pageFeatures('/voice-campaigns/new')).toEqual(['voice_agent', 'campaigns']);
  expect(pageFeatures('/catalog')).toEqual(['product_catalog']);
  expect(pageFeatures('/catalogue')).toEqual([]);
  expect(pageFeatures('/dashboard')).toEqual([]);
});

test('only a change from allowed to not allowed, for the same user', () => {
  const on = user({ agent_instances: true });
  expect(lostPageFeatures('/agents/sdr_outbound', on, user({ agent_instances: false }))).toEqual(['agent_instances']);
  expect(lostPageFeatures('/agents/sdr_outbound', on, user({}))).toEqual(['agent_instances']); // missing = off
  expect(lostPageFeatures('/agents/sdr_outbound', on, user({ agent_instances: true }))).toEqual([]);
  expect(lostPageFeatures('/agents/sdr_outbound', null, user({}))).toEqual([]); // first load
  expect(lostPageFeatures('/agents/sdr_outbound', user({}), user({}))).toEqual([]); // was never allowed
  expect(lostPageFeatures('/agents/sdr_outbound', on, user({}, 2))).toEqual([]); // another user
  expect(lostPageFeatures('/agents/sdr_outbound', on, null)).toEqual([]); // signed out
});

test('notice', () => {
  expect(featureLossNotice(['agent_instances'])).toBe('Agent configuration was switched off for your organisation.');
  expect(featureLossNotice(['voice_agent', 'campaigns'])).toBe('Voice agent and Campaigns were switched off for your organisation.');
});

test('where a lost page goes: its legacy equivalent, else the dashboard', () => {
  expect(featureLossTarget('/call-logs')).toBe('/voice_agent?tab=logs');
  expect(featureLossTarget('/single-call')).toBe('/voice_agent?tab=single');
  expect(featureLossTarget('/prospects')).toBe('/prospecting');
  expect(featureLossTarget('/agents/sdr_outbound')).toBe('/dashboard');
  expect(featureLossTarget('/voice-campaigns/new')).toBe('/dashboard');
});
