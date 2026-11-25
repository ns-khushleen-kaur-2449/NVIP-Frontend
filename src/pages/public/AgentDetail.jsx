import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Phone } from 'lucide-react';
import { AuthContext } from '@/lib/AuthContext';
import { getAgentCatalog } from '@/lib/api';
import { canManageBilling } from '@/lib/rbac';
import { isAvailable } from '../../config/agents';
import { marketplaceApi } from '../../api/services';
import { useNvipQuery } from '../../hooks/useNvipQuery';
import {
  AgentTile, AsyncBoundary, ButtonLink, EmptyState, GuardrailChips, Panel, TextLink,
} from '../../components/primitives';

function ListBlock({ title, items }) {
  return (
    <Panel className="p-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-[var(--nv-muted)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nv-success)]" aria-hidden /> {i}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Where this agent stands for the person reading the page, and the way into the real workspace.
 *   Guest                    -> sign in (the real /login).
 *   No backend agent yet     -> not in the workspace yet (Inbound Voice SDR, held back as Coming soon).
 *   Signed-in tenant user    -> GET /api/v1/agents/catalog says whether their organisation may use it: open the
 *                               Agents page (it shows setup state and opens the agent's screens), or Not in plan.
 * The backend decides; this only reads it. If the catalog can't be read, it still offers the Agents page.
 */
function WorkspaceAccess({ agent }) {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const signedIn = Boolean(user || auth?.token);
  const live = isAvailable(agent);
  const { catalogKey, agentType } = agent.backend;
  // undefined: not asked / loading; null: couldn't tell; true / false: the backend's answer.
  const [usable, setUsable] = useState(undefined);

  useEffect(() => {
    if (!user || !live) return undefined;
    let stopped = false;
    setUsable(undefined);
    getAgentCatalog()
      .then(({ data }) => {
        if (stopped) return;
        const row = (data || []).find((r) => r.key === catalogKey || r.agent_type === agentType);
        setUsable(row ? Boolean(row.usable) : false);
      })
      .catch(() => { if (!stopped) setUsable(null); });
    return () => { stopped = true; };
  }, [user, live, catalogKey, agentType]);

  let body;
  let action = null;
  if (!live) {
    body = `${agent.name} isn't in the NVIP workspace yet. Book a demo and we'll tell you when it's ready.`;
  } else if (!signedIn) {
    body = `Already an NVIP customer? Sign in to set up and run ${agent.name}.`;
    action = <ButtonLink to="/login" variant="secondary">Sign in <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>;
  } else if (usable === undefined && user) {
    body = 'Checking your plan…';
  } else if (usable === false) {
    body = `${agent.name} is not in your organisation's plan.`;
    action = canManageBilling(user)
      ? <ButtonLink to="/billing" variant="secondary">See plans</ButtonLink>
      : <span className="text-sm text-[var(--nv-muted)]">Ask your Tenant Admin about plans.</span>;
  } else {
    body = usable ? `${agent.name} is included in your plan.` : `Open your agents to use ${agent.name}.`;
    action = <ButtonLink to="/agents">Open in your workspace <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>;
  }

  return (
    <Panel className="mt-6 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-testid="workspace-access">
      <div>
        <h2 className="font-semibold">In your workspace</h2>
        <p className="mt-1 text-sm text-[var(--nv-muted)]" role="status">{body}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Panel>
  );
}

/** Agent brochure page (doc §29.2). Sample transcript / live sandbox widget plug in here later. */
export default function AgentDetail() {
  const { slug } = useParams();
  const query = useNvipQuery(() => marketplaceApi.getAgent(slug), [slug]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <TextLink to="/" className="mb-8"><ArrowLeft className="h-4 w-4" aria-hidden /> All agents</TextLink>
      <AsyncBoundary query={query}>
        {(agent) => !agent ? (
          <EmptyState title="Agent not found" action={<ButtonLink to="/">Browse agents</ButtonLink>} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
              <AgentTile agent={agent} solid />
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{agent.name}</h1>
                <p className="mt-2 text-lg text-[var(--nv-muted)]">{agent.summary}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to={`/request-demo?agent=${agent.slug}`}><Phone className="h-4 w-4" aria-hidden /> Book a demo</ButtonLink>
              <ButtonLink to={`/pricing#${agent.slug}`} variant="secondary">See pricing — from ${agent.startingPrice}/mo</ButtonLink>
            </div>

            <WorkspaceAccess agent={agent} />

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <ListBlock title="What it captures" items={agent.captures} />
              <ListBlock title="Tools & integrations" items={agent.tools} />
            </div>

            <Panel className="mt-6 p-6">
              <h2 className="font-semibold">Built-in guardrails</h2>
              <p className="mt-1 mb-4 text-sm text-[var(--nv-muted)]">Enforced by the platform — not left to the agent's judgment.</p>
              <GuardrailChips guardrails={agent.guardrails} />
            </Panel>

            <Panel className="mt-6 p-6 grid gap-4 sm:grid-cols-3 text-sm">
              <div><div className="text-[var(--nv-muted)]">Built for</div><div className="font-semibold mt-1">{agent.primaryUsers}</div></div>
              <div><div className="text-[var(--nv-muted)]">System of record</div><div className="font-semibold mt-1">{agent.systemOfRecord || 'Not required'}</div></div>
              <div><div className="text-[var(--nv-muted)]">Books</div><div className="font-semibold mt-1">{agent.booking}</div></div>
            </Panel>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
