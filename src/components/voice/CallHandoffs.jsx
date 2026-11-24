import { useEffect, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCallHandoffs } from '@/lib/api';

// "Transfer started" is all Vapi tells us: never "connected" (it does not say the person picked up).
export const HANDOFF_STATUS = {
  requested: { label: 'Transfer requested', tone: 'bg-amber-500/10 text-amber-700 border-amber-500/25' },
  transfer_started: { label: 'Transfer started', tone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' },
  refused: { label: 'Not transferred', tone: 'bg-muted text-muted-foreground' },
  callback_created: { label: 'Not transferred · callback task created', tone: 'bg-muted text-muted-foreground' },
};

/** The human handoffs of one call (GET /api/call-logs/{id}/handoffs): status, target, reason and summary. */
export default function CallHandoffs({ callId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!callId) return;
    Promise.resolve().then(() => getCallHandoffs(callId)).then((r) => setRows(r?.data || []))
      .catch(() => setRows([]));
  }, [callId]);
  if (!rows?.length) return null;
  return (
    <section className="rounded-xl border border-border p-4 space-y-3" data-testid="call-handoffs">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><UserRoundCheck className="h-4 w-4" /> Handover to a person</h3>
      {rows.map((row) => {
        const status = HANDOFF_STATUS[row.status] || { label: row.status, tone: '' };
        return (
          <div key={row.id} className="space-y-1 text-sm" data-testid={`handoff-${row.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-[11px] ${status.tone}`}>{status.label}</Badge>
              {row.target_label && (
                <span>{row.target_label}{row.target_number_last4 ? ` (…${row.target_number_last4})` : ''}</span>
              )}
            </div>
            {row.reason && <p className="text-xs text-muted-foreground">Reason: {row.reason}</p>}
            {row.summary && <p className="whitespace-pre-line text-sm">{row.summary}</p>}
          </div>
        );
      })}
    </section>
  );
}
