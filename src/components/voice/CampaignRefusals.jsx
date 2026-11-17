import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { campaignRefusals } from '@/lib/campaignRefusals';
import { plural } from '@/lib/ops';

/** Pause and skip reasons a person can fix, with the server's detail and where to fix it. */
export default function CampaignRefusals({ campaign, contacts, user }) {
  const refusals = campaignRefusals(campaign, contacts, user);
  if (!refusals.length) return null;
  return (
    <div className="space-y-2" data-testid="campaign-refusals">
      {refusals.map((r) => (
        <div key={r.code} role="alert" className="ops-tone ops-tone-bad flex flex-wrap items-start gap-3 rounded-[14px] px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {r.title}{r.count ? ` (${plural(r.count, 'lead')})` : ''}{r.detail ? ':' : ''}
            </p>
            {r.detail && <p className="mt-0.5 break-words">{r.detail}</p>}
          </div>
          {r.fix?.to ? (
            <Link to={r.fix.to} className="font-semibold underline underline-offset-2">{r.fix.label}</Link>
          ) : (
            <span className="text-xs">{r.fix?.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
