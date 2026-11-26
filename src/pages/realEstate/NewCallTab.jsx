import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { getRealEstateKnowledgeBase, startRealEstateCall } from '@/lib/api';
import {
  KNOWLEDGE_BASE_PATH, callPath, callRefusal, callStarted, formProblem, newKey,
} from '@/lib/realEstate';
import useHiringData from '../hiring/useHiringData';

const blank = { lead_name: '', phone_number: '' };

/** Which knowledge base the call will use: the organisation's saved one (edited on the Knowledge base tab). */
function SavedKnowledgeBase() {
  const { data, error } = useHiringData(() => getRealEstateKnowledgeBase(), []);
  if (error || !data) return null; // the call itself still works; the backend uses whatever is saved
  const link = (
    <Link to={KNOWLEDGE_BASE_PATH} className="font-medium text-[color:var(--ops-accent-ink)] hover:underline">
      {data.knowledge_base ? 'View or change it' : 'Add one'}
    </Link>
  );
  return (
    <p className="text-sm text-muted-foreground" data-testid="saved-knowledge-base">
      {data.knowledge_base
        ? <>The agent talks from your saved knowledge base (version {data.version}). {link}</>
        : <>No knowledge base saved: the agent uses its standard script. {link}</>}
    </p>
  );
}

/**
 * "New call": the lead's name and phone number. The agent talks from the organisation's saved knowledge base. One
 * idempotency key per submit, kept only when no answer came back, so pressing again retries that same submit and the
 * backend never dials twice. A placed call opens its page. "Call again" on a call page comes back here with that
 * call's name and number filled in.
 */
export default function NewCallTab() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState(() => ({ ...blank, ...(state?.prefill || {}) }));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const unanswered = useRef(null);
  const inFlight = useRef(false);

  const set = (field) => (event) => {
    unanswered.current = null; // a changed form is a new call
    setForm((f) => ({ ...f, [field]: event.target.value }));
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

        <SavedKnowledgeBase />

        {problem && (
          <div role="alert" className="text-sm">
            <FormError>{problem.message}</FormError>
            {problem.hint && <p className="text-muted-foreground">{problem.hint}</p>}
          </div>
        )}

        <div className="flex justify-end">
          <OpsButton variant="primary" type="submit" busy={busy}>
            <Phone className="h-4 w-4" /> {busy ? 'Calling…' : 'Call now'}
          </OpsButton>
        </div>
      </form>
    </section>
  );
}
