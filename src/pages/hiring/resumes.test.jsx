import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { HiringRoute } from '@/pages/hiring/HiringAgent';
import * as api from '@/lib/api';
import {
  MAX_RESUME_BYTES, MAX_RESUME_FILES, checkResumeFiles, formatScore, readFromResume, resumeBusy, scoreTone,
} from '@/lib/hiring';
import { USERS, renderWithAuth } from '@/test/renderWithAuth';

jest.mock('@/lib/api', () => ({
  listAvailableAgents: jest.fn(),
  listHiringJobs: jest.fn(),
  getHiringJob: jest.fn(),
  listHiringCandidates: jest.fn(),
  createHiringCandidate: jest.fn(),
  updateHiringCandidate: jest.fn(),
  uploadHiringResumes: jest.fn(),
  attachHiringResume: jest.fn(),
  getHiringResume: jest.fn(),
  downloadHiringResume: jest.fn(),
  listHiringScores: jest.fn(),
  retryHiringResumeScore: jest.fn(),
}));

const AT = '2026-11-20T09:00:00Z';
const JOBS = [
  { id: 'j-1', title: 'AI Engineer', status: 'open', has_jd: true, question_count: 2, screening_question_count: 0, created_at: AT, updated_at: AT },
  { id: 'j-2', title: 'Designer', status: 'open', has_jd: false, question_count: 0, screening_question_count: 0, created_at: AT, updated_at: AT },
];
const candidate = (overrides = {}) => ({
  id: 'c-1', first_name: 'Jordan', last_name: 'Example', phone_number: '+14155550100', email: 'jordan@example.com',
  consent_status: 'unknown', consent_source: null, consent_recorded_at: null, consent_recorded_by: null,
  created_at: AT, updated_at: AT, job_id: 'j-1', job_title: 'AI Engineer', stage: 'applied',
  detail_sources: { first_name: 'resume', last_name: 'resume', email: 'resume', phone_number: 'resume' },
  resume_status: 'read', resume_score: 3.7, resume_score_status: 'scored', ...overrides,
});
const SCORED = {
  kind: 'resume', status: 'scored', score: 3.7, reason: 'A reasonable fit.', bullets: ['Strong Python', 'No cloud'],
  categories: [
    { key: 'skills_match', label: 'Skills match', score: 4, reason: 'Python and FastAPI.' },
    { key: 'experience_match', label: 'Experience match', score: 3, reason: 'Four years.' },
    { key: 'qualifications', label: 'Qualifications', score: 5, reason: 'B.Tech.' },
    { key: 'keyword_presence', label: 'Keyword presence', score: 2, reason: 'Few key terms.' },
  ],
  weights: { skills_match: 40, experience_match: 30, qualifications: 20, keyword_presence: 10 },
  failure_code: null, failure_message: null, updated_at: AT,
};
const RESUME = { id: 'r-1', candidate_id: 'c-1', filename: 'jordan.pdf', content_type: 'application/pdf', size_bytes: 2048,
  parse_status: 'read', failure_code: null, failure_message: null, uploaded_by: 2, created_at: AT, updated_at: AT };

const pdf = (name = 'cv.pdf', size = 2000) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });
const dialog = () => screen.getByRole('dialog');

function open(role = 'manager', path = '/hiring_agent/candidates') {
  return renderWithAuth(
    <Routes>
      <Route path="/hiring_agent/*" element={<HiringRoute />} />
      <Route path="/403" element={<p>Forbidden</p>} />
    </Routes>,
    { user: USERS[role], path },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.listAvailableAgents.mockResolvedValue({ data: [{ id: 'a-2', key: 'hiring', name: 'Hiring' }] });
  api.listHiringJobs.mockResolvedValue({ data: JOBS });
  api.getHiringJob.mockResolvedValue({ data: { ...JOBS[0], questions: [], screening_questions: [] } });
  api.listHiringCandidates.mockResolvedValue({ data: [candidate()] });
  api.createHiringCandidate.mockResolvedValue({ data: {} });
  api.updateHiringCandidate.mockResolvedValue({ data: {} });
  api.uploadHiringResumes.mockResolvedValue({ data: { accepted: 1, rejected: 0, results: [] } });
  api.attachHiringResume.mockResolvedValue({ data: RESUME });
  api.getHiringResume.mockResolvedValue({ data: RESUME });
  api.listHiringScores.mockResolvedValue({ data: [SCORED] });
  api.retryHiringResumeScore.mockResolvedValue({ data: { ...SCORED, status: 'pending' } });
  api.downloadHiringResume.mockResolvedValue({ data: new Blob(['%PDF-']) });
});

describe('Hiring: the candidate list with resumes', () => {
  test('shows the job, the score, and marks details the AI read from the resume', async () => {
    open();
    const row = await screen.findByTestId('candidate-row-c-1');
    expect(within(row).getByText('AI Engineer')).toBeInTheDocument();
    expect(within(row).getByText('3.7 / 5')).toBeInTheDocument();
    expect(within(row).getAllByText('From resume')).toHaveLength(3); // name, phone, email
    expect(within(row).getByRole('button', { name: 'Scores' })).toBeInTheDocument();
  });

  test('a detail a person typed is not marked', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({ detail_sources: { email: 'resume' } })] });
    open();
    const row = await screen.findByTestId('candidate-row-c-1');
    expect(within(row).getAllByText('From resume')).toHaveLength(1);
  });

  test('a candidate with no phone number says so, and a candidate with no resume says so', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({
      phone_number: null, detail_sources: null, resume_status: null, resume_score: null, resume_score_status: null })] });
    open();
    const row = await screen.findByTestId('candidate-row-c-1');
    expect(within(row).getByText('Not found')).toBeInTheDocument();
    expect(within(row).getByText('No resume')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Upload resume' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Scores' })).not.toBeInTheDocument();
  });

  test('each state of a resume reads as words', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [
      candidate({ id: 'c-a', resume_status: 'pending', resume_score_status: 'pending', resume_score: null }),
      candidate({ id: 'c-b', resume_status: 'reading', resume_score_status: 'pending', resume_score: null }),
      candidate({ id: 'c-c', resume_status: 'read', resume_score_status: 'scoring', resume_score: null }),
      candidate({ id: 'c-d', resume_status: 'failed', resume_score_status: 'failed', resume_score: null }),
      candidate({ id: 'c-e', resume_status: 'read', resume_score_status: 'failed', resume_score: null }),
      candidate({ id: 'c-f', resume_status: 'read', resume_score_status: 'blocked', resume_score: null }),
    ] });
    open();
    expect(within(await screen.findByTestId('candidate-row-c-a')).getByText('Waiting to be read')).toBeInTheDocument();
    expect(within(screen.getByTestId('candidate-row-c-b')).getByText('Reading…')).toBeInTheDocument();
    expect(within(screen.getByTestId('candidate-row-c-c')).getByText('Scoring…')).toBeInTheDocument();
    expect(within(screen.getByTestId('candidate-row-c-d')).getByText('Could not be read')).toBeInTheDocument();
    expect(within(screen.getByTestId('candidate-row-c-e')).getByText('Not scored')).toBeInTheDocument();
    expect(within(screen.getByTestId('candidate-row-c-f')).getByText('Not scored')).toBeInTheDocument();
  });

  test('the list is filtered by job on the backend', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByTestId('candidate-row-c-1');
    await waitFor(() => expect(within(screen.getByLabelText('Job')).getAllByRole('option')).toHaveLength(3));
    await user.selectOptions(screen.getByLabelText('Job'), 'j-2');
    await waitFor(() => expect(api.listHiringCandidates).toHaveBeenLastCalledWith({ job_id: 'j-2', limit: 50 }));
  });

  test('while a resume is being read or scored the list refreshes by itself, and then stops', async () => {
    jest.useFakeTimers();
    try {
      let current = candidate({ resume_status: 'read', resume_score_status: 'scoring', resume_score: null });
      api.listHiringCandidates.mockImplementation(async () => ({ data: [current] }));
      open();
      expect(await within(await screen.findByTestId('candidate-row-c-1')).findByText('Scoring…')).toBeInTheDocument();
      current = candidate(); // the work finished on the server
      await act(async () => { jest.advanceTimersByTime(3200); });
      await waitFor(() => expect(within(screen.getByTestId('candidate-row-c-1')).getByText('3.7 / 5')).toBeInTheDocument());
      await act(async () => { jest.advanceTimersByTime(1000); });
      const calls = api.listHiringCandidates.mock.calls.length;
      await act(async () => { jest.advanceTimersByTime(20000); });
      expect(api.listHiringCandidates.mock.calls.length).toBe(calls); // nothing is busy any more: no more refreshing
    } finally {
      jest.useRealTimers();
    }
  });

  test('a rep sees the list and scores but no way to upload or edit', async () => {
    open('rep');
    const row = await screen.findByTestId('candidate-row-c-1');
    expect(screen.queryByRole('button', { name: /upload resumes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new candidate/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Scores' })).toBeInTheDocument();
  });
});

describe('Hiring: uploading resumes', () => {
  async function openUpload(user) {
    open();
    await user.click(await screen.findByRole('button', { name: /upload resumes/i }));
    const form = within(dialog());
    await waitFor(() => expect(form.getByLabelText(/^Job/)).not.toBeDisabled());
    return form;
  }

  test('choose a job and files, and the usable ones are uploaded together', async () => {
    api.uploadHiringResumes.mockResolvedValue({ data: { accepted: 2, rejected: 0, results: [] } });
    const user = userEvent.setup();
    const form = await openUpload(user);
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    const a = pdf('a.pdf');
    const b = new File([new Uint8Array(500)], 'b.docx');
    await user.upload(form.getByLabelText('Resume files'), [a, b]);
    expect(within(form.getByTestId('selected-files')).getAllByRole('listitem')).toHaveLength(2);
    await user.click(form.getByRole('button', { name: 'Upload 2 resumes' }));
    expect(api.uploadHiringResumes).toHaveBeenCalledWith('j-1', [a, b]);
    expect(await form.findByText(/2 resumes accepted/i)).toBeInTheDocument();
    await waitFor(() => expect(api.listHiringCandidates.mock.calls.length).toBeGreaterThanOrEqual(2));
    await user.click(form.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('files that cannot be used are named with the reason before anything is sent', async () => {
    // A drop, or "All files" in the picker, can bring any type in: the picker's own filter is turned off here.
    const user = userEvent.setup({ applyAccept: false });
    const form = await openUpload(user);
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    const big = pdf('big.pdf');
    Object.defineProperty(big, 'size', { value: MAX_RESUME_BYTES + 1 });
    await user.upload(form.getByLabelText('Resume files'), [pdf('ok.pdf'), new File(['hi'], 'notes.txt'), big,
      new File([], 'empty.pdf')]);
    expect(within(form.getByTestId('selected-files')).getAllByRole('listitem')).toHaveLength(1);
    const skipped = within(form.getByTestId('skipped-files')).getAllByRole('listitem').map((li) => li.textContent);
    expect(skipped).toHaveLength(3);
    expect(skipped.find((text) => text.startsWith('notes.txt'))).toContain('Only PDF and Word (.docx) files can be uploaded.');
    expect(skipped.find((text) => text.startsWith('big.pdf'))).toContain('larger than 5 MB');
    expect(skipped.find((text) => text.startsWith('empty.pdf'))).toContain('The file is empty.');
    expect(api.uploadHiringResumes).not.toHaveBeenCalled();
  });

  test('the backend’s own rejections are listed by name once the upload is done', async () => {
    api.uploadHiringResumes.mockResolvedValue({ data: { accepted: 1, rejected: 1, results: [
      { filename: 'good.pdf', status: 'accepted', candidate_id: 'c-9', code: null, message: null },
      { filename: 'locked.pdf', status: 'rejected', candidate_id: null, code: 'unsupported_type',
        message: 'Only PDF and Word (.docx) files can be uploaded.' }] } });
    const user = userEvent.setup();
    const form = await openUpload(user);
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    await user.upload(form.getByLabelText('Resume files'), [pdf('good.pdf'), pdf('locked.pdf')]);
    await user.click(form.getByRole('button', { name: 'Upload 2 resumes' }));
    const list = await form.findByTestId('rejected-files');
    expect(list).toHaveTextContent('locked.pdf: Only PDF and Word (.docx) files can be uploaded.');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  test('a job and at least one file are required', async () => {
    const user = userEvent.setup();
    const form = await openUpload(user);
    expect(form.getByRole('button', { name: 'Upload resume' })).toBeDisabled();
    await user.upload(form.getByLabelText('Resume files'), pdf());
    await user.click(form.getByRole('button', { name: 'Upload resume' }));
    expect(form.getByRole('alert')).toHaveTextContent('Choose the job these resumes are for.');
    expect(api.uploadHiringResumes).not.toHaveBeenCalled();
  });

  test('a job with no description warns that resumes can be read but not scored', async () => {
    const user = userEvent.setup();
    const form = await openUpload(user);
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-2');
    expect(form.getByText(/no description yet, so resumes can be read but not scored/i)).toBeInTheDocument();
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    expect(form.getByText(/scored against this job’s description/i)).toBeInTheDocument();
  });

  test('no more than thirty files, and the same file is not added twice', async () => {
    const user = userEvent.setup();
    const form = await openUpload(user);
    const many = Array.from({ length: MAX_RESUME_FILES + 2 }, (_, i) => pdf(`cv${i}.pdf`, 100 + i));
    await user.upload(form.getByLabelText('Resume files'), many);
    expect(within(form.getByTestId('selected-files')).getAllByRole('listitem')).toHaveLength(MAX_RESUME_FILES);
    expect(within(form.getByTestId('skipped-files')).getAllByRole('listitem')).toHaveLength(2);
    await user.upload(form.getByLabelText('Resume files'), many[0]);
    expect(within(form.getByTestId('selected-files')).getAllByRole('listitem')).toHaveLength(MAX_RESUME_FILES);
  });

  test('a file can be taken out of the list before uploading', async () => {
    const user = userEvent.setup();
    const form = await openUpload(user);
    await user.upload(form.getByLabelText('Resume files'), [pdf('a.pdf'), pdf('b.pdf', 3000)]);
    await user.click(form.getByRole('button', { name: 'Remove a.pdf' }));
    expect(within(form.getByTestId('selected-files')).getAllByRole('listitem')).toHaveLength(1);
    expect(form.getByRole('button', { name: 'Upload resume' })).toBeEnabled();
  });

  test('files can be dropped on the box', async () => {
    const user = userEvent.setup();
    const form = await openUpload(user);
    const file = pdf('dropped.pdf');
    const zone = form.getByTestId('drop-zone');
    await act(async () => {
      zone.dispatchEvent(Object.assign(new Event('drop', { bubbles: true, cancelable: true }),
        { dataTransfer: { files: [file] } }));
    });
    expect(await form.findByText('dropped.pdf')).toBeInTheDocument();
  });

  test('an upload that fails shows the reason and keeps the files', async () => {
    api.uploadHiringResumes.mockRejectedValue({ response: { status: 409, data: { detail: 'This job is closed' } } });
    const user = userEvent.setup();
    const form = await openUpload(user);
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    await user.upload(form.getByLabelText('Resume files'), pdf('a.pdf'));
    await user.click(form.getByRole('button', { name: 'Upload resume' }));
    expect(await form.findByRole('alert')).toHaveTextContent('This job is closed');
    expect(form.getByTestId('selected-files')).toBeInTheDocument();
  });

  test('only open jobs are offered, and the list’s job filter is the default choice', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByTestId('candidate-row-c-1');
    await waitFor(() => expect(within(screen.getByLabelText('Job')).getAllByRole('option')).toHaveLength(3));
    await user.selectOptions(screen.getByLabelText('Job'), 'j-1');
    await user.click(screen.getByRole('button', { name: /upload resumes/i }));
    await waitFor(() => expect(api.listHiringJobs).toHaveBeenCalledWith({ status: 'open', limit: 200 }));
    expect(within(dialog()).getByLabelText(/^Job/)).toHaveValue('j-1');
  });

  test('replacing one candidate’s resume takes a single file and replaces it', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({ resume_status: null, resume_score: null,
      resume_score_status: null, detail_sources: null })] });
    const user = userEvent.setup();
    open();
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Upload resume' }));
    const form = within(dialog());
    expect(form.getByRole('heading', { name: /upload a resume for jordan example/i })).toBeInTheDocument();
    expect(form.queryByLabelText(/^Job/)).not.toBeInTheDocument();
    const first = pdf('first.pdf');
    await user.upload(form.getByLabelText('Resume file'), first);
    await user.click(form.getByRole('button', { name: 'Upload resume' }));
    expect(api.attachHiringResume).toHaveBeenCalledWith('c-1', first);
    expect(await form.findByText(/1 resume accepted/i)).toBeInTheDocument();
  });
});

describe('Hiring: scores', () => {
  async function openScores(user, role = 'manager') {
    open(role);
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Scores' }));
    return within(dialog());
  }

  test('the resume score shows its categories, weights, reasons and the file', async () => {
    const user = userEvent.setup();
    const form = await openScores(user);
    const card = within(await form.findByTestId('score-resume'));
    expect(card.getByTestId('score-figure')).toHaveTextContent('3.7 / 5');
    expect(card.getByText('A reasonable fit.')).toBeInTheDocument();
    const skills = within(card.getByTestId('category-skills_match'));
    expect(skills.getByText('Skills match')).toBeInTheDocument();
    expect(skills.getByText('counts 40%')).toBeInTheDocument();
    expect(skills.getByText('Python and FastAPI.')).toBeInTheDocument();
    expect(skills.getByText('4.0 / 5')).toBeInTheDocument();
    expect(card.getAllByRole('listitem').map((li) => li.textContent).join(' ')).toContain('Strong Python');
    expect(form.getByTestId('resume-file')).toHaveTextContent('jordan.pdf');
  });

  test('the file can be downloaded', async () => {
    const createUrl = jest.fn(() => 'blob:resume');
    const revoke = jest.fn();
    const original = { create: global.URL.createObjectURL, revoke: global.URL.revokeObjectURL };
    global.URL.createObjectURL = createUrl;
    global.URL.revokeObjectURL = revoke;
    try {
      const user = userEvent.setup();
      const form = await openScores(user);
      await user.click(await form.findByRole('button', { name: /download/i }));
      await waitFor(() => expect(api.downloadHiringResume).toHaveBeenCalledWith('c-1'));
      expect(createUrl).toHaveBeenCalled();
      await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:resume'));
    } finally {
      global.URL.createObjectURL = original.create;
      global.URL.revokeObjectURL = original.revoke;
    }
  });

  test('a score that could not be worked out says why and can be tried again', async () => {
    api.listHiringScores.mockResolvedValue({ data: [{ ...SCORED, status: 'failed', score: null, categories: [],
      bullets: [], failure_code: 'jd_missing', failure_message: 'This job has no description yet. Add one to the job, then score the resume.' }] });
    const user = userEvent.setup();
    const form = await openScores(user);
    expect(await form.findByRole('alert')).toHaveTextContent('This job has no description yet.');
    await user.click(form.getByRole('button', { name: 'Score again' }));
    expect(api.retryHiringResumeScore).toHaveBeenCalledWith('c-1');
  });

  test('an unreadable file offers a new upload, not another try', async () => {
    api.getHiringResume.mockResolvedValue({ data: { ...RESUME, parse_status: 'failed', failure_code: 'password_protected',
      failure_message: 'The file is password protected. Remove the password and upload it again.' } });
    api.listHiringScores.mockResolvedValue({ data: [{ ...SCORED, status: 'failed', score: null, categories: [], bullets: [],
      failure_code: 'password_protected', failure_message: 'The file is password protected. Remove the password and upload it again.' }] });
    const user = userEvent.setup();
    const form = await openScores(user);
    expect((await form.findAllByRole('alert'))[0]).toHaveTextContent('password protected');
    expect(form.queryByRole('button', { name: 'Score again' })).not.toBeInTheDocument();
    expect(form.getAllByRole('button', { name: 'Upload another file' }).length).toBeGreaterThan(0);
  });

  test('a resume the AI refused is explained and cannot simply be retried', async () => {
    api.listHiringScores.mockResolvedValue({ data: [{ ...SCORED, status: 'blocked', score: null, categories: [], bullets: [],
      failure_code: 'content_blocked', failure_message: 'The resume was not scored because it contains instructions aimed at the AI. A person should read it.' }] });
    const user = userEvent.setup();
    const form = await openScores(user);
    expect(await form.findByRole('alert')).toHaveTextContent('A person should read it.');
    expect(form.queryByRole('button', { name: 'Score again' })).not.toBeInTheDocument();
  });

  test('a score still being worked out says so and the dialog keeps itself up to date', async () => {
    jest.useFakeTimers();
    try {
      let current = [{ ...SCORED, status: 'scoring', score: null, categories: [], bullets: [] }];
      api.listHiringScores.mockImplementation(async () => ({ data: current }));
      open();
      const row = await screen.findByTestId('candidate-row-c-1');
      await act(async () => { within(row).getByRole('button', { name: 'Scores' }).click(); });
      expect(await within(dialog()).findByText(/being scored now/i)).toBeInTheDocument();
      current = [SCORED]; // the work finished on the server
      await act(async () => { jest.advanceTimersByTime(3200); });
      expect(await within(dialog()).findByTestId('score-figure')).toHaveTextContent('3.7 / 5');
      expect(within(dialog()).queryByText(/being scored now/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('a candidate with no resume has nothing to score', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({ resume_status: 'read' })] });
    api.getHiringResume.mockRejectedValue({ response: { status: 404, data: { detail: 'Resume not found' } } });
    api.listHiringScores.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    const form = await openScores(user);
    expect(await form.findByText(/no resume has been uploaded/i)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Upload resume' })).toBeInTheDocument();
  });

  test('a rep reads scores but cannot retry or replace', async () => {
    api.listHiringScores.mockResolvedValue({ data: [{ ...SCORED, status: 'failed', score: null, categories: [], bullets: [],
      failure_message: 'The AI could not score this resume just now. Try again in a moment.' }] });
    const user = userEvent.setup();
    const form = await openScores(user, 'rep');
    expect(await form.findByRole('alert')).toBeInTheDocument();
    expect(form.queryByRole('button', { name: 'Score again' })).not.toBeInTheDocument();
    expect(form.queryByRole('button', { name: /replace resume|upload resume/i })).not.toBeInTheDocument();
  });

  test('replacing from the scores opens the upload for that candidate', async () => {
    const user = userEvent.setup();
    const form = await openScores(user);
    await user.click(await form.findByRole('button', { name: 'Replace resume' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /upload a resume for jordan example/i })).toBeInTheDocument());
  });
});

describe('Hiring: the candidate dialog with jobs', () => {
  test('a typed candidate must be given a job', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: /new candidate/i }));
    const form = within(dialog());
    await user.type(form.getByLabelText(/first name/i), 'Grace');
    await user.type(form.getByLabelText(/phone number/i), '4155550102');
    expect(form.getByRole('button', { name: 'Add candidate' })).toBeDisabled();
    await waitFor(() => expect(within(form.getByLabelText(/^Job/)).getAllByRole('option').length).toBeGreaterThan(1));
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    await user.click(form.getByRole('button', { name: 'Add candidate' }));
    expect(api.createHiringCandidate).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Grace', job_id: 'j-1' }));
  });

  test('a candidate with no job can be linked to one', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({ job_id: null, job_title: null, detail_sources: null })] });
    const user = userEvent.setup();
    open();
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Edit' }));
    const form = within(dialog());
    await waitFor(() => expect(within(form.getByLabelText('Job')).getAllByRole('option').length).toBeGreaterThan(1));
    await user.selectOptions(form.getByLabelText(/^Job/), 'j-1');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(api.updateHiringCandidate).toHaveBeenCalledWith('c-1', { job_id: 'j-1' });
  });

  test('a candidate already on a job shows it and cannot be moved', async () => {
    const user = userEvent.setup();
    open();
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Edit' }));
    const form = within(dialog());
    expect(form.getByText('AI Engineer')).toBeInTheDocument();
    expect(form.queryByLabelText('Job')).not.toBeInTheDocument();
    expect(form.getByText(/marked "From resume" in the list were read by the AI/i)).toBeInTheDocument();
  });

  test('a candidate whose resume had no phone number can be edited without adding one', async () => {
    api.listHiringCandidates.mockResolvedValue({ data: [candidate({ phone_number: null, detail_sources: null })] });
    const user = userEvent.setup();
    open();
    await user.click(within(await screen.findByTestId('candidate-row-c-1')).getByRole('button', { name: 'Edit' }));
    const form = within(dialog());
    expect(form.getByText(/no phone number was found in the resume/i)).toBeInTheDocument();
    const email = form.getByLabelText(/email/i);
    await user.clear(email);
    await user.type(email, 'new@example.com');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(api.updateHiringCandidate).toHaveBeenCalledWith('c-1', { email: 'new@example.com' });
  });
});

describe('lib/hiring: resume helpers', () => {
  test('scores read out of 5 and are coloured by how good they are', () => {
    expect(formatScore(3.7)).toBe('3.7 / 5');
    expect(formatScore(4)).toBe('4.0 / 5');
    expect(formatScore(0)).toBe('0.0 / 5');
    expect(formatScore(null)).toBe('—');
    expect(formatScore(undefined)).toBe('—');
    expect([scoreTone(4), scoreTone(4.5), scoreTone(2.5), scoreTone(3.9), scoreTone(2.4), scoreTone(0)])
      .toEqual(['good', 'good', 'warn', 'warn', 'bad', 'bad']);
    expect(scoreTone(null)).toBe('neutral');
  });

  test('a row is busy while its resume is read or scored', () => {
    expect(resumeBusy({ resume_status: 'pending' })).toBe(true);
    expect(resumeBusy({ resume_status: 'reading' })).toBe(true);
    expect(resumeBusy({ resume_status: 'read', resume_score_status: 'scoring' })).toBe(true);
    expect(resumeBusy({ resume_status: 'read', resume_score_status: 'pending' })).toBe(true);
    expect(resumeBusy({ resume_status: 'read', resume_score_status: 'scored' })).toBe(false);
    expect(resumeBusy({ resume_status: 'failed', resume_score_status: 'failed' })).toBe(false);
    expect(resumeBusy({ resume_status: null })).toBe(false);
    expect(resumeBusy(null)).toBe(false);
  });

  test('a detail is from the resume only when marked so', () => {
    expect(readFromResume({ detail_sources: { email: 'resume', first_name: 'manual' } }, 'email')).toBe(true);
    expect(readFromResume({ detail_sources: { email: 'resume', first_name: 'manual' } }, 'first_name')).toBe(false);
    expect(readFromResume({ detail_sources: null }, 'email')).toBe(false);
    expect(readFromResume(null, 'email')).toBe(false);
  });

  test('resume files are checked the way the backend checks them', () => {
    const ok = pdf('cv.PDF');
    const docx = new File(['x'], 'cv.DOCX');
    const { accepted, problems } = checkResumeFiles([ok, docx, new File(['x'], 'cv.doc'), new File([], 'e.pdf'),
      new File(['x'], 'photo.png')]);
    expect(accepted).toEqual([ok, docx]);
    expect(problems.map((p) => p.name)).toEqual(['cv.doc', 'e.pdf', 'photo.png']);
    const many = Array.from({ length: MAX_RESUME_FILES + 3 }, (_, i) => pdf(`f${i}.pdf`));
    const result = checkResumeFiles(many);
    expect(result.accepted).toHaveLength(MAX_RESUME_FILES);
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0].message).toMatch(/at most 30/i);
  });
});
