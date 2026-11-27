import OpsButton from '@/components/ops/OpsButton';
import StatusBadge from '@/components/ops/StatusBadge';
import { CALL_SCORE_KINDS, SCORE_KIND, SCORE_STATUS, formatScore, scoreTone, statusOf } from '@/lib/hiring';

const WORKING = ['pending', 'scoring'];

/** A score's number, big, with its colour. */
export function ScoreFigure({ score }) {
  const tone = scoreTone(score);
  const colour = tone === 'good' ? 'var(--ops-good)' : tone === 'warn' ? 'var(--ops-warn)' : tone === 'bad' ? 'var(--ops-bad)' : 'inherit';
  return <span className="ops-num shrink-0 whitespace-nowrap text-2xl font-semibold" style={{ color: colour }} data-testid="score-figure">{formatScore(score)}</span>;
}

/** A category's score out of 5 as a thin bar in the score's colour (decorative: the number beside it is the value). */
function ScoreBar({ score }) {
  const tone = scoreTone(score);
  const colour = tone === 'good' ? 'var(--ops-good)' : tone === 'warn' ? 'var(--ops-warn)' : tone === 'bad' ? 'var(--ops-bad)' : 'hsl(var(--muted-foreground))';
  const percent = Math.max(0, Math.min(100, ((Number(score) || 0) / 5) * 100));
  return (
    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: colour }} />
    </div>
  );
}

export default function ScoreCard({ score, canManage, onRetry, retrying, resumeFailed, onReplace, onRebuild }) {
  const state = statusOf(SCORE_STATUS, score.status);
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={SCORE_KIND[score.kind] || score.kind}
      data-testid={`score-${score.kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.95rem] font-semibold">{SCORE_KIND[score.kind] || score.kind}</h3>
        <StatusBadge label={state.label} tone={state.tone} />
      </div>

      {score.status === 'scored' && (
        <>
          {/* The score, then the summary on its own lines, so a long reason reads as a paragraph. */}
          <div className="space-y-2">
            <ScoreFigure score={score.score} />
            {score.reason && <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{score.reason}</p>}
          </div>
          {score.categories.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Score by category">
              {score.categories.map((category) => (
                <li key={category.key} className="space-y-2 rounded-lg border border-border bg-background/40 p-3.5 text-sm"
                  data-testid={`category-${category.key}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{category.label}</p>
                      {score.weights?.[category.key] !== undefined && (
                        <p className="mt-0.5 text-xs text-muted-foreground">counts {score.weights[category.key]}%</p>
                      )}
                    </div>
                    <span className="ops-num shrink-0 whitespace-nowrap font-semibold">{formatScore(category.score)}</span>
                  </div>
                  <ScoreBar score={category.score} />
                  {category.reason && <p className="text-[0.8rem] leading-relaxed text-muted-foreground">{category.reason}</p>}
                </li>
              ))}
            </ul>
          )}
          {score.bullets.length > 0 && (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed" aria-label="Strengths and gaps">
              {score.bullets.map((text) => <li key={text}>{text}</li>)}
            </ul>
          )}
        </>
      )}

      {WORKING.includes(score.status) && (
        <p className="text-sm text-muted-foreground" role="status">
          {score.status === 'pending' ? 'Waiting to be scored.' : 'Being scored now.'} This page updates by itself.
        </p>
      )}

      {(score.status === 'failed' || score.status === 'blocked') && (
        <div className="space-y-2">
          <p className="text-sm" role="alert">{score.failure_message || 'This score could not be worked out.'}</p>
          {canManage && score.kind === 'resume' && (
            resumeFailed
              ? <OpsButton size="sm" onClick={onReplace}>Upload another file</OpsButton>
              : score.status === 'failed' && <OpsButton size="sm" busy={retrying} onClick={onRetry}>Score again</OpsButton>
          )}
          {canManage && onRebuild && score.status === 'failed' && CALL_SCORE_KINDS.includes(score.kind) && (
            <OpsButton size="sm" onClick={onRebuild}>Write the AI resume and score again</OpsButton>
          )}
        </div>
      )}
    </section>
  );
}
