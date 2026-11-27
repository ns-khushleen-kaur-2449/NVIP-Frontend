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

export default function ScoreCard({ score, canManage, onRetry, retrying, resumeFailed, onReplace, onRebuild }) {
  const state = statusOf(SCORE_STATUS, score.status);
  return (
    <section className="space-y-3 rounded-lg border border-border p-4" aria-label={SCORE_KIND[score.kind] || score.kind}
      data-testid={`score-${score.kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{SCORE_KIND[score.kind] || score.kind}</h3>
        <StatusBadge label={state.label} tone={state.tone} />
      </div>

      {score.status === 'scored' && (
        <>
          <div className="flex items-baseline gap-3">
            <ScoreFigure score={score.score} />
            {score.reason && <p className="text-sm text-muted-foreground">{score.reason}</p>}
          </div>
          {score.categories.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border" aria-label="Score by category">
              {score.categories.map((category) => (
                <li key={category.key} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
                  data-testid={`category-${category.key}`}>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{category.label}</span>
                    {score.weights?.[category.key] !== undefined && (
                      <span className="ml-2 text-xs text-muted-foreground">counts {score.weights[category.key]}%</span>
                    )}
                    {category.reason && <span className="block text-xs text-muted-foreground">{category.reason}</span>}
                  </span>
                  <span className="ops-num font-medium">{formatScore(category.score)}</span>
                </li>
              ))}
            </ul>
          )}
          {score.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm" aria-label="Strengths and gaps">
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
