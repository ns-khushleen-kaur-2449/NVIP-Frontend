import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Bot, Loader2, Lock, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { errorText } from '@/components/admin/userBits';
import {
  getAgentCatalog, getAgentInstanceVersion, getBuilderLanguages, listAgentInstances, listAvailableAgentTypes, listAvailableAgents,
  getVoiceCampaigns, listOwnPhoneNumbers,
} from '@/lib/api';
import { accountReadiness } from '@/lib/campaignRefusals';
import { useAuth } from '@/lib/AuthContext';
import { agentConfigRoute, agentRoute, agentTypeLabel, canonicalAgentType, isConfigurableAgentType } from '@/lib/agents';
import {
  INSTANCE_STATES, INSTANCE_STATE_LABELS, activeSummary, instanceState, languageNames,
} from '@/lib/agentInstances';
import { agentInstancesAvailable, CAMPAIGN_FEATURES, canCreateCampaigns, canManageBilling, featureOn, featuresEnabled, isSharedMode } from '@/lib/rbac';
import { formatDateTime, displayTimeZone } from '@/lib/ops';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/setup/SetupUi';

const TYPE_DESCRIPTIONS = {
  sdr_outbound: 'Calls your prospects from campaigns, qualifies interest, books meetings and sends brochures.',
  sdr_inbound: 'Answers calls to your number, qualifies callers and books demos. Reuses your business details and catalog.',
};

/** Today's card: the agent and a link to its screen. */
function LegacyCard({ agent }) {
  const route = agentRoute(agent);
  return (
    <Card className="card-base p-5 flex flex-col gap-3" data-testid={`agent-card-${agent.key}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{agent.name}</h2>
        {agent.industry && <Badge variant="outline" className="text-[11px]">{agent.industry}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground flex-1">{agent.description || 'No description.'}</p>
      {route ? (
        <Button asChild className="bg-primary text-primary-foreground self-start"><Link to={route}>Open</Link></Button>
      ) : (
        <span className="text-xs text-muted-foreground">Coming soon to your workspace</span>
      )}
    </Card>
  );
}

const TYPE_ICONS = { sdr_outbound: PhoneOutgoing, sdr_inbound: PhoneIncoming };
const SETUP_HINTS = {
  sdr_outbound: 'Setup takes about 10 minutes · 8 steps',
  sdr_inbound: 'Setup takes about 5 minutes after Outbound',
};
const STATE_TONES = { not_set_up: 'warn', draft: 'warn', active: 'good', not_in_plan: 'neutral' };

/** One agent type with its configuration state (agent instances). */
function AgentTypeCard({ agentType, name, description, instance, payload, languages, user, primary, phoneNumbers = [] }) {
  const state = instanceState(instance);
  const summary = state === INSTANCE_STATES.ACTIVE ? activeSummary(instance, payload) : null;
  const configure = agentConfigRoute(agentType);
  const campaigns = agentType === 'sdr_outbound' && canCreateCampaigns(user) && featuresEnabled(user, CAMPAIGN_FEATURES);
  const canConfigure = agentInstancesAvailable(user);
  const Icon = TYPE_ICONS[agentType] || Bot;
  const badge = (
    <Pill tone={canConfigure ? STATE_TONES[state] : 'neutral'} data-testid={`agent-state-${agentType}`}>
      {canConfigure ? INSTANCE_STATE_LABELS[state] : 'Managed by your admin'}
    </Pill>
  );
  const cardClass = cn('flex flex-col gap-3 rounded-2xl border bg-card p-6',
    primary && state === INSTANCE_STATES.NOT_SET_UP ? 'border-2 border-primary' : 'border-border');

  if (summary) {
    const voice = payload?.voice?.voice_id;
    return (
      <article className={cardClass} data-testid={`agent-card-${agentType}`}>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
            {(summary.persona || name).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {[summary.persona, languageNames(summary.languages, languages), `v${summary.version}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">
          Last edited {summary.editedAt ? formatDateTime(summary.editedAt, displayTimeZone(user)) : '—'}
          {payload?.persona?.gender || voice ? ` · Voice: ${voice || 'default'}${payload?.persona?.gender ? ` (${payload.persona.gender})` : ''}` : ''}
        </p>
        {agentType === 'sdr_inbound' && <InboundNumberStatus phoneNumbers={phoneNumbers} />}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {canConfigure && <Button asChild variant="outline"><Link to={configure}>Edit configuration</Link></Button>}
          {campaigns && <Button asChild><Link to="/voice-campaigns/new">New campaign</Link></Button>}
        </div>
      </article>
    );
  }

  return (
    <article className={cardClass} data-testid={`agent-card-${agentType}`}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {badge}
      </div>
      <h2 className="text-lg font-semibold">{name}</h2>
      <p className="flex-1 text-sm text-muted-foreground">{description}</p>
      {SETUP_HINTS[agentType] && <p className="text-sm text-muted-foreground">{SETUP_HINTS[agentType]}</p>}
      {agentType === 'sdr_inbound' && <InboundNumberStatus phoneNumbers={phoneNumbers} />}
      {canConfigure ? <Button asChild variant={primary ? 'default' : 'outline'} className="w-full">
        <Link to={configure}>{state === INSTANCE_STATES.DRAFT ? 'Continue setup' : 'Set up agent'}</Link>
      </Button> : <p className="text-sm text-muted-foreground">Your Tenant Admin or Manager manages agent setup.</p>}
    </article>
  );
}

function InboundNumberStatus({ phoneNumbers }) {
  const numbers = phoneNumbers.filter((number) => number.inbound_mode === 'shared');
  return numbers.length ? <p className="text-sm text-muted-foreground">Answers: {numbers.map((number) => number.phone_number || number.label || 'number not synced yet').join(', ')}</p>
    : <p className="text-sm text-muted-foreground">Ask your platform admin to connect a number.</p>;
}

/** Agents the organisation cannot use: one dashed card naming them all. */
export function NotInPlanCard({ names, user, testId = 'agent-card-locked' }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-6" data-testid={testId}>
      <Pill className="self-start">{INSTANCE_STATE_LABELS.not_in_plan}</Pill>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Lock className="h-4 w-4" aria-hidden="true" /> {names.join(' · ')}</h2>
      <p className="flex-1 text-sm text-muted-foreground">More agents run on the same platform. Add them when you need them.</p>
      {canManageBilling(user) ? (
        <Link to="/billing" className="font-semibold text-primary underline underline-offset-2">See plans</Link>
      ) : (
        <p className="text-xs text-muted-foreground">Ask your Tenant Admin about plans.</p>
      )}
    </article>
  );
}

/**
 * The agents the signed-in user's organisation may use. With agent instances on (and a Manager or Tenant Admin),
 * SDR's agent types show their configuration state; otherwise the cards open the agents' screens as before.
 * Nothing here reveals how an agent is set up in Vapi.
 */
export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState(null);
  // null: not loaded / not used; { byType, payloads }: loaded.
  const [instances, setInstances] = useState(null);
  const [languages, setLanguages] = useState([]);
  const configurable = agentInstancesAvailable(user);
  const newMode = featureOn(user, 'agent_instances');
  const [phoneNumbers, setPhoneNumbers] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listAvailableAgents()
      .then((response) => { if (!cancelled) setAgents(response.data); })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorText(e, 'Failed to load agents'));
        setAgents([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!newMode) { setInstances(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        if (!configurable) {
          const [typesRes, catalogRes] = await Promise.all([listAvailableAgentTypes(), getAgentCatalog().catch(() => ({ data: [] }))]);
          if (!cancelled) setInstances({ byType: {}, payloads: {}, types: typesRes.data || [], catalog: catalogRes.data || [] });
          return;
        }
        // The agent types the tenant uses (Inbound SDR included, with `usable`) and the whole catalog (Not in plan).
        const [rowsRes, typesRes, catalogRes] = await Promise.all([
          listAgentInstances(), listAvailableAgentTypes(), getAgentCatalog().catch(() => ({ data: [] })),
        ]);
        const rows = rowsRes.data || [];
        const byType = Object.fromEntries(rows.map((row) => [canonicalAgentType(row.agent_type), row]));
        const active = rows.filter((row) => row.published_version != null);
        const versions = await Promise.allSettled(active.map((row) => getAgentInstanceVersion(row.agent_type, row.published_version)));
        const payloads = Object.fromEntries(active.map((row, i) => [
          canonicalAgentType(row.agent_type), versions[i].status === 'fulfilled' ? versions[i].value.data.payload : null,
        ]));
        if (!cancelled) setInstances({ byType, payloads, types: typesRes.data || [], catalog: catalogRes.data || [] });
      } catch (e) {
        // 403: the feature is off for the organisation after all; keep today's cards.
        if (!cancelled) setInstances({ failed: e?.response?.status || true });
      }
    })();
    getBuilderLanguages().then((r) => { if (!cancelled) setLanguages(r.data || []); }).catch(() => {});
    if (newMode) {
      listOwnPhoneNumbers().then((r) => { if (!cancelled) setPhoneNumbers(r.data || []); }).catch(() => {});
      // Paused campaigns carry the reason calling is blocked (agent_not_ready, no_caller_id, shared_assistants_off).
      Promise.resolve().then(() => getVoiceCampaigns()).then((r) => { if (!cancelled) setCampaigns(r?.data?.campaigns || []); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [configurable, newMode]);

  const useTypes = newMode && Boolean(instances);
  const waiting = !agents || (newMode && !instances);

  const outboundEntry = instances?.types?.find((entry) => (entry.agent_type || canonicalAgentType(entry.key)) === 'sdr_outbound');
  const readiness = useTypes && !instances.failed ? accountReadiness({
    sharedMode: isSharedMode(user),
    outboundUsable: Boolean(outboundEntry?.usable),
    published: configurable ? instances.byType?.sdr_outbound?.published_version != null : null,
    numbers: phoneNumbers,
    platformCallerId: featureOn(user, 'allow_platform_caller_id'),
    campaigns,
    user,
  }) : [];

  const cards = (() => {
    if (newMode && instances?.failed) return [];
    if (!useTypes) return (agents || []).map((agent) => <LegacyCard key={agent.id} agent={agent} />);
    const shown = new Set(instances.types.map((entry) => entry.id));
    const typeOf = (entry) => entry.agent_type || canonicalAgentType(entry.key);
    const list = [];
    const locked = [];
    instances.types.forEach((entry) => {
      const type = typeOf(entry);
      if (!entry.usable) {
        // A type the tenant's pack runs (Inbound SDR) gets its own locked card; others join the group.
        if (isConfigurableAgentType(type)) list.push(<NotInPlanCard key={entry.id} names={[agentTypeLabel(type)]} user={user} testId={`agent-card-${type}`} />);
        else locked.push(entry.name);
      } else if (!isConfigurableAgentType(type)) {
        list.push(<LegacyCard key={entry.id} agent={entry} />);
      } else {
        list.push(
          <AgentTypeCard key={entry.id} agentType={type} name={agentTypeLabel(type)} primary={type === 'sdr_outbound'}
            description={TYPE_DESCRIPTIONS[type] || entry.description}
            instance={instances.byType[type]} payload={instances.payloads[type]} languages={languages} user={user} phoneNumbers={phoneNumbers || []} />,
        );
      }
    });
    instances.catalog.filter((entry) => !entry.usable && !shown.has(entry.id)).forEach((entry) => locked.push(entry.name));
    if (locked.length) list.push(<NotInPlanCard key="locked" names={locked} user={user} />);
    return list;
  })();

  return (
    <div className="ops max-w-6xl mx-auto space-y-6" data-testid="agents-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Agents</h1>
        <p className="mt-1 text-muted-foreground">
          {useTypes ? 'Set an agent up once. Campaigns and phone numbers then use it.' : 'The AI agents available to your organisation.'}
        </p>
      </div>
      {useTypes && <h2 className="text-lg font-semibold">Your agents</h2>}
      {useTypes && !instances.failed && readiness.length > 0 && (
        <div role="status" className="ops-tone ops-tone-warn space-y-1 rounded-xl px-4 py-3 text-sm" data-testid="calling-readiness">
          {readiness.map((issue) => (
            <p key={issue.code}>
              <span className="font-semibold">{issue.title}.</span>{' '}
              {issue.fix?.to ? <Link className="underline" to={issue.fix.to}>{issue.fix.label}</Link> : issue.fix?.label}
            </p>
          ))}
        </div>
      )}

      {waiting ? (
        <div className="flex justify-center py-10" aria-busy="true"><Loader2 className="w-5 h-5 animate-spin text-primary" aria-label="Loading agents" /></div>
      ) : instances?.failed ? (
        <Card className="card-base p-8 text-center text-sm text-muted-foreground" role="alert">Agent setup couldn't be loaded. Refresh the page to try again.</Card>
      ) : cards.length === 0 ? (
        <Card className="card-base p-8 text-center text-sm text-muted-foreground">
          No agents are available to your organisation yet. Ask your platform administrator to enable one.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </div>
  );
}
