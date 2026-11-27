import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Pencil, Plus, Search, Sparkles, Upload } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ScrollTable, SkeletonRows } from '@/components/ops/States';
import CandidateDialog from '@/components/hiring/CandidateDialog';
import ScoresDialog from '@/components/hiring/ScoresDialog';
import UploadResumesDialog from '@/components/hiring/UploadResumesDialog';
import { CONTROL, HiringError, ListFooter } from '@/components/hiring/HiringBits';
import { listHiringCandidates, listHiringJobs } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  CONSENT_STATUS, MAX_ROWS, PAGE_SIZE, RESUME_STATUS, SCORE_STATUS, STAGE, candidateName, candidatePath, formatScore,
  readFromResume, resumeBusy, scoreTone, statusOf,
} from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

const SEARCH_DELAY_MS = 300;
// While a resume is being read or scored, the list refreshes this often.
const BUSY_REFRESH_MS = 3000;

/** A detail the AI read from the resume, marked so a person checks it. */
function AiRead({ show }) {
  if (!show) return null;
  // Small and inline (not a pill), so it sits beside the value instead of taking a line of its own.
  return (
    <span title="Read from the resume by the AI. Check it, and edit it if it is wrong."
      className="inline-flex items-center gap-0.5 whitespace-nowrap text-[0.68rem] font-semibold text-[color:var(--ops-info)]">
      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />From resume
    </span>
  );
}

/** The uploaded resume's state, or its score once there is one. */
function ResumeCell({ candidate, onOpen }) {
  if (!candidate.resume_status) return <span className="whitespace-nowrap text-muted-foreground">No resume</span>;
  if (candidate.resume_score_status === 'scored') {
    return (
      <button type="button" onClick={onOpen} aria-label={`Resume score ${formatScore(candidate.resume_score)}`}
        className="inline-flex items-center gap-2 rounded-md hover:underline">
        <StatusBadge label={formatScore(candidate.resume_score)} tone={scoreTone(candidate.resume_score)} />
      </button>
    );
  }
  const file = statusOf(RESUME_STATUS, candidate.resume_status);
  const score = candidate.resume_score_status ? statusOf(SCORE_STATUS, candidate.resume_score_status) : null;
  const shown = candidate.resume_status === 'read' && score ? score : file;
  return (
    <button type="button" onClick={onOpen} className="rounded-md hover:underline" aria-label={`Resume: ${shown.label}`}>
      <StatusBadge label={shown.label} tone={shown.tone} />
    </button>
  );
}

/**
 * The organisation's candidates: their job, details, uploaded resume and its score, and their consent to be called.
 * Tenant Admins and Managers add candidates (by uploading resumes, or by typing details), edit them and upload resumes;
 * everyone else reads. A resume is read and scored in the background, so the list refreshes by itself meanwhile.
 */
export default function CandidatesTab() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // A job's "Open in Candidates" link arrives with ?job=<id>, already filtered to that job.
  const [searchParams] = useSearchParams();
  const [jobFilter, setJobFilter] = useState(() => searchParams.get('job') || '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState(null); // { candidate } to edit, {} to add
  const [uploading, setUploading] = useState(null); // {} for new resumes, { candidate } to replace one
  const [scoresOf, setScoresOf] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setLimit(PAGE_SIZE); }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: jobs } = useHiringData(() => listHiringJobs({ limit: 200 }), []);
  const { data: candidates, error, reload } = useHiringData(
    () => listHiringCandidates({ q: query || undefined, job_id: jobFilter || undefined, limit }),
    [query, jobFilter, limit], { pollMs: busy ? BUSY_REFRESH_MS : 0 });

  useEffect(() => { setBusy(Boolean(candidates?.some(resumeBusy))); }, [candidates]);

  const filtered = Boolean(query || jobFilter);

  return (
    <section className="space-y-4" aria-label="Candidates">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* The job first, then the search to its right. */}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Job
            <select value={jobFilter} onChange={(e) => { setJobFilter(e.target.value); setLimit(PAGE_SIZE); }}
              className={`${CONTROL} w-52`}>
              <option value="">All jobs</option>
              {(jobs || []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Search
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100}
                placeholder="Name, phone or email" className={`${CONTROL} w-64 pl-9`} />
            </span>
          </label>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <OpsButton variant="primary" onClick={() => setUploading({})}><Upload className="h-4 w-4" /> Upload resumes</OpsButton>
            <OpsButton onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New candidate</OpsButton>
          </div>
        )}
      </div>

      {error && <HiringError error={error} onRetry={reload} />}
      {!candidates ? (!error && <SkeletonRows rows={4} label="Loading candidates" />)
        : candidates.length === 0 ? (
          <EmptyState title={filtered ? 'No candidates match' : 'No candidates yet'}
            body={filtered ? 'Try another name, phone number, email or job.'
              : canManage ? 'Upload resumes to add many candidates at once, or add one by typing their details.'
                : 'Candidates your managers add appear here.'} />
        ) : (
          <>
            <ScrollTable label="Candidates">
              {/* Seven columns that fit the page without sideways scrolling: the job sits under the name, and the
                  phone and email share one Contact column. Nothing is left out. */}
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-3 font-semibold">Candidate</th>
                  <th className="px-2.5 py-3 font-semibold">Round</th>
                  <th className="px-2.5 py-3 font-semibold">Contact</th>
                  <th className="px-2.5 py-3 font-semibold">Resume</th>
                  <th className="px-2.5 py-3 font-semibold">Consent</th>
                  <th className="px-2.5 py-3 font-semibold">Added</th>
                  <th className="px-2.5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((candidate) => {
                  const consent = statusOf(CONSENT_STATUS, candidate.consent_status);
                  const stage = statusOf(STAGE, candidate.stage);
                  return (
                    <tr key={candidate.id} data-testid={`candidate-row-${candidate.id}`} className="align-middle">
                      <td className="px-2.5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link to={candidatePath(candidate.id)} className="whitespace-nowrap font-medium text-[color:var(--ops-accent-ink)] hover:underline">
                            {candidateName(candidate)}
                          </Link>
                          <AiRead show={readFromResume(candidate, 'first_name') || readFromResume(candidate, 'last_name')} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{candidate.job_title || 'No job'}</p>
                      </td>
                      <td className="px-2.5 py-3"><StatusBadge label={stage.label} tone={stage.tone} /></td>
                      <td className="px-2.5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {candidate.phone_number
                            ? <span className="ops-num whitespace-nowrap font-medium">{candidate.phone_number}</span>
                            : <span className="text-muted-foreground" title="Add a phone number to call this candidate">Not found</span>}
                          <AiRead show={candidate.phone_number && readFromResume(candidate, 'phone_number')} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="block max-w-[9.5rem] truncate" title={candidate.email || undefined}>{candidate.email || 'No email'}</span>
                          <AiRead show={candidate.email && readFromResume(candidate, 'email')} />
                        </div>
                      </td>
                      <td className="px-2.5 py-3"><ResumeCell candidate={candidate} onOpen={() => setScoresOf(candidate)} /></td>
                      <td className="px-2.5 py-3">
                        <StatusBadge label={consent.label} tone={consent.tone} />
                        {candidate.consent_source && (
                          <p className="mt-1 text-xs text-muted-foreground">{candidate.consent_source}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-muted-foreground"><RelativeTime iso={candidate.created_at} /></td>
                      <td className="px-2.5 py-3 text-right">
                        {/* One line per row: the resume action at one fixed width (Scores or Upload resume), then the
                            Edit icon, so the buttons sit in two straight columns down the table. */}
                        <div className="flex flex-nowrap items-center justify-end gap-1.5">
                          {candidate.resume_status ? (
                            <OpsButton size="sm" onClick={() => setScoresOf(candidate)} className="w-[6.5rem] whitespace-nowrap">
                              <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Scores
                            </OpsButton>
                          ) : canManage ? (
                            <OpsButton size="sm" onClick={() => setUploading({ candidate })} aria-label="Upload resume" title="Upload a resume" className="w-[6.5rem] whitespace-nowrap">
                              <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Upload
                            </OpsButton>
                          ) : null}
                          {canManage && (
                            <OpsButton size="sm" variant="quiet" onClick={() => setEditing({ candidate })}
                              aria-label="Edit" title="Edit candidate" className="w-8 px-0">
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </OpsButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <ListFooter count={candidates.length} limit={limit} max={MAX_ROWS} what="candidates"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}

      <CandidateDialog open={editing !== null} candidate={editing?.candidate || null}
        onOpenChange={(open) => { if (!open) setEditing(null); }} onSaved={reload} />
      <UploadResumesDialog open={uploading !== null} candidate={uploading?.candidate || null} defaultJobId={jobFilter}
        onOpenChange={(open) => { if (!open) setUploading(null); }} onDone={reload} />
      <ScoresDialog candidate={scoresOf} canManage={canManage} onChanged={reload}
        onOpenChange={(open) => { if (!open) setScoresOf(null); }}
        onReplace={() => { setUploading({ candidate: scoresOf }); setScoresOf(null); }} />
    </section>
  );
}
