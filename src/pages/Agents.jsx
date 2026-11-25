import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Bot, Check, Loader2, Lock, ShoppingCart, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { AGENTS as NVIP_AGENTS, getAgentByBackendKey, runsOnBackend } from '@/config/agents';

const TYPE_DESCRIPTIONS = {
  sdr_outbound: 'Calls your prospects from campaigns, qualifies interest, books meetings and sends brochures.',
  sdr_inbound: 'Answers calls to your number, qualifies callers and books demos. Reuses your business details and catalog.',
};

/** The NVIP catalog icon of a backend agent (config/agents.js: `sdr` -> Outbound Lead Gen, ...); else a robot. */
function AgentIcon({ agentKey, icon, muted = false }) {
  const Icon = icon || getAgentByBackendKey(agentKey)?.icon || Bot;
  return (
    <span aria-hidden="true" className={cn('nvw-agent-icon h-14 w-14 shrink-0', muted && 'opacity-80')}>
      <Icon className="h-6 w-6" />
    </span>
  );
}

/** Up to three of the agent's tools, with orange check circles (as on the public agent cards). */
function ToolList({ tools }) {
  if (!tools?.length) return null;
  return (
    <ul className="space-y-2 text-sm">
      {tools.slice(0, 3).map((tool) => (
        <li key={tool} className="flex items-center gap-2.5 text-foreground/85">
          <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[var(--nvw-orange-text)]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          {tool}
        </li>
      ))}
    </ul>
  );
}

/** The action of an agent the organisation hasn't bought: Purchase (billing) for those who manage billing. */
function PurchaseAction({ agent, user }) {
  if (!canManageBilling(user)) {
    return <span className="text-xs text-muted-foreground">Ask your Tenant Admin to purchase</span>;
  }
  return (
    <Button asChild className="group/btn px-5">
      <Link to="/billing" data-testid={`agent-purchase-${agent.key}`}>
        <ShoppingCart aria-hidden="true" />Purchase<span className="sr-only"> {agent.name}</span>
      </Link>
    </Button>
  );
}

/** Today's card: the agent and a link to its screen, or (`locked`: not in the plan) a Purchase button. */
function LegacyCard({ agent, locked = false, user }) {
  const route = locked ? null : agentRoute(agent);
  const nvip = getAgentByBackendKey(agent.key);
  return (
    <article className="nvw-agent-card flex flex-col gap-5 p-6" data-featured={route ? 'true' : undefined}
      data-locked={locked ? 'true' : undefined} data-testid={`agent-card-${agent.key}`}>
      <div className="relative flex items-start gap-4">
        <AgentIcon agentKey={agent.key} />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[1.2rem] font-bold tracking-[-0.02em]">{agent.name}</h2>
            {agent.industry && (
              <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[var(--nvw-orange-ink)]">
                {agent.industry}
              </span>
            )}
          </div>
          {route && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
              Available in your workspace
            </p>
          )}
          {locked && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Not in your plan
            </p>
          )}
        </div>
      </div>
      <p className="relative text-sm leading-relaxed text-muted-foreground">
        {agent.description || nvip?.summary || 'No description.'}
      </p>
      <ToolList tools={nvip?.tools} />
      <div className="relative mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        {locked ? (
          <PurchaseAction agent={agent} user={user} />
        ) : route ? (
          <Button asChild className="group/btn px-5"><Link to={route}>Open<ArrowRight className="transition-transform duration-200 group-hover/btn:translate-x-0.5" aria-hidden="true" /></Link></Button>
        ) : (
          <span className="text-xs text-muted-foreground">Coming soon to your workspace</span>
        )}
        {nvip?.slug && (
          <Link to={`/marketplace/${nvip.slug}`} className="nvw-link text-sm">
            Details<span className="sr-only"> about {agent.name}</span>
          </Link>
        )}
      </div>
    </article>
  );
}

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
  const badge = (
    <Pill tone={canConfigure ? STATE_TONES[state] : 'neutral'} data-testid={`agent-state-${agentType}`}>
      {canConfigure ? INSTANCE_STATE_LABELS[state] : 'Managed by your admin'}
    </Pill>
  );
  const cardClass = 'nvw-agent-card flex flex-col gap-4 p-6';
  const featured = primary && state === INSTANCE_STATES.NOT_SET_UP ? 'true' : undefined;

  if (summary) {
    const voice = payload?.voice?.voice_id;
    return (
      <article className={cardClass} data-featured="true" data-testid={`agent-card-${agentType}`}>
        <div className="relative flex items-start gap-4">
          <span aria-hidden="true" className="nvw-agent-icon h-14 w-14 shrink-0 text-lg font-bold">
            {(summary.persona || name).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-[1.2rem] font-bold tracking-[-0.02em]">{name}</h2>
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
        <div className="relative mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
          {canConfigure && <Button asChild variant="outline"><Link to={configure}>Edit configuration</Link></Button>}
          {campaigns && <Button asChild><Link to="/voice-campaigns/new">New campaign</Link></Button>}
        </div>
      </article>
    );
  }

  return (
    <article className={cardClass} data-featured={featured} data-testid={`agent-card-${agentType}`}>
      <div className="relative flex items-start justify-between gap-2">
        <AgentIcon agentKey={agentType} />
        {badge}
      </div>
      <h2 className="text-[1.2rem] font-bold tracking-[-0.02em]">{name}</h2>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
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

/**
 * An NVIP catalog agent with no backend agent type yet (none today): shown so the workspace lists the
 * whole lineup, never as something to open. "View details" opens its public brochure (/marketplace/:slug).
 */
function ComingSoonCard({ agent }) {
  const Icon = agent.icon;
  return (
    <article className="nvw-agent-card flex flex-col gap-4 p-6" data-muted="true" data-testid={`agent-card-nvip-${agent.type}`}>
      <div className="relative flex items-start justify-between gap-2">
        <AgentIcon icon={Icon} muted />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3 w-3 text-[var(--nvw-orange-text)]" aria-hidden="true" />
          Coming soon
        </span>
      </div>
      <h2 className="text-[1.2rem] font-bold tracking-[-0.02em]">{agent.name}</h2>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{agent.summary}</p>
      <Link to={`/marketplace/${agent.slug}`} className="nvw-link group/link inline-flex items-center gap-1.5 self-start text-sm">
        View details<span className="sr-only"> about {agent.name}</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/link:translate-x-0.5" aria-hidden="true" />
      </Link>
    </article>
  );
}

/** Agents the organisation cannot use: one dashed card naming them all. */
export function NotInPlanCard({ names, user, testId = 'agent-card-locked' }) {
  return (
    <article className="nvw-agent-card flex flex-col gap-3 p-6" data-muted="true" data-testid={testId}>
      <Pill className="self-start">{INSTANCE_STATE_LABELS.not_in_plan}</Pill>
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Lock className="h-4 w-4" aria-hidden="true" /> {names.join(' · ')}</h2>
      <p className="flex-1 text-sm text-muted-foreground">More agents run on the same platform. Add them when you need them.</p>
      {canManageBilling(user) ? (
        <Link to="/billing" className="nvw-link self-start">See plans</Link>
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
  // Every published agent with `usable` (legacy view): the ones not bought get a Purchase card.
  const [catalog, setCatalog] = useState([]);
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
    // Tenant users only (403 for a Super Admin): a failure just leaves the purchasable agents out.
    if (!newMode) {
      Promise.resolve().then(() => getAgentCatalog())
        .then((response) => { if (!cancelled) setCatalog(response?.data || []); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [newMode]);

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
    if (!useTypes) {
      const owned = new Set((agents || []).map((agent) => agent.id));
      const purchasable = catalog.filter((entry) => !entry.usable && entry.has_screen !== false && !owned.has(entry.id));
      return [
        ...(agents || []).map((agent) => <LegacyCard key={agent.id} agent={agent} user={user} />),
        ...purchasable.map((agent) => <LegacyCard key={agent.id} agent={agent} locked user={user} />),
      ];
    }
    const shown = new Set(instances.types.map((entry) => entry.id));
    const typeOf = (entry) => entry.agent_type || canonicalAgentType(entry.key);
    const list = [];
    const locked = [];
    instances.types.forEach((entry) => {
      const type = typeOf(entry);
      if (!entry.usable) {
        // A type the tenant's pack runs (Inbound SDR) gets its own locked card; others join the group.
        if (isConfigurableAgentType(type)) list.push(<NotInPlanCard key={entry.id} names={[agentTypeLabel(type)]} user={user} testId={`agent-card-${type}`} />);
        else locked.push(entry);
      } else if (!isConfigurableAgentType(type)) {
        list.push(<LegacyCard key={entry.id} agent={entry} user={user} />);
      } else {
        list.push(
          <AgentTypeCard key={entry.id} agentType={type} name={agentTypeLabel(type)} primary={type === 'sdr_outbound'}
            description={TYPE_DESCRIPTIONS[type] || entry.description}
            instance={instances.byType[type]} payload={instances.payloads[type]} languages={languages} user={user} phoneNumbers={phoneNumbers || []} />,
        );
      }
    });
    instances.catalog.filter((entry) => !entry.usable && !shown.has(entry.id)).forEach((entry) => locked.push(entry));
    // Each agent not bought gets its own card with a Purchase button.
    locked.forEach((entry) => list.push(<LegacyCard key={entry.id} agent={entry} locked user={user} />));
    return list;
  })();

  // NVIP catalog agents the backend has no agent for, and that no backend list above mentions (by key or type).
  const backendKeys = new Set([
    ...[...(agents || []), ...catalog].map((a) => a.key),
    ...[...(instances?.types || []), ...(instances?.catalog || [])].flatMap((e) => [e.key, e.agent_type]),
  ].filter(Boolean));
  const comingSoon = waiting || instances?.failed ? [] : NVIP_AGENTS.filter(
    (agent) => !runsOnBackend(agent) && !backendKeys.has(agent.backend.catalogKey),
  );

  return (
    <div className="ops max-w-6xl mx-auto space-y-8 pt-2" data-testid="agents-page">
      <header>
        <h1 className="nvw-h1">Agents</h1>
        <p className="mt-2 max-w-xl text-[1.02rem] leading-relaxed text-muted-foreground">
          {useTypes ? 'Set an agent up once. Campaigns and phone numbers then use it.' : 'The AI agents available to your organisation.'}
        </p>
      </header>
      {useTypes && <h2 className="text-xl font-bold tracking-[-0.02em]">Your agents</h2>}
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}

      {comingSoon.length > 0 && (
        <section className="space-y-4 pt-2" aria-labelledby="nvip-more-agents" data-testid="nvip-coming-soon">
          <h2 id="nvip-more-agents" className="text-xl font-bold tracking-[-0.02em]">More NVIP agents</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoon.map((agent) => <ComingSoonCard key={agent.type} agent={agent} />)}
          </div>
        </section>
      )}
    </div>
  );
}
