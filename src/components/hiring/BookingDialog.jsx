import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { createHiringBooking, listHiringCandidates } from '@/lib/api';
import { CONSENT_STATUS, candidateName, newKey, statusOf } from '@/lib/hiring';

const SEARCH_DELAY_MS = 300;

/**
 * Book a candidate's intake call for an open job. One key per opening of the dialog, kept while it is retried, so
 * a repeated click or a retry after a lost answer makes one booking (the backend returns the first one).
 *
 * Only the candidates on the chosen job are offered (a candidate belongs to one job), so a job is chosen first and the
 * search looks inside that job's candidates.
 */
export default function BookingDialog({ open, jobs, onOpenChange, onCreated }) {
  const [jobId, setJobId] = useState('');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [candidateId, setCandidateId] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const openJobs = (jobs || []).filter((job) => job.status === 'open');

  useEffect(() => {
    if (!open) return;
    setJobId('');
    setSearch('');
    setCandidateId('');
    setError(null);
    setKey(newKey());
  }, [open]);

  useEffect(() => {
    setCandidateId('');
    setSearch('');
  }, [jobId]);

  useEffect(() => {
    if (!open || !jobId) {
      setCandidates([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      listHiringCandidates({ job_id: jobId, q: search.trim() || undefined, limit: 50 })
        .then((response) => { if (!cancelled) setCandidates(response.data); })
        .catch(() => { if (!cancelled) setCandidates([]); });
    }, search ? SEARCH_DELAY_MS : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, search, jobId]);

  const job = openJobs.find((j) => j.id === jobId);
  const candidate = candidates.find((c) => c.id === candidateId);
  // Plain strings: an <option> may hold only text.
  const choices = candidates.map((c) => ({
    id: c.id,
    label: `${candidateName(c)} · ${c.phone_number || 'no phone number'} · consent ${statusOf(CONSENT_STATUS, c.consent_status).label.toLowerCase()}`,
  }));
  const placeholder = !jobId ? 'Choose a job first'
    : candidates.length ? 'Choose a candidate'
      : search.trim() ? 'No matching candidates on this job' : 'No candidates on this job yet';

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!jobId || !candidateId) {
      setError('Choose a job and a candidate.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await createHiringBooking({ job_id: jobId, candidate_id: candidateId, idempotency_key: key });
      toast.success(response.status === 200 ? 'That booking already exists' : 'Booking created');
      onOpenChange(false);
      onCreated?.(response.data);
    } catch (e) {
      setError(errorMessage(e, 'The booking could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-w-lg rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New booking</DialogTitle>
            <DialogDescription>A booking is one candidate's intake call for one job.</DialogDescription>
          </DialogHeader>
          <Field label="Job" required>
            {(id) => (
              <select id={id} value={jobId} onChange={(e) => setJobId(e.target.value)} className={CONTROL}>
                <option value="">Choose an open job</option>
                {openJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            )}
          </Field>
          {job && job.question_count === 0 && (
            <p className="text-xs text-[color:var(--ops-warn)]">This job has no questions yet: add them before calling.</p>
          )}
          <Field label="Find a candidate" hint={jobId ? 'Searches the candidates on this job.' : undefined}>
            {(id) => <input id={id} type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              className={CONTROL} placeholder="Name, phone or email" disabled={!jobId} />}
          </Field>
          <Field label="Candidate" required
            hint={jobId && !candidates.length && !search.trim()
              ? 'Upload their resumes on the Candidates tab, or link a candidate to this job there.' : undefined}>
            {(id) => (
              <select id={id} value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className={CONTROL}
                disabled={!jobId}>
                <option value="">{placeholder}</option>
                {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
              </select>
            )}
          </Field>
          {candidate && candidate.consent_status !== 'granted' && (
            <p className="text-xs text-[color:var(--ops-warn)]">
              Consent is not granted, so this candidate cannot be called until it is.
            </p>
          )}
          {candidate && !candidate.phone_number && (
            <p className="text-xs text-[color:var(--ops-warn)]">
              This candidate has no phone number, so they cannot be called until one is added.
            </p>
          )}
          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant="primary" busy={busy}>Create booking</OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
