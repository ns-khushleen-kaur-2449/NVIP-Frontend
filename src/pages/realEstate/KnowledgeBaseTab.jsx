import { useEffect, useRef, useState } from 'react';
import { FileUp, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import { SkeletonRows } from '@/components/ops/States';
import { CONTROL, Field, FormError } from '@/components/hiring/HiringBits';
import { RealEstateError } from '@/components/realEstate/RealEstateBits';
import { getRealEstateKnowledgeBase, saveRealEstateKnowledgeBase } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSIONS } from '@/lib/rbac';
import {
  KNOWLEDGE_BASE_FILE_TYPES, MAX_KNOWLEDGE_BASE_CHARS, callRefusal, knowledgeBaseProblem,
} from '@/lib/realEstate';
import useHiringData from '../hiring/useHiringData';

/**
 * "Knowledge base": the organisation's projects, locations, prices, amenities and offers, saved once and used by
 * every call (backend app/agents/real_estate/knowledge_base.py). Typed, pasted or read from a text file. Each save
 * is a new version; saving it empty means none, and the agent uses its standard script. Until one is saved, the
 * latest call's knowledge base is filled in to start from (nothing is saved until Save is pressed). Those who may
 * place calls edit it; everyone else reads it.
 */
export default function KnowledgeBaseTab() {
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.REAL_ESTATE_CALL);
  const { data, error, reload } = useHiringData(() => getRealEstateKnowledgeBase(), []);
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInput = useRef(null);

  // The saved text, else the latest call's to start from; once, when it first arrives.
  useEffect(() => {
    if (data && text === null) setText(data.knowledge_base ?? data.last_used ?? '');
  }, [data, text]);

  if (!data || text === null) {
    return error ? <RealEstateError error={error} onRetry={reload} /> : <SkeletonRows rows={3} label="Loading the knowledge base" />;
  }

  const saved = data.knowledge_base ?? '';
  const fromLastCall = data.version === null && !!data.last_used && text === data.last_used;
  const changed = text.trim() !== saved.trim() || (data.version === null && text.trim() !== '');
  const chars = text.length;
  const over = chars > MAX_KNOWLEDGE_BASE_CHARS;

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const added = await file.text();
      setText((t) => (t.trim() ? `${t.trim()}\n\n${added}` : added));
      setFileName(file.name);
    } catch (e) {
      setProblem({ message: `${file.name} could not be read. Use a text file (.txt, .md, .csv or .json).` });
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const invalid = knowledgeBaseProblem(text);
    if (invalid) {
      setProblem({ message: invalid });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const response = await saveRealEstateKnowledgeBase(text.trim() || null);
      setText(response.data.knowledge_base ?? '');
      setFileName(null);
      toast.success(response.data.knowledge_base ? 'Knowledge base saved. New calls use it.'
        : 'Knowledge base cleared. New calls use the standard script.');
      reload();
    } catch (e) {
      setProblem(e?.response ? callRefusal(e) : { message: 'The knowledge base was not saved.', hint: 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const status = data.version === null
    ? 'Not saved yet: calls use the standard script.'
    : <>Version {data.version}, saved <RelativeTime iso={data.saved_at} />. Every new call uses it.</>;

  if (!canEdit) {
    return (
      <section aria-label="Saved knowledge base" className="max-w-2xl space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground" data-testid="knowledge-base-status">{status}</p>
        {saved
          ? <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans">{saved}</pre>
          : <p className="text-muted-foreground">No knowledge base: the agent uses its standard script.</p>}
      </section>
    );
  }

  return (
    <section aria-label="Saved knowledge base" className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
      <form onSubmit={save} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground" data-testid="knowledge-base-status">{status}</p>
        {fromLastCall && (
          <p className="text-sm text-muted-foreground" data-testid="knowledge-base-from-last-call">
            Filled in from your latest call. Save it to use it on every call.
          </p>
        )}
        <Field label="Knowledge base"
          hint="Projects, locations, prices, amenities and offers the agent may talk about. Leave it empty for the standard script.">
          {(id) => (
            <div className="space-y-2">
              <textarea id={id} value={text} onChange={(event) => setText(event.target.value)} rows={14}
                placeholder="e.g. Palm Springs, Jaipur: 3 and 4 BHK villas from ₹1.2 Cr. Clubhouse, pool, 24x7 security. Possession Dec 2027."
                className={`${CONTROL} h-auto min-h-[14rem] py-2 leading-relaxed`} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInput} type="file" accept={KNOWLEDGE_BASE_FILE_TYPES} onChange={readFile}
                    className="hidden" aria-label="Upload a text file" data-testid="knowledge-base-file" />
                  <OpsButton size="sm" type="button" onClick={() => fileInput.current?.click()}>
                    <FileUp className="h-4 w-4" /> Add from a text file
                  </OpsButton>
                  {fileName && <span className="text-muted-foreground">Added {fileName}</span>}
                  {chars > 0 && (
                    <OpsButton size="sm" variant="quiet" type="button" onClick={() => { setText(''); setFileName(null); }}>
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
          <OpsButton variant="primary" type="submit" busy={busy} disabled={over || !changed}>
            <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}
          </OpsButton>
        </div>
      </form>
    </section>
  );
}
