import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import NotificationBell from '@/components/ops/NotificationBell';

// Readable names for the first path segment; anything else is title-cased from the URL.
const SECTION_NAMES = {
  dashboard: 'Dashboard', agents: 'Agents', voice_agent: 'Voice Agent', 'voice-campaigns': 'Campaigns',
  prospects: 'Prospects', prospecting: 'Prospecting', conversion: 'Conversion', inbox: 'Inbox', catalog: 'Product catalog',
  meetings: 'Meetings', reports: 'Reports & Analytics', operations: 'Operations', settings: 'Settings', billing: 'Billing',
  leads: 'Leads', 'call-logs': 'Call logs', 'single-call': 'Single call', hiring_agent: 'Hiring Agent',
  real_estate_agent: 'Real Estate Agent', strategist: 'AI Strategist', 'knowledge-base': 'Knowledge Base',
  'call-quality': 'Call Quality', 'manager-dashboard': 'Team Overview', 'audio-upload': 'Audio Upload',
  'sheets-sync': 'Sheets Sync', 'weight-config': 'Scoring Criteria',
};

// Voice Agent's views are ?tab= values rather than paths.
const VOICE_TABS = {
  builder: 'Lead-to-Campaign Builder', logs: 'Call Logs', create: 'Create Agent', kb: 'Knowledge Base',
  csv: 'CSV Call Campaign', single: 'Single Call', requests: 'Assistant Requests',
};

const titleCase = (segment) => segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function crumbsFor(location) {
  const [section] = location.pathname.split('/').filter(Boolean);
  if (!section) return [];
  const crumbs = [SECTION_NAMES[section] || titleCase(section)];
  if (section === 'voice_agent') {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || (params.get('view') === 'logs' ? 'logs' : 'builder');
    if (VOICE_TABS[tab]) crumbs.push(VOICE_TABS[tab]);
  }
  return crumbs;
}

const normalize = (text) => (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

// A page heading that only repeats the section name already shown in this bar ("Agents" here and "Agents" below)
// is hidden visually. It stays in the DOM for screen readers. Headings that say more, such as a campaign's name, stay visible.
function useHideDuplicateHeading(barRef, crumbs) {
  const key = crumbs.join('|');
  useEffect(() => {
    const content = barRef.current?.parentElement?.querySelector('.page-content');
    if (!content) return undefined;
    const names = key.split('|').map(normalize).filter(Boolean);
    const isDuplicate = (h1) => {
      const text = normalize(h1.textContent);
      return !!text && names.some((name) => text === name || text.includes(name) || name.includes(text));
    };
    const apply = () => {
      content.querySelectorAll('h1').forEach((h1) => {
        if (isDuplicate(h1)) h1.setAttribute('data-duplicate-title', '');
        else h1.removeAttribute('data-duplicate-title');
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(content, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [barRef, key]);
}

/** The thin bar above pages in the sidebar layout: where you are on the left, notifications on the right. */
export default function SidebarTopBar() {
  const location = useLocation();
  const crumbs = crumbsFor(location);
  const barRef = useRef(null);
  useHideDuplicateHeading(barRef, crumbs);
  return (
    <div ref={barRef} className="nvw-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <li key={crumb} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              <span
                aria-current={i === crumbs.length - 1 ? 'page' : undefined}
                className={i === crumbs.length - 1 ? 'truncate font-semibold text-foreground' : 'truncate text-muted-foreground'}
              >
                {crumb}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
      </div>
    </div>
  );
}
