import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUp, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { startRealEstateCall } from '@/lib/api';
import {
  KNOWLEDGE_BASE_FILE_TYPES, MAX_KNOWLEDGE_BASE_CHARS, callPath, callRefusal, callStarted, formProblem, newKey,
} from '@/lib/realEstate';

const blank = { lead_name: '', phone_number: '', knowledge_base: '' };

/**
 * "New call": the lead's name and phone number, and an optional knowledge base (typed, pasted or read from a text
 * file) that the agent talks from on this call. One idempotency key per submit, kept only when no answer came back,
 * so pressing again retries that same submit and the backend never dials twice. A placed call opens its page.
 * "Call again" on a call page comes back here with that call's details filled in.
 */
export default function NewCallTab() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState(() => ({ ...blank, ...(state?.prefill || {}) }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [fileName, setFileName] = useState(null);
  const unanswered = useRef(null);
  const inFlight = useRef(false);
  const fileInput = useRef(null);

  const set = (field) => (event) => {
    unanswered.current = null; // a changed form is a new call
    setForm((f) => ({ ...f, [field]: event.target.value }));
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      unanswered.current = null;
      setForm((f) => ({ ...f, knowledge_base: f.knowledge_base.trim() ? `${f.knowledge_base.trim()}\n\n${text}` : text }));
      setFileName(file.name);
    } catch (e) {
      setProblem({ message: `${file.name} could not be read. Use a text file (.txt, .md, .csv or .json).` });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const invalid = formProblem(form);
    if (invalid) {
      setProblem({ message: invalid });
      return;
    }
    inFlight.current = true;
    const key = unanswered.current || newKey();
    unanswered.current = key;
    setBusy(true);
    setProblem(null);
    try {
      const response = await startRealEstateCall({
        lead_name: form.lead_name.trim(),
        phone_number: form.phone_number.trim(),
        knowledge_base: form.knowledge_base.trim() || null,
        idempotency_key: key,
      });
      unanswered.current = null;
      const { kind, text } = callStarted(response.status, form.lead_name.trim());
      toast[kind](text);
      navigate(callPath(response.data.id));
    } catch (error) {
      if (error?.response) {
        unanswered.current = null;
        setProblem(callRefusal(error));
      } else {
        setProblem({ message: 'The call request got no answer.', hint: 'Press Call now again: it will not call twice.' });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const chars = form.knowledge_base.length;
  const over = chars > MAX_KNOWLEDGE_BASE_CHARS;

  return (
    <section aria-label="New call" className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lead's name" required>
            {(id) => <input id={id} value={form.lead_name} onChange={set('lead_name')} maxLength={200} autoComplete="off"
              className={CONTROL} />}
          </Field>
          <Field label="Phone number" required hint="Without a country code, your organisation's region is used.">
            {(id) => <input id={id} type="tel" value={form.phone_number} onChange={set('phone_number')} maxLength={32}
              autoComplete="off" className={CONTROL} />}
          </Field>
        </div>

        <Field label="Knowledge base (optional)"
          hint="Projects, locations, prices, amenities and offers the agent may talk about on this call. Without one, the agent uses its standard script.">
          {(id) => (
            <div className="space-y-2">
              <textarea id={id} value={form.knowledge_base} onChange={set('knowledge_base')} rows={10}
                placeholder="e.g. Palm Springs, Jaipur: 3 and 4 BHK villas from ₹1.2 Cr. Clubhouse, pool, 24x7 security. Possession Dec 2027."
                className={`${CONTROL} h-auto min-h-[10rem] py-2 leading-relaxed`} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInput} type="file" accept={KNOWLEDGE_BASE_FILE_TYPES} onChange={readFile}
                    className="hidden" aria-label="Upload a text file" data-testid="knowledge-base-file" />
                  <OpsButton size="sm" type="button" onClick={() => fileInput.current?.click()}>
                    <FileUp className="h-4 w-4" /> Add from a text file
                  </OpsButton>
                  {fileName && <span className="text-muted-foreground">Added {fileName}</span>}
                  {chars > 0 && (
                    <OpsButton size="sm" variant="quiet" type="button"
                      onClick={() => { unanswered.current = null; setForm((f) => ({ ...f, knowledge_base: '' })); setFileName(null); }}>
                      <X className="h-4 w-4" /> Clear
                    </OpsButton>
                  )}
                </div>
                <span className={over ? 'text-[color:var(--ops-bad)]' : 'text-muted-foreground'}>
                  {`${chars.toLocaleString()} / ${MAX_KNOWLEDGE_BASE_CHARS.toLocaleString()} characters`}
                </span>
              </div>
            </div>
          )}
        </Field>

        {problem && (
          <div role="alert" className="text-sm">
            <FormError>{problem.message}</FormError>
            {problem.hint && <p className="text-muted-foreground">{problem.hint}</p>}
          </div>
        )}

        <div className="flex justify-end">
          <OpsButton variant="primary" type="submit" busy={busy} disabled={over}>
            <Phone className="h-4 w-4" /> {busy ? 'Calling…' : 'Call now'}
          </OpsButton>
        </div>
      </form>
    </section>
  );
}
