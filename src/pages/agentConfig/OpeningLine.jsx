// Outbound SDR's opening line (opener.first_message) in the Agent identity step: a suggested line when the user changes
// the primary language, the writing guide for that language, and the unknown-variable and voice readiness warnings.
// Backend: app/features/opening_lines. Nothing here saves: a suggestion goes into the form value (and so the draft's
// autosave) only when the line was empty or still a default line, or when the user presses Replace.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { suggestOpeningLine } from '@/lib/api';
import { directionOf, voiceStatus } from '@/lib/builderLanguages';
import {
  DEFAULT_RECOMMENDED_VARIABLES, insertVariable, languageName, loadOpeningLineGuide, looksDefault, unknownVariables,
} from '@/lib/openingLines';
import { TextField } from './fields';

export const SUGGEST_DEBOUNCE_MS = 300;
export const OPENING_LINE_MAX = 500;
const SUGGESTED_BADGE = 'Suggested — review before publishing';

/**
 * The suggestion flow. `languageChanged(next, previous)` is called by the primary language select only (never on load
 * or for `languages.supported`). Only the latest request's answer applies. `pending`: false, "loading" (a default
 * line) or "translating" (the user's own), set once the request is sent, not during the debounce. A language with no
 * suggestion (422 opening_line_language_not_supported) sets `unavailable`; other 4xx show nothing; other failures an
 * error with a retry. `getLine()` reads the box now; `setLine(value)` writes it through the form (autosave runs).
 */
export function useOpeningLineSuggestion({ agentType, enabled, getLine, setLine }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null); // the suggestion for a line the user wrote, until Replace / Keep mine
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [tips, setTips] = useState({}); // language -> { tips, example } from suggest answers
  const seq = useRef(0);
  const timer = useRef(null);
  const lineLanguage = useRef(null); // the language the box's line is in, as far as we know
  const last = useRef(null);
  const lineRef = useRef(getLine);
  lineRef.current = getLine;
  const setLineRef = useRef(setLine);
  setLineRef.current = setLine;

  useEffect(() => () => { clearTimeout(timer.current); seq.current += 1; }, []);

  const apply = useCallback((value, language) => {
    setLineRef.current(value);
    lineLanguage.current = language;
    setSuggested(true);
    setNotice(null);
  }, []);

  const run = useCallback((to, from) => {
    const id = ++seq.current;
    const sent = lineRef.current() || '';
    last.current = { to, from };
    setPending(looksDefault(sent) ? 'loading' : 'translating');
    setFailed(false);
    setUnavailable(false);
    Promise.resolve()
      .then(() => suggestOpeningLine(agentType, { language: to, current_opening_line: sent }))
      .then(({ data }) => {
        if (id !== seq.current) return;
        setPending(false);
        setTips((t) => ({ ...t, [to]: { tips: data.tips, example: data.example } }));
        const now = lineRef.current() || '';
        // A default (or empty) line is replaced, unless the user typed while we waited: then it's their line.
        if (data.current_is_default && now === sent) apply(data.opening_line, to);
        else if ((data.opening_line || '').trim() !== now.trim()) setNotice({ ...data, from, to });
      })
      .catch((e) => {
        if (id !== seq.current) return;
        setPending(false);
        const status = e?.response?.status;
        if (status === 422 && e?.response?.data?.detail?.code === 'opening_line_language_not_supported') {
          setUnavailable(true);
          return;
        }
        // 403 (role, feature off), 404 (no instance, feature gate), 422 opening_line_not_supported: nothing to say.
        if (status && status < 500) return;
        setFailed(true);
      });
  }, [agentType, apply]);

  const languageChanged = useCallback((next, previous) => {
    if (!enabled || !next) return;
    if (lineLanguage.current == null) lineLanguage.current = previous || null;
    const from = lineLanguage.current;
    clearTimeout(timer.current);
    seq.current += 1; // an answer still on its way is for an older choice
    setNotice(null);
    setFailed(false);
    setUnavailable(false);
    setPending(false);
    if (next === from) return; // the line is already in this language
    timer.current = setTimeout(() => run(next, from), SUGGEST_DEBOUNCE_MS);
  }, [enabled, run]);

  return {
    pending, notice, failed, unavailable, suggested, tips, languageChanged,
    retry: () => last.current && run(last.current.to, last.current.from),
    replace: () => notice && apply(notice.opening_line, notice.to),
    keepMine: () => setNotice(null),
    edited: () => setSuggested(false),
  };
}

function fallbackNote(notice, languages) {
  if (notice.source !== 'template' || !notice.fallback_reason) return null;
  const name = languageName(languages, notice.to);
  if (notice.fallback_reason === 'variables_changed' && notice.unknown_variables?.length) {
    const names = notice.unknown_variables.map((v) => `{{${v}}}`).join(', ');
    return `Your line has unknown variables (${names}), so this is the standard ${name} line. Fix them and change the `
      + 'language again to get a translation.';
  }
  return `We couldn't translate your line, so this is the standard ${name} opening line.`;
}

function SuggestionNotice({ notice, languages, onReplace, onKeep }) {
  const note = fallbackNote(notice, languages);
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm space-y-2" role="region"
      aria-label="Suggested opening line" data-testid="opening-line-notice">
      <p className="font-medium">
        Your opening line is in {languageName(languages, notice.from)}. Use the suggested {languageName(languages, notice.to)} version?
      </p>
      <p dir={directionOf(languages, notice.to)} className="rounded-md border border-border bg-background px-3 py-2"
        data-testid="opening-line-suggestion">{notice.opening_line}</p>
      {note && <p className="text-xs text-muted-foreground" data-testid="opening-line-fallback">{note}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onReplace}>Replace</Button>
        <Button type="button" size="sm" variant="outline" onClick={onKeep}>Keep mine</Button>
      </div>
    </div>
  );
}

function TipsPanel({ guide, tips, languages, language, readOnly, onInsert }) {
  const [english, setEnglish] = useState(false);
  const shown = guide?.tips || tips?.tips;
  const example = guide?.example || tips?.example;
  const recommended = guide?.recommended_variables || DEFAULT_RECOMMENDED_VARIABLES;
  const list = (english ? shown?.en : shown?.target) || [];
  const tipDir = english ? 'ltr' : directionOf(languages, language);
  return (
    <details className="rounded-lg border border-border px-3 py-2 text-sm" data-testid="opening-line-tips">
      <summary className="cursor-pointer text-sm font-medium">How to write the opening line</summary>
      <div className="mt-2 space-y-3">
        {list.length > 0 && (
          <div>
            <ul dir={tipDir} className="list-disc space-y-1 ps-5 text-sm" data-testid="opening-line-tip-list">
              {list.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
            {language !== 'en' && shown?.en?.length > 0 && (
              <button type="button" className="mt-1 text-xs text-primary underline underline-offset-2"
                aria-pressed={english} onClick={() => setEnglish((v) => !v)}>
                {english ? `Show in ${languageName(languages, language)}` : 'Show in English'}
              </button>
            )}
          </div>
        )}
        {example && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Example</p>
            <p dir={directionOf(languages, language)} className="mt-0.5 italic" data-testid="opening-line-example">{example}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground">Insert a variable</p>
          <div className="mt-1 flex flex-wrap gap-1.5" data-testid="opening-line-variables">
            {recommended.map((name) => (
              <button key={name} type="button" disabled={readOnly} onClick={() => onInsert(name)}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-xs hover:border-primary disabled:opacity-60">
                {`{{${name}}}`}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {'{{call_purpose}}'} is spoken exactly as written in the campaign, so write the campaign's purpose in the same language.
          </p>
        </div>
      </div>
    </details>
  );
}

/** The opening line box with its suggestion notice, badge, warnings and writing guide. `field`: the form's props. */
export function OpeningLineField({ agentType, field, languages, language, suggestion }) {
  const inputRef = useRef(null);
  const [guides, setGuides] = useState({});
  const [allowed, setAllowed] = useState(null);
  const [noRoom, setNoRoom] = useState(false); // a variable chip found the line at the limit; cleared on the next edit

  useEffect(() => {
    if (!language) return undefined;
    let live = true;
    loadOpeningLineGuide(agentType, language)
      .then((guide) => {
        if (!live) return;
        setGuides((g) => ({ ...g, [language]: guide }));
        if (guide?.allowed_variables?.length) setAllowed(guide.allowed_variables);
      })
      .catch(() => {}); // the tips panel keeps the default variables; the warning waits for a list
    return () => { live = false; };
  }, [agentType, language]);

  const guide = guides[language] || null;
  const recommended = guide?.recommended_variables || DEFAULT_RECOMMENDED_VARIABLES;
  const max = guide?.max_length || OPENING_LINE_MAX;
  const unknown = unknownVariables(field.value, allowed);

  const edit = (value) => {
    setNoRoom(false);
    suggestion.edited();
    field.onChange(value);
  };

  const insert = (name) => {
    const el = inputRef.current;
    const { value, caret } = insertVariable(field.value, name, el?.selectionStart, el?.selectionEnd);
    if (value.length > max) { setNoRoom(true); return; }
    edit(value);
    setTimeout(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange?.(caret, caret);
    }, 0);
  };

  const labelExtra = suggestion.pending ? (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" data-testid="opening-line-pending">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      {suggestion.pending === 'translating' ? 'Translating…' : 'Loading suggestion…'}
    </span>
  ) : suggestion.suggested ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400"
      data-testid="opening-line-suggested">
      <Sparkles className="h-3 w-3" aria-hidden="true" /> {SUGGESTED_BADGE}
    </span>
  ) : null;

  return (
    <div className="space-y-2" data-testid="opening-line">
      {suggestion.notice && (
        <SuggestionNotice notice={suggestion.notice} languages={languages} onReplace={suggestion.replace}
          onKeep={suggestion.keepMine} />
      )}
      <TextField label="Opening line" multiline maxLength={max} counter {...field} onChange={edit}
        dir={directionOf(languages, language)} inputRef={inputRef} labelExtra={labelExtra} busy={Boolean(suggestion.pending)}
        hint={`Placeholders: ${recommended.map((v) => `{{${v}}}`).join(', ')}.`} />
      {noRoom && (
        <p role="status" className="text-xs text-amber-700" data-testid="opening-line-no-room">
          No room for this variable — the opening line is at the {max}-character limit.
        </p>
      )}
      {suggestion.unavailable && (
        <p className="text-xs text-muted-foreground" data-testid="opening-line-unavailable">
          No suggested opening line for this language yet. Write your own, or pick another language.
        </p>
      )}
      {suggestion.failed && (
        <p role="alert" className="text-xs text-red-600" data-testid="opening-line-error">
          Couldn't get a suggested opening line for this language.{' '}
          <button type="button" className="underline underline-offset-2" onClick={suggestion.retry}>Try again</button>
        </p>
      )}
      {unknown.length > 0 && (
        <p role="status" className="flex items-start gap-1 text-xs text-amber-700" data-testid="opening-line-unknown">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Unknown {unknown.length === 1 ? 'variable' : 'variables'}: {unknown.map((v) => `{{${v}}}`).join(', ')}.
          Calls leave {unknown.length === 1 ? 'it' : 'them'} empty; check the spelling.
        </p>
      )}
      <TipsPanel guide={guide} tips={suggestion.tips[language]} languages={languages} language={language}
        readOnly={field.readOnly} onInsert={insert} />
    </div>
  );
}

/** The primary language's voice readiness for the agent's gender, when it isn't ready (as LanguageField shows it). */
export function VoiceReadiness({ languages, language, gender }) {
  const status = voiceStatus(languages, language, gender);
  if (!status || status.ready) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-amber-700" role="status" data-testid="voice-status">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {status.problem}
    </p>
  );
}
