import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Briefcase, ChevronDown, FileText, ListChecks, MessagesSquare, Pencil, Plus, Search, Users,
} from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import JobDialog from '@/components/hiring/JobDialog';
import QuestionsDialog from '@/components/hiring/QuestionsDialog';
import ScreeningQuestionsDialog from '@/components/hiring/ScreeningQuestionsDialog';
import { CONTROL, HiringError, ListFooter } from '@/components/hiring/HiringBits';
import useApiAction from '@/hooks/useApiAction';
import { listHiringCandidates, listHiringJobs, updateHiringJob } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  JOB_STATUS, MAX_ROWS, PAGE_SIZE, STAGE, candidateName, candidatePath, statusOf,
} from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

// The status filter, as a segmented control: every job, or one status (sent to the backend as `status`).
const FILTERS = [{ value: '', label: 'All jobs' }, ...Object.entries(JOB_STATUS).map(([value, { label }]) => ({ value, label }))];

/** One fact about a job, with its label, on the row's second line. */
function Fact({ icon: Icon, label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

// How many of a job's candidates the opened row lists; the Candidates tab has the rest.
const PREVIEW_CANDIDATES = 10;

/** The candidates who applied for a job, each a link to their profile. Loaded when the job is opened. */
function JobCandidates({ job }) {
  const { data: candidates, error, reload } = useHiringData(
    () => listHiringCandidates({ job_id: job.id, limit: PREVIEW_CANDIDATES + 1 }), [job.id]);
  const shown = candidates ? candidates.slice(0, PREVIEW_CANDIDATES) : null;
  const more = Boolean(candidates && candidates.length > PREVIEW_CANDIDATES);
  return (
    <div id={`job-candidates-${job.id}`} data-testid={`job-candidates-${job.id}`}
      className="rounded-lg border border-border bg-background/60 p-3 sm:ml-[3.25rem]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> Candidates
        </h4>
        {shown && shown.length > 0 && (
          <Link to={`${candidatePath('').replace(/\/$/, '')}?job=${encodeURIComponent(job.id)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--ops-accent-ink)] hover:underline">
            {more ? 'View all' : 'Open in Candidates'} <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
      {error ? <HiringError error={error} onRetry={reload} />
        : !shown ? <SkeletonRows rows={2} label="Loading candidates" />
          : shown.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No one has applied for this job yet.</p>
          ) : (
            <ul className="divide-y divide-border" aria-label={`Candidates for ${job.title}`}>
              {shown.map((candidate) => {
                const stage = statusOf(STAGE, candidate.stage);
                return (
                  <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link to={candidatePath(candidate.id)}
                      className="min-w-0 truncate font-medium text-[color:var(--ops-accent-ink)] hover:underline">
                      {candidateName(candidate)}
                    </Link>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <StatusBadge label={stage.label} tone={stage.tone} />
                      <span className="hidden sm:inline">Added <RelativeTime iso={candidate.created_at} /></span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
    </div>
  );
}

/** A job: its title and status, what it is set up with, when it changed, and what can be done with it. */
function JobRow({ job, canManage, toggling, expanded, onExpand, onQuestions, onScreening, onEdit, onToggle }) {
  const state = statusOf(JOB_STATUS, job.status);
  const closed = job.status !== 'open';
  return (
    <li data-testid={`job-row-${job.id}`} className="space-y-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
     <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${closed ? 'bg-muted text-muted-foreground' : '[background:color-mix(in_srgb,var(--ops-accent)_12%,transparent)] text-[color:var(--ops-accent-ink)]'}`}>
          <Briefcase className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* The title opens the candidates who applied for this job. */}
            <h3 className="min-w-0 text-[0.95rem] font-semibold">
              <button type="button" onClick={onExpand} aria-expanded={expanded} aria-controls={`job-candidates-${job.id}`}
                title={`Show candidates for ${job.title}`}
                className={`inline-flex max-w-full items-center gap-1 rounded-sm text-left underline-offset-4 hover:text-[color:var(--ops-accent-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ops-accent)] ${closed ? 'text-muted-foreground' : ''}`}>
                <span className="truncate">{job.title}</span>
                <ChevronDown aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            <StatusBadge label={state.label} tone={state.tone} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <Fact icon={FileText} label="Description">
              {job.has_jd
                ? <StatusBadge label="Added" tone="good" />
                : <StatusBadge label="No JD" tone="neutral" title="Resumes can only be scored against a job description" />}
            </Fact>
            <Fact icon={ListChecks} label="Intake questions">
              {job.question_count
                ? <span className="ops-num font-medium text-foreground">{job.question_count}</span>
                : <StatusBadge label="No questions" tone="warn" title="A job needs at least one question before calls" />}
            </Fact>
            <Fact icon={MessagesSquare} label="Screening">
              {job.screening_question_count
                ? <span className="ops-num font-medium text-foreground" data-testid={`screening-count-${job.id}`}>{job.screening_question_count}</span>
                : <span className="font-medium text-foreground">None</span>}
            </Fact>
            <span className="text-muted-foreground">Updated <RelativeTime iso={job.updated_at} /></span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
        <OpsButton size="sm" onClick={onQuestions}>{canManage ? 'Edit questions' : 'View questions'}</OpsButton>
        <OpsButton size="sm" onClick={onScreening}>{canManage ? 'Screening questions' : 'View screening'}</OpsButton>
        {canManage && (
          <>
            <OpsButton size="sm" variant="quiet" onClick={onEdit} aria-label="Edit job" title="Edit job">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /><span className="lg:sr-only">Edit</span>
            </OpsButton>
            <OpsButton size="sm" variant="quiet" busy={toggling} onClick={onToggle}
              title={closed ? 'Open this job again' : 'Stop using this job for new calls'}>
              {closed ? 'Reopen' : 'Close'}
            </OpsButton>
          </>
        )}
      </div>
     </div>
      {expanded && <JobCandidates job={job} />}
    </li>
  );
}

/**
 * Jobs, their description, resume weights, intake questions and audio-screening questions.  Tenant Admins and
 * Managers change them; everyone else reads.  The status filter asks the backend; the search narrows the loaded list.
 */
export default function JobsTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const [jobStatus, setJobStatus] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [naming, setNaming] = useState(null); // { job } to rename, {} to create
  const [questionsOf, setQuestionsOf] = useState(null);
  const [screeningOf, setScreeningOf] = useState(null);
  const [openJob, setOpenJob] = useState(null); // the job whose candidates are showing
  const { data: jobs, error, reload } = useHiringData(
    () => listHiringJobs({ status: jobStatus || undefined, limit }), [jobStatus, limit]);
  const toggle = useApiAction(
    (job) => updateHiringJob(job.id, { status: job.status === 'open' ? 'closed' : 'open' }),
    { success: (r) => (r.data.status === 'open' ? 'Job reopened' : 'Job closed'), onSuccess: reload, onConflict: reload });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !jobs || !q ? jobs : jobs.filter((job) => job.title.toLowerCase().includes(q));
  }, [jobs, query]);

  const saved = (job, created) => {
    reload();
    if (created) setQuestionsOf(job);
  };

  return (
    <section className="space-y-4" aria-label="Jobs">
      {/* Toolbar: search and the status filter on the left, the one primary action on the right. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block sm:w-64">
            <span className="sr-only">Search jobs</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs"
              className={`${CONTROL} pl-9`} />
          </label>
          <div role="group" aria-label="Status" className="inline-flex w-fit rounded-lg border border-border bg-background p-0.5">
            {FILTERS.map((filter) => {
              const active = jobStatus === filter.value;
              return (
                <button key={filter.value || 'all'} type="button" aria-pressed={active}
                  onClick={() => { setJobStatus(filter.value); setLimit(PAGE_SIZE); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ops-accent)] ${
                    active ? 'bg-[color:var(--ops-accent)] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        {canManage && (
          <OpsButton variant="primary" onClick={() => setNaming({})} className="w-fit">
            <Plus className="h-4 w-4" /> New job
          </OpsButton>
        )}
      </div>

      {error && <HiringError error={error} onRetry={reload} />}
      {!jobs ? (!error && <SkeletonRows rows={4} label="Loading jobs" />)
        : jobs.length === 0 ? (
          <EmptyState title={jobStatus ? `No ${statusOf(JOB_STATUS, jobStatus).label.toLowerCase()} jobs` : 'No jobs yet'}
            body={canManage ? 'Create a job and add the questions its intake call asks.' : 'Jobs your managers add appear here.'}
            action={canManage && !jobStatus
              ? <OpsButton variant="primary" onClick={() => setNaming({})}><Plus className="h-4 w-4" /> New job</OpsButton>
              : null} />
        ) : shown.length === 0 ? (
          <EmptyState title="No matching jobs" body={`No job title contains "${query.trim()}".`}
            action={<OpsButton size="sm" onClick={() => setQuery('')}>Clear search</OpsButton>} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {shown.length} {shown.length === 1 ? 'job' : 'jobs'}{query.trim() ? ` matching "${query.trim()}"` : ''}
            </p>
            <ul className="ops-card divide-y divide-border overflow-hidden" aria-label="Jobs list">
              {shown.map((job) => (
                <JobRow key={job.id} job={job} canManage={canManage} toggling={toggle.pending}
                  expanded={openJob === job.id} onExpand={() => setOpenJob((id) => (id === job.id ? null : job.id))}
                  onQuestions={() => setQuestionsOf(job)} onScreening={() => setScreeningOf(job)}
                  onEdit={() => setNaming({ job })} onToggle={() => toggle.run(job)} />
              ))}
            </ul>
            <ListFooter count={jobs.length} limit={limit} max={MAX_ROWS} what="jobs"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}

      <JobDialog open={naming !== null} job={naming?.job || null} onOpenChange={(open) => { if (!open) setNaming(null); }}
        onSaved={saved} />
      <QuestionsDialog job={questionsOf} canEdit={canManage} onOpenChange={(open) => { if (!open) setQuestionsOf(null); }}
        onSaved={reload} />
      <ScreeningQuestionsDialog job={screeningOf} canEdit={canManage}
        onOpenChange={(open) => { if (!open) setScreeningOf(null); }} onSaved={reload} />
    </section>
  );
}
