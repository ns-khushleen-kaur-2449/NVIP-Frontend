---
version: 1
slug: "src-pages-public-agentcatalog-jsx"
primary_target: "src/pages/public/AgentCatalog.jsx"
related_targets: ["src/layouts/PublicLayout.jsx"]
---

# Public landing page (agent catalog)

Scope: `/` (src/pages/public/AgentCatalog.jsx) inside the public layout (src/layouts/PublicLayout.jsx). Visitor mode: Persuade.

Audience and job: business buyers (sales, recruitment, support, real estate, MSPs) choosing a voice agent. Action: Book a demo (primary), Get a quote (secondary). Proof: Netsmartz company facts only (since 1999, 2000+ clients, 1500+ people); a sample transcript labelled as a sample. Constraints: agent data from marketplaceApi.listAgents(); one heading per agent name (route test); integrations limited to shipped ones (Zoho CRM, Google Calendar and Outlook via Nylas, Twilio, Vapi, ElevenLabs).

## Direction contract

THESIS: The page shows the voice agent as an object you can picture: a dark glass orb wearing headphones on a lit stand, surrounded by what it does. The catalog follows as the decision.

OWN-WORLD: The user's approved mockup (2026-11-19). Warm cream ground with a peach wash; white cards and chips; Netsmartz orange #FE7725 with navy labels; pill buttons; Inter bold and tight; warm brown-tinted soft shadows. Dark theme follows the SmartSDR site (near-black, orange light, faint grid).

STORY: Meet NVIP, see what it connects to, pick an agent, watch one handle a call, learn your system of record stays yours, see three steps to live, check price and FAQ, book a demo.

FIRST VIEWPORT: Header with nav, theme toggle, Sign in and Book a demo; no logo on `/`. Hero left: large Netsmartz logo, "NVIP" wordmark (N ink, VIP orange), H1 "Meet the AI voice agents that move your business forward.", lede, Book a demo + Explore AI agents, three true proof points. Hero right: the 3D orb on its stand with four capability chips. Integrations strip beneath.

FORM: Mockup-pinned direction; it overrides the roll's assignment. Signature interaction: the demo transcript plays on scroll and fills the captured-fields panel, ending in a booked slot. Card hover keeps the brief-requested orange edge glow. seed:cb0a662c26a73855

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
