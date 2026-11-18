// F-02: every route App.js guards by a tenant feature is in featureLoss.PAGE_FEATURES (and nothing stale is), so a
// switch turned off while the page is open always leads to the dashboard with a notice.
//   CI=true npx craco test --watchAll=false src/lib/featureLossRoutes.test.js
import fs from 'fs';
import path from 'path';
import * as rbac from '@/lib/rbac';
import { PAGE_FEATURES, pageFeatures } from '@/lib/featureLoss';

const SRC = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(SRC, 'App.js'), 'utf8');

// Routes whose page checks a feature itself (not visible in App.js): path → [file, the check it must contain, features].
const IN_PAGE_GUARDS = {
  '/agents/:agentType': ['pages/agentConfig/AgentConfigPage.jsx', "featureOn(user, 'agent_instances')", ['agent_instances']],
};

/** [path, features] for every <Route> in App.js guarded by FeatureRoute or by ModeRedirect's legacyTo. */
function guardedRoutes() {
  return APP.split('<Route ').slice(1).flatMap((chunk) => {
    const route = chunk.match(/^path="([^"]+)"/);
    if (!route) return [];
    const features = [];
    const gate = chunk.match(/<FeatureRoute\s+features=\{([^}]+)\}/);
    if (gate) {
      const expr = gate[1].trim();
      const keys = expr.startsWith('[') ? JSON.parse(expr.replace(/'/g, '"')) : rbac[expr];
      if (!Array.isArray(keys)) throw new Error(`cannot read the features of ${route[1]}: ${expr}`);
      features.push(...keys);
    }
    // ModeRedirect legacyTo: a NEW MODE page (agent_instances on); legacy users are sent elsewhere.
    if (/<ModeRedirect\s+legacyTo=/.test(chunk)) features.push('agent_instances');
    return features.length ? [[route[1], features]] : [];
  });
}

const sample = (route) => route.replace(/:[A-Za-z]+/g, 'x');

test('App.js has guarded routes to check (the parser still reads it)', () => {
  const paths = guardedRoutes().map(([p]) => p);
  expect(paths).toEqual(expect.arrayContaining(['/catalog', '/voice-campaigns', '/prospects', '/call-logs', '/single-call']));
});

test('every feature-guarded route in App.js is watched for the same features', () => {
  const missing = [...guardedRoutes(), ...Object.entries(IN_PAGE_GUARDS).map(([p, [, , f]]) => [p, f])]
    .filter(([route, features]) => !features.every((key) => pageFeatures(sample(route)).includes(key)))
    .map(([route, features]) => `${route} needs ${features.join(', ')}`);
  expect(missing).toEqual([]);
});

test("a NEW MODE page's legacy target is its ModeRedirect legacyTo in App.js", () => {
  const legacy = Object.fromEntries(APP.split('<Route ').slice(1)
    .map((chunk) => [chunk.match(/^path="([^"]+)"/)?.[1], chunk.match(/<ModeRedirect\s+legacyTo="([^"]+)"/)?.[1]])
    .filter(([route, to]) => route && to));
  expect(Object.keys(legacy).length).toBeGreaterThan(0);
  const declared = Object.fromEntries(PAGE_FEATURES.filter((e) => e.legacyTo).map((e) => [e.prefix, e.legacyTo]));
  expect(declared).toEqual(legacy);
});

test('the in-page guards still exist', () => {
  Object.entries(IN_PAGE_GUARDS).forEach(([route, [file, check]]) => {
    expect(APP).toContain(`path="${route}"`);
    expect(fs.readFileSync(path.join(SRC, file), 'utf8')).toContain(check);
  });
});

test('no watched entry without a guarded route behind it', () => {
  const routes = [...guardedRoutes().map(([p]) => p), ...Object.keys(IN_PAGE_GUARDS)].map(sample);
  const stale = PAGE_FEATURES.filter(({ prefix, features }) => !routes.some(
    (route) => pageFeatures(route).length && features.every((key) => pageFeatures(route).includes(key))
      && (route === prefix || route.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)),
  )).map(({ prefix }) => prefix);
  expect(stale).toEqual([]);
});
