import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { SkeletonRows } from '@/components/ops/States';
import ScoreCard from '@/components/hiring/ScoreCards';
import { HiringError } from '@/components/hiring/HiringBits';
import usePolling from '@/hooks/usePolling';
import { errorMessage } from '@/hooks/useApiAction';
import { downloadHiringResume, getHiringResume, listHiringScores, retryHiringResumeScore } from '@/lib/api';
import { WORKING_SCORE, candidateName, statusOf } from '@/lib/hiring';

const REFRESH_MS = 3000;

/**
 * A candidate's scores, out of 5, with how each was worked out. The resume score shows its four categories with the
 * weights the job gave them. A score that could not be worked out says why in words and what to do. It refreshes
 * itself while any score is still being worked out.
 */
export default function ScoresDialog({ candidate, canManage, onOpenChange, onChanged, onReplace }) {
  const [scores, setScores] = useState(null);
  const [resume, setResume] = useState(undefined); // undefined: loading, null: none
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!candidate) return;
    try {
      const [{ data: list }, file] = await Promise.all([
        listHiringScores(candidate.id),
        getHiringResume(candidate.id).then((r) => r.data).catch((e) => (e?.response?.status === 404 ? null : Promise.reject(e))),
      ]);
      setScores(list);
      setResume(file);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [candidate]);

  useEffect(() => {
    setScores(null);
    setResume(undefined);
    setError(null);
    load();
  }, [load]);

  const working = Boolean(scores?.some((score) => WORKING_SCORE.includes(score.status)))
    || ['pending', 'reading'].includes(resume?.parse_status);
  usePolling(load, REFRESH_MS, [load], { enabled: Boolean(candidate) && working });
  // The list behind this dialog follows along while something is being worked out.
  useEffect(() => { if (candidate && scores) onChanged?.(); }, [scores]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => {
    setRetrying(true);
    try {
      await retryHiringResumeScore(candidate.id);
      toast.success('Scoring again');
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'The resume could not be scored again.'));
    } finally {
      setRetrying(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const response = await downloadHiringResume(candidate.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume?.filename || 'resume';
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

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent className="ops max-h-[90vh] max-w-2xl overflow-y-auto rounded-[14px]">
        <DialogHeader>
          <DialogTitle>Scores: {candidate ? candidateName(candidate) : ''}</DialogTitle>
          <DialogDescription>
            Every score is out of 5. The AI scores each category and the total is worked out from the job's weights.
          </DialogDescription>
        </DialogHeader>

        {error ? <HiringError error={error} onRetry={load} />
          : scores === null || resume === undefined ? <SkeletonRows rows={3} label="Loading scores" />
          : (
            <div className="space-y-3">
              {resume && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="resume-file">
                  <span className="min-w-0">
                    <span className="font-medium">{resume.filename}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{statusOf({ pending: { label: 'waiting to be read' },
                      reading: { label: 'being read' }, read: { label: 'read' }, failed: { label: 'could not be read' } },
                    resume.parse_status).label}</span>
                  </span>
                  <OpsButton size="sm" onClick={download} busy={downloading}><Download className="h-4 w-4" /> Download</OpsButton>
                </div>
              )}
              {resume?.parse_status === 'failed' && resume.failure_message && (
                <p className="text-sm text-[color:var(--ops-bad)]" role="alert">{resume.failure_message}</p>
              )}
              {scores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {resume ? 'No score yet.' : 'No resume has been uploaded for this candidate, so there is nothing to score yet.'}
                </p>
              ) : scores.map((score) => (
                <ScoreCard key={score.kind} score={score} canManage={canManage} onRetry={retry} retrying={retrying}
                  resumeFailed={resume?.parse_status === 'failed'} onReplace={onReplace} />
              ))}
            </div>
          )}

        <DialogFooter className="gap-2 sm:gap-2">
          {canManage && candidate && (
            <OpsButton onClick={onReplace}>{resume ? 'Replace resume' : 'Upload resume'}</OpsButton>
          )}
          <OpsButton variant="primary" onClick={() => onOpenChange(false)}>Close</OpsButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
