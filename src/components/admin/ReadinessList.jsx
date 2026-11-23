import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Readiness items from the backend (`onboarding.readiness`): {key, status, severity, message, fix: {path, label, by}}.
 * Missing blocking items first, then missing recommended ones, then what is done; not-applicable items are left out.
 * A fix is a link only when this viewer can open it (`linkable(fix)`); otherwise it names who fixes it.
 */
const ORDER = (item) => (item.status === 'missing' ? (item.severity === 'blocking' ? 0 : 1) : 2);
const BY_LABEL = { tenant_admin: 'Tenant Admin', super_admin: 'Super Admin' };

export function ReadinessBadge({ summary }) {
  if (!summary) return <span className="text-muted-foreground">—</span>;
  if (summary.blocking) {
    return <Badge variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/25">{summary.blocking} blocking</Badge>;
  }
  if (summary.recommended) {
    return <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/25">{summary.recommended} to do</Badge>;
  }
  return <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/25">Ready</Badge>;
}

export default function ReadinessList({ items, linkable = () => false }) {
  const shown = [...(items || [])].filter((item) => item.status !== 'not_applicable').sort((a, b) => ORDER(a) - ORDER(b));
  if (!shown.length) return <p className="text-sm text-muted-foreground">Nothing to check.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="readiness-list">
      {shown.map((item) => {
        const missing = item.status === 'missing';
        const Icon = !missing ? CheckCircle2 : item.severity === 'blocking' ? CircleAlert : CircleDashed;
        const tone = !missing ? 'text-emerald-600' : item.severity === 'blocking' ? 'text-red-600' : 'text-amber-600';
        return (
          <li key={item.key} className="flex items-start gap-3 p-3 text-sm" data-testid={`readiness-${item.key}`}>
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className={missing ? 'font-medium' : 'text-muted-foreground'}>{item.message}</p>
              {missing && item.fix?.label && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.fix.path && linkable(item.fix)
                    ? <Link className="underline" to={item.fix.path}>{item.fix.label}</Link>
                    : item.fix.label}
                  {item.fix.by && <> · {BY_LABEL[item.fix.by] || item.fix.by}</>}
                </p>
              )}
            </div>
            {missing && (
              <Badge variant="outline" className="text-[10px]">{item.severity === 'blocking' ? 'Blocking' : 'Recommended'}</Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
