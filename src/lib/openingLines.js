// The outbound opening line (opener.first_message) helpers: the per-language writing guide (read once per language
// per session), the {{variables}} in a line, and inserting a variable at the cursor.
// Backend: app/features/opening_lines (POST/GET /api/v1/agent-instances/{type}/opening-line/...).

import { getOpeningLineGuide } from '@/lib/api';

// Shown until the guide answers (and when it can't): the four variables an opening line usually needs.
export const DEFAULT_RECOMMENDED_VARIABLES = ['lead_first_name', 'agent_name', 'company_name', 'call_purpose'];

const guides = new Map(); // `${agentType}:${language}` -> Promise<guide>
const templates = new Set(); // the default lines of the guides read so far (whitespace collapsed)
const normal = (text) => String(text || '').split(/\s+/).filter(Boolean).join(' ');

/** The writing guide for `language`, read once per session. A failed read is not kept. */
export function loadOpeningLineGuide(agentType, language) {
  const key = `${agentType}:${language}`;
  if (!guides.has(key)) {
    guides.set(key, Promise.resolve()
      .then(() => getOpeningLineGuide(agentType, language))
      .then((r) => {
        if (r.data?.template) templates.add(normal(r.data.template));
        return r.data;
      })
      .catch((error) => { guides.delete(key); throw error; }));
  }
  return guides.get(key);
}

/** For tests: forget the session's guides. */
export function resetOpeningLineGuides() {
  guides.clear();
  templates.clear();
}

/** Empty, or the default line of a language whose guide was read: a suggestion replaces it rather than translates. */
export function looksDefault(line) {
  const text = normal(line);
  return !text || templates.has(text);
}

const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** Plain names of the {{variables}} in `text`, in order of first use. */
export function variablesIn(text) {
  const found = [];
  for (const match of String(text || '').matchAll(VARIABLE)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** The {{names}} in `text` that calls never fill. [] while the allowed list is unknown. */
export function unknownVariables(text, allowed) {
  if (!allowed?.length) return [];
  return variablesIn(text).filter((name) => !allowed.includes(name));
}

/** `text` with `{{name}}` put in place of the selection [start, end). -> { value, caret } */
export function insertVariable(text, name, start, end) {
  const value = String(text || '');
  const from = Number.isInteger(start) ? start : value.length;
  const to = Number.isInteger(end) ? end : from;
  const token = `{{${name}}}`;
  return { value: value.slice(0, from) + token + value.slice(to), caret: from + token.length };
}

/** The language's English name (`name` in GET /api/v1/assistant-builder/languages), else its code. */
export function languageName(languages, code) {
  const known = (languages || []).find((l) => l.code === code);
  return known?.name || code || '';
}
