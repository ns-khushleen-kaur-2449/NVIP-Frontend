// The editor's right-hand column: what the agent will say and what goes with the call, for the labelled sample lead,
// from the draft being edited (or the version on view). Rendered in the browser (lib/agentInstances renderGreeting);
// the final wording is set when the call is placed.
import {
  PREVIEW_NOTE, SAMPLE_LEAD, greetingValues, languageNames, publishProblems, renderGreeting,
} from '@/lib/agentInstances';

function Box({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ label, children, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone === 'good' ? 'text-right text-emerald-500' : tone === 'warn' ? 'text-right text-amber-500' : 'text-right'}>
        {children}
      </dd>
    </div>
  );
}

const minutes = (seconds) => {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n / 60) || 1} min` : 'Default';
};

/** The greetings this agent type speaks first: Outbound's opening line, Inbound's two greetings. */
function greetings(agentType, payload) {
  if (agentType === 'sdr_inbound') {
    return [
      { label: 'Known caller', text: payload?.inbound?.known_caller_greeting },
      { label: 'New caller', text: payload?.inbound?.new_caller_greeting },
    ];
  }
  return [{ label: 'Opening line', text: payload?.opener?.first_message }];
}

export default function PreviewPanel({ agentType, payload, context, versionLabel }) {
  const values = greetingValues({ payload, business: context?.business });
  const company = context?.business?.company_name || context?.business?.company || 'Not set';
  const voice = payload?.voice || {};
  const languages = languageNames([payload?.languages?.primary, ...(payload?.languages?.supported || [])],
    context?.languages || []);
  const missing = Object.keys(publishProblems(payload, agentType));

  return (
    <div className="space-y-5" data-testid="agent-preview">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">What the agent will say</h2>
        {versionLabel && <span className="text-sm text-muted-foreground">{versionLabel}</span>}
      </div>

      <div>
        <p className="text-sm font-semibold">Sample lead</p>
        <p className="mt-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
          {SAMPLE_LEAD.name} · {SAMPLE_LEAD.company} <span className="text-muted-foreground">(made up)</span>
        </p>
      </div>

      {greetings(agentType, payload).map((g) => (
        <Box key={g.label} title={g.label}>
          <p className="text-[0.95rem] leading-relaxed" aria-live="polite">
            {g.text ? `“${renderGreeting(g.text, values)}”` : <span className="text-muted-foreground">Nothing yet.</span>}
          </p>
        </Box>
      ))}

      <Box title="Sent with the call">
        <dl>
          <Row label="Voice">
            {payload?.persona?.name || 'Agent'} · {voice.voice_id ? `${voice.provider || 'Voice'} ${voice.voice_id}` : 'default voice'}
          </Row>
          <Row label="Listening">{languages || 'Not set'}</Row>
          <Row label="Max length">{minutes(payload?.call_behaviour?.max_duration_seconds)}</Row>
          <Row label="Calling for">{company}</Row>
          <Row label="Missing values" tone={missing.length ? 'warn' : 'good'}>
            {missing.length ? `${missing.length} to fill before publishing` : 'None'}
          </Row>
        </dl>
      </Box>

      <p className="text-xs text-muted-foreground">{PREVIEW_NOTE}.</p>
    </div>
  );
}
