import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PhoneForwarded } from 'lucide-react';
import OpsButton from '@/components/ops/OpsButton';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import { CallRecording, CallTranscript, RealEstateError } from '@/components/realEstate/RealEstateBits';
import { getRealEstateCall } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSIONS } from '@/lib/rbac';
import {
  CALL_STATUS, CALLS_PATH, IDLE_REFRESH_MS, LIVE_REFRESH_MS, NEW_CALL_PATH, callOutcome, callProblem, isCallActive,
  isNotFound, refreshInterval, statusOf,
} from '@/lib/realEstate';
import useHiringData from '../hiring/useHiringData';

function BackLink() {
  return (
    <Link to={CALLS_PATH}
      className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--ops-accent-ink)] hover:underline">
      <ArrowLeft className="h-4 w-4" /> All calls
    </Link>
  );
}

const FACT_LABELS = [['purpose', 'Purpose'], ['property_type', 'Looking for'], ['budget', 'Budget'], ['callback_time', 'Call back']];

/** What the lead said, extracted after the call (backend app/agents/real_estate/extraction.py). */
function LeadFactsPanel({ facts }) {
  const rows = FACT_LABELS.filter(([key]) => facts?.[key]);
  if (!rows.length) return null;
  return (
    <section aria-label="What the lead said" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">What the lead said</h3>
      <dl className="space-y-1.5">
        {rows.map(([key, label]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt><dd className="text-right">{facts[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function KnowledgeBasePanel({ text }) {
  return (
    <section aria-label="Knowledge base" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Knowledge base on this call</h3>
      {text
        ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-sans text-muted-foreground">{text}</pre>
        : <p className="text-muted-foreground">None: the agent used its standard script.</p>}
    </section>
  );
}

/**
 * One call: its state and outcome, the site visit it booked, its transcript and recording, and the knowledge base
 * it was given. Refreshes every 5 s while the call runs, otherwise every 30 s. "Call again" opens New call with the
 * same name and number (the new call uses the organisation's saved knowledge base).
 */
export default function CallPage() {
  const { callId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [refreshMs, setRefreshMs] = useState(IDLE_REFRESH_MS);
  const { data: call, error, reload } = useHiringData(() => getRealEstateCall(callId), [callId], { pollMs: refreshMs });

  useEffect(() => { if (call) setRefreshMs(refreshInterval(call)); }, [call]);

  if (!call) {
    return (
      <section aria-label="Call" className="space-y-4">
        <BackLink />
        {error && isNotFound(error)
          ? <EmptyState title="Call not found" body="It may have been removed, or it is not in your organisation." />
          : error ? <RealEstateError error={error} onRetry={reload} /> : <SkeletonRows rows={3} label="Loading the call" />}
      </section>
    );
  }

  const state = statusOf(CALL_STATUS, call.status);
  const outcome = callOutcome(call);
  const problem = callProblem(call);
  const live = refreshMs === LIVE_REFRESH_MS;
  // A new call uses the organisation's saved knowledge base, not this call's.
  const callAgain = () => navigate(NEW_CALL_PATH, { state: { prefill: {
    lead_name: call.lead_name, phone_number: call.phone_number } } });

  return (
    <section aria-label="Call" className="space-y-5">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{call.lead_name}</h2>
          <p className="text-sm text-muted-foreground"><span className="ops-num">{call.phone_number}</span> · placed <RelativeTime iso={call.created_at} /></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live && <span className="text-xs text-muted-foreground">Updating every few seconds</span>}
          <StatusBadge label={state.label} tone={state.tone} />
          {outcome && <StatusBadge label={outcome.label} tone={outcome.tone} />}
          {can(PERMISSIONS.REAL_ESTATE_CALL) && !isCallActive(call) && (
            <OpsButton size="sm" onClick={callAgain}><PhoneForwarded className="h-4 w-4" /> Call again</OpsButton>
          )}
        </div>
      </header>

      {error && <RealEstateError error={error} onRetry={reload} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="space-y-3 rounded-xl border border-border bg-card p-4">
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Started</dt><dd><RelativeTime iso={call.dialed_at || call.created_at} /></dd></div>
              <div><dt className="text-muted-foreground">Ended</dt><dd><RelativeTime iso={call.ended_at} /></dd></div>
            </dl>
            {problem && <p className="text-sm text-[color:var(--ops-warn)]">{problem}</p>}
            {(call.has_transcript || call.has_recording) ? (
              <div className="space-y-2">
                {call.has_transcript && <CallTranscript callId={call.id} />}
                {call.has_recording && <CallRecording callId={call.id} />}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isCallActive(call) ? 'The transcript and recording appear here after the call.' : 'No transcript or recording for this call.'}
              </p>
            )}
          </article>
        </div>
        <aside className="space-y-4">
          <LeadFactsPanel facts={call.lead_facts} />
          <KnowledgeBasePanel text={call.knowledge_base} />
        </aside>
      </div>
    </section>
  );
}
