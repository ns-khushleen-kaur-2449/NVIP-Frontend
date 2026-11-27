import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import CallCandidate from '@/components/hiring/CallCandidate';
import CallCard from '@/components/hiring/CallCard';
import AiResumePanel from '@/components/hiring/AiResumePanel';
import CandidateDialog from '@/components/hiring/CandidateDialog';
import { HiringError } from '@/components/hiring/HiringBits';
import PipelineCard from '@/components/hiring/PipelineCard';
import ScoreCard from '@/components/hiring/ScoreCards';
import UploadResumesDialog from '@/components/hiring/UploadResumesDialog';
import { errorMessage } from '@/hooks/useApiAction';
import {
  advanceHiringCandidate, callHiringCandidate, decideHiringCandidate, downloadHiringResume, getHiringCandidate,
  getHiringAiResume, getHiringPipeline, getHiringResume, listHiringCandidateCalls, listHiringScores,
  rebuildHiringAiResume, retryHiringResumeScore,
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import {
  CONSENT_STATUS, LIVE_REFRESH_MS, aiResumeBusy, RESUME_STATUS, ROUND_LABEL, WORKING_SCORE, bookingPath, candidateName, isFinalStage,
  isNotFound, pipelineRefusal, readFromResume, refreshInterval, resumeBusy, statusOf, STAGE,
} from '@/lib/hiring';
import { PERMISSIONS } from '@/lib/rbac';
import useHiringData from './useHiringData';

const BUSY_REFRESH_MS = 3000;
const NOT_FOUND_RESUME = () => Promise.resolve({ data: null });

function BackLink() {
  return (
    <Link to="/hiring_agent/candidates"
      className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--ops-accent-ink)] hover:underline">
      <ArrowLeft className="h-4 w-4" /> All candidates
    </Link>
  );
}

function AiRead({ show }) {
  if (!show) return null;
  return <StatusBadge label="From resume" tone="info" title="Read from the resume by the AI. Check it, and edit it if it is wrong." />;
}

function Row({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 font-medium">{children}</dd>
    </div>
  );
}

/** Who the candidate is, and what a call needs from them. */
function DetailsPanel({ candidate, canManage, onEdit }) {
  const consent = statusOf(CONSENT_STATUS, candidate.consent_status);
  return (
    <section aria-label="Details" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Details</h3>
        {canManage && <OpsButton size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</OpsButton>}
      </div>
      <dl className="space-y-3">
        <Row label="Job">{candidate.job_title || <span className="font-normal text-muted-foreground">Not linked to a job</span>}</Row>
        <Row label="Phone">
          {candidate.phone_number
            ? <><span className="ops-num">{candidate.phone_number}</span> <AiRead show={readFromResume(candidate, 'phone_number')} /></>
            : <span className="font-normal text-muted-foreground">Not found</span>}
        </Row>
        <Row label="Email">
          {candidate.email
            ? <><span className="break-all">{candidate.email}</span> <AiRead show={readFromResume(candidate, 'email')} /></>
            : <span className="font-normal text-muted-foreground">—</span>}
        </Row>
        <Row label="Consent to be called">
          <StatusBadge label={consent.label} tone={consent.tone} title={candidate.consent_source || undefined} />
        </Row>
        <Row label="Added"><span className="font-normal"><RelativeTime iso={candidate.created_at} /></span></Row>
      </dl>
    </section>
  );
}

/** The uploaded resume: its state, a download, and replacing it. (The AI resume built from a call is separate.) */
function ResumePanel({ resume, canManage, onUpload }) {
  const [downloading, setDownloading] = useState(false);
  const download = async (candidateId) => {
    setDownloading(true);
    try {
      const response = await downloadHiringResume(candidateId);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e, 'The resume could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  };
  const state = resume ? statusOf(RESUME_STATUS, resume.parse_status) : null;
  return (
    <section aria-label="Uploaded resume" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Uploaded resume</h3>
      {resume ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
            <span aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-[color:var(--ops-accent-ink)]">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" data-testid="resume-name" title={resume.filename}>{resume.filename}</p>
              <div className="mt-1"><StatusBadge label={state.label} tone={state.tone} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <OpsButton size="sm" busy={downloading} onClick={() => download(resume.candidate_id)}>
                <Download className="h-3.5 w-3.5" /> Download
              </OpsButton>
              {canManage && <OpsButton size="sm" onClick={onUpload}><Upload className="h-3.5 w-3.5" /> Replace</OpsButton>}
            </div>
          </div>
          {resume.failure_message && <p className="text-[color:var(--ops-bad)]" role="alert">{resume.failure_message}</p>}
        </>
      ) : (
        <>
          <p className="text-muted-foreground">No resume has been uploaded for this candidate.</p>
          {canManage && <OpsButton size="sm" onClick={onUpload}><Upload className="h-3.5 w-3.5" /> Upload resume</OpsButton>}
        </>
      )}
    </section>
  );
}

/**
 * Every call to the candidate, newest first, as on a booking's page: what happened, the result, each question's answer, and
 * the transcript and recording (opened only when asked for). A link goes to the booking the call belongs to.
 */
function CallsSection({ calls }) {
  return (
    <section aria-label="Calls" className="space-y-3">
      <h3 className="text-sm font-semibold">Calls</h3>
      {calls === null ? <SkeletonRows rows={1} label="Loading calls" />
        : calls.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="no-calls">No calls yet.</p>
        : (
          <div className="space-y-3" data-testid="calls">
            {calls.map((call) => (
              <div key={call.id} className="space-y-1">
                <CallCard bookingId={call.booking_id} call={call} number={call.call_number}
                  title={`${ROUND_LABEL[call.interview_type] || 'Call'}: call ${call.call_number}`} />
                <Link to={bookingPath(call.booking_id)}
                  className="text-xs font-medium text-[color:var(--ops-accent-ink)] hover:underline">
                  Open this booking
                </Link>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

/** Why the profile already knows a call cannot be placed now, or null; the backend checks the rest. */
function callBlocker(candidate, pipeline) {
  if (isFinalStage(candidate.stage)) return `This candidate is ${statusOf(STAGE, candidate.stage).label.toLowerCase()}.`;
  if (!candidate.job_id) return 'Link this candidate to a job first (Edit).';
  if (!candidate.phone_number) return 'Add a phone number first (Edit).';
  if (candidate.consent_status !== 'granted') return "Record the candidate's consent first (Edit).";
  if (pipeline && (pipeline.blockers || []).length) return pipeline.blockers[0];
  return null;
}

/**
 * One candidate: their details, where they are in the pipeline (and moving them on), every score, their resume, and
 * their calls. Tenant Admins and Managers change things; reps read. It refreshes by itself while a resume is being read
 * or a score worked out.
 */
export default function CandidateProfile() {
  const { candidateId } = useParams();
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.HIRING_MANAGE);
  const canCall = can(PERMISSIONS.HIRING_CALL);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: candidate, error, reload: reloadCandidate } = useHiringData(
    () => getHiringCandidate(candidateId), [candidateId], { pollMs: busy ? BUSY_REFRESH_MS : 0 });
  const { data: scores, reload: reloadScores } = useHiringData(
    () => listHiringScores(candidateId), [candidateId], { pollMs: busy ? BUSY_REFRESH_MS : 0 });
  const { data: resume, reload: reloadResume } = useHiringData(
    () => getHiringResume(candidateId).catch((e) => (isNotFound(e) ? NOT_FOUND_RESUME() : Promise.reject(e))),
    [candidateId], { pollMs: busy ? BUSY_REFRESH_MS : 0 });
  const { data: aiResume, reload: reloadAiResume } = useHiringData(
    () => getHiringAiResume(candidateId).catch((e) => (isNotFound(e) ? NOT_FOUND_RESUME() : Promise.reject(e))),
    [candidateId], { pollMs: busy ? BUSY_REFRESH_MS : 0 });
  const { data: pipeline, reload: reloadPipeline } = useHiringData(() => getHiringPipeline(candidateId), [candidateId]);
  // Refreshes every few seconds while a call is ringing or its summary is awaited.
  const [liveCalls, setLiveCalls] = useState(false);
  const { data: calls, reload: reloadCalls } = useHiringData(
    () => listHiringCandidateCalls(candidateId), [candidateId], { pollMs: liveCalls ? LIVE_REFRESH_MS : 0 });

  const reloadAll = useCallback(() => {
    reloadCandidate(); reloadScores(); reloadResume(); reloadAiResume(); reloadPipeline(); reloadCalls();
  }, [reloadCandidate, reloadScores, reloadResume, reloadAiResume, reloadPipeline, reloadCalls]);

  useEffect(() => {
    setLiveCalls(Boolean(calls) && refreshInterval(calls) === LIVE_REFRESH_MS);
  }, [calls]);

  useEffect(() => {
    setBusy(Boolean(candidate && (resumeBusy(candidate) || aiResumeBusy(aiResume)
      || (scores || []).some((score) => WORKING_SCORE.includes(score.status)))));
  }, [candidate, scores, aiResume]);

  const run = async (request) => {
    setActing(true);
    setActionError(null);
    try {
      await request();
      reloadAll();
      return true;
    } catch (e) {
      setActionError(pipelineRefusal(e));
      reloadAll();
      return false;
    } finally {
      setActing(false);
    }
  };

  const advance = (note) => run(async () => {
    await advanceHiringCandidate(candidateId, pipeline.stage, note);
    toast.success('Moved on');
  });
  const decide = (decision, note) => run(async () => {
    await decideHiringCandidate(candidateId, decision, pipeline.stage, note);
    toast.success(decision === 'selected' ? 'Candidate selected' : 'Candidate rejected');
  });
  const retry = async () => {
    try {
      await retryHiringResumeScore(candidateId);
      toast.success('Scoring again');
      reloadScores();
      reloadCandidate();
    } catch (e) {
      toast.error(errorMessage(e, 'The resume could not be scored again.'));
    }
  };

  const rebuild = async () => {
    try {
      await rebuildHiringAiResume(candidateId);
      toast.success('Writing the AI resume again');
      reloadAll();
    } catch (e) {
      toast.error(errorMessage(e, 'The AI resume could not be written again.'));
    }
  };

  if (!candidate) {
    if (error && isNotFound(error)) {
      return (
        <section aria-label="Candidate" className="space-y-4">
          <BackLink />
          <EmptyState title="Candidate not found" body="They may have been removed, or are not in your organisation." />
        </section>
      );
    }
    return (
      <section aria-label="Candidate" className="space-y-4">
        <BackLink />
        {error ? <HiringError error={error} onRetry={reloadCandidate} /> : <SkeletonRows rows={4} label="Loading the candidate" />}
      </section>
    );
  }

  const stage = statusOf(STAGE, candidate.stage);
  const resumeFailed = resume?.parse_status === 'failed';

  return (
    <section aria-label="Candidate" className="space-y-5">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold" data-testid="candidate-name">
            {candidateName(candidate)}{' '}
            <AiRead show={readFromResume(candidate, 'first_name') || readFromResume(candidate, 'last_name')} />
          </h2>
          <p className="text-sm text-muted-foreground">
            {candidate.job_title || 'No job yet'}
            {busy && ' · updating every few seconds'}
          </p>
        </div>
        <StatusBadge label={stage.label} tone={stage.tone} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Read the resume first, then its scores, then where the candidate is and moving them on. */}
          {resume !== undefined && (
            <ResumePanel resume={resume} canManage={canManage} onUpload={() => setUploading(true)} />
          )}

          <section aria-label="Scores" className="space-y-3">
            <h3 className="text-sm font-semibold">Scores</h3>
            {scores === null ? <SkeletonRows rows={2} label="Loading scores" />
              : scores.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="no-scores">
                  No scores yet. The resume is scored when one is uploaded; the calls are scored after they end.
                </p>
              ) : [...scores].sort((a, b) => (b.kind === 'overall') - (a.kind === 'overall')).map((score) => (
                <ScoreCard key={score.kind} score={score} canManage={canManage} onRetry={retry} retrying={false}
                  resumeFailed={resumeFailed} onReplace={() => setUploading(true)} onRebuild={rebuild} />
              ))}
          </section>

          {pipeline ? (
            <PipelineCard pipeline={pipeline} canManage={canManage} busy={acting} error={actionError}
              onAdvance={advance} onDecide={decide} />
          ) : <SkeletonRows rows={2} label="Loading the pipeline" />}

          {canCall && !isFinalStage(candidate.stage) && (
            <CallCandidate request={(key) => callHiringCandidate(candidateId, key)} name={candidateName(candidate)}
              onDone={reloadAll} showUsage={false}
              title={candidate.stage === 'audio_screening' ? 'Audio screening call' : 'Intake call'}
              blocker={callBlocker(candidate, pipeline)} />
          )}

          <CallsSection calls={calls} />
        </div>
        <aside className="space-y-4">
          <DetailsPanel candidate={candidate} canManage={canManage} onEdit={() => setEditing(true)} />
          {aiResume !== undefined && (
            <AiResumePanel candidateId={candidateId} resume={aiResume} canManage={canManage} onChanged={reloadAll} />
          )}
        </aside>
      </div>

      <CandidateDialog open={editing} candidate={candidate} onOpenChange={setEditing} onSaved={reloadAll} />
      <UploadResumesDialog open={uploading} candidate={candidate} onOpenChange={setUploading} onDone={reloadAll} />
    </section>
  );
}
