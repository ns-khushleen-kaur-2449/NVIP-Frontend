// Labelled form fields for the agent configuration and campaign builder screens. Each field carries
// `data-field={path}` so a refused save can move focus to it, shows its error (the server's message when it gave
// one) and, after a rebase, a "changed in the newer version too" note.

import { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

const WEEKDAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

const show = (value) => {
  if (value == null || value === '') return 'empty';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'empty';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Error and rebase-conflict notes under a field. */
export function FieldNotes({ id, error, conflict, hint }) {
  return (
    <>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {conflict && (
        <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400" data-testid="field-conflict">
          Also changed in the newer published version (it had “{show(conflict.theirs)}”). Your value was kept; check it.
        </p>
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

const describedBy = (id, { error, hint }) => [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

/** A text input or textarea. `counter` shows the characters used of `maxLength`. */
export function TextField({ label, path, value, onChange, error, conflict, hint, maxLength, multiline = false, counter = false,
  readOnly = false, placeholder, type = 'text', required = false, className }) {
  const id = useId();
  const Control = multiline ? Textarea : Input;
  const length = (value || '').length;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}{required && <span aria-hidden="true"> *</span>}</label>
        {counter && maxLength && <span className="text-xs text-muted-foreground" aria-live="polite">{length}/{maxLength}</span>}
      </div>
      <Control id={id} data-field={path} value={value ?? ''} readOnly={readOnly} placeholder={placeholder} type={type}
        maxLength={maxLength} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, { error, hint })}
        onChange={(e) => onChange?.(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
        className={cn('mt-1', conflict && 'border-amber-500', multiline && 'min-h-[90px]')} />
      <FieldNotes id={id} error={error} conflict={conflict} hint={hint} />
    </div>
  );
}

/** A native select (keyboard and screen-reader friendly). options: [{ value, label }]. */
export function SelectField({ label, path, value, onChange, options, error, conflict, hint, readOnly = false, placeholder }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select id={id} data-field={path} value={value ?? ''} disabled={readOnly} aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, { error, hint })} onChange={(e) => onChange?.(e.target.value || null)}
        className={cn('mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          conflict && 'border-amber-500')}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldNotes id={id} error={error} conflict={conflict} hint={hint} />
    </div>
  );
}

/** A radio group (role radiogroup). options: [{ value, label, help?, disabled? }]. */
export function ChoiceField({ label, path, value, onChange, options, error, conflict, hint, readOnly = false, cards = false }) {
  const id = useId();
  return (
    <fieldset aria-describedby={describedBy(id, { error, hint })}>
      <legend className="text-sm font-medium">{label}</legend>
      <RadioGroup value={value ?? ''} onValueChange={onChange} disabled={readOnly} data-field={path} aria-label={label}
        className={cn('mt-2', cards ? 'grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]' : 'flex flex-wrap gap-4')}>
        {options.map((o) => {
          const optionId = `${id}-${o.value}`;
          return (
            <label key={o.value} htmlFor={optionId}
              className={cn('flex items-start gap-2 text-sm', cards && 'rounded-xl border-2 border-border bg-card px-3.5 py-3 cursor-pointer',
                cards && value === o.value && 'border-primary bg-primary/5', o.disabled && 'opacity-60 cursor-not-allowed')}>
              <RadioGroupItem id={optionId} value={o.value} disabled={readOnly || o.disabled} className="mt-0.5" />
              <span>
                <span className="font-medium">{o.label}</span>
                {o.help && <span className="block text-xs text-muted-foreground">{o.help}</span>}
              </span>
            </label>
          );
        })}
      </RadioGroup>
      <FieldNotes id={id} error={error} conflict={conflict} hint={hint} />
    </fieldset>
  );
}

/** A labelled on/off switch (role switch). */
export function SwitchField({ label, path, checked, onChange, hint, readOnly = false, error }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <Switch id={id} data-field={path} checked={Boolean(checked)} disabled={readOnly} onCheckedChange={onChange}
          aria-describedby={describedBy(id, { error, hint })} />
      </div>
      <FieldNotes id={id} error={error} hint={hint} />
    </div>
  );
}

/**
 * A list of short texts: add, remove and (with `reorder`) move up and down with real buttons.
 * `markers[i]` labels a row (e.g. "Edited").
 */
export function ListField({ label, path, values = [], onChange, error, conflict, hint, readOnly = false, max, min,
  reorder = false, addLabel = 'Add', maxLength, placeholder, markers = [] }) {
  const id = useId();
  const list = values.length ? values : [];
  const set = (index, value) => onChange(list.map((v, i) => (i === index ? value : v)));
  const move = (index, by) => {
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    onChange(next);
  };
  return (
    <fieldset data-field={path} tabIndex={-1} aria-describedby={describedBy(id, { error, hint })}>
      <legend className="text-sm font-medium">
        {label}{(min || max) && <span className="ml-1 text-xs font-normal text-muted-foreground">({min ? `${min}–` : 'up to '}{max})</span>}
      </legend>
      <ol className="mt-2 space-y-2">
        {list.map((value, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground" aria-hidden="true">{index + 1}.</span>
            <Input value={value ?? ''} readOnly={readOnly} maxLength={maxLength} placeholder={placeholder}
              aria-label={`${label} ${index + 1}`} onChange={(e) => set(index, e.target.value)} className="flex-1" />
            {markers[index] && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{markers[index]}</span>}
            {!readOnly && reorder && (
              <>
                <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index === 0}
                  aria-label={`Move ${label} ${index + 1} up`} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index === list.length - 1}
                  aria-label={`Move ${label} ${index + 1} down`} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button>
              </>
            )}
            {!readOnly && (
              <button type="button" className="rounded p-1 hover:bg-muted" aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => onChange(list.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && (!max || list.length < max) && (
        <button type="button" onClick={() => onChange([...list, ''])}
          className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2">
          <Plus className="h-4 w-4" aria-hidden="true" /> {addLabel}
        </button>
      )}
      <FieldNotes id={id} error={error} conflict={conflict} hint={hint} />
    </fieldset>
  );
}

/** Days and hours: { days: ['mon', ...], start_time: 'HH:MM', end_time: 'HH:MM' }, or null (no window of its own). */
export function WindowField({ label, path, value, onChange, error, conflict, hint, readOnly = false, emptyLabel = 'No window of its own' }) {
  const id = useId();
  const window = value || null;
  const toggleDay = (day) => {
    const days = window?.days || [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onChange({ start_time: '09:00', end_time: '18:00', ...window, days: WEEKDAYS.map(([d]) => d).filter((d) => next.includes(d)) });
  };
  return (
    <fieldset data-field={path} tabIndex={-1} aria-describedby={describedBy(id, { error, hint })}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${label}: days`}>
        {WEEKDAYS.map(([day, name]) => (
          <button key={day} type="button" disabled={readOnly} aria-pressed={Boolean(window?.days?.includes(day))}
            onClick={() => toggleDay(day)}
            className={cn('h-8 rounded-md border px-2.5 text-xs font-medium focus-visible:outline focus-visible:outline-2',
              window?.days?.includes(day) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
            {name}
          </button>
        ))}
      </div>
      {window ? (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted-foreground">From
            <Input type="time" className="mt-1 w-32" value={window.start_time || ''} readOnly={readOnly}
              onChange={(e) => onChange({ ...window, start_time: e.target.value })} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">To
            <Input type="time" className="mt-1 w-32" value={window.end_time || ''} readOnly={readOnly}
              onChange={(e) => onChange({ ...window, end_time: e.target.value })} />
          </label>
          {!readOnly && (
            <button type="button" className="text-xs underline" onClick={() => onChange(null)}>Clear window</button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>
      )}
      <FieldNotes id={id} error={error} conflict={conflict} hint={hint} />
    </fieldset>
  );
}

/** A value shown read-only, with a label. */
export function ReadOnlyValue({ label, value, note }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-sm text-foreground break-words">{value || <span className="text-muted-foreground">Not set</span>}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A panel's note about data the backend can't save or provide yet. */
export function GapNote({ children }) {
  return <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">{children}</p>;
}
