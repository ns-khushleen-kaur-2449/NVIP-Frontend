import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { HiringRoute } from '@/pages/hiring/HiringAgent';
import * as api from '@/lib/api';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listHiringJobs: jest.fn(),
  getHiringCandidate: jest.fn(),
  getHiringPipeline: jest.fn(),
  listHiringScores: jest.fn(),
  getHiringResume: jest.fn(),
  listHiringCandidateCalls: jest.fn(),
  getHiringAiResume: jest.fn(),
  downloadHiringAiResume: jest.fn(),
  rebuildHiringAiResume: jest.fn(),
  getHiringCallTranscript: jest.fn(),
  getHiringCallRecording: jest.fn(),
  advanceHiringCandidate: jest.fn(),
  decideHiringCandidate: jest.fn(),
  callHiringCandidate: jest.fn(),
  retryHiringResumeScore: jest.fn(),
  downloadHiringResume: jest.fn(),
  updateHiringCandidate: jest.fn(),
  attachHiringResume: jest.fn(),
  listHiringCandidates: jest.fn(),
}));

const AT = '2026-11-20T09:00:00Z';
const candidate = (overrides = {}) => ({
  id: 'c-1', first_name: 'Jordan', last_name: 'Example', phone_number: '+14155550100', email: 'jordan@example.com',
  consent_status: 'granted', consent_source: 'application form', consent_recorded_at: AT, consent_recorded_by: 2,
  created_at: AT, updated_at: AT, job_id: 'j-1', job_title: 'AI Engineer', stage: 'applied',
  detail_sources: { first_name: 'resume', last_name: 'resume', email: 'resume' },
  resume_status: 'read', resume_score: 3.7, resume_score_status: 'scored', ...overrides,
});
const pipeline = (overrides = {}) => ({
  stage: 'applied', stage_label: 'Resume stage', next_stage: 'intake_call', next_label: 'Intake call', can_advance: true,
  blockers: [], warnings: [], decisions: ['rejected'], intake_completed: false, history: [], ...overrides,
});
const SCORE = {
  kind: 'resume', status: 'scored', score: 3.7, reason: 'A reasonable fit.', bullets: ['Strong Python'],
  categories: [{ key: 'skills_match', label: 'Skills match', score: 4, reason: 'Python.' }],
  weights: { skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 },
  failure_code: null, failure_message: null, updated_at: AT,
};
const RESUME = { id: 'r-1', candidate_id: 'c-1', filename: 'jordan.pdf', content_type: 'application/pdf', size_bytes: 2048,
  parse_status: 'read', failure_code: null, failure_message: null, uploaded_by: 2, created_at: AT, updated_at: AT };
const CALL = { id: 's-1', booking_id: 'b-1', interview_type: 'audio', job_title: 'AI Engineer', call_number: 1,
  status: 'ended', interview_outcome: 'completed', dialed_at: AT, ended_at: AT, created_at: AT,
  has_transcript: true, has_recording: true, questions: [], snapshot: [{ question_id: 'q-1', question_text: 'Why this role?' }] };
const AI_RESUME = { status: 'ready', failure_code: null, failure_message: null, has_pdf: true, updated_at: AT,
  sections: [
    { key: 'summary', label: 'Summary', answered: true, summary: 'A Python engineer at Acme.', entries: [], bullets: [] },
    { key: 'experience', label: 'Experience', answered: true, summary: null, bullets: [],
      entries: [{ heading: 'Engineer', subheading: 'Acme', period: '5 years', bullets: ['Built payment services'] }] },
    { key: 'skills', label: 'Skills', answered: false, summary: null, entries: [], bullets: [] },
  ] };
const dialog = () => screen.getByRole('dialog');

function open(role = 'manager', id = 'c-1') {
  return renderWithAuth(
    <Routes>
      <Route path="/hiring_agent/*" element={<HiringRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path: `/hiring_agent/candidates/${id}` },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-2', key: 'hiring', name: 'Hiring' }] });
  api.listHiringJobs.mockResolvedValue({ data: [{ id: 'j-1', title: 'AI Engineer', status: 'open', has_jd: true }] });
  api.getHiringCandidate.mockResolvedValue({ data: candidate() });
  api.getHiringPipeline.mockResolvedValue({ data: pipeline() });
  api.listHiringScores.mockResolvedValue({ data: [SCORE] });
  api.getHiringResume.mockResolvedValue({ data: RESUME });
  api.listHiringCandidateCalls.mockResolvedValue({ data: [CALL] });
  api.getHiringAiResume.mockRejectedValue({ response: { status: 404, data: { detail: 'AI resume not found' } } });
  api.rebuildHiringAiResume.mockResolvedValue({ data: { ...AI_RESUME, status: 'pending' } });
  api.getHiringCallTranscript.mockResolvedValue({ data: { transcript: 'AI: Why this role?User: I like it.', summary: 'Likes it.' } });
  api.getHiringCallRecording.mockResolvedValue({ data: { url: 'https://example.test/rec.mp3' } });
  api.advanceHiringCandidate.mockResolvedValue({ data: pipeline({ stage: 'intake_call' }) });
  api.decideHiringCandidate.mockResolvedValue({ data: pipeline({ stage: 'rejected' }) });
  api.callHiringCandidate.mockResolvedValue({ status: 201, data: { id: 's-1', status: 'in_progress' } });
  api.listHiringCandidates.mockResolvedValue({ data: [candidate()] });
});

describe('Hiring: the candidate profile', () => {
  test('shows who they are, their round, scores, resume and calls in one place', async () => {
    open();
    expect(await screen.findByTestId('candidate-name')).toHaveTextContent('Jordan Example');
    expect(screen.getByText('AI Engineer', { selector: 'p' })).toBeInTheDocument();
    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('+14155550100')).toBeInTheDocument();
    expect(details.getByText(/jordan@example\.com/)).toBeInTheDocument();
    expect(details.getByText('Granted')).toBeInTheDocument();
    expect(await within(screen.getByRole('region', { name: 'Scores' })).findByTestId('score-resume')).toBeInTheDocument();
    expect(screen.getByTestId('resume-name')).toHaveTextContent('jordan.pdf');
    const calls = within(await screen.findByTestId('calls'));
    expect(calls.getByRole('heading', { name: 'Intake call: call 1' })).toBeInTheDocument();
    expect(calls.getByRole('link', { name: /open this booking/i })).toHaveAttribute('href', '/hiring_agent/bookings/b-1');
    expect(screen.getAllByText('From resume').length).toBeGreaterThan(0);
  });

  test('the tracker shows the steps done, current and still to come', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'audio_screening' }) });
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'audio_screening', stage_label: 'Audio screening',
      next_stage: null, next_label: null, can_advance: false, decisions: ['selected', 'rejected'] }) });
    open();
    const steps = within(await screen.findByTestId('tracker')).getAllByRole('listitem');
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['done', 'done', 'current', 'todo']);
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
  });

  test('a decision fills the last step with its name', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'selected' }) });
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'selected', stage_label: 'Selected', next_stage: null,
      next_label: null, can_advance: false, decisions: [] }) });
    open();
    const steps = within(await screen.findByTestId('tracker')).getAllByRole('listitem');
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'done']);
    expect(within(steps[3]).getByText('Selected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /advance to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Call' })).not.toBeInTheDocument();
  });

  test('moving on asks first, shows the warnings, and sends the stage the person saw', async () => {
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ warnings: ['The candidate has no phone number, so they cannot be called.'] }) });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Advance to Intake call' }));
    const form = within(dialog());
    expect(form.getByRole('heading', { name: 'Move to Intake call?' })).toBeInTheDocument();
    expect(form.getByTestId('confirm-warnings')).toHaveTextContent('no phone number');
    await user.type(form.getByLabelText(/note/i), 'Good resume');
    await user.click(form.getByRole('button', { name: 'Move on' }));
    expect(api.advanceHiringCandidate).toHaveBeenCalledWith('c-1', 'applied', 'Good resume');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(api.getHiringPipeline.mock.calls.length).toBeGreaterThanOrEqual(2)); // reloaded
  });

  test('a candidate who cannot move on shows why and the button is off', async () => {
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ can_advance: false,
      blockers: ['Link this candidate to a job first: rounds belong to a job.'] }) });
    open();
    expect(await screen.findByTestId('blockers')).toHaveTextContent('Link this candidate to a job first');
    expect(screen.getByRole('button', { name: 'Advance to Intake call' })).toBeDisabled();
  });

  test('rejecting records a note, and selecting is only offered from the last round', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('button', { name: 'Reject' });
    expect(screen.queryByRole('button', { name: 'Select candidate' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const form = within(dialog());
    await user.type(form.getByLabelText(/note/i), 'Not a fit');
    await user.click(form.getByRole('button', { name: 'Reject' }));
    expect(api.decideHiringCandidate).toHaveBeenCalledWith('c-1', 'rejected', 'applied', 'Not a fit');
  });

  test('the last round offers selecting and rejecting but no more moving on', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'audio_screening' }) });
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'audio_screening', next_stage: null, next_label: null,
      can_advance: false, decisions: ['selected', 'rejected'] }) });
    const user = userEvent.setup();
    open();
    await screen.findByRole('button', { name: 'Select candidate' });
    expect(screen.queryByRole('button', { name: /advance to/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select candidate' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Select' }));
    expect(api.decideHiringCandidate).toHaveBeenCalledWith('c-1', 'selected', 'audio_screening', '');
  });

  test('a move someone else already made is refused with the reason, the dialog stays, and the screen refreshes', async () => {
    api.advanceHiringCandidate.mockRejectedValue({ response: { status: 409, data: { detail: {
      code: 'stage_changed', message: 'This candidate is now on Intake call: someone else moved them. Refresh to see it.' } } } });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Advance to Intake call' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Move on' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('someone else moved them');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(api.getHiringCandidate.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  test('the history lists each move with who made it and why, newest first', async () => {
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'intake_call', history: [
      { id: 'e-2', from_stage: 'intake_call', to_stage: 'audio_screening', kind: 'advance', note: 'Call went well',
        actor_id: 2, actor_name: 'Tara Admin', created_at: AT },
      { id: 'e-1', from_stage: 'applied', to_stage: 'intake_call', kind: 'auto', note: 'Intake call booked', actor_id: 2,
        actor_name: 'Tara Admin', created_at: AT }] }) });
    open();
    const items = within(await screen.findByTestId('history')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Moved to Audio screening');
    expect(items[0]).toHaveTextContent('Tara Admin');
    expect(items[0]).toHaveTextContent('Call went well');
    expect(items[1]).toHaveTextContent('Intake call booked');
  });

  test('a rep sees everything and can change nothing', async () => {
    open('rep');
    await screen.findByTestId('candidate-name');
    for (const name of [/advance to/i, 'Reject', 'Select candidate', 'Edit', 'Replace', /call/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('resume-name')).toBeInTheDocument();
    expect(screen.getByTestId('score-resume')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  test('a candidate who was not found says so', async () => {
    api.getHiringCandidate.mockRejectedValue({ response: { status: 404, data: { detail: 'Candidate not found' } } });
    open();
    expect(await screen.findByText('Candidate not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /all candidates/i })).toHaveAttribute('href', '/hiring_agent/candidates');
  });

  test('a load error offers a retry', async () => {
    api.getHiringCandidate.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('candidate-name')).toBeInTheDocument();
  });

  test('no scores yet says when they will come', async () => {
    api.listHiringScores.mockResolvedValue({ data: [] });
    api.getHiringResume.mockRejectedValue({ response: { status: 404, data: { detail: 'Resume not found' } } });
    open();
    expect(await screen.findByTestId('no-scores')).toHaveTextContent(/scored when one is uploaded/i);
    expect(screen.getByRole('button', { name: /upload resume/i })).toBeInTheDocument();
  });
});

describe('Hiring: calling from the profile', () => {
  test('the intake call can be placed from here, once per click', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /call candidate/i }));
    expect(api.callHiringCandidate).toHaveBeenCalledWith('c-1', expect.any(String));
    await waitFor(() => expect(api.listHiringCandidateCalls.mock.calls.length).toBeGreaterThanOrEqual(2)); // the calls reload
  });

  test.each([
    [{ phone_number: null }, 'Add a phone number first'],
    [{ consent_status: 'unknown' }, "Record the candidate's consent first"],
    [{ job_id: null, job_title: null }, 'Link this candidate to a job first'],
  ])('what the call needs that is missing is said, and the button is off (%j)', async (overrides, message) => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate(overrides) });
    open();
    const card = within(await screen.findByRole('region', { name: 'Call' }));
    expect(card.getByText(new RegExp(message, 'i'))).toBeInTheDocument();
    expect(card.getByRole('button', { name: /call candidate/i })).toBeDisabled();
  });

  test('the backend’s refusal is shown with what to do', async () => {
    api.callHiringCandidate.mockRejectedValue({ response: { status: 409, data: { detail: {
      code: 'outside_calling_hours', message: 'Outside your calling hours. Calls can be placed from 9:00.' } } } });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /call candidate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Outside your calling hours');
  });

  test('on the screening round the call is the audio screening call', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'audio_screening' }) });
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'audio_screening', next_stage: null,
      next_label: null, can_advance: false, decisions: ['selected', 'rejected'] }) });
    const user = userEvent.setup();
    open();
    const card = within(await screen.findByRole('region', { name: 'Call' }));
    expect(card.getByText('Audio screening call')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: /call candidate/i }));
    expect(api.callHiringCandidate).toHaveBeenCalledWith('c-1', expect.any(String));
  });

  test('a decided candidate is not offered a call', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'rejected' }) });
    api.getHiringPipeline.mockResolvedValue({ data: pipeline({ stage: 'rejected', next_stage: null,
      next_label: null, can_advance: false, decisions: [] }) });
    open();
    await screen.findByTestId('candidate-name');
    expect(screen.queryByRole('region', { name: 'Call' })).not.toBeInTheDocument();
  });

  test('a missing screening assistant is explained', async () => {
    api.getHiringCandidate.mockResolvedValue({ data: candidate({ stage: 'audio_screening' }) });
    api.callHiringCandidate.mockRejectedValue({ response: { status: 503, data: { detail: {
      code: 'screening_not_set_up', message: 'The audio screening call is not set up yet. Ask your administrator.' } } } });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /call candidate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not set up yet/i);
  });

  test('a call placed from the profile is listed with the others', async () => {
    api.listHiringCandidateCalls.mockResolvedValue({ data: [
      { ...CALL, id: 's-2', call_number: 2, has_transcript: false, has_recording: false, status: 'in_progress',
        interview_outcome: null, ended_at: null }, CALL] });
    open();
    const calls = within(await screen.findByTestId('calls'));
    expect(calls.getAllByRole('article').map((card) => card.getAttribute('aria-label')))
      .toEqual(['Intake call: call 2', 'Intake call: call 1']);
  });

  test('a call can be read and heard from the profile', async () => {
    const user = userEvent.setup();
    open();
    const card = within(await screen.findByTestId('call-s-1'));
    await user.click(card.getByRole('button', { name: /show transcript/i }));
    expect(await card.findByText(/I like it\./)).toBeInTheDocument();
    expect(api.getHiringCallTranscript).toHaveBeenCalledWith('b-1', 's-1');
    await user.click(card.getByRole('button', { name: /play recording/i }));
    expect(await screen.findByTestId('recording-s-1')).toBeInTheDocument();
    expect(api.getHiringCallRecording).toHaveBeenCalledWith('b-1', 's-1');
  });

  test('a call with nothing to read or hear offers neither', async () => {
    api.listHiringCandidateCalls.mockResolvedValue({ data: [{ ...CALL, has_transcript: false, has_recording: false }] });
    open();
    const card = within(await screen.findByTestId('call-s-1'));
    expect(card.queryByRole('button', { name: /show transcript/i })).not.toBeInTheDocument();
    expect(card.queryByRole('button', { name: /play recording/i })).not.toBeInTheDocument();
  });

  test('no calls yet says so', async () => {
    api.listHiringCandidateCalls.mockResolvedValue({ data: [] });
    open();
    expect(await screen.findByTestId('no-calls')).toBeInTheDocument();
  });

  test('the audio screening round’s calls are named as such', async () => {
    api.listHiringCandidateCalls.mockResolvedValue({ data: [{ ...CALL, interview_type: 'audio_screening' }] });
    open();
    expect(await screen.findByRole('heading', { name: 'Audio screening call: call 1' })).toBeInTheDocument();
  });
});

describe('Hiring: the AI resume and the overall score', () => {
  test('before any call the AI resume says when it will appear', async () => {
    open();
    expect(await screen.findByTestId('no-ai-resume')).toHaveTextContent(/after that call is completed/i);
  });

  test('a ready AI resume shows what was said, section by section, and skips sections nobody answered', async () => {
    api.getHiringAiResume.mockResolvedValue({ data: AI_RESUME });
    open();
    const text = within(await screen.findByTestId('ai-resume-text'));
    expect(text.getByText('A Python engineer at Acme.')).toBeInTheDocument();
    expect(text.getByText('Engineer')).toBeInTheDocument();
    expect(text.getByText('Acme | 5 years')).toBeInTheDocument();
    expect(text.getByText('Built payment services')).toBeInTheDocument();
    expect(text.queryByText('Skills')).not.toBeInTheDocument();
  });

  test('the PDF can be downloaded', async () => {
    api.getHiringAiResume.mockResolvedValue({ data: AI_RESUME });
    api.downloadHiringAiResume.mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /download pdf/i }));
    await waitFor(() => expect(api.downloadHiringAiResume).toHaveBeenCalledWith('c-1'));
  });

  test('one being written says so and offers nothing to download', async () => {
    api.getHiringAiResume.mockResolvedValue({ data: { ...AI_RESUME, status: 'building', sections: [], has_pdf: false } });
    open();
    const panel = within(await screen.findByRole('region', { name: 'AI resume' }));
    expect(panel.getByRole('status')).toHaveTextContent(/being written/i);
    expect(panel.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();
  });

  test('a failed one says why and can be written again', async () => {
    api.getHiringAiResume.mockResolvedValue({ data: { ...AI_RESUME, status: 'failed', sections: [], has_pdf: false,
      failure_message: 'The candidate did not say enough on the call to write a resume.' } });
    const user = userEvent.setup();
    open();
    const panel = within(await screen.findByRole('region', { name: 'AI resume' }));
    expect(panel.getByRole('alert')).toHaveTextContent(/did not say enough/i);
    await user.click(panel.getByRole('button', { name: /write again/i }));
    expect(api.rebuildHiringAiResume).toHaveBeenCalledWith('c-1');
  });

  test('a rep can read it but not write it again', async () => {
    api.getHiringAiResume.mockResolvedValue({ data: { ...AI_RESUME, status: 'failed', sections: [], has_pdf: false,
      failure_message: 'Nothing said.' } });
    open('rep');
    const panel = within(await screen.findByRole('region', { name: 'AI resume' }));
    expect(panel.queryByRole('button', { name: /write again/i })).not.toBeInTheDocument();
  });

  test('the overall score is shown first, ahead of the resume score', async () => {
    api.listHiringScores.mockResolvedValue({ data: [SCORE, { ...SCORE, kind: 'overall', score: 4.1, reason: 'The average of 2 scores.',
      categories: [], weights: null }] });
    open();
    const scores = within(await screen.findByRole('region', { name: 'Scores' }));
    const cards = await scores.findAllByTestId(/^score-/);
    expect(cards.map((card) => card.getAttribute('data-testid')).filter((id) => id !== 'score-figure'))
      .toEqual(['score-overall', 'score-resume']);
    expect(within(scores.getByTestId('score-overall')).getByText('4.1 / 5')).toBeInTheDocument();
  });

  test('a failed call score offers to write the AI resume and score again', async () => {
    api.listHiringScores.mockResolvedValue({ data: [{ ...SCORE, kind: 'intake', status: 'failed', score: null, categories: [],
      failure_message: 'The AI could not answer just now. Try again in a moment.' }] });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /write the ai resume and score again/i }));
    expect(api.rebuildHiringAiResume).toHaveBeenCalledWith('c-1');
  });
});

describe('Hiring: the profile from the candidate list', () => {
  test('the name opens the profile and the list shows the round', async () => {
    renderWithAuth(
      <Routes><Route path="/hiring_agent/*" element={<HiringRoute />} /></Routes>,
      { user: USERS.manager, path: '/hiring_agent/candidates' });
    const row = await screen.findByTestId('candidate-row-c-1');
    expect(within(row).getByRole('link', { name: 'Jordan Example' })).toHaveAttribute('href', '/hiring_agent/candidates/c-1');
    expect(within(row).getByText('Resume stage')).toBeInTheDocument();
  });
});
