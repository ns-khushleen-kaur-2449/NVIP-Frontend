import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { SkeletonRows } from '@/components/ops/States';
import { CONTROL, FormError, HiringError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { generateHiringScreeningQuestions, getHiringJob, replaceHiringScreeningQuestions } from '@/lib/api';
import { MAX_SCREENING_QUESTIONS, checkScreeningQuestions } from '@/lib/hiring';

const DEFAULT_COUNT = 5;

/**
 * A job's audio-screening questions, in the order the screening call asks them. With `canEdit` the whole set is
 * edited and saved at once (up to 15, and none is allowed); otherwise it is read only. A question is typed by hand
 * or written by the AI from the job description (the tenant picks how many), and the tenant can edit either. What
 * the AI writes is only a proposal added to the list: nothing is saved until "Save screening questions". Calls
 * already placed keep the questions they were asked.
 */
export default function ScreeningQuestionsDialog({ job, canEdit, onOpenChange, onSaved }) {
  const [items, setItems] = useState(null);
  const [hasJd, setHasJd] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(String(DEFAULT_COUNT));
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    if (!job) return;
    setItems(null);
    setLoadError(null);
    setError(null);
    setNote(null);
    setCount(String(DEFAULT_COUNT));
    try {
      const { data } = await getHiringJob(job.id);
      setHasJd(Boolean(data.jd_text));
      setItems((data.screening_questions || []).map((question) => (
        { text: question.question_text, source: question.source || 'manual' })));
    } catch (e) {
      setLoadError(e);
    }
  }, [job]);

  const room = MAX_SCREENING_QUESTIONS - (items?.length || 0);
  const wanted = Number(count);
  const countValid = Number.isInteger(wanted) && wanted >= 1 && wanted <= room;

  const generate = async () => {
    if (writing || busy || !countValid) return;
    setWriting(true);
    setError(null);
    setNote(null);
    try {
      const { data } = await generateHiringScreeningQuestions(job.id, wanted);
      const written = (data.questions || []).map((question) => ({ text: question.question_text, source: 'ai' }));
      setItems((list) => [...list, ...written].slice(0, MAX_SCREENING_QUESTIONS));
      setNote(written.length === 0
        ? 'The AI did not write any usable questions this time. Try again.'
        : written.length < wanted
          ? `The AI wrote ${written.length} of ${wanted} questions. Review them, then save.`
          : `Added ${written.length} question${written.length === 1 ? '' : 's'} written by AI. Review them, then save.`);
    } catch (e) {
      setError(errorMessage(e, 'The AI could not write questions just now. Try again in a moment.'));
    } finally {
      setWriting(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // Editing a question the AI wrote keeps it as the tenant's own words from then on.
  const change = (index, value) => setItems((list) => list.map((item, i) => (
    i === index ? { text: value, source: 'manual' } : item)));
  const remove = (index) => setItems((list) => list.filter((_, i) => i !== index));
  const move = (index, delta) => setItems((list) => {
    const next = [...list];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    return next;
  });

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const { questions, error: problem } = checkScreeningQuestions(items.map((item) => item.text));
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await replaceHiringScreeningQuestions(job.id, questions.map((text, i) => ({ text, source: items[i].source })));
      toast.success('Screening questions saved');
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e, 'The screening questions could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const iconButton = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card '
    + 'hover:bg-[hsl(var(--surface-2))] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <Dialog open={Boolean(job)} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-2xl max-h-[90vh] overflow-y-auto rounded-[14px]">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Edit screening questions' : 'Screening questions'}: {job?.title}</DialogTitle>
            <DialogDescription>
              The audio screening call asks these in order, after the intake call. Add them one by one. Calls
              already placed keep the questions they were asked.
            </DialogDescription>
          </DialogHeader>

          {loadError ? <HiringError error={loadError} onRetry={load} />
            : items === null ? <SkeletonRows rows={3} label="Loading screening questions" />
            : !canEdit ? (
              items.length ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm" data-testid="screening-read-only">
                  {items.map((item, i) => <li key={i}>{item.text}</li>)}
                </ol>
              ) : <p className="text-sm text-muted-foreground">No screening questions yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 rounded-lg border border-border p-3" data-testid="generate-box">
                  <p className="text-sm font-medium">Write questions with AI</p>
                  {hasJd ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">How many
                        <input type="number" inputMode="numeric" min={1} max={Math.max(room, 1)} step={1} value={count}
                          onChange={(e) => setCount(e.target.value)} disabled={room < 1 || writing}
                          className={`${CONTROL} ops-num w-24`} />
                      </label>
                      <OpsButton size="sm" variant="primary" onClick={generate} busy={writing}
                        disabled={!countValid || busy}>
                        Generate with AI
                      </OpsButton>
                      <span className="text-xs text-muted-foreground">
                        {room < 1 ? 'The list is full.' : `Up to ${room} more. Written from the job description.`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add a job description to this job (Edit job) to have the AI write questions from it. You can
                      still add questions by hand below.
                    </p>
                  )}
                  {note && <p role="status" className="text-xs text-muted-foreground">{note}</p>}
                </div>
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">No screening questions yet. Add the first one.</p>
                )}
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="ops-num mt-2 w-5 text-right text-sm text-muted-foreground">{i + 1}.</span>
                    <div className="flex-1 space-y-1">
                      <textarea value={item.text} onChange={(e) => change(i, e.target.value)} rows={2}
                        maxLength={2000} aria-label={`Screening question ${i + 1}`}
                        className="min-h-[2.5rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                      {item.source === 'ai' && <StatusBadge label="Written by AI" tone="info" />}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" className={iconButton} onClick={() => move(i, -1)} disabled={i === 0}
                        aria-label={`Move screening question ${i + 1} up`}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" className={iconButton} onClick={() => move(i, 1)}
                        disabled={i === items.length - 1} aria-label={`Move screening question ${i + 1} down`}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" className={iconButton} onClick={() => remove(i)}
                        aria-label={`Remove screening question ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <OpsButton size="sm" onClick={() => setItems((list) => [...list, { text: '', source: 'manual' }])}
                    disabled={items.length >= MAX_SCREENING_QUESTIONS}>
                    <Plus className="h-4 w-4" /> Add question
                  </OpsButton>
                  <span className="text-xs text-muted-foreground">{items.length} of {MAX_SCREENING_QUESTIONS}</span>
                </div>
              </div>
            )}

          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              {canEdit ? 'Cancel' : 'Close'}
            </OpsButton>
            {canEdit && items !== null && !loadError && (
              <OpsButton type="submit" variant="primary" busy={busy}>Save screening questions</OpsButton>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
