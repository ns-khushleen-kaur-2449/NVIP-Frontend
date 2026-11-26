import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { errorMessage } from '@/hooks/useApiAction';
import { attachHiringResume, listHiringJobs, uploadHiringResumes } from '@/lib/api';
import { MAX_RESUME_FILES, candidateName, checkResumeFiles } from '@/lib/hiring';

const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Upload resumes.
 *
 * Without `candidate`: choose a job and one or up to 30 files (PDF or Word). Each usable file becomes a candidate whose
 * name, email and phone are read from the resume and whose resume is scored against the job's description, both in
 * the background. A file that cannot be used is listed with its reason and the rest go ahead.
 *
 * With `candidate`: one file that adds or replaces that candidate's uploaded resume. Details the candidate already has
 * are never overwritten, and the AI resume built from an intake call is kept.
 *
 * `onDone(result)` is called once the upload has been accepted, so the list can refresh.
 */
export default function UploadResumesDialog({ open, candidate = null, defaultJobId = '', onOpenChange, onDone }) {
  const single = Boolean(candidate);
  const [jobs, setJobs] = useState(null);
  const [jobId, setJobId] = useState('');
  const [files, setFiles] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setFiles([]);
    setSkipped([]);
    setError(null);
    setResult(null);
    setJobId(defaultJobId || '');
    if (!single) {
      setJobs(null);
      listHiringJobs({ status: 'open', limit: 200 })
        .then(({ data }) => { if (!cancelled) setJobs(data); })
        .catch((e) => { if (!cancelled) { setJobs([]); setError(errorMessage(e, 'The jobs could not be loaded.')); } });
    }
    return () => { cancelled = true; };
  }, [open, single, defaultJobId]);

  const chosen = (jobs || []).find((job) => job.id === jobId);

  const addFiles = (list) => {
    const { accepted, problems } = checkResumeFiles(list);
    setError(null);
    if (single) {
      setFiles(accepted.slice(0, 1));
      setSkipped([...problems, ...accepted.slice(1).map((file) => ({ name: file.name, message: 'One file at a time.' }))]);
      return;
    }
    const room = Math.max(MAX_RESUME_FILES - files.length, 0);
    // Choosing the same file twice adds it once.
    const fresh = accepted.filter((file) => !files.some((other) => other.name === file.name && other.size === file.size));
    setSkipped([...problems, ...fresh.slice(room).map((file) => (
      { name: file.name, message: `At most ${MAX_RESUME_FILES} files at a time.` }))]);
    setFiles([...files, ...fresh.slice(0, room)]);
  };

  const onPick = (event) => {
    addFiles(event.target.files || []);
    if (input.current) input.current.value = ''; // so choosing the same file again still counts
  };
  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer?.files || []);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!single && !jobId) {
      setError('Choose the job these resumes are for.');
      return;
    }
    if (files.length === 0) {
      setError(single ? 'Choose a resume file.' : 'Choose at least one resume file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (single) {
        await attachHiringResume(candidate.id, files[0]);
        toast.success('Resume uploaded. It is being read and scored.');
        setResult({ accepted: 1, rejected: 0, results: [{ filename: files[0].name, status: 'accepted' }] });
      } else {
        const { data } = await uploadHiringResumes(jobId, files);
        toast[data.accepted ? 'success' : 'warning'](data.accepted
          ? `${data.accepted} resume${data.accepted === 1 ? '' : 's'} uploaded. They are being read and scored.`
          : 'No resume could be used.');
        setResult(data);
      }
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, 'The upload failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const rejected = (result?.results || []).filter((item) => item.status === 'rejected');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="ops max-h-[90vh] max-w-xl overflow-y-auto rounded-[14px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{single ? `Upload a resume for ${candidateName(candidate)}` : 'Upload resumes'}</DialogTitle>
            <DialogDescription>
              {single
                ? 'This replaces the resume you uploaded before. Details already on the candidate are kept, and the AI resume built from an intake call is kept too.'
                : `PDF or Word, up to 5 MB each, up to ${MAX_RESUME_FILES} at a time. Each resume becomes a candidate: their name, email and phone are read from it, and the resume is scored against the job description.`}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3" role="status">
              <p className="text-sm">
                {result.accepted
                  ? `${result.accepted} resume${result.accepted === 1 ? '' : 's'} accepted. They are being read and scored; this takes a few seconds each, and the list updates by itself.`
                  : 'No resume could be used.'}
              </p>
              {rejected.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Not uploaded ({rejected.length})</p>
                  <ul className="mt-1 space-y-1 text-sm text-[color:var(--ops-bad)]" data-testid="rejected-files">
                    {rejected.map((item) => <li key={item.filename}><span className="font-medium">{item.filename}</span>: {item.message}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {!single && (
                <Field label="Job" required hint={chosen && !chosen.has_jd
                  ? 'This job has no description yet, so resumes can be read but not scored. Add one with Edit job.'
                  : 'Resumes are scored against this job’s description.'}>
                  {(id) => (
                    <select id={id} value={jobId} onChange={(e) => setJobId(e.target.value)} className={CONTROL}
                      disabled={jobs === null}>
                      <option value="">{jobs === null ? 'Loading jobs…' : jobs.length ? 'Choose a job' : 'No open jobs'}</option>
                      {(jobs || []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                    </select>
                  )}
                </Field>
              )}

              <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                onDrop={onDrop} data-testid="drop-zone"
                className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center ${
                  dragging ? 'border-[color:var(--ops-accent)] bg-[hsl(var(--surface-2))]' : 'border-border'}`}>
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm">Drop {single ? 'a resume' : 'resumes'} here, or</p>
                <OpsButton size="sm" onClick={() => input.current?.click()}>Choose {single ? 'a file' : 'files'}</OpsButton>
                <input ref={input} type="file" accept=".pdf,.docx" multiple={!single} onChange={onPick} className="sr-only"
                  aria-label={single ? 'Resume file' : 'Resume files'} />
              </div>

              {files.length > 0 && (
                <ul className="space-y-1" aria-label="Selected files" data-testid="selected-files">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="ops-num text-xs text-muted-foreground">{sizeText(file.size)}</span>
                      <button type="button" aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((list) => list.filter((other) => other !== file))}
                        className="rounded p-1 hover:bg-[hsl(var(--surface-2))]"><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {skipped.length > 0 && (
                <ul className="space-y-1 text-sm text-[color:var(--ops-bad)]" data-testid="skipped-files">
                  {skipped.map((item) => <li key={item.name}><span className="font-medium">{item.name}</span>: {item.message}</li>)}
                </ul>
              )}
              <FormError>{error}</FormError>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {result ? (
              <OpsButton variant="primary" onClick={() => onOpenChange(false)}>Done</OpsButton>
            ) : (
              <>
                <OpsButton variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</OpsButton>
                <OpsButton type="submit" variant="primary" busy={busy} disabled={files.length === 0}>
                  {files.length > 1 ? `Upload ${files.length} resumes` : 'Upload resume'}
                </OpsButton>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
