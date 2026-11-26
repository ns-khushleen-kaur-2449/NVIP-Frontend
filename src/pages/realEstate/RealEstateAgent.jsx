import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { House } from 'lucide-react';
import RequirePermission from '@/components/auth/RequirePermission';
import { EmptyState, SkeletonRows } from '@/components/ops/States';
import { RealEstateError } from '@/components/realEstate/RealEstateBits';
import { listAvailableAgents } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSIONS } from '@/lib/rbac';
import {
  CALLS_PATH, KNOWLEDGE_BASE_PATH, NEW_CALL_PATH, NOT_AVAILABLE, REAL_ESTATE_AGENT_KEY, REAL_ESTATE_PATH,
} from '@/lib/realEstate';
import CallPage from './CallPage';
import CallsTab from './CallsTab';
import KnowledgeBaseTab from './KnowledgeBaseTab';
import NewCallTab from './NewCallTab';

/** Whether the organisation may use Real Estate now; `available` is null while asking. Every route checks too. */
function useRealEstateAvailable() {
  const [state, setState] = useState({ available: null, error: null });
  const check = useCallback(async () => {
    setState({ available: null, error: null });
    try {
      const { data } = await listAvailableAgents();
      setState({ available: (data || []).some((agent) => agent.key === REAL_ESTATE_AGENT_KEY), error: null });
    } catch (error) {
      setState({ available: null, error });
    }
  }, []);
  useEffect(() => { check(); }, [check]);
  return { ...state, retry: check };
}

/**
 * The Real Estate agent's screen: "New call" (name and phone number) for those who may place calls, "Calls" and
 * "Knowledge base" (the organisation's saved one, editable by those who may place calls) for everyone, and one page
 * per call (/real_estate_agent/calls/<id>).
 */
export default function RealEstateAgentPage() {
  const { available, error, retry } = useRealEstateAvailable();
  const { can } = useAuth();
  const { pathname } = useLocation();
  const canCall = can(PERMISSIONS.REAL_ESTATE_CALL);
  const tabs = [
    ...(canCall ? [{ path: NEW_CALL_PATH, label: 'New call' }] : []),
    { path: CALLS_PATH, label: 'Calls' },
    { path: KNOWLEDGE_BASE_PATH, label: 'Knowledge base' },
  ];

  return (
    <div className="ops mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6" data-testid="real-estate-page">
      <header>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <House className="h-6 w-6 text-primary" /> Real Estate
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Call a property lead. The agent talks from your knowledge base and books site visits on your calendar.
        </p>
      </header>

      {error ? <RealEstateError error={error} onRetry={retry} />
        : available === null ? <SkeletonRows rows={3} label="Loading Real Estate" />
        : !available ? (
          <EmptyState title={NOT_AVAILABLE} body="Ask your platform administrator to enable Real Estate for your organisation." />
        ) : (
          <>
            <nav aria-label="Real Estate">
              <ul className="flex gap-1 overflow-x-auto border-b border-border">
                {tabs.map((tab) => {
                  const active = pathname.startsWith(tab.path);
                  return (
                    <li key={tab.path}>
                      <Link to={tab.path} aria-current={active ? 'page' : undefined}
                        className={`-mb-px inline-flex whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? 'border-[var(--ops-accent)] text-[color:var(--ops-accent-ink)]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <Routes>
              {canCall && <Route path="new" element={<NewCallTab />} />}
              <Route path="calls" element={<CallsTab />} />
              <Route path="calls/:callId" element={<CallPage />} />
              <Route path="knowledge-base" element={<KnowledgeBaseTab />} />
              <Route path="*" element={<Navigate to={canCall ? NEW_CALL_PATH : CALLS_PATH} replace />} />
            </Routes>
          </>
        )}
    </div>
  );
}

/** The route element: tenant users with real_estate.view (a Super Admin has none and gets /403). */
export function RealEstateRoute() {
  return <RequirePermission perm={PERMISSIONS.REAL_ESTATE_VIEW}><RealEstateAgentPage /></RequirePermission>;
}

export { REAL_ESTATE_PATH };
