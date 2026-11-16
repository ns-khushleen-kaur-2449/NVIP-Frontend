# NVIP — Netsmartz Voice Intelligence Platform (frontend)

One portal for every NVIP voice agent: AI Receptionist / Router, Outbound Lead Gen,
Inbound Voice SDR, Hiring / Recruitment and Real Estate. All agents run on the same
platform (Twilio · Vapi · ElevenLabs · Nylas); each one is a configuration, not a
separate app. See the NVIP Architecture, SRS & FRS document, §29 for the portal structure.

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

Without a backend it runs on built-in demo data. Open `/signin`, enter any email and
pick a role to preview that role's workspace.

```bash
npm test -- --watchAll=false   # tests
npm run build                  # production build in /build
```

Copy `.env.example` to `.env` to point at a real backend:

| Variable | Meaning |
|---|---|
| `REACT_APP_NVIP_API_URL` | NVIP backend origin; requests go to `<origin>/api/v1/...` |
| `REACT_APP_NVIP_USE_MOCKS` | `false` to call the backend instead of demo data |

## Structure

```
src/
  routes.jsx            all routes: public site, /signin, /app/* workspace
  config/
    agents.js           agent catalog: the one list of agent types, tiers, guardrails
    navigation.js       sidebar per role; also decides route access
    roles.js            platform admin, tenant admin, agent user, reporting
  api/
    client.js           axios client, auth header, mock switch
    services.js         platform endpoints (doc §9), one function each
    mocks.js            demo data
  agents/               per-agent screens — the plug-in point for each agent's backend
    index.js            registry: agent type → extra tabs on the agent page
    <type>/index.jsx    that agent's tabs (Campaigns, Candidates, Listings…)
  lib/                  lifecycle rules (§26), acceptance checklist (§18)
  layouts/              public top-nav layout, workspace sidebar layout
  pages/public/         marketplace, agent detail, pricing, demo/quote, sign-in
  pages/workspace/      dashboard, my agents, agent page, orders, usage, team, integrations
  components/           shared UI primitives
```

### Adding an agent's backend

1. Put the agent's endpoints in `src/agents/<type>/api.js`, using `http` and `call`
   from `src/api/client.js`.
2. Replace the placeholder tabs in `src/agents/<type>/index.jsx` with real screens.
   Each tab receives `{ instance, agent }`.

Routing, navigation and the agent page pick the tabs up automatically.

---

# SmartSDR Frontend

The web app for SmartSDR: leads, AI calling, campaigns, conversion, meetings, reports and
administration. It is a React 19 single-page app that talks to one backend, the SmartSDR API
(`smartsdr-platform`, FastAPI).

## Quick start

You need Node.js 22 (the version Netlify builds with) and the backend running on
`http://localhost:8000`. See the backend README for that.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start                 # http://localhost:3000
```

Sign in with a user from the backend's seed data.

## Configuration

Settings are read at build time from `.env`. Only `REACT_APP_*` variables reach the browser, so never
put secrets in them.

| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | The API origin. Leave empty locally (falls back to `http://localhost:8000`); set per deployment in Netlify. Never commit an ngrok URL. |
| `REACT_APP_USD_INR_RATE` | Optional display rate for prices shown in INR (default 88). Stripe always charges in USD. |
| `BACKEND_URL` | Optional target of the dev-server proxy in `src/setupProxy.js` (default `http://localhost:8000`). |
| `ENABLE_HEALTH_CHECK` | Optional `true` adds the dev-server health endpoints in `plugins/health-check/`. |

`REACT_APP_VOICE_AGENT_URL` and `REACT_APP_REPORT_AGENT_URL` are deprecated: everything is served by the
one backend, and `src/lib/api.js` uses `REACT_APP_BACKEND_URL` first.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server on port 3000 with hot reload. |
| `npm test` | Jest in watch mode. |
| `npm test -- --watchAll=false` | Runs every test once (about 785 tests, under a minute). |
| `npm run build` | Production build in `build/`. |

The scripts run through CRACO (`craco.config.js`), which adds the `@` → `src/` import alias and the
React hooks lint rules. `NODE_OPTIONS` (OpenSSL legacy provider, 4 GB heap) is already set in
`package.json`.

## Project structure

```
src/
├── App.js          routes and role guards
├── pages/          one file per screen (tests sit next to them as *.test.jsx)
├── components/     feature components (leads, conversion, voice, billing, admin, ...) and ui/ primitives
├── lib/            API client (api.js), auth context, role rules (rbac.js), shared helpers
├── hooks/          shared hooks (polling, call logs, API actions, toasts)
└── test/           test helpers and fixtures (renderWithAuth, lead score fixtures)
```

UI building blocks are shadcn/ui components (Radix UI + Tailwind CSS) in `components/ui/`, configured in
`components.json`. Charts use Recharts.

## Main screens

| Area | Routes |
|---|---|
| Leads and prospecting | `/leads` (incl. Archived view), `/prospecting`, `/research`, `/sheets-sync` |
| Calling | `/voice_agent`, `/voice-campaigns`, `/calls`, `/audio-upload`, `/call-quality`, `/agent-performance`, `/agent-runs` |
| Campaigns and inbox | `/campaigns/*`, `/inbox` |
| Conversion | `/conversion` |
| Meetings | `/meetings`, `/settings/calendar` (Nylas calendar connection) |
| Dashboards and reports | `/dashboard`, `/manager-dashboard`, `/reports` |
| Catalog and marketplace | `/catalog`, `/marketplace`, `/projects`, `/properties` |
| Administration | `/settings`, `/settings/users`, `/settings/teams`, `/settings/tenants`, `/billing`, `/weight-config`, `/knowledge-base` |

What each role can see is defined in `src/lib/rbac.js` (it mirrors the backend's
`app/core/permissions.py`). The frontend only hides things; the backend enforces every rule. Lead
visibility, archive/restore and delete follow the backend's lead rules (see its README).

## Analytics

PostHog is loaded in `public/index.html`. Session recordings mask all text and element attributes, and
pages that cannot be masked safely (sign-in, registration, settings, billing, inbox, calls, audio upload,
call quality) are never recorded. Keep that list in step when adding a page that shows personal data.

## Deployment

Netlify builds the site with `netlify.toml` (Node 22, `craco build`, `build/` published, all routes
served by `index.html`). Set `REACT_APP_BACKEND_URL` in Netlify's environment variables for each
deploy context.
