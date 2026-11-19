// F-08: a call preview from the server (POST /api/v1/agent-instances/{type}/preview, POST /api/campaigns/preview,
// GET /api/campaigns/{id}/preview). Shows exactly what the server returns; nothing is rendered here.
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const minutes = (seconds) => `${Math.round(seconds / 60) || 1} min`;

/** "What's still needed" from the server's missing_required: [{ code, label, fields?, action? }]. */
export function MissingChecklist({ items = [], extra = [] }) {
  const all = [...extra, ...items];
  return (
    <div data-testid="required-checklist" className={cn('rounded-xl px-3 py-2 text-sm',
      all.length ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
      {all.length === 0 ? (
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Nothing missing for calls</p>
      ) : (
        <>
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" aria-hidden="true" /> Still needed</p>
          <ul className="mt-1 space-y-1 pl-6" aria-label="Still needed">
            {all.map((item) => (
              <li key={`${item.code}-${item.label}`} className="list-disc" data-code={item.code}>
                {item.label}{item.fields?.length ? `: ${item.fields.join(', ')}` : ''}
                {item.action && <span className="block text-xs opacity-80">{item.action}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt><dd className="text-right">{children}</dd>
    </div>
  );
}

/** The opening line, what goes with the call, the checklist and the server's warnings. */
export default function CallPreviewView({ preview, loading, error, title = 'Opening line', showPrompt = true, extraMissing = [] }) {
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!preview) return <p className="text-sm text-muted-foreground" aria-live="polite">{loading ? 'Loading the preview…' : 'No preview yet.'}</p>;
  const settings = preview.call_settings || {};
  // What the agent knows: the tenant's and campaign's own values (the server never sends a tenant the prompt).
  const sections = Object.entries(preview.tenant_sections || {});
  const offer = preview.tenant_sections?.campaign_section?.value;
  return (
    <div className={cn('space-y-3', loading && 'opacity-60')} aria-busy={loading} data-testid="call-preview">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 rounded-xl bg-muted px-3 py-2.5 text-sm" data-testid="server-first-message">
          {preview.first_message ? `“${preview.first_message}”` : "The assistant's own opening line."}
        </p>
      </div>
      {offer && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offer the agent receives</p>
          <p className="mt-1 whitespace-pre-line text-sm">{offer}</p>
        </div>
      )}
      {preview.mode === 'shared' && (
        <dl className="rounded-xl border border-border px-3 py-2" aria-label="Sent with the call">
          <Row label="Voice">{settings.voice?.voiceId ? `${settings.voice.provider || 'Voice'} · ${settings.voice.voiceId}` : 'Default voice'}</Row>
          <Row label="Listening">{settings.transcriber?.language || '—'}</Row>
          <Row label="Max length">{settings.maxDurationSeconds ? minutes(settings.maxDurationSeconds) : 'Platform default'}</Row>
          {settings.voicemailMessage && <Row label="Voicemail">Set</Row>}
          {settings.endCallMessage && <Row label="Goodbye line">Set</Row>}
          <Row label="Caller ID">{preview.caller_id?.number || { tenant_number: 'Your number', platform: "Platform's number" }[preview.caller_id?.source] || 'None'}</Row>
        </dl>
      )}
      <MissingChecklist items={preview.missing_required} extra={extraMissing} />
      {(preview.warnings || []).length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground" data-testid="preview-warnings">
          {preview.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {showPrompt && sections.length > 0 && (
        <details className="text-xs" data-testid="agent-knows">
          <summary className="cursor-pointer font-medium">What the agent knows</summary>
          <dl className="mt-2 space-y-2">
            {sections.map(([key, section]) => (
              <div key={key}>
                <dt className="font-semibold text-muted-foreground">{section.label}</dt>
                <dd className="whitespace-pre-line">{section.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {/* Only a Super Admin's response carries the full prompt. */}
      {showPrompt && preview.rendered_prompt && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Full prompt (platform)</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans" data-testid="rendered-prompt">{preview.rendered_prompt}</pre>
        </details>
      )}
    </div>
  );
}
