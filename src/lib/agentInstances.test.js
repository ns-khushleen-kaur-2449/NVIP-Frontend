import {
  configMode, fieldErrors, instanceState, publishProblems, publishedModeMessage, reapplyEdits,
  setPath, staleDraft,
} from '@/lib/agentInstances';
import { agentInstancesAvailable, canForcePublish, featureOn } from '@/lib/rbac';

describe('instance state', () => {
  test.each([
    [null, 'not_set_up'],
    [{ published_version: null, draft_version: null }, 'not_set_up'],
    [{ published_version: null, draft_version: 1 }, 'draft'],
    [{ published_version: 2, draft_version: 3 }, 'active'],
  ])('%j is %s', (instance, state) => {
    expect(instanceState(instance)).toBe(state);
  });

  test('wizard until something was published, then tabs', () => {
    expect(configMode(null)).toBe('wizard');
    expect(configMode({ published_version: null })).toBe('wizard');
    expect(configMode({ published_version: 1 })).toBe('tabs');
  });
});

describe('feature flags are read, never assumed', () => {
  test('off-by-default features need an explicit true', () => {
    expect(featureOn({ features: {} }, 'agent_instances')).toBe(false);
    expect(featureOn({}, 'shared_assistants')).toBe(false);
    expect(featureOn({ features: { agent_instances: true } }, 'agent_instances')).toBe(true);
    // Ordinary features keep the old rule: missing means on.
    expect(featureOn({ features: {} }, 'campaigns')).toBe(true);
  });

  test('agent instances: Managers and Tenant Admins with the flag', () => {
    const on = { features: { agent_instances: true } };
    expect(agentInstancesAvailable({ role: 'manager', ...on })).toBe(true);
    expect(agentInstancesAvailable({ role: 'tenant_admin', ...on })).toBe(true);
    expect(agentInstancesAvailable({ role: 'rep', ...on })).toBe(false);
    expect(agentInstancesAvailable({ role: 'super_admin', ...on })).toBe(false);
    expect(agentInstancesAvailable({ role: 'manager', features: {} })).toBe(false);
    expect(canForcePublish({ role: 'tenant_admin' })).toBe(true);
    expect(canForcePublish({ role: 'manager' })).toBe(false);
  });

  test('the message after a publish follows shared_assistants', () => {
    expect(publishedModeMessage({ features: { shared_assistants: true } })).toBe('Live on your next calls.');
    expect(publishedModeMessage({ features: { shared_assistants: false } })).toMatch(/still use the Assistant builder/);
    expect(publishedModeMessage({ features: {} })).toMatch(/still use the Assistant builder/);
  });
});

describe('reapplyEdits after a rebase', () => {
  const base = { persona: { name: 'Riya', gender: 'female' }, tone: 'friendly', qualification_questions: ['A', 'B', 'C'], source: { v: 1 } };

  test('edits are applied; untouched fields take the newer version', () => {
    const previous = { ...base, persona: { name: 'Riya', gender: 'male' } };
    const latest = { ...base, tone: 'calm', source: { v: 2 } };
    const result = reapplyEdits({ base, previous, latest });
    expect(result.payload.persona.gender).toBe('male');
    expect(result.payload.tone).toBe('calm');
    expect(result.payload.source).toEqual({ v: 2 });
    expect(result.applied).toEqual(['persona.gender']);
    expect(result.conflicts).toEqual([]);
  });

  test('a field changed in both keeps the user\'s value and is a conflict', () => {
    const previous = { ...base, tone: 'energetic' };
    const latest = { ...base, tone: 'calm' };
    const result = reapplyEdits({ base, previous, latest });
    expect(result.payload.tone).toBe('energetic');
    expect(result.conflicts).toEqual([{ path: 'tone', yours: 'energetic', theirs: 'calm', base: 'friendly' }]);
  });

  test('a field that no longer exists is dropped', () => {
    const previous = { ...base, legacy_field: { x: 1 } };
    const latest = { ...base };
    const result = reapplyEdits({ base, previous, latest });
    expect(result.dropped).toEqual(['legacy_field.x']);
    expect(result.payload).not.toHaveProperty('legacy_field');
  });

  test('lists are compared whole', () => {
    const previous = { ...base, qualification_questions: ['A', 'B', 'C', 'D'] };
    const result = reapplyEdits({ base, previous, latest: base });
    expect(result.payload.qualification_questions).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('server answers', () => {
  test('the stale-draft refusal', () => {
    const error = { response: { status: 409, data: { detail: { code: 'stale_draft', base_version: 2, published_version: 4 } } } };
    expect(staleDraft(error)).toEqual({ code: 'stale_draft', base_version: 2, published_version: 4 });
    expect(staleDraft({ response: { status: 409, data: { detail: 'open draft' } } })).toBeNull();
  });

  test('422 errors map to their field with the server\'s message', () => {
    const error = { response: { status: 422, data: { detail: [
      { loc: ['body', 'payload', 'persona', 'name'], msg: 'String should have at most 60 characters' },
      { loc: ['calling', 'max_attempts_per_lead'], msg: 'Input should be a valid integer' },
    ] } } };
    expect(fieldErrors(error)).toEqual({
      'persona.name': 'String should have at most 60 characters',
      'calling.max_attempts_per_lead': 'Input should be a valid integer',
    });
    expect(fieldErrors({ response: { status: 409, data: { detail: [] } } })).toEqual({});
  });

  test('publish checks', () => {
    expect(publishProblems({ persona: { name: 'Riya' }, languages: { primary: 'en' }, qualification_questions: ['a', 'b'] }, 'sdr_outbound'))
      .toEqual({ qualification_questions: 'Add 3 to 6 qualification questions (now 2)' });
    // Inbound SDR has its own questions now (3 to 7), like Outbound SDR.
    expect(publishProblems({ persona: { name: '' }, languages: { primary: 'en' }, inbound: { overflow: { mode: 'transfer' } } }, 'sdr_inbound'))
      .toEqual({ 'persona.name': 'Give the agent a name', 'inbound.overflow.transfer_number': 'Add the number to transfer to',
        qualification_questions: 'Add 3 to 6 qualification questions (now 0)' });
    const ready = { persona: { name: 'Riya' }, languages: { primary: 'en' }, qualification_questions: ['a', 'b', 'c'] };
    expect(publishProblems(ready, 'sdr_inbound')).toEqual({});
    // At most 6 questions (what a call asks) and 600 characters of extra instructions.
    expect(publishProblems({ ...ready, qualification_questions: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 'sdr_outbound'))
      .toEqual({ qualification_questions: 'Add 3 to 6 qualification questions (now 7)' });
    expect(publishProblems({ ...ready, guardrails: { custom_instructions: 'x'.repeat(601) } }, 'sdr_outbound'))
      .toEqual({ 'guardrails.custom_instructions': 'Shorten the extra instructions to 600 characters (now 601)' });
    expect(publishProblems({ ...ready, guardrails: { custom_instructions: 'x'.repeat(600) } }, 'sdr_outbound')).toEqual({});
    // Maximum call length: 60 to 1800 seconds, or empty (the platform's default).
    [[null, {}], [600, {}], [59, 'bad'], [1801, 'bad']].forEach(([seconds, expected]) => {
      const problems = publishProblems({ ...ready, call_behaviour: { max_duration_seconds: seconds } }, 'sdr_outbound');
      expect(Object.keys(problems)).toEqual(expected === 'bad' ? ['call_behaviour.max_duration_seconds'] : []);
    });
  });
});

describe('helpers', () => {
  test('setPath copies on the way', () => {
    const before = { a: { b: 1 } };
    const after = setPath(before, 'a.c.d', 2);
    expect(after).toEqual({ a: { b: 1, c: { d: 2 } } });
    expect(before).toEqual({ a: { b: 1 } });
  });

});
