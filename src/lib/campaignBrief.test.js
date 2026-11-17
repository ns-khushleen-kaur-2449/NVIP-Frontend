import {
  GOALS, callingLimitConflicts, campaignBriefFields, emptyBriefForm, fromOldPitch, qualificationOverrides,
  requiredChecklist, serializeBrief,
} from '@/lib/campaignBrief';

const DEFAULTS = ['Budget?', 'Timeline?', 'Decision maker?'];
const filled = () => ({
  ...emptyBriefForm({ questions: DEFAULTS }),
  name: 'Diwali camp',
  spokenName: '  our Diwali service camp ',
  goal: 'book_meeting',
  callPurpose: 'You asked about a service last month.',
  valueProposition: 'Free inspection this week',
  keyPoints: ['One', ' ', 'Two', 'Three', 'Four'],
  objections: [{ objection: 'Too busy', response: 'It takes 20 minutes' }, { objection: 'Half', response: '' }],
});

describe('serializeBrief', () => {
  test('a disabled offer keeps its text, date and timing', () => {
    const form = { ...filled(), offer: { enabled: false, text: '10% off', validUntil: '2026-12-01', whenToMention: 'At the end' } };
    expect(serializeBrief(form).offer).toEqual({ enabled: false, text: '10% off', valid_until: '2026-12-01', when_to_mention: 'At the end' });
  });

  test('an enabled offer is trimmed; empty values are null', () => {
    const form = { ...filled(), offer: { enabled: true, text: ' 10% off ', validUntil: '', whenToMention: '' } };
    expect(serializeBrief(form).offer).toEqual({ enabled: true, text: '10% off', valid_until: null, when_to_mention: null });
  });

  test('at most three key points, blanks dropped; complete objections sent as { objection, answer }', () => {
    const brief = serializeBrief(filled());
    expect(brief.key_points).toEqual(['One', 'Two', 'Three']);
    expect(brief.objections).toEqual([{ objection: 'Too busy', answer: 'It takes 20 minutes' }]);
    expect(brief.spoken_name).toBe('our Diwali service camp');
  });

  test('qualification_overrides: empty while the defaults are untouched, else the whole ordered list', () => {
    expect(serializeBrief(filled(), { defaultQuestions: DEFAULTS }).qualification_overrides).toEqual([]);
    const edited = filled();
    edited.qualification[1] = { text: 'When do you want it done?', inherited: 'Timeline?' };
    expect(serializeBrief(edited, { defaultQuestions: DEFAULTS }).qualification_overrides)
      .toEqual(['Budget?', 'When do you want it done?', 'Decision maker?']);
    const removed = filled();
    removed.qualification = removed.qualification.slice(0, 2);
    expect(qualificationOverrides(removed.qualification, DEFAULTS)).toEqual(['Budget?', 'Timeline?']);
    expect(qualificationOverrides([{ text: 'Which branch?', inherited: null }], [])).toEqual(['Which branch?']);
  });

  test('the campaign fields: goal, priority and brief', () => {
    const fields = campaignBriefFields({ ...filled(), goal: 'send_brochure', priority: 3, mustNotSay: ['guaranteed'],
      featuredProductIds: ['p-1'] });
    expect(fields.goal).toBe('send_brochure');
    expect(fields.priority).toBe(3);
    expect(fields.brief.must_not_say).toEqual(['guaranteed']);
    expect(fields.brief.featured_product_ids).toEqual(['p-1']);
    expect(fields).not.toHaveProperty('pitch');
  });
});

describe('goals and checks', () => {
  test('all four goals can be chosen', () => {
    expect(GOALS.map((g) => g.value)).toEqual(['book_meeting', 'send_brochure', 'callback', 'qualify_only']);
  });

  test('the required checklist', () => {
    const items = requiredChecklist({ ...filled(), offer: { enabled: true, text: '' } }, { leadCount: 2, assistantId: '' });
    expect(Object.fromEntries(items.map((i) => [i.key, i.done]))).toEqual({
      leads: true, name: true, goal: true, callPurpose: true, assistant: false, offerText: false,
    });
  });

  test('brief_sources: fields derived from the old pitch', () => {
    expect(fromOldPitch({ call_purpose: 'pitch', goal: 'campaign' }, 'call_purpose')).toBe(true);
    expect(fromOldPitch({ call_purpose: 'campaign' }, 'call_purpose')).toBe(false);
    expect(fromOldPitch(undefined, 'call_purpose')).toBe(false);
  });

  test('calling window and attempts against the agent limits', () => {
    const limits = { window: { days: ['mon', 'tue'], start_time: '10:00', end_time: '18:00' }, max_attempts_per_lead: 3 };
    expect(callingLimitConflicts({ window: { days: ['mon'], start_time: '10:00', end_time: '17:00' }, attempts: 3 }, limits)).toEqual([]);
    const found = callingLimitConflicts({ window: { days: ['mon', 'sat'], start_time: '09:00', end_time: '18:00' }, attempts: 5 }, limits);
    expect(found).toHaveLength(3);
    expect(callingLimitConflicts({ window: null, attempts: 3 }, limits)[0]).toMatch(/set a calling window/);
    expect(callingLimitConflicts({ window: null, attempts: 9 }, null)).toEqual([]);
  });
});
