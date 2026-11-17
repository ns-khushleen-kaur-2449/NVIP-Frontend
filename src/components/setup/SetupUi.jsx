// Building blocks shared by the agent setup, Agents page and campaign builder screens. Colours come from the app's
// theme tokens (primary = Netsmartz orange), so light and dark modes both work.

import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Breadcrumb, title and a right-hand slot (save status, agent chip). */
export function SetupHeader({ crumbs = [], title, aside }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.label}>
                {i > 0 && ' / '}
                {c.to ? <Link to={c.to} className="text-primary underline underline-offset-2">{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
        )}
        <h1 id="setup-title" tabIndex={-1} className="mt-1 text-2xl font-bold tracking-tight focus:outline-none sm:text-3xl">{title}</h1>
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </header>
  );
}

/** A white (card) panel with a title, a subtitle, an optional badge or action on the right. */
export function Panel({ title, subtitle, badge, action, children, className, tone }) {
  return (
    <section className={cn('rounded-2xl border bg-card p-5 sm:p-6',
      tone === 'accent' ? 'border-primary/30 bg-primary/5' : 'border-border', className)}>
      {(title || badge || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {badge && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{badge}</span>}
          {action}
        </div>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** A small rounded status label. tone: neutral | good | warn | primary. */
export function Pill({ tone = 'neutral', children, className, ...props }) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    primary: 'bg-primary/15 text-primary',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)} {...props}>{children}</span>;
}

/**
 * The vertical step list of a setup: numbered circles, a check for steps already visited, the current one
 * highlighted. Each step is a real button.
 */
export function StepRail({ steps, current, done = new Set(), onSelect, label = 'Setup steps' }) {
  return (
    <nav aria-label={label} className="rounded-2xl border border-border bg-card p-3">
      <ol className="space-y-1">
        {steps.map((step, i) => {
          const active = step.id === current;
          const finished = done.has(step.id) && !active;
          return (
            <li key={step.id}>
              <button type="button" onClick={() => onSelect(step.id)} aria-current={active ? 'step' : undefined}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                  active ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground hover:bg-muted')}>
                <span aria-hidden="true" className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  active ? 'border-primary bg-primary text-primary-foreground'
                    : finished ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600' : 'border-border text-muted-foreground')}>
                  {finished ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span>{step.label}</span>
                {finished && <span className="sr-only">(done)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Horizontal step pills (campaign builder): done steps green with a check and a short summary. */
export function StepPills({ steps, current, onSelect, label = 'Steps' }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label={label}>
      {steps.map((step, i) => {
        const active = i === current;
        const finished = i < current;
        return (
          <li key={step.label}>
            <button type="button" disabled={step.disabled} onClick={() => onSelect(i)} aria-current={active ? 'step' : undefined}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                active ? 'border-primary bg-primary text-primary-foreground'
                  : finished ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-border bg-card text-foreground')}>
              {finished ? <Check className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
              {finished && step.summary ? step.summary : step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Choice chips that work like checkboxes (featured products, languages). */
export function CheckChip({ checked, onChange, disabled, children }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm',
      checked ? 'border-primary bg-primary/5' : 'border-border bg-card', disabled && 'cursor-not-allowed opacity-60')}>
      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={checked} disabled={disabled} onChange={onChange} />
      {children}
    </label>
  );
}

/** The platform rules every call follows, as non-editable chips. */
export function LockedRules({ rules }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Platform rules">
      {rules.map((rule) => <li key={rule}><Pill>{rule}</Pill></li>)}
    </ul>
  );
}
