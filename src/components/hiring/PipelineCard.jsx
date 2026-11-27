import { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { FormError } from '@/components/hiring/HiringBits';
import { PIPELINE_STEPS, STAGE, isFinalStage, statusOf, stepOf } from '@/lib/hiring';

const HISTORY_LABEL = { advance: 'Moved to', auto: 'Moved to', decision: 'Decided:' };

/** The steps left to right: done, current, and still to come. A final decision fills the last step. */
function Tracker({ stage }) {
  const current = PIPELINE_STEPS.findIndex((step) => step.id === stepOf(stage));
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Pipeline" data-testid="tracker">
      {PIPELINE_STEPS.map((step, index) => {
        const done = index < current || (index === current && isFinalStage(stage));
        const here = index === current && !isFinalStage(stage);
        const label = step.id === 'decision' && isFinalStage(stage) ? STAGE[stage].label : step.label;
        return (
          <li key={step.id} aria-current={here ? 'step' : undefined} data-state={done ? 'done' : here ? 'current' : 'todo'}
            className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
              done ? 'border-transparent bg-[color:var(--ops-good)] text-white'
                : here ? 'border-[color:var(--ops-accent)] text-[color:var(--ops-accent-ink)]'
                  : 'border-border text-muted-foreground'}`}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={`text-sm ${here ? 'font-semibold' : done ? '' : 'text-muted-foreground'}`}>{label}</span>
            {index < PIPELINE_STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Asks before something that cannot be taken back lightly, with an optional note recorded in the history. */
function Confirm({ open, title, description, warnings = [], confirmLabel, tone, busy, error, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) { setNote(''); onCancel(); } }}>
      <DialogContent className="ops max-w-md rounded-[14px]">
        <form onSubmit={(e) => { e.preventDefault(); onConfirm(note.trim()); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ops-warn)]" data-testid="confirm-warnings">
              {warnings.map((text) => <li key={text}>{text}</li>)}
            </ul>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">Note (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal" />
          </label>
          <FormError>{error}</FormError>
          <DialogFooter className="gap-2 sm:gap-2">
            <OpsButton variant="quiet" onClick={() => { setNote(''); onCancel(); }} disabled={busy}>Cancel</OpsButton>
            <OpsButton type="submit" variant={tone === 'bad' ? 'danger' : 'primary'} busy={busy}>{confirmLabel}</OpsButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Where the candidate is: the steps, what blocks the next one, and, for Tenant Admins and Managers, moving them on
 * (to the next round) or deciding (selecting from the last round, or rejecting from any). Everything is checked by the
 * backend; a move is refused if someone else already moved the candidate (the screen was out of date).
 * Warnings (for example "the intake call has not been completed") are shown and may be accepted.
 */
export default function PipelineCard({ pipeline, canManage, busy, error, onAdvance, onDecide }) {
  const [asking, setAsking] = useState(null); // 'advance' | 'selected' | 'rejected'
  const stage = statusOf(STAGE, pipeline.stage);
  const warnings = pipeline.warnings || [];
  const blockers = pipeline.blockers || [];

  const confirm = async (note) => {
    const done = asking === 'advance' ? await onAdvance(note) : await onDecide(asking, note);
    if (done !== false) setAsking(null);
  };

  const text = {
    advance: { title: `Move to ${pipeline.next_label}?`, description: 'The candidate moves on to the next round. This is recorded in their history.', label: 'Move on' },
    selected: { title: 'Select this candidate?', description: 'This is the final decision. It is recorded in their history.', label: 'Select' },
    rejected: { title: 'Reject this candidate?', description: 'This is the final decision. It is recorded in their history.', label: 'Reject' },
  }[asking || 'advance'];

  return (
    <section aria-label="Pipeline" className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Pipeline</h3>
        <StatusBadge label={stage.label} tone={stage.tone} />
      </div>
      <Tracker stage={pipeline.stage} />

      {blockers.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ops-bad)]" role="alert" data-testid="blockers">
          {blockers.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
      {warnings.length > 0 && !isFinalStage(pipeline.stage) && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ops-warn)]" data-testid="warnings">
          {warnings.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}


      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h4>
        {(pipeline.history || []).length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No moves yet.</p>
        ) : (
          <ul className="mt-1 space-y-1.5 text-sm" data-testid="history">
            {pipeline.history.map((event) => (
              <li key={event.id}>
                <span className="font-medium">{HISTORY_LABEL[event.kind] || 'Moved to'} {statusOf(STAGE, event.to_stage).label}</span>
                <span className="text-muted-foreground">
                  {event.actor_name ? ` · ${event.actor_name}` : ''} · <RelativeTime iso={event.created_at} />
                </span>
                {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The actions come last, under the steps and the history. */}
      {canManage && !isFinalStage(pipeline.stage) && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {pipeline.next_stage && (
            <OpsButton variant="primary" disabled={!pipeline.can_advance} onClick={() => setAsking('advance')}>
              Advance to {pipeline.next_label}
            </OpsButton>
          )}
          {(pipeline.decisions || []).includes('selected') && (
            <OpsButton onClick={() => setAsking('selected')}>Select candidate</OpsButton>
          )}
          {(pipeline.decisions || []).includes('rejected') && (
            <OpsButton variant="quiet" onClick={() => setAsking('rejected')}>Reject</OpsButton>
          )}
        </div>
      )}
      {error && !asking && <FormError>{error}</FormError>}

      <Confirm open={asking !== null} title={text.title} description={text.description}
        warnings={asking === 'advance' ? warnings : []} confirmLabel={text.label}
        tone={asking === 'rejected' ? 'bad' : 'good'} busy={busy} error={asking ? error : null}
        onConfirm={confirm} onCancel={() => setAsking(null)} />
    </section>
  );
}
