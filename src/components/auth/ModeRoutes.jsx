// Routes that depend on the tenant's mode (agent_instances on: NEW MODE). Every redirect keeps the query string, so
// deep links such as /leads?prospect=X land on the same record. Read from the signed-in session only.

import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { featureOn } from '@/lib/rbac';
import VoiceAgentPage from '@/pages/VoiceAgent';

/** `to` with the current query string (and hash) kept; params already in `to` win. */
export function keepQuery(to, location) {
  const [path, query = ''] = to.split('?');
  const params = new URLSearchParams(location.search);
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return `${path}${search ? `?${search}` : ''}${location.hash || ''}`;
}

/** Same page in both modes, or a redirect (query kept) to the other mode's page. */
export function ModeRedirect({ legacyTo, instancesTo, children }) {
  const { user } = useAuth();
  const location = useLocation();
  const to = featureOn(user, 'agent_instances') ? instancesTo : legacyTo;
  return to ? <Navigate to={keepQuery(to, location)} replace /> : children;
}

export function OldCampaignRouteRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  return <Navigate to={keepQuery(featureOn(user, 'agent_instances') ? '/voice-campaigns/new' : '/voice-campaigns', location)} replace />;
}

/**
 * /voice_agent in NEW MODE: its tabs moved to their own pages, except what still has no other home. The Assistant
 * builder stays here while shared assistants are off (it still drives calls) and Assistant requests stay for
 * everyone who could use them. The query (apart from `tab`) is kept.
 */
export function VoiceAgentModeRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  if (!featureOn(user, 'agent_instances')) return <VoiceAgentPage />;
  const tab = params.get('tab');
  const rest = { ...location, search: (() => { const p = new URLSearchParams(location.search); p.delete('tab'); p.delete('view'); return p.toString() ? `?${p}` : ''; })() };
  const go = (to) => <Navigate to={keepQuery(to, rest)} replace />;
  if (tab === 'logs' || params.get('view') === 'logs') return go('/call-logs');
  if (tab === 'builder' || tab === 'csv' || !tab) return go('/voice-campaigns/new');
  if (tab === 'campaigns') return go('/voice-campaigns');
  if (tab === 'single') return go('/single-call');
  if (tab === 'kb') return go('/agents'); // the Knowledge Base is hidden in NEW MODE
  if (tab === 'create') return featureOn(user, 'shared_assistants') ? go('/agents/sdr_outbound') : <VoiceAgentPage />;
  return <VoiceAgentPage />; // requests, and any tab without a new home
}

