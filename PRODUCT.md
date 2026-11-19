# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Buyers evaluating NVIP** (public site): sales leaders, recruiters and staffing teams, support and front-desk owners, brokerages and property managers, and MSPs. They compare voice agents, check pricing, and book a demo or ask for a quote.
- **Tenant users** (signed-in workspace): tenant admins, managers, reps and reporting users who configure agents, run campaigns, and review calls.
- **Netsmartz platform admins** (Super Admin): manage tenants, the agent catalog, and platform controls.

## Product Purpose

NVIP (Netsmartz Voice Intelligence Platform) is one portal for every Netsmartz voice agent. Each agent is a configuration on the same platform, not a separate app. Success on the public site means a visitor understands which agent fits their business and books a demo or requests a quote.

## Positioning

Every agent runs on one managed voice stack (Twilio, Vapi, ElevenLabs, Nylas), and the customer's own CRM, ATS or property system stays the system of record. Customers get a workspace login, never raw provider credentials. Guardrails are fixed per agent and shown, not hidden.

## Operating Context

- Agents in the catalog (src/config/agents.js): AI Receptionist, Outbound Lead Gen, Inbound Voice SDR (marked most popular), Hiring / Recruitment, Real Estate Agent. Categories: Sales, Recruitment, Support, Real Estate.
- Path to live (src/pages/public/HowItWorks.jsx): book a demo with a sandboxed agent, pick a package, NVIP provisions it, connect and configure (OAuth to CRM/ATS/calendar), test and go live after the acceptance checklist.
- Calendar booking runs through Nylas (Google and Microsoft 365 / Outlook calendars).

## Capabilities and Constraints

- Public routes: `/` (agent catalog), `/marketplace/:slug`, `/pricing`, `/how-it-works`, `/request-demo`, `/request-quote`; sign-in at `/login`.
- Agent data comes from `marketplaceApi.listAgents()`; the catalog config is the single source of truth.
- Prices are placeholders pending commercial sign-off ("From $X/mo" per agent; Starter, Growth, Enterprise tiers).
- Receptionist and Real Estate have no backend agent yet (shown as Coming soon inside the workspace).
- Supported integrations to show publicly: Twilio, Vapi, ElevenLabs, Nylas. Do not list other CRMs or vendors.
- Stack: React 19 (CRA + craco), Tailwind 3, framer-motion, three.js. No React Three Fiber.

## Brand Commitments

- NVIP is a Netsmartz product. The landing hero leads with a large Netsmartz logo above an "NVIP" wordmark, the SmartSDR arrangement (user-confirmed 2026-11-19); the landing header carries no logo. Inner pages and the footer use the Netsmartz │ NVIP lockup. Logo files: `src/assets/netsmartz-27-on-light.png`, `src/assets/netsmartz-27-on-dark.png`.
- The public site follows the user's approved mockup (2026-11-19, replacing the 2026-11-18 white-and-navy direction): warm cream page, white cards, Netsmartz orange `#FE7725`, navy ink, pill buttons, Inter type, a dark glass orb with headphones on a glowing stand. Light and dark themes both stay; dark follows the SmartSDR site.

## Evidence on Hand

- Netsmartz company facts, approved for use on the public site: since 1999 (27 years), 2000+ global clients, 1500+ people (as published on netsmartz.com).
- No customer logos, testimonials, case studies, call metrics or NVIP-specific certifications are approved. Do not invent them. Netsmartz certifications (SOC 2, ISO) were not approved for the NVIP page.
- No real demo call recording yet. Any call example must be labelled as a sample.

## Product Principles

1. One platform, many agents: every agent is a configuration, never a separate product.
2. The customer's system of record stays theirs.
3. Guardrails are visible and fixed, not marketing.
4. Show the agent working rather than claiming outcomes.

## Accessibility & Inclusion

WCAG AA contrast, keyboard navigation with visible focus, and `prefers-reduced-motion` respected across all motion and 3D.
