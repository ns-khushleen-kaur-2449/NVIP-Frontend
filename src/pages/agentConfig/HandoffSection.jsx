// Human handoff (FR-CORE-10): where the shared assistant transfers a caller who wants a person. Saved on the agent
// version (payload `handoff`, backend agent_instances/schema.py Handoff); a call keeps the version it started on. NVIP
// picks the number per call from these targets: the agent never sees or chooses one.

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ChoiceField, FieldNotes, SwitchField, TextField, WindowField } from './fields';

export const E164 = /^\+[1-9]\d{6,14}$/;
export const MAX_TARGETS = 5;
export const E164_MESSAGE = 'Use the international format (E.164), e.g. +919876543210';
const AFTER_HOURS = [
  { value: 'callback', label: 'Create a callback task', help: 'The caller is told someone will call back; your team gets a task.' },
  { value: 'backup', label: 'Transfer to a backup number' },
  { value: 'message', label: 'Say a message', help: 'Then a callback task is created too.' },
];

/** A number field that saves only a valid E.164 number (or nothing), and says why otherwise. */
function NumberInput({ label, value, onChange, readOnly, error }) {
  const [text, setText] = useState(value || '');
  const [local, setLocal] = useState(null);
  useEffect(() => { setText(value || ''); }, [value]);
  const change = (next) => {
    setText(next);
    const number = next.replace(/\s+/g, '');
    if (!number) { setLocal(null); onChange(null); return; }
    if (E164.test(number)) { setLocal(null); onChange(number); return; }
    setLocal(E164_MESSAGE);
  };
  return (
    <label className="block text-xs font-medium text-muted-foreground">{label}
      <Input className="mt-1" inputMode="tel" placeholder="+919876543210" value={text} readOnly={readOnly}
        aria-invalid={Boolean(local || error)} onChange={(e) => change(e.target.value)} />
      {(local || error) && <span role="alert" className="mt-1 block text-xs text-red-600">{local || error}</span>}
    </label>
  );
}

function TargetFields({ target, onChange, readOnly, errors = {}, index }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="block text-xs font-medium text-muted-foreground">Label
        <Input className="mt-1" maxLength={60} placeholder="Sales desk" value={target.label || ''} readOnly={readOnly}
          onChange={(e) => onChange({ ...target, label: e.target.value })} />
      </label>
      <NumberInput label="Number" value={target.number} readOnly={readOnly} error={errors.number}
        onChange={(number) => onChange({ ...target, number })} />
      {index !== undefined && (
        <label className="block text-xs font-medium text-muted-foreground">Priority
          <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={readOnly}
            value={target.priority || 1} onChange={(e) => onChange({ ...target, priority: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>{p === 1 ? '1 (first)' : p}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/** `field(path)` gives {value, onChange, error, ...} for a payload path (steps.jsx fieldPropsFor). */
export default function HandoffSection({ field, readOnly }) {
  const enabled = field('handoff.enabled');
  const targets = field('handoff.targets');
  const afterHours = field('handoff.after_hours');
  const backup = field('handoff.backup_target');
  const message = field('handoff.after_hours_message');
  const summary = field('handoff.summary');
  const list = targets.value || [];
  const setTarget = (i, next) => targets.onChange(list.map((t, n) => (n === i ? next : t)));
  const errorFor = (i, key) => field(`handoff.targets.${i}.${key}`).error;
  const mode = afterHours.value || 'callback';
  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="handoff-section">
      <SwitchField label="Hand over to a person" path="handoff.enabled" checked={Boolean(enabled.value)} readOnly={readOnly}
        onChange={enabled.onChange} error={enabled.error}
        hint="The agent offers a person when the caller asks, has a complaint or is ready to buy now. NVIP picks the number." />
      {enabled.value && (
        <>
          <fieldset className="space-y-3" data-field="handoff.targets">
            <legend className="text-sm font-medium">Transfer numbers (first by priority whose hours are open)</legend>
            {list.length === 0 && <p className="text-xs text-amber-700">Add at least one number to publish.</p>}
            {list.map((target, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-2" data-testid={`handoff-target-${i}`}>
                <TargetFields target={target} index={i} readOnly={readOnly} errors={{ number: errorFor(i, 'number') }}
                  onChange={(next) => setTarget(i, next)} />
                <WindowField label="Hours (your organisation's time zone)" path={`handoff.targets.${i}.hours`}
                  value={target.hours || null} readOnly={readOnly} emptyLabel="Any time"
                  onChange={(hours) => setTarget(i, { ...target, hours })} />
                {!readOnly && (
                  <button type="button" className="text-xs text-red-600 underline"
                    onClick={() => targets.onChange(list.filter((_, n) => n !== i))}>Remove number</button>
                )}
              </div>
            ))}
            {!readOnly && list.length < MAX_TARGETS && (
              <button type="button" className="text-sm underline"
                onClick={() => targets.onChange([...list, { label: '', number: null, priority: list.length + 1, hours: null }])}>
                Add a number
              </button>
            )}
            <FieldNotes id="handoff-targets" error={targets.error} path="handoff.targets" />
          </fieldset>
          <ChoiceField label="After hours" path="handoff.after_hours" value={mode} options={AFTER_HOURS}
            readOnly={readOnly} onChange={afterHours.onChange} error={afterHours.error} />
          {mode === 'backup' && (
            <div data-testid="handoff-backup">
              <TargetFields target={backup.value || {}} readOnly={readOnly} errors={{ number: field('handoff.backup_target.number').error }}
                onChange={(next) => backup.onChange(next)} />
              <FieldNotes id="handoff-backup" error={backup.error} path="handoff.backup_target" />
            </div>
          )}
          {mode === 'message' && (
            <TextField label="After-hours message" path="handoff.after_hours_message" multiline maxLength={300}
              value={message.value || ''} onChange={message.onChange} error={message.error} readOnly={readOnly}
              hint="Said instead of transferring (when the phone line supports it); a callback task is created too." />
          )}
          <SwitchField label="Brief the person before connecting" path="handoff.summary" checked={summary.value !== false}
            readOnly={readOnly} onChange={summary.onChange}
            hint="They hear a short summary of the call first (needs a Twilio number). Off: a direct transfer." />
        </>
      )}
    </div>
  );
}
