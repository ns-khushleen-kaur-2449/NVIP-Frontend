import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorText } from '@/components/admin/userBits';
import { getAgentBuilderVoices, setAgentVoices } from '@/lib/api';

export const GENDERS = ['female', 'male'];
const GENDER_LABELS = { female: 'Female', male: 'Male' };
export const FALLBACK = "Falls back to the assistant's default voice";
const FIELD_LABELS = { provider: 'provider', voiceId: 'voice ID', model: 'model' };
const blank = () => ({ provider: '', voiceId: '', model: '' });

/** A cell counts as filled when any of its fields has text. */
export const isEmptyCell = (cell) => !cell || !['provider', 'voiceId', 'model'].some((k) => String(cell[k] || '').trim());

/** Cells from the stored ``settings.voices``: {code: {female: {provider, voiceId, model}, male: {...}}}. */
export function cellsFrom(voices, codes) {
  return Object.fromEntries(codes.map((code) => [code, Object.fromEntries(GENDERS.map((gender) => {
    const saved = voices?.[code]?.[gender];
    return [gender, saved ? { provider: saved.provider || '', voiceId: saved.voiceId || '', model: saved.model || '' } : blank()];
  }))]));
}

/** ``settings.voices`` from the cells: filled cells only (the backend reports a half-filled one). */
export function voicesFrom(cells) {
  const voices = {};
  Object.entries(cells).forEach(([code, genders]) => GENDERS.forEach((gender) => {
    const cell = genders[gender];
    if (isEmptyCell(cell)) return;
    const entry = { provider: cell.provider.trim(), voiceId: cell.voiceId.trim() };
    if (cell.model.trim()) entry.model = cell.model.trim();
    voices[code] = { ...(voices[code] || {}), [gender]: entry };
  }));
  return voices;
}

/**
 * Fill only EMPTY cells from the Assistant Builder's voices. A language with one builder voice for both genders
 * (``gendered`` false) fills Female only, so the health check keeps asking for a real male voice.
 * Returns [cells, how many were filled].
 */
export function withBuilderVoices(cells, languages) {
  let filled = 0;
  const next = { ...cells };
  languages.forEach((language) => {
    (language.gendered ? GENDERS : ['female']).forEach((gender) => {
      const voice = language[gender];
      if (!voice || !isEmptyCell(next[language.code]?.[gender])) return;
      next[language.code] = { ...next[language.code],
        [gender]: { provider: voice.provider || '', voiceId: voice.voiceId || '', model: voice.model || '' } };
      filled += 1;
    });
  });
  return [next, filled];
}

/** 422 entries by cell ("en.male") from FastAPI-style errors with loc ["body", "voices", code, gender, field]. */
export function errorsByCell(detail) {
  const byCell = {};
  const other = [];
  (Array.isArray(detail) ? detail : []).forEach((error) => {
    const loc = Array.isArray(error.loc) ? error.loc : [];
    const [code, gender, fieldName] = loc.slice(2);
    if (code && GENDERS.includes(gender)) {
      const key = `${code}.${gender}`;
      byCell[key] = [...(byCell[key] || []), fieldName ? `${FIELD_LABELS[fieldName] || fieldName}: ${error.msg}` : error.msg];
    } else {
      other.push(code ? `${code}${gender ? ` ${gender}` : ''}: ${error.msg}` : error.msg);
    }
  });
  return [byCell, other];
}

/**
 * Super Admin: the voices of an agent's shared assistant, per language and gender ("Speaks as").
 * A call uses the tenant's own voice if set, else the cell for its language and gender, else the assistant's own
 * voice. Save sends PUT /api/v1/agents/{id}/voices (only settings.voices changes).
 */
export default function AgentVoicesDialog({ agent, onClose, onSaved }) {
  const [languages, setLanguages] = useState(null);
  const [providers, setProviders] = useState([]);
  const [cells, setCells] = useState({});
  const [cellErrors, setCellErrors] = useState({});
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent) return undefined;
    let live = true;
    setLanguages(null); setCellErrors({}); setError(null); setNote(null);
    getAgentBuilderVoices().then(({ data }) => {
      if (!live) return;
      setLanguages(data.languages || []);
      setProviders(data.providers || []);
      setCells(cellsFrom(agent.settings?.voices, (data.languages || []).map((l) => l.code)));
    }).catch((e) => { if (live) { setLanguages([]); setError(errorText(e, 'Could not load the languages')); } });
    return () => { live = false; };
  }, [agent]);

  const change = (code, gender, key, value) => {
    setCells((current) => ({ ...current, [code]: { ...current[code], [gender]: { ...current[code][gender], [key]: value } } }));
    setCellErrors((current) => { const { [`${code}.${gender}`]: _gone, ...rest } = current; return rest; });
  };

  const copyBuilder = () => {
    const [next, filled] = withBuilderVoices(cells, languages || []);
    setCells(next);
    setNote(filled ? `Filled ${filled} empty ${filled === 1 ? 'cell' : 'cells'} from the builder's voices. Save to keep them.`
      : "No empty cell has a builder voice to copy.");
  };

  const save = async () => {
    setSaving(true); setError(null); setCellErrors({});
    try {
      await setAgentVoices(agent.id, voicesFrom(cells));
      toast.success(`Voices of ${agent.name} saved`);
      await onSaved?.();
      onClose();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && Array.isArray(detail)) {
        const [byCell, other] = errorsByCell(detail);
        setCellErrors(byCell);
        setError(other.length ? other.join('; ') : 'Fix the marked voices, then save again.');
      } else {
        setError(errorText(e, 'Could not save the voices'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voices of {agent?.name}</DialogTitle>
          <DialogDescription>
            The voice a call uses for the organisation's language and "Speaks as" choice. An organisation's own voice
            comes first; an empty cell falls back to the assistant's default voice.
          </DialogDescription>
        </DialogHeader>

        {!languages ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Copy builder voices fills only empty cells; a language with one builder voice for both genders fills Female only. Nothing is saved until you save.
              </p>
              <Button variant="outline" size="sm" onClick={copyBuilder} disabled={!languages.length}>Copy builder voices</Button>
            </div>
            {note && <p className="text-xs text-muted-foreground" data-testid="voices-note">{note}</p>}
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-2 font-medium">Language</th>
                    {GENDERS.map((gender) => <th key={gender} className="p-2 font-medium">{GENDER_LABELS[gender]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {languages.map((language) => (
                    <tr key={language.code} className="border-b border-border last:border-0 align-top" data-testid={`voices-row-${language.code}`}>
                      <td className="p-2">
                        <p className="font-medium">{language.name}</p>
                        <p className="text-xs text-muted-foreground">{language.code}</p>
                      </td>
                      {GENDERS.map((gender) => {
                        const cell = cells[language.code]?.[gender] || blank();
                        const label = `${language.name} ${GENDER_LABELS[gender].toLowerCase()}`;
                        const problems = cellErrors[`${language.code}.${gender}`];
                        return (
                          <td key={gender} className="p-2 min-w-[220px]" data-testid={`voice-cell-${language.code}-${gender}`}>
                            <div className="space-y-1.5">
                              <select aria-label={`${label} provider`} value={cell.provider}
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                onChange={(e) => change(language.code, gender, 'provider', e.target.value)}>
                                <option value="">Provider…</option>
                                {[...new Set([...providers, ...(cell.provider ? [cell.provider] : [])])].map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                              <Input aria-label={`${label} voice ID`} placeholder="Voice ID" value={cell.voiceId}
                                onChange={(e) => change(language.code, gender, 'voiceId', e.target.value)} />
                              <Input aria-label={`${label} model`} placeholder="Model (optional)" value={cell.model}
                                onChange={(e) => change(language.code, gender, 'model', e.target.value)} />
                              {isEmptyCell(cell) && <p className="text-xs text-muted-foreground">{FALLBACK}</p>}
                              {problems && (
                                <ul role="alert" className="text-xs text-red-600 list-disc pl-4">
                                  {problems.map((p) => <li key={p}>{p}</li>)}
                                </ul>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p role="alert" className="text-sm text-red-600" data-testid="voices-error">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !languages}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
