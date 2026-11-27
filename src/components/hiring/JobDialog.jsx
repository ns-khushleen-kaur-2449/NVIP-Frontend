import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { SkeletonRows } from '@/components/ops/States';
import { CONTROL, Field, FormError, HiringError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { createHiringJob, getHiringJob, updateHiringJob } from '@/lib/api';
import {
  JD_MAX_CHARS, RESUME_CATEGORIES, equalWeights, rebalanceWeights, sameWeights, weightsProblem, weightsTotal,
} from '@/lib/hiring';

/**
 * Create a job, or edit `job`: its title, its description (JD) and how its resumes are scored.
 * `onSaved(job, created)` gets the saved job.
 *
 * The JD is optional here, but resumes can only be scored against a job that has one. The four weights say how much
 * each scoring category counts (percent, adding up to 100); equal weights are the default and are not stored.
 */
export default function JobDialog({ open, job = null, onOpenChange, onSaved }) {
  const [title, setTitle] = useState('');
  const [jd, setJd] = useState('');
  const [weights, setWeights] = useState(equalWeights());
  // The weights the user has set by hand: they stay put while the others adjust to keep the total at 100.
  const [setByHand, setSetByHand] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Editing needs the job's description and weights, which the job list leaves out.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setTitle(job?.title || '');
    setJd('');
    setWeights(equalWeights());
    setSetByHand([]);
    setError(null);
    setLoadError(null);
    if (job) {
      setLoading(true);
      getHiringJob(job.id)
        .then(({ data }) => {
          if (cancelled) return;
          setJd(data.jd_text || '');
          setWeights({ ...equalWeights(), ...(data.resume_weights || {}) });
        })
        .catch((e) => { if (!cancelled) setLoadError(e); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [open, job]);

  const total = weightsTotal(weights);
  const isEqual = sameWeights(weights, equalWeights());
  // A new job needs a title and a description (resumes are scored against it), and the weights must add up to 100.
  // An existing job may predate descriptions, so editing it only needs the title.
  const needsJd = !job;
  const missing = !title.trim() ? 'Add a job title.'
    : needsJd && !jd.trim() ? 'Add the job description.'
      : weightsProblem(weights);
  // Changing one weight rebalances the others so the total is always 100. A cleared box is left empty while the
  // user types the next number, and counts as 0 once they leave it.
  const setWeight = (key, value) => {
    if (value === '') {
      setWeights((current) => ({ ...current, [key]: '' }));
      return;
    }
    const next = rebalanceWeights(weights, key, value, setByHand);
    setWeights(next.weights);
    setSetByHand(next.fixed);
  };
  const leaveWeight = (key) => { if (weights[key] === '') setWeight(key, 0); };
  const resetWeights = () => { setWeights(equalWeights()); setSetByHand([]); };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || loading || loadError) return;
    const value = title.trim();
    if (missing) {
      setError(missing);
      return;
    }
    const description = jd.trim();
    const custom = isEqual ? null : Object.fromEntries(RESUME_CATEGORIES.map(({ key }) => [key, Number(weights[key])]));
    setBusy(true);
    setError(null);
    try {
      let response;
      if (job) {
        // Editing sends everything, so a cleared description or reset weights are cleared on the backend too.
        response = await updateHiringJob(job.id, { title: value, jd_text: description || null, resume_weights: custom });
      } else {
        response = await createHiringJob({
          title: value, ...(description ? { jd_text: description } : {}), ...(custom ? { resume_weights: custom } : {}),
        });
      }
      toast.success(job ? 'Job saved' : 'Job created');
      onOpenChange(false);
      onSaved?.(response.data, !job);
    } catch (e) {
      setError(errorMessage(e, 'The job could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-h-[90vh] max-w-2xl overflow-y-auto rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{job ? 'Edit job' : 'New job'}</DialogTitle>
            <DialogDescription>
              {job ? 'Bookings and calls keep their link to the job.'
                : 'Add the job title and description, then the questions its intake call asks.'}
            </DialogDescription>
          </DialogHeader>

          {loadError ? <HiringError error={loadError} />
            : loading ? <SkeletonRows rows={3} label="Loading job" />
            : (
              <>
                <Field label="Job title" required>
                  {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255}
                    className={CONTROL} placeholder="Backend engineer" />}
                </Field>

                <Field label="Job description" required={needsJd}
                  hint={`Paste the job description. Resumes are scored against it, and screening questions can be written from it. ${jd.length} of ${JD_MAX_CHARS} characters.`}>
                  {(id) => <textarea id={id} value={jd} onChange={(e) => setJd(e.target.value)} rows={7}
                    maxLength={JD_MAX_CHARS} placeholder="Responsibilities, requirements, skills, experience…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />}
                </Field>

                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">How resumes are scored</legend>
                  <p className="text-xs text-muted-foreground">
                    Each resume gets a score out of 5 in four categories. These weights (percent) say how much each
                    one counts toward the total. Change one and the others you have not set yet adjust, so the total
                    always stays at 100.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {RESUME_CATEGORIES.map(({ key, label, hint }) => (
                      <Field key={key} label={label} hint={hint}>
                        {(id) => <input id={id} type="number" inputMode="numeric" min={0} max={100} step={1}
                          value={weights[key]} onChange={(e) => setWeight(key, e.target.value)}
                          onBlur={() => leaveWeight(key)}
                          className={`${CONTROL} ops-num`} />}
                      </Field>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span data-testid="weights-total"
                      className={total === 100 ? 'text-muted-foreground' : 'text-[color:var(--ops-bad)]'}>
                      Total: <span className="ops-num">{total}</span> of 100
                    </span>
                    <OpsButton size="sm" onClick={resetWeights} disabled={isEqual}>
                      Equal weights
                    </OpsButton>
                  </div>
                </fieldset>
              </>
            )}

          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant="primary" busy={busy}
              disabled={loading || Boolean(loadError) || Boolean(missing)} title={missing || undefined}>
              {job ? 'Save' : 'Create job'}
            </OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
