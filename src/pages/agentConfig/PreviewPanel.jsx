// The editor's right-hand column: what the agent will say, from the server (POST /api/v1/agent-instances/{type}/
// preview), built by the code that builds real calls for the version on screen. Asked again 500 ms after each autosave.
import CallPreviewView from '@/components/voice/CallPreview';
import useCallPreview from '@/hooks/useCallPreview';
import { previewAgentInstance } from '@/lib/api';

// The made-up lead a known-caller greeting is previewed with (the server labels it as a sample).
export const KNOWN_CALLER_SAMPLE = Object.freeze({ first_name: 'Asha', company: 'Sample Traders' });

function ServerPreview({ agentType, versionNumber, refreshKey, title, sampleLead }) {
  const body = { version_n: versionNumber, ...(sampleLead ? { sample_lead: sampleLead } : {}) };
  const state = useCallPreview(() => previewAgentInstance(agentType, body),
    `${agentType}:${versionNumber}:${refreshKey}:${sampleLead ? 'known' : 'new'}`, { enabled: versionNumber != null });
  return <CallPreviewView {...state} title={title} />;
}

export default function PreviewPanel({ agentType, versionNumber, refreshKey, versionLabel }) {
  return (
    <div className="space-y-5" data-testid="agent-preview">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">What the agent will say</h2>
        {versionLabel && <span className="text-sm text-muted-foreground">{versionLabel}</span>}
      </div>
      {versionNumber == null ? (
        <p className="text-sm text-muted-foreground">Start setup to see how calls will sound.</p>
      ) : agentType === 'sdr_inbound' ? (
        <>
          <ServerPreview agentType={agentType} versionNumber={versionNumber} refreshKey={refreshKey} title="New caller" />
          <ServerPreview agentType={agentType} versionNumber={versionNumber} refreshKey={refreshKey}
            title="Known caller (sample)" sampleLead={KNOWN_CALLER_SAMPLE} />
        </>
      ) : (
        <ServerPreview agentType={agentType} versionNumber={versionNumber} refreshKey={refreshKey} title="Opening line" />
      )}
    </div>
  );
}
