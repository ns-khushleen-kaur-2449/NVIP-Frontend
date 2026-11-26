import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { errorMessage } from '@/hooks/useApiAction';
import { downloadHiringAiResume, rebuildHiringAiResume } from '@/lib/api';
import { AI_RESUME_STATUS, statusOf } from '@/lib/hiring';

/** One section of the resume as printed: what the candidate said, as a short paragraph, entries and a list. */
function Section({ section }) {
  return (
    <section aria-label={section.label} className="space-y-1" data-testid={`ai-section-${section.key}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</h4>
      {section.summary && <p>{section.summary}</p>}
      {section.entries.map((entry) => (
        <div key={`${entry.heading}|${entry.subheading}`} className="space-y-0.5">
          <p className="font-medium">{entry.heading}</p>
          {(entry.subheading || entry.period) && (
            <p className="text-xs text-muted-foreground">{[entry.subheading, entry.period].filter(Boolean).join(' | ')}</p>
          )}
          {entry.bullets.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5">{entry.bullets.map((text) => <li key={text}>{text}</li>)}</ul>
          )}
        </div>
      ))}
      {section.bullets.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5">{section.bullets.map((text) => <li key={text}>{text}</li>)}</ul>
      )}
    </section>
  );
}

/**
 * The resume the AI wrote from the intake call: its text as printed, a PDF to download, and a way to write it again when
 * it failed. It sits beside the uploaded resume; neither replaces the other. `resume` is `null` before any call produced one.
 */
export default function AiResumePanel({ candidateId, resume, canManage, onChanged }) {
  const [downloading, setDownloading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const response = await downloadHiringAiResume(candidateId);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ai-resume.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e, 'The AI resume could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await rebuildHiringAiResume(candidateId);
      toast.success('Writing the AI resume again');
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e, 'The AI resume could not be written again.'));
    } finally {
      setRebuilding(false);
    }
  };

  const state = resume ? statusOf(AI_RESUME_STATUS, resume.status) : null;
  const answered = resume?.status === 'ready' ? resume.sections.filter((section) => section.answered) : [];

  return (
    <section aria-label="AI resume" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">AI resume</h3>
        {state && <StatusBadge label={state.label} tone={state.tone} />}
      </div>
      {!resume && (
        <p className="text-muted-foreground" data-testid="no-ai-resume">
          Written from what the candidate says on their intake call. It appears here after that call is completed.
        </p>
      )}
      {resume && ['pending', 'building'].includes(resume.status) && (
        <p className="text-muted-foreground" role="status">Being written from the call. This page updates by itself.</p>
      )}
      {resume && ['failed', 'blocked'].includes(resume.status) && (
        <p role="alert">{resume.failure_message || 'The AI resume could not be written.'}</p>
      )}
      {answered.length > 0 && (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-border p-3" data-testid="ai-resume-text">
          {answered.map((section) => <Section key={section.key} section={section} />)}
        </div>
      )}
      {resume && (resume.has_pdf || (canManage && resume.status === 'failed')) && (
        <div className="flex flex-wrap gap-2">
          {resume.has_pdf && (
            <OpsButton size="sm" busy={downloading} onClick={download}><Download className="h-3.5 w-3.5" /> Download PDF</OpsButton>
          )}
          {canManage && ['ready', 'failed'].includes(resume.status) && (
            <OpsButton size="sm" busy={rebuilding} onClick={rebuild}><RefreshCw className="h-3.5 w-3.5" /> Write again</OpsButton>
          )}
        </div>
      )}
    </section>
  );
}
