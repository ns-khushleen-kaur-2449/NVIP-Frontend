import { Badge } from '@/components/ui/badge';
import { agentTypeLabel, callAgentType } from '@/lib/agents';

const STYLE = {
  sdr_outbound: 'bg-sky-500/10 text-sky-600 border-sky-500/25',
  sdr_inbound: 'bg-violet-500/10 text-violet-600 border-violet-500/25',
  hiring: 'bg-teal-500/10 text-teal-600 border-teal-500/25',
};

/** The agent type a call ran as (Outbound SDR / Inbound SDR / Hiring), from lib/agents.js callAgentType. */
export default function AgentTypeBadge({ log, className = '' }) {
  const type = callAgentType(log);
  if (!type) return null;
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${STYLE[type] || ''} ${className}`} data-testid="call-agent-type">
      {agentTypeLabel(type)}
    </Badge>
  );
}

/** "Agent version 3": the agent instance version the call ran with (`agent_version` from the call-log API). */
export function CallAgentVersion({ log }) {
  if (log?.agent_version == null) return null;
  return <span className="text-xs text-muted-foreground" data-testid="call-agent-version">Agent version {log.agent_version}</span>;
}
