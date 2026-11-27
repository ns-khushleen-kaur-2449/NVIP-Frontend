import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { createHiringCandidate, listHiringJobs, updateHiringCandidate } from '@/lib/api';
import { CONSENT_STATUS, candidateName, candidateProblem, readFromResume } from '@/lib/hiring';

const FIELDS = ['first_name', 'last_name', 'phone_number', 'email', 'consent_status', 'consent_source'];
const blank = { first_name: '', last_name: '', phone_number: '', email: '', consent_status: 'unknown', consent_source: '' };

const formOf = (candidate) => (candidate
  ? Object.fromEntries(FIELDS.map((field) => [field, candidate[field] || '']))
  : blank);

/** What to send: every field for a new candidate, only the changed ones for an edit (blank means none). */
function changes(form, candidate) {
  const before = formOf(candidate);
  const body = {};
  FIELDS.forEach((field) => {
    const value = form[field].trim();
    if (!candidate || value !== before[field].trim()) body[field] = value || null;
  });
  return body;
}

/**
 * Add a candidate by typing their details, or edit `candidate`.  Consent is recorded with who recorded it and when (by
 * the backend). A new candidate may be given a job now; a candidate with no job can be linked to one here (a candidate
 * already on a job stays on it). Details read from a resume are marked, and become the tenant's own once edited.
 */
export default function CandidateDialog({ open, candidate = null, onOpenChange, onSaved }) {
  const [form, setForm] = useState(blank);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const linked = Boolean(candidate?.job_id);
  // A resume-made candidate with no phone may be saved without one; everyone else needs a first name and a phone.
  // A new candidate also needs a job.
  const phoneOptional = Boolean(candidate && !candidate.phone_number);
  const incomplete = !form.first_name.trim() || (!phoneOptional && !form.phone_number.trim()) || (!candidate && !jobId);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setForm(formOf(candidate));
    setJobId('');
    setError(null);
    listHiringJobs({ limit: 200 }).then(({ data }) => { if (!cancelled) setJobs(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, candidate]);

  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const problem = candidateProblem(form, phoneOptional) || (!candidate && !jobId ? 'Choose a job.' : null);
    if (problem) {
      setError(problem);
      return;
    }
    const body = changes(form, candidate);
    if (jobId && !linked) body.job_id = jobId;
    if (candidate && !Object.keys(body).length) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = candidate ? await updateHiringCandidate(candidate.id, body) : await createHiringCandidate(body);
      toast.success(candidate ? 'Candidate updated' : 'Candidate added');
      onOpenChange(false);
      onSaved?.(response.data);
    } catch (e) {
      setError(errorMessage(e, 'The candidate could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-lg max-h-[90vh] overflow-y-auto rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{candidate ? `Edit ${candidateName(candidate)}` : 'New candidate'}</DialogTitle>
            <DialogDescription>
              {candidate ? 'A candidate is called only when consent is granted.'
                : 'A candidate is called only when consent is granted; record it later with Edit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" required>
              {(id) => <input id={id} value={form.first_name} onChange={set('first_name')} maxLength={120} className={CONTROL} />}
            </Field>
            <Field label="Last name">
              {(id) => <input id={id} value={form.last_name} onChange={set('last_name')} maxLength={120} className={CONTROL} />}
            </Field>
          </div>
          {candidate && !candidate.phone_number && (
            <p className="text-xs text-muted-foreground">
              No phone number was found in the resume. Add one to be able to call this candidate.
            </p>
          )}
          <Field label="Phone number" required={!candidate || Boolean(candidate.phone_number)}
            hint="Any format. Without a country code, your organisation's region is used.">
            {(id) => <input id={id} type="tel" value={form.phone_number} onChange={set('phone_number')} maxLength={32}
              className={CONTROL} />}
          </Field>
          <Field label="Email">
            {(id) => <input id={id} type="email" value={form.email} onChange={set('email')} maxLength={320} className={CONTROL} />}
          </Field>
          {/* Consent is not asked when adding a candidate (it is sent as "Not recorded"); it is recorded with Edit. */}
          {candidate && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Consent to be called">
              {(id) => (
                <select id={id} value={form.consent_status} onChange={set('consent_status')} className={CONTROL}>
                  {Object.entries(CONSENT_STATUS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
                </select>
              )}
            </Field>
            <Field label="How consent was given" required={form.consent_status === 'granted'}>
              {(id) => <input id={id} value={form.consent_source} onChange={set('consent_source')} maxLength={120}
                className={CONTROL} placeholder="Application form" />}
            </Field>
          </div>
          )}
          {linked ? (
            <p className="text-sm"><span className="text-muted-foreground">Job: </span>{candidate.job_title || 'Linked'}</p>
          ) : (
            <Field label="Job" required={!candidate} hint={candidate
              ? 'Link this candidate to a job so their resume can be scored against it.'
              : jobs.length ? 'Resumes are scored against the candidate’s job.' : 'No jobs yet: create one in the Jobs tab first.'}>
              {(id) => (
                <select id={id} value={jobId} onChange={(e) => setJobId(e.target.value)} className={CONTROL}>
                  <option value="">{candidate ? 'No job yet' : 'Choose a job'}</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              )}
            </Field>
          )}
          {candidate && ['first_name', 'last_name', 'email', 'phone_number'].some((field) => readFromResume(candidate, field)) && (
            <p className="text-xs text-muted-foreground">
              Details marked "From resume" in the list were read by the AI. Check them; once you edit one it is yours.
            </p>
          )}
          {candidate && (
            <p className="text-xs text-muted-foreground">A consent change is saved with your name and the time.</p>
          )}
          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant="primary" busy={busy} disabled={incomplete}
              title={incomplete ? (candidate ? 'Fill in the first name and phone number first'
                : 'Fill in the first name, phone number and job first') : undefined}>{candidate ? 'Save' : 'Add candidate'}</OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
