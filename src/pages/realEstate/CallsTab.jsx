import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock } from 'lucide-react';
import RelativeTime from '@/components/ops/RelativeTime';
import StatusBadge from '@/components/ops/StatusBadge';
import { EmptyState, ScrollTable, SkeletonRows } from '@/components/ops/States';
import { CONTROL, ListFooter } from '@/components/hiring/HiringBits';
import { listRealEstateCalls } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PERMISSIONS } from '@/lib/rbac';
import {
  CALL_STATUS, IDLE_REFRESH_MS, MAX_ROWS, PAGE_SIZE, callOutcome, callPath, statusOf,
} from '@/lib/realEstate';
import useHiringData from '../hiring/useHiringData';
import { RealEstateError } from '@/components/realEstate/RealEstateBits';

/** Every call the organisation placed, newest first; refreshed every 30 s. */
export default function CallsTab() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data: calls, error, reload } = useHiringData(
    () => listRealEstateCalls({ q: q.trim() || undefined, status: callStatus || undefined, limit }),
    [q, callStatus, limit], { pollMs: IDLE_REFRESH_MS });
  const filtered = Boolean(q.trim() || callStatus);

  return (
    <section className="space-y-4" aria-label="Calls">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Search
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE_SIZE); }} maxLength={100}
            placeholder="Name or phone" className={`${CONTROL} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Status
          <select value={callStatus} onChange={(e) => { setCallStatus(e.target.value); setLimit(PAGE_SIZE); }}
            className={`${CONTROL} w-44`}>
            <option value="">All statuses</option>
            {Object.entries(CALL_STATUS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {error && <RealEstateError error={error} onRetry={reload} />}
      {!calls ? (!error && <SkeletonRows rows={4} label="Loading calls" />)
        : calls.length === 0 ? (
          <EmptyState title={filtered ? 'No calls match' : 'No calls yet'}
            body={filtered ? 'Try another name, number or status.'
              : can(PERMISSIONS.REAL_ESTATE_CALL) ? 'Use New call to call a lead.' : 'Calls your managers place appear here.'} />
        ) : (
          <>
            <ScrollTable label="Calls">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Site visit</th>
                  <th className="px-4 py-3 font-semibold">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {calls.map((call) => {
                  const state = statusOf(CALL_STATUS, call.status);
                  const outcome = callOutcome(call);
                  return (
                    <tr key={call.id} data-testid={`call-row-${call.id}`}>
                      <td className="px-4 py-3 font-medium">
                        <Link to={callPath(call.id)} className="text-[color:var(--ops-accent-ink)] hover:underline">
                          {call.lead_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 ops-num">{call.phone_number}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge label={state.label} tone={state.tone} />
                          {outcome && <StatusBadge label={outcome.label} tone={outcome.tone} />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {call.site_visit
                          ? <span className="inline-flex items-center gap-1"><CalendarCheck className="h-4 w-4 text-primary" />{call.site_visit.label || 'Booked'}</span>
                          : call.lead_facts?.site_visit_requested
                            ? <span className="inline-flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-4 w-4" />{`Requested${call.lead_facts.site_visit_time ? `: ${call.lead_facts.site_visit_time}` : ''}`}</span>
                            : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground"><RelativeTime iso={call.created_at} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <ListFooter count={calls.length} limit={limit} max={MAX_ROWS} what="calls"
              onMore={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_ROWS))} />
          </>
        )}
    </section>
  );
}
