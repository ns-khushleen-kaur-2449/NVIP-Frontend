import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { HiringRoute } from '@/pages/hiring/HiringAgent';
import * as api from '@/lib/api';
import {
  BOOKING_STATUS, RESUME_SECTIONS, candidateProblem, checkQuestions, checkScreeningQuestions, equalWeights, newKey,
  rebalanceWeights, sectionLabel, statusOf, weightsProblem,
} from '@/lib/hiring';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listHiringJobs: jest.fn(),
  getHiringJob: jest.fn(),
  createHiringJob: jest.fn(),
  updateHiringJob: jest.fn(),
  replaceHiringQuestions: jest.fn(),
  replaceHiringScreeningQuestions: jest.fn(),
  generateHiringScreeningQuestions: jest.fn(),
  listHiringCandidates: jest.fn(),
  createHiringCandidate: jest.fn(),
  updateHiringCandidate: jest.fn(),
  listHiringBookings: jest.fn(),
  createHiringBooking: jest.fn(),
}));

const AT = '2026-11-07T09:00:00Z';
const JOBS = [
  { id: 'j-1', title: 'Backend engineer', status: 'open', question_count: 2, created_at: AT, updated_at: AT },
  { id: 'j-2', title: 'Designer', status: 'closed', question_count: 0, created_at: AT, updated_at: AT },
];
const QUESTIONS = [
  { id: 'q-1', position: 1, question_text: 'Why this role?' },
  { id: 'q-2', position: 2, question_text: 'Notice period?' },
];
const CANDIDATES = [
  { id: 'c-1', first_name: 'Ada', last_name: 'Lovelace', phone_number: '+14155550100', email: 'ada@x.co',
    consent_status: 'granted', consent_source: 'application form', consent_recorded_at: AT, consent_recorded_by: 2,
    created_at: AT, updated_at: AT },
  { id: 'c-2', first_name: 'Alan', last_name: null, phone_number: '+14155550101', email: null,
    consent_status: 'unknown', consent_source: null, consent_recorded_at: null, consent_recorded_by: null,
    created_at: AT, updated_at: AT },
];
const BOOKINGS = [
  { id: 'b-1', job_id: 'j-1', job_title: 'Backend engineer', candidate_id: 'c-1', candidate_name: 'Ada Lovelace',
    interview_type: 'audio', status: 'needs_review', created_by: 2, created_at: AT, updated_at: AT },
];
const NOT_AVAILABLE = 'Hiring is not available to your organisation';
const forbidden = { response: { status: 403, data: { detail: NOT_AVAILABLE } } };

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-2', key: 'hiring', name: 'Hiring' }] });
  api.listHiringJobs.mockResolvedValue({ data: JOBS });
  api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: QUESTIONS } });
  api.createHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', status: 'open', questions: [] } });
  api.updateHiringJob.mockImplementation((id, body) => Promise.resolve({ data: { ...JOBS[0], ...body } }));
  api.replaceHiringQuestions.mockResolvedValue({ data: {} });
  api.replaceHiringScreeningQuestions.mockResolvedValue({ data: {} });
  api.listHiringCandidates.mockResolvedValue({ data: CANDIDATES });
  api.createHiringCandidate.mockResolvedValue({ data: {} });
  api.updateHiringCandidate.mockResolvedValue({ data: {} });
  api.listHiringBookings.mockResolvedValue({ data: BOOKINGS });
  api.createHiringBooking.mockResolvedValue({ status: 201, data: BOOKINGS[0] });
});

function open(role, path = '/hiring_agent/bookings') {
  return renderWithAuth(
    <Routes>
      <Route path="/hiring_agent/*" element={<HiringRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path },
  );
}

const dialog = () => screen.getByRole('dialog');

describe('Hiring: who may open it', () => {
  test.each(['tenant_admin', 'manager', 'rep'])('%s opens the screen', async (role) => {
    open(role);
    expect(await screen.findByTestId('booking-row-b-1')).toHaveTextContent('Ada Lovelace');
  });

  test('a Super Admin going to the address directly gets 403 and nothing is loaded', () => {
    open('super_admin');
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(api.listAvailableAgents).not.toHaveBeenCalled();
  });

  test('an organisation that may not use Hiring is told so and nothing else loads', async () => {
    api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-1', key: 'sdr', name: 'SmartSDR' }] });
    open('tenant_admin');
    expect(await screen.findByText(NOT_AVAILABLE)).toBeInTheDocument();
    expect(api.listHiringBookings).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Hiring' })).not.toBeInTheDocument();
  });

  test('a 403 from Hiring (access revoked meanwhile) shows the reason and offers no retry', async () => {
    api.listHiringBookings.mockRejectedValue(forbidden);
    open('manager');
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_AVAILABLE);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  test('a failed load can be retried', async () => {
    api.listHiringBookings.mockRejectedValueOnce({ response: { status: 500 } });
    const user = userEvent.setup();
    open('manager');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('booking-row-b-1')).toBeInTheDocument();
  });

  test('a failed availability check can be retried', async () => {
    api.listAvailableAgents.mockRejectedValueOnce({ response: { status: 500 } });
    const user = userEvent.setup();
    open('rep');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('booking-row-b-1')).toBeInTheDocument();
  });

  test('the bare address opens the Jobs tab, and there is no Bookings tab', async () => {
    open('rep', '/hiring_agent');
    expect(await screen.findByTestId('job-row-j-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Bookings' })).not.toBeInTheDocument();
  });
});

describe('Hiring: jobs', () => {
  test('a rep reads jobs and their questions but changes nothing', async () => {
    const user = userEvent.setup();
    open('rep', '/hiring_agent/jobs');
    const row = await screen.findByTestId('job-row-j-1');
    expect(screen.queryByRole('button', { name: /new job/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit job' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'View questions' }));
    const list = await within(dialog()).findByTestId('questions-read-only');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Why this role?', 'Notice period?']);
    expect(within(dialog()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  test('a job without questions is marked', async () => {
    open('manager', '/hiring_agent/jobs');
    expect(within(await screen.findByTestId('job-row-j-2')).getByText('No questions')).toBeInTheDocument();
  });

  test('a new job goes straight on to its questions', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/jobs');
    await user.click(await screen.findByRole('button', { name: /new job/i }));
    await user.type(within(dialog()).getByLabelText(/job title/i), 'Data analyst');
    await user.click(within(dialog()).getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst' });
    await user.type(await screen.findByLabelText('Question 1'), 'Why this role?');
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(api.replaceHiringQuestions).toHaveBeenCalledWith('j-3', [{ text: 'Why this role?', section_key: null }]);
  });

  test('an empty question is refused before sending, and the saved order is the order shown', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit questions' }));
    const second = await screen.findByLabelText('Question 2');
    await user.clear(second);
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('A question cannot be empty.');
    expect(api.replaceHiringQuestions).not.toHaveBeenCalled();
    await user.type(second, 'Notice period?');
    await user.click(within(dialog()).getByRole('button', { name: 'Move question 1 down' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(api.replaceHiringQuestions).toHaveBeenCalledWith('j-1', [
      { text: 'Notice period?', section_key: null }, { text: 'Why this role?', section_key: null }]);
  });

  test('no more than eight questions can be added', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: Array.from({ length: 8 }, (_, i) => (
      { id: `q-${i}`, position: i + 1, question_text: `Question text ${i + 1}` })) } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit questions' }));
    await screen.findByLabelText('Question 8');
    expect(within(dialog()).getByRole('button', { name: /add question/i })).toBeDisabled();
  });

  test('a job is closed and reopened', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Close' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-1', { status: 'closed' });
    await user.click(within(screen.getByTestId('job-row-j-2')).getByRole('button', { name: 'Reopen' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-2', { status: 'open' });
  });

  test('clicking a job title lists that job’s candidates, each linking to their profile', async () => {
    const user = userEvent.setup();
    open('rep', '/hiring_agent/jobs');
    const title = within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: /Backend engineer/ });
    expect(title).toHaveAttribute('aria-expanded', 'false');
    await user.click(title);
    expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ job_id: 'j-1', limit: 11 });
    const panel = await screen.findByTestId('job-candidates-j-1');
    expect(await within(panel).findByRole('link', { name: 'Ada Lovelace' }))
      .toHaveAttribute('href', '/hiring_agent/candidates/c-1');
    expect(within(panel).getByRole('link', { name: /Open in Candidates/ }))
      .toHaveAttribute('href', '/hiring_agent/candidates?job=j-1');
    await user.click(title);
    expect(screen.queryByTestId('job-candidates-j-1')).not.toBeInTheDocument();
  });

  test('a job with no candidates says so', async () => {
    const user = userEvent.setup();
    api.listHiringCandidates.mockResolvedValue({ data: [] });
    open('rep', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-2')).getByRole('button', { name: /Designer/ }));
    expect(await screen.findByText('No one has applied for this job yet.')).toBeInTheDocument();
  });

  test('the Candidates tab opened from a job is already filtered to it', async () => {
    open('rep', '/hiring_agent/candidates?job=j-1');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenCalledWith({ job_id: 'j-1', limit: 50 }));
  });
});

describe('Hiring: candidates', () => {
  test('a new candidate is not asked for consent, and Add candidate waits for a first name, a phone and a job', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/candidates');
    await user.click(await screen.findByRole('button', { name: /new candidate/i }));
    const form = within(dialog());
    expect(form.queryByLabelText(/consent to be called/i)).not.toBeInTheDocument();
    expect(form.queryByLabelText(/how consent was given/i)).not.toBeInTheDocument();
    const add = form.getByRole('button', { name: 'Add candidate' });
    expect(add).toBeDisabled();
    await user.type(form.getByLabelText(/first name/i), 'Grace');
    expect(add).toBeDisabled();
    await user.type(form.getByLabelText(/phone number/i), '4155550102');
    expect(add).toBeDisabled();
    await waitFor(() => expect(within(form.getByLabelText(/^Job/)).getAllByRole('option').length).toBeGreaterThan(1));
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    expect(add).toBeEnabled();
    await user.click(add);
    expect(api.createHiringCandidate).toHaveBeenCalledWith({
      first_name: 'Grace', last_name: null, phone_number: '4155550102', email: null, consent_status: 'unknown',
      consent_source: null, job_id: 'j-1' });
  });

  test('granted consent, recorded with Edit, needs a source before anything is sent', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/candidates');
    await user.click(within(await screen.findByTestId('candidate-row-c-2')).getByRole('button', { name: 'Edit' }));
    const form = within(dialog());
    await user.selectOptions(form.getByLabelText(/consent to be called/i), 'granted');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(form.getByRole('alert')).toHaveTextContent(/how consent was given/i);
    expect(api.updateHiringCandidate).not.toHaveBeenCalled();
    await user.type(form.getByLabelText(/how consent was given/i), 'verbal');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(api.updateHiringCandidate).toHaveBeenCalledWith('c-2', { consent_status: 'granted', consent_source: 'verbal' });
  });

  test('an edit sends only what changed', async () => {
    const user = userEvent.setup();
    open('tenant_admin', '/hiring_agent/candidates');
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Edit' }));
    const email = within(dialog()).getByLabelText(/email/i);
    await user.clear(email);
    await user.type(email, 'ada@new.co');
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(api.updateHiringCandidate).toHaveBeenCalledWith('c-1', { email: 'ada@new.co' });
  });

  test('search asks the backend', async () => {
    const user = userEvent.setup();
    open('rep', '/hiring_agent/candidates');
    await screen.findByTestId('candidate-row-c-1');
    await user.type(screen.getByLabelText('Search'), 'ada');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ q: 'ada', limit: 50 }));
  });

  test('a rep cannot add or edit candidates', async () => {
    open('rep', '/hiring_agent/candidates');
    const row = await screen.findByTestId('candidate-row-c-2');
    expect(within(row).getByText('Not recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new candidate/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('Hiring: bookings', () => {
  test('statuses read as words and the filters go to the backend', async () => {
    const user = userEvent.setup();
    open('rep');
    expect(within(await screen.findByTestId('booking-row-b-1')).getByText('Needs review')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByLabelText('Job')).getAllByRole('option')).toHaveLength(3));
    await user.selectOptions(screen.getByLabelText('Job'), 'j-1');
    await user.selectOptions(screen.getByLabelText('Status'), 'completed');
    await waitFor(() => expect(api.listHiringBookings)
      .toHaveBeenLastCalledWith({ job_id: 'j-1', status: 'completed', limit: 50 }));
    expect(screen.queryByRole('button', { name: /new booking/i })).not.toBeInTheDocument();
  });

  async function startBooking(user, candidateId = 'c-1') {
    await user.click(await screen.findByRole('button', { name: /new booking/i }));
    const form = within(dialog());
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    await waitFor(() => expect(form.getAllByRole('option', { name: /ada lovelace/i })).toHaveLength(1));
    await user.selectOptions(form.getByLabelText(/^candidate/i), candidateId);
    return form;
  }

  test('a double click makes one booking', async () => {
    let finish;
    api.createHiringBooking.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    open('manager');
    const form = await startBooking(user);
    const create = form.getByRole('button', { name: 'Create booking' });
    await user.dblClick(create);
    expect(api.createHiringBooking).toHaveBeenCalledTimes(1);
    expect(api.createHiringBooking).toHaveBeenCalledWith({ job_id: 'j-1', candidate_id: 'c-1', idempotency_key: expect.any(String) });
    finish({ status: 201, data: BOOKINGS[0] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('a refusal stays in the dialog, and trying again reuses the same key', async () => {
    api.createHiringBooking.mockRejectedValueOnce({ response: { status: 409,
      data: { detail: 'This candidate already has an open booking for this job' } } });
    const user = userEvent.setup();
    open('tenant_admin');
    const form = await startBooking(user);
    await user.click(form.getByRole('button', { name: 'Create booking' }));
    expect(await form.findByRole('alert')).toHaveTextContent('already has an open booking');
    await user.click(form.getByRole('button', { name: 'Create booking' }));
    const [first, second] = api.createHiringBooking.mock.calls.map(([body]) => body.idempotency_key);
    expect(second).toBe(first);
  });

  test('a candidate without consent is flagged before booking', async () => {
    const user = userEvent.setup();
    open('manager');
    const form = await startBooking(user, 'c-2');
    expect(form.getByText(/consent is not granted/i)).toBeInTheDocument();
  });
});

describe('Hiring: the new booking dialog offers only the chosen job’s candidates', () => {
  async function openDialog(user) {
    open('manager');
    await user.click(await screen.findByRole('button', { name: /new booking/i }));
    return within(dialog());
  }

  test('no candidate is asked for, or can be picked, until a job is chosen', async () => {
    const user = userEvent.setup();
    const form = await openDialog(user);
    expect(form.getByLabelText(/^candidate/i)).toBeDisabled();
    expect(form.getByLabelText(/find a candidate/i)).toBeDisabled();
    expect(within(form.getByLabelText(/^candidate/i)).getByRole('option', { name: 'Choose a job first' })).toBeInTheDocument();
    expect(api.listHiringCandidates).not.toHaveBeenCalledWith(expect.objectContaining({ job_id: expect.anything() }));
  });

  test('choosing a job asks the backend for that job’s candidates only', async () => {
    const user = userEvent.setup();
    const form = await openDialog(user);
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ job_id: 'j-1', limit: 50 }));
    expect(form.getByLabelText(/^candidate/i)).not.toBeDisabled();
  });

  test('the search stays inside the chosen job', async () => {
    const user = userEvent.setup();
    const form = await openDialog(user);
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    await user.type(form.getByLabelText(/find a candidate/i), 'ada');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ job_id: 'j-1', q: 'ada', limit: 50 }));
  });

  test('changing the job clears the candidate and the search, and asks again', async () => {
    api.listHiringJobs.mockResolvedValue({ data: [JOBS[0], { ...JOBS[1], status: 'open', question_count: 1 }] });
    const user = userEvent.setup();
    const form = await openDialog(user);
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    await waitFor(() => expect(form.getAllByRole('option', { name: /ada lovelace/i })).toHaveLength(1));
    await user.selectOptions(form.getByLabelText(/^candidate/i), 'c-1');
    await user.type(form.getByLabelText(/find a candidate/i), 'a');
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-2');
    expect(form.getByLabelText(/^candidate/i)).toHaveValue('');
    expect(form.getByLabelText(/find a candidate/i)).toHaveValue('');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ job_id: 'j-2', limit: 50 }));
  });

  test('a job with no candidates says how to get some', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    const form = await openDialog(user);
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    expect(await form.findByRole('option', { name: 'No candidates on this job yet' })).toBeInTheDocument();
    expect(form.getByText(/upload their resumes on the candidates tab/i)).toBeInTheDocument();
    await user.type(form.getByLabelText(/find a candidate/i), 'zed');
    expect(await form.findByRole('option', { name: 'No matching candidates on this job' })).toBeInTheDocument();
  });

  test('a candidate with no phone number is labelled and warned about, not shown as "null"', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [{ ...CANDIDATES[0], phone_number: null }] });
    const user = userEvent.setup();
    const form = await openDialog(user);
    await user.selectOptions(form.getByLabelText(/^job/i), 'j-1');
    const option = await form.findByRole('option', { name: /ada lovelace/i });
    expect(option).toHaveTextContent('no phone number');
    expect(option).not.toHaveTextContent('null');
    await user.selectOptions(form.getByLabelText(/^candidate/i), 'c-1');
    expect(form.getByText(/has no phone number, so they cannot be called/i)).toBeInTheDocument();
  });
});

describe('Hiring: job setup (description, weights, sections, screening questions)', () => {
  const WEIGHTS = { skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 };

  async function openNewJob(user) {
    open('tenant_admin', '/hiring_agent/jobs');
    await user.click(await screen.findByRole('button', { name: /new job/i }));
    await user.type(within(dialog()).getByLabelText(/job title/i), 'Data analyst');
    return within(dialog());
  }

  async function setWeights(user, form, values) {
    for (const [label, value] of values) {
      const input = form.getByLabelText(label);
      await user.clear(input);
      await user.type(input, String(value));
    }
  }

  test('a new job can carry its description', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    const form = await openNewJob(user);
    await user.type(form.getByLabelText(/job description/i), '  Analyse sales data with SQL.  ');
    await user.click(form.getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst', jd_text: 'Analyse sales data with SQL.' });
  });

  const shown = (form) => Object.fromEntries([['skills_match', 'Skills match'], ['experience_match', 'Experience match'],
    ['qualifications', 'Qualifications'], ['keyword_presence', 'Keyword presence']]
    .map(([key, label]) => [key, Number(form.getByLabelText(label).value)]));

  test('changing one weight adjusts the others you have not set, and the total stays 100', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    const form = await openNewJob(user);
    expect(form.getByTestId('weights-total')).toHaveTextContent('Total: 100 of 100');
    await setWeights(user, form, [['Skills match', 40]]);
    expect(shown(form)).toEqual({ skills_match: 40, experience_match: 20, qualifications: 20, keyword_presence: 20 });
    await setWeights(user, form, [['Experience match', 30]]);
    expect(shown(form)).toEqual({ skills_match: 40, experience_match: 30, qualifications: 15, keyword_presence: 15 });
    await setWeights(user, form, [['Qualifications', 20]]);
    expect(shown(form)).toEqual(WEIGHTS);
    expect(form.getByTestId('weights-total')).toHaveTextContent('Total: 100 of 100');
    await user.click(form.getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst', resume_weights: WEIGHTS });
  });

  test('the total is 100 after every keystroke, whatever is typed', async () => {
    const user = userEvent.setup();
    const form = await openNewJob(user);
    for (const [label, typed] of [['Skills match', '73'], ['Keyword presence', '5'], ['Qualifications', '999'],
      ['Experience match', '12'], ['Skills match', '0']]) {
      const input = form.getByLabelText(label);
      await user.clear(input);
      for (const digit of typed) {
        await user.type(input, digit);
        const values = shown(form);
        expect(Object.values(values).reduce((a, b) => a + b, 0)).toBe(100);
        expect(Object.values(values).every((n) => Number.isInteger(n) && n >= 0 && n <= 100)).toBe(true);
      }
    }
  }, 30000);

  test('a value above 100 stops at 100 and leaves the others at 0', async () => {
    const user = userEvent.setup();
    const form = await openNewJob(user);
    await setWeights(user, form, [['Qualifications', 250]]);
    expect(shown(form)).toEqual({ skills_match: 0, experience_match: 0, qualifications: 100, keyword_presence: 0 });
  });

  test('a cleared box counts as 0 once you leave it, and the others rebalance', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    const form = await openNewJob(user);
    await user.clear(form.getByLabelText('Skills match'));
    expect(form.getByLabelText('Skills match')).toHaveValue(null); // empty while the next number is typed
    await user.tab();
    expect(shown(form)).toEqual({ skills_match: 0, experience_match: 34, qualifications: 33, keyword_presence: 33 });
    expect(form.getByTestId('weights-total')).toHaveTextContent('Total: 100 of 100');
    await user.click(form.getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst', resume_weights: {
      skills_match: 0, experience_match: 34, qualifications: 33, keyword_presence: 33 } });
  });

  test('equal weights can be restored, and are then not sent', async () => {
    api.getHiringJob.mockResolvedValue({ data: { id: 'j-3', title: 'Data analyst', questions: [] } });
    const user = userEvent.setup();
    const form = await openNewJob(user);
    await setWeights(user, form, [['Skills match', 70]]);
    expect(form.getByRole('button', { name: 'Equal weights' })).toBeEnabled();
    await user.click(form.getByRole('button', { name: 'Equal weights' }));
    expect(shown(form)).toEqual(equalWeights());
    expect(form.getByRole('button', { name: 'Equal weights' })).toBeDisabled();
    await user.click(form.getByRole('button', { name: 'Create job' }));
    expect(api.createHiringJob).toHaveBeenCalledWith({ title: 'Data analyst' });
  });

  test('after a reset, the next change adjusts all the others again', async () => {
    const user = userEvent.setup();
    const form = await openNewJob(user);
    await setWeights(user, form, [['Skills match', 40], ['Experience match', 30]]);
    await user.click(form.getByRole('button', { name: 'Equal weights' }));
    await setWeights(user, form, [['Qualifications', 40]]);
    expect(shown(form)).toEqual({ skills_match: 20, experience_match: 20, qualifications: 40, keyword_presence: 20 });
  });

  test('editing a job loads its description and weights and saves what changed', async () => {
    api.getHiringJob.mockResolvedValue({ data: {
      ...JOBS[0], jd_text: 'Build APIs.', resume_weights: WEIGHTS, questions: QUESTIONS } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit job' }));
    const form = within(dialog());
    expect(await form.findByDisplayValue('Build APIs.')).toBeInTheDocument();
    expect(form.getByLabelText('Skills match')).toHaveValue(40);
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-1', {
      title: 'Backend engineer', jd_text: 'Build APIs.', resume_weights: WEIGHTS });
  });

  test('clearing the description and resetting the weights clears them on the backend', async () => {
    api.getHiringJob.mockResolvedValue({ data: {
      ...JOBS[0], jd_text: 'Build APIs.', resume_weights: WEIGHTS, questions: QUESTIONS } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit job' }));
    const form = within(dialog());
    await user.clear(await form.findByDisplayValue('Build APIs.'));
    await user.click(form.getByRole('button', { name: 'Equal weights' }));
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(api.updateHiringJob).toHaveBeenCalledWith('j-1', {
      title: 'Backend engineer', jd_text: null, resume_weights: null });
  });

  test('the job list shows whether a description and screening questions exist', async () => {
    api.listHiringJobs.mockResolvedValue({ data: [
      { ...JOBS[0], has_jd: true, screening_question_count: 3 }, { ...JOBS[1], has_jd: false, screening_question_count: 0 }] });
    open('rep', '/hiring_agent/jobs');
    const withJd = await screen.findByTestId('job-row-j-1');
    expect(within(withJd).getByText('Added')).toBeInTheDocument();
    expect(within(withJd).getByTestId('screening-count-j-1')).toHaveTextContent('3');
    const without = screen.getByTestId('job-row-j-2');
    expect(within(without).getByText('No JD')).toBeInTheDocument();
    expect(within(without).getByText('None')).toBeInTheDocument();
  });

  test('an intake question can name its resume section, or leave it to the AI', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Edit questions' }));
    const section = await within(dialog()).findByLabelText('Resume section of question 1');
    expect(section).toHaveValue('');
    expect(within(section).getAllByRole('option').map((option) => option.value))
      .toEqual(['', ...RESUME_SECTIONS.map(({ key }) => key)]);
    await user.selectOptions(section, 'experience');
    await user.click(within(dialog()).getByRole('button', { name: 'Save questions' }));
    expect(api.replaceHiringQuestions).toHaveBeenCalledWith('j-1', [
      { text: 'Why this role?', section_key: 'experience' }, { text: 'Notice period?', section_key: null }]);
  });

  test('a rep sees each question with its section but cannot change anything', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: [
      { id: 'q-1', position: 1, question_text: 'Where have you worked?', section_key: 'experience' }] } });
    const user = userEvent.setup();
    open('rep', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'View questions' }));
    const list = await within(dialog()).findByTestId('questions-read-only');
    expect(list).toHaveTextContent('Where have you worked?');
    expect(list).toHaveTextContent('(Work & Professional Experience)');
    expect(within(dialog()).queryByRole('combobox')).not.toBeInTheDocument();
  });

  test('screening questions are added one by one and saved as the tenant’s own', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Screening questions' }));
    const form = within(dialog());
    expect(await form.findByText(/no screening questions yet/i)).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Add question' }));
    await user.type(form.getByLabelText('Screening question 1'), '  Why do you want to join us?  ');
    await user.click(form.getByRole('button', { name: 'Add question' }));
    await user.type(form.getByLabelText('Screening question 2'), 'Where do you see yourself in five years?');
    await user.click(form.getByRole('button', { name: 'Move screening question 2 up' }));
    await user.click(form.getByRole('button', { name: 'Save screening questions' }));
    expect(api.replaceHiringScreeningQuestions).toHaveBeenCalledWith('j-1', [
      { text: 'Where do you see yourself in five years?', source: 'manual' },
      { text: 'Why do you want to join us?', source: 'manual' }]);
  }, 30000); // types about 70 characters one by one, which takes a while on a busy machine

  test('a question the AI wrote is marked, and editing it makes it the tenant’s own', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: QUESTIONS, screening_questions: [
      { id: 's-1', position: 1, question_text: 'Describe a project.', source: 'ai' },
      { id: 's-2', position: 2, question_text: 'What motivates you?', source: 'ai' }] } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Screening questions' }));
    const form = within(dialog());
    expect(await form.findAllByText('Written by AI')).toHaveLength(2);
    await user.type(form.getByLabelText('Screening question 1'), ' you are proud of');
    expect(form.getAllByText('Written by AI')).toHaveLength(1);
    await user.click(form.getByRole('button', { name: 'Save screening questions' }));
    expect(api.replaceHiringScreeningQuestions).toHaveBeenCalledWith('j-1', [
      { text: 'Describe a project. you are proud of', source: 'manual' },
      { text: 'What motivates you?', source: 'ai' }]);
  });

  test('every screening question can be removed, and an empty set is saved as empty', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: QUESTIONS, screening_questions: [
      { id: 's-1', position: 1, question_text: 'Only one', source: 'manual' }] } });
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Screening questions' }));
    const form = within(dialog());
    await user.click(await form.findByRole('button', { name: 'Remove screening question 1' }));
    await user.click(form.getByRole('button', { name: 'Save screening questions' }));
    expect(api.replaceHiringScreeningQuestions).toHaveBeenCalledWith('j-1', []);
  });

  test('a blank screening question is refused before sending', async () => {
    const user = userEvent.setup();
    open('manager', '/hiring_agent/jobs');
    await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button', { name: 'Screening questions' }));
    const form = within(dialog());
    await user.click(await form.findByRole('button', { name: 'Add question' }));
    await user.click(form.getByRole('button', { name: 'Save screening questions' }));
    expect(form.getByRole('alert')).toHaveTextContent('A question cannot be empty.');
    expect(api.replaceHiringScreeningQuestions).not.toHaveBeenCalled();
  });

  describe('writing screening questions with AI', () => {
    const withJd = (screening = []) => api.getHiringJob.mockResolvedValue({ data: {
      ...JOBS[0], jd_text: 'Lead a support team.', questions: QUESTIONS, screening_questions: screening } });
    const proposal = (...texts) => ({ data: { requested: texts.length, questions: texts.map((question_text) => (
      { question_text, source: 'ai' })) } });

    async function openScreening(user, role = 'manager') {
      open(role, '/hiring_agent/jobs');
      await user.click(within(await screen.findByTestId('job-row-j-1')).getByRole('button',
        { name: role === 'rep' ? 'View screening' : 'Screening questions' }));
      return within(dialog());
    }

    test('the tenant picks a count, the AI’s questions are added and marked, and nothing is saved until Save', async () => {
      withJd();
      api.generateHiringScreeningQuestions.mockResolvedValue(proposal('Why do you want this role?',
        'How do you handle pressure?', 'Where do you want to grow?'));
      const user = userEvent.setup();
      const form = await openScreening(user);
      const count = await form.findByLabelText('How many');
      expect(count).toHaveValue(5);
      await user.clear(count);
      await user.type(count, '3');
      await user.click(form.getByRole('button', { name: 'Generate with AI' }));
      expect(api.generateHiringScreeningQuestions).toHaveBeenCalledWith('j-1', 3);
      expect(await form.findByLabelText('Screening question 3')).toHaveValue('Where do you want to grow?');
      expect(form.getAllByText('Written by AI')).toHaveLength(3);
      expect(form.getByRole('status')).toHaveTextContent('Added 3 questions written by AI. Review them, then save.');
      expect(api.replaceHiringScreeningQuestions).not.toHaveBeenCalled();
      await user.click(form.getByRole('button', { name: 'Save screening questions' }));
      expect(api.replaceHiringScreeningQuestions).toHaveBeenCalledWith('j-1', [
        { text: 'Why do you want this role?', source: 'ai' }, { text: 'How do you handle pressure?', source: 'ai' },
        { text: 'Where do you want to grow?', source: 'ai' }]);
    });

    test('questions typed by hand stay first, and the AI’s are added after them', async () => {
      withJd([{ id: 's-1', position: 1, question_text: 'My own question', source: 'manual' }]);
      api.generateHiringScreeningQuestions.mockResolvedValue(proposal('Written by the model today?'));
      const user = userEvent.setup();
      const form = await openScreening(user);
      await user.clear(await form.findByLabelText('How many'));
      await user.type(form.getByLabelText('How many'), '1');
      await user.click(form.getByRole('button', { name: 'Generate with AI' }));
      expect(await form.findByLabelText('Screening question 2')).toHaveValue('Written by the model today?');
      expect(form.getByLabelText('Screening question 1')).toHaveValue('My own question');
      expect(form.getAllByText('Written by AI')).toHaveLength(1);
    });

    test('a short answer says how many it wrote, and an empty one says to try again', async () => {
      withJd();
      api.generateHiringScreeningQuestions.mockResolvedValueOnce(proposal('Only one usable question?'));
      const user = userEvent.setup();
      const form = await openScreening(user);
      await user.click(await form.findByRole('button', { name: 'Generate with AI' }));
      expect(await form.findByRole('status')).toHaveTextContent('The AI wrote 1 of 5 questions.');
      api.generateHiringScreeningQuestions.mockResolvedValueOnce({ data: { requested: 4, questions: [] } });
      await user.click(form.getByRole('button', { name: 'Generate with AI' }));
      await waitFor(() => expect(form.getByRole('status')).toHaveTextContent('did not write any usable questions'));
    });

    test('without a job description the AI is not offered, and manual questions still work', async () => {
      const user = userEvent.setup();
      const form = await openScreening(user);
      expect(await form.findByText(/add a job description to this job/i)).toBeInTheDocument();
      expect(form.queryByRole('button', { name: 'Generate with AI' })).not.toBeInTheDocument();
      await user.click(form.getByRole('button', { name: 'Add question' }));
      await user.type(form.getByLabelText('Screening question 1'), 'Why us?');
      await user.click(form.getByRole('button', { name: 'Save screening questions' }));
      expect(api.replaceHiringScreeningQuestions).toHaveBeenCalledWith('j-1', [{ text: 'Why us?', source: 'manual' }]);
    });

    test('the backend’s reason is shown when the AI cannot write, and the list is unchanged', async () => {
      withJd();
      api.generateHiringScreeningQuestions.mockRejectedValue({ response: { status: 503, data: { detail: {
        code: 'ai_not_configured', message: 'AI is not set up yet. Ask your platform administrator.' } } } });
      const user = userEvent.setup();
      const form = await openScreening(user);
      await user.click(await form.findByRole('button', { name: 'Generate with AI' }));
      expect(await form.findByRole('alert')).toHaveTextContent('AI is not set up yet. Ask your platform administrator.');
      expect(form.queryByLabelText('Screening question 1')).not.toBeInTheDocument();
    });

    test('the count cannot go past the 15-question limit or below 1', async () => {
      withJd(Array.from({ length: 14 }, (_, i) => (
        { id: `s-${i}`, position: i + 1, question_text: `Existing ${i + 1}`, source: 'manual' })));
      const user = userEvent.setup();
      const form = await openScreening(user);
      const count = await form.findByLabelText('How many');
      expect(form.getByText('Up to 1 more. Written from the job description.')).toBeInTheDocument();
      expect(form.getByRole('button', { name: 'Generate with AI' })).toBeDisabled(); // the default 5 is more than 1 fits
      await user.clear(count);
      await user.type(count, '0');
      expect(form.getByRole('button', { name: 'Generate with AI' })).toBeDisabled();
      await user.clear(count);
      await user.type(count, '1');
      expect(form.getByRole('button', { name: 'Generate with AI' })).toBeEnabled();
    });

    test('a rep cannot generate', async () => {
      withJd();
      const user = userEvent.setup();
      const form = await openScreening(user, 'rep');
      await form.findByTestId('screening-read-only').catch(() => null);
      expect(form.queryByTestId('generate-box')).not.toBeInTheDocument();
      expect(form.queryByRole('button', { name: 'Generate with AI' })).not.toBeInTheDocument();
    });
  });

  test('a rep reads screening questions but changes nothing', async () => {
    api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: QUESTIONS, screening_questions: [
      { id: 's-1', position: 1, question_text: 'Why us?', source: 'ai' }] } });
    const user = userEvent.setup();
    open('rep', '/hiring_agent/jobs');
    const row = await screen.findByTestId('job-row-j-1');
    expect(within(row).queryByRole('button', { name: 'Screening questions' })).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'View screening' }));
    const list = await within(dialog()).findByTestId('screening-read-only');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Why us?']);
    expect(within(dialog()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });
});

describe('lib/hiring: rebalancing weights', () => {
  const sum = (weights) => Object.values(weights).reduce((a, b) => a + b, 0);

  test('the others share what is left in proportion to what they hold', () => {
    expect(rebalanceWeights(equalWeights(), 'skills_match', 40)).toEqual({
      weights: { skills_match: 40, experience_match: 20, qualifications: 20, keyword_presence: 20 },
      fixed: ['skills_match'] });
    const lopsided = { skills_match: 10, experience_match: 60, qualifications: 20, keyword_presence: 10 };
    expect(rebalanceWeights(lopsided, 'skills_match', 40).weights).toEqual({
      skills_match: 40, experience_match: 40, qualifications: 13, keyword_presence: 7 });
  });

  test('weights already set stay put, so 40/30/20/10 is reachable by setting three', () => {
    let state = { weights: equalWeights(), fixed: [] };
    for (const [key, value] of [['skills_match', 40], ['experience_match', 30], ['qualifications', 20]]) {
      state = rebalanceWeights(state.weights, key, value, state.fixed);
    }
    expect(state.weights).toEqual({ skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 });
    expect(state.fixed).toEqual(['skills_match', 'experience_match', 'qualifications']);
  });

  test('when all four are set, a change scales the other three in proportion', () => {
    const set = { skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 };
    const all = ['skills_match', 'experience_match', 'qualifications', 'keyword_presence'];
    const state = rebalanceWeights(set, 'skills_match', 80, all);
    expect(state.weights).toEqual({ skills_match: 80, experience_match: 10, qualifications: 7, keyword_presence: 3 });
    expect(state.fixed).toEqual(['skills_match']);
  });

  test('the whole 100 can go to one weight, and the leftovers go to the first', () => {
    expect(rebalanceWeights(equalWeights(), 'qualifications', 100).weights)
      .toEqual({ skills_match: 0, experience_match: 0, qualifications: 100, keyword_presence: 0 });
    expect(rebalanceWeights(equalWeights(), 'skills_match', 0).weights)
      .toEqual({ skills_match: 0, experience_match: 34, qualifications: 33, keyword_presence: 33 });
  });

  test('others that hold nothing share the rest equally', () => {
    const all = { skills_match: 100, experience_match: 0, qualifications: 0, keyword_presence: 0 };
    expect(rebalanceWeights(all, 'skills_match', 40).weights)
      .toEqual({ skills_match: 40, experience_match: 20, qualifications: 20, keyword_presence: 20 });
  });

  test('values are rounded and kept from 0 to 100; nonsense counts as 0', () => {
    expect(rebalanceWeights(equalWeights(), 'skills_match', 12.6).weights.skills_match).toBe(13);
    expect(rebalanceWeights(equalWeights(), 'skills_match', 400).weights.skills_match).toBe(100);
    expect(rebalanceWeights(equalWeights(), 'skills_match', -9).weights.skills_match).toBe(0);
    expect(rebalanceWeights(equalWeights(), 'skills_match', 'abc').weights.skills_match).toBe(0);
    expect(sum(rebalanceWeights(equalWeights(), 'skills_match', 'abc').weights)).toBe(100);
  });

  test('whatever the sequence of changes, the weights are whole numbers from 0 to 100 adding up to 100', () => {
    let seed = 12345;
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const keys = ['skills_match', 'experience_match', 'qualifications', 'keyword_presence'];
    let state = { weights: equalWeights(), fixed: [] };
    for (let step = 0; step < 2000; step += 1) {
      const key = keys[Math.floor(random() * 4)];
      const value = random() < 0.1 ? Math.floor(random() * 300) - 100 : Math.floor(random() * 101);
      state = rebalanceWeights(state.weights, key, value, random() < 0.05 ? [] : state.fixed);
      expect(sum(state.weights)).toBe(100);
      expect(Object.values(state.weights).every((n) => Number.isInteger(n) && n >= 0 && n <= 100)).toBe(true);
      expect(Object.keys(state.weights).sort()).toEqual([...keys].sort());
      expect(state.fixed).toContain(key);
      expect(weightsProblem(state.weights)).toBeNull();
    }
  });
});

describe('lib/hiring: sections, weights and screening questions', () => {
  test('the seven resume sections are CFP’s, with readable names', () => {
    expect(RESUME_SECTIONS.map(({ key }) => key)).toEqual(['introduction', 'education', 'experience', 'projects',
      'skills', 'achievements', 'certifications_and_awards']);
    expect(sectionLabel('experience')).toBe('Work & Professional Experience');
    expect(sectionLabel('unknown')).toBeNull();
    expect(sectionLabel('')).toBeNull();
  });

  test('weights must be whole numbers from 0 to 100 that add up to 100', () => {
    expect(weightsProblem(equalWeights())).toBeNull();
    expect(weightsProblem({ skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 })).toBeNull();
    expect(weightsProblem({ ...equalWeights(), skills_match: 50 })).toMatch(/add up to 125/);
    expect(weightsProblem({ ...equalWeights(), skills_match: '' })).toMatch(/Skills match/);
    expect(weightsProblem({ ...equalWeights(), skills_match: 12.5 })).toMatch(/whole number/);
    expect(weightsProblem({ ...equalWeights(), skills_match: -5, keyword_presence: 55 })).toMatch(/whole number/);
  });

  test('screening question sets are trimmed, up to 15, none blank, and may be empty', () => {
    expect(checkScreeningQuestions([' Why us? '])).toEqual({ questions: ['Why us?'] });
    expect(checkScreeningQuestions([])).toEqual({ questions: [] });
    expect(checkScreeningQuestions(['A', ' ']).error).toMatch(/empty/i);
    expect(checkScreeningQuestions(Array(16).fill('Q')).error).toMatch(/at most 15/i);
    expect(checkScreeningQuestions(Array(15).fill('Q')).questions).toHaveLength(15);
  });
});

describe('lib/hiring', () => {
  test('question sets are trimmed, 1 to 8, none blank', () => {
    expect(checkQuestions([' Why this role? ', 'Notice?'])).toEqual({ questions: ['Why this role?', 'Notice?'] });
    expect(checkQuestions([]).error).toMatch(/at least one/i);
    expect(checkQuestions(['A', '  ']).error).toMatch(/empty/i);
    expect(checkQuestions(Array(9).fill('Q')).error).toMatch(/at most 8/i);
  });

  test('candidate forms need a name, a phone and a consent source when granted', () => {
    const form = { first_name: 'Ada', last_name: '', phone_number: '+1415', email: '', consent_status: 'unknown', consent_source: '' };
    expect(candidateProblem(form)).toBeNull();
    expect(candidateProblem({ ...form, first_name: ' ' })).toMatch(/first name/i);
    expect(candidateProblem({ ...form, phone_number: '' })).toMatch(/phone/i);
    expect(candidateProblem({ ...form, consent_status: 'granted' })).toMatch(/consent/i);
  });

  test('statuses read as words; an unknown one as it is', () => {
    expect(statusOf(BOOKING_STATUS, 'draft').label).toBe('Not called yet');
    expect(statusOf(BOOKING_STATUS, 'something_new')).toEqual({ label: 'something_new', tone: 'neutral' });
  });

  test('each action gets its own key', () => {
    expect(newKey()).not.toBe(newKey());
  });
});
