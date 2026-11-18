// F-02: which open pages need which tenant features, and whether a refreshed /api/auth/me took one away.
// The guards (FeatureRoute, ModeRedirect, AgentConfigPage) still decide on every render; this only says when a page
// that *was* allowed stopped being allowed, so the app can leave it for the dashboard with a notice.

import { featureOn } from '@/lib/rbac';

export const FEATURE_LOSS_HOME = '/dashboard';

// Path prefix → features the page needs (all of them), and where to go when they are lost: `legacyTo` for a NEW MODE
// page with a legacy equivalent (the same target as its ModeRedirect legacyTo in App.js), else FEATURE_LOSS_HOME.
// Keep in step with the guards in App.js (featureLossRoutes.test.js checks both).
export const PAGE_FEATURES = Object.freeze([
  { prefix: '/agents/', features: ['agent_instances'] }, // agent configuration (/agents itself works in both modes)
  { prefix: '/prospects', features: ['agent_instances'], legacyTo: '/prospecting' },
  { prefix: '/call-logs', features: ['agent_instances'], legacyTo: '/voice_agent?tab=logs' },
  { prefix: '/single-call', features: ['agent_instances'], legacyTo: '/voice_agent?tab=single' },
  { prefix: '/voice-campaigns', features: ['voice_agent', 'campaigns'] },
  { prefix: '/catalog', features: ['product_catalog'] },
]);

export const FEATURE_LABELS = Object.freeze({
  agent_instances: 'Agent configuration',
  voice_agent: 'Voice agent',
  campaigns: 'Campaigns',
  product_catalog: 'Catalog',
});

const matches = (pathname, prefix) => (prefix.endsWith('/')
  ? pathname.startsWith(prefix) && pathname.length > prefix.length
  : pathname === prefix || pathname.startsWith(`${prefix}/`));

/** The features the page at `pathname` needs ([] when none). */
export function pageFeatures(pathname = '') {
  return PAGE_FEATURES.filter(({ prefix }) => matches(pathname, prefix)).flatMap(({ features }) => features);
}

/** Where to send a user whose page at `pathname` lost its features: the legacy equivalent, else the dashboard. */
export function featureLossTarget(pathname = '') {
  return PAGE_FEATURES.find(({ prefix, legacyTo }) => legacyTo && matches(pathname, prefix))?.legacyTo
    || FEATURE_LOSS_HOME;
}

/**
 * The features `next` lost that the page at `pathname` needs, when `previous` (the same signed-in user) had them all.
 * [] when nothing changed for this page, on first load (no previous), or when the user changed.
 */
export function lostPageFeatures(pathname, previous, next) {
  if (!previous || !next || previous.id !== next.id) return [];
  const needed = pageFeatures(pathname);
  if (!needed.length || !needed.every((key) => featureOn(previous, key))) return [];
  return needed.filter((key) => !featureOn(next, key));
}

/** "Agent configuration was switched off for your organisation." */
export function featureLossNotice(keys) {
  const names = keys.map((key) => FEATURE_LABELS[key] || key);
  return `${names.join(' and ')} ${names.length > 1 ? 'were' : 'was'} switched off for your organisation.`;
}
