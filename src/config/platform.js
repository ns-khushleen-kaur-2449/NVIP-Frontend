/**
 * Platform facts shared by the public pages (landing page, How it works).
 * One copy here so the landing page and /how-it-works never drift apart.
 */

/** The path from first demo to live calls (architecture doc §29). */
export const GO_LIVE_STEPS = [
  { id: 'demo', title: 'Book a demo', body: 'Talk to a sandboxed agent — same voice stack, no writes to real systems.' },
  { id: 'package', title: 'Pick a package', body: 'Order a tier yourself, or accept a custom quote for enterprise volumes.' },
  { id: 'provision', title: 'We provision it', body: 'Your workspace, agent instance and phone number are created automatically.' },
  { id: 'connect', title: 'Connect & configure', body: 'Link your CRM, ATS or calendar with OAuth, then tune prompts and rules.' },
  { id: 'live', title: 'Test, then go live', body: 'Run test calls, pass the acceptance checklist, and approve activation.' },
];

/** The three steps the landing page shows; the full five live on /how-it-works. */
export const GO_LIVE_SHORT = ['demo', 'connect', 'live'].map((id) => GO_LIVE_STEPS.find((s) => s.id === id));

/** The managed voice stack the public site names (landing, How it works, footer). ElevenLabs is not named publicly. */
export const VOICE_STACK = [
  { name: 'Twilio', role: 'Phone numbers, call control and SMS' },
  { name: 'Vapi', role: 'Real-time conversation, speech-to-text, interruptions' },
  { name: 'Nylas', role: 'Calendar booking and email across Google, Outlook, Exchange' },
];

/**
 * The landing page's integrations strip. Only tools the platform actually connects to: the Zoho CRM integration
 * (Settings → Integrations), calendars through Nylas, and the voice stack. No HubSpot or Salesforce until they ship.
 * ElevenLabs is left out on purpose: it is part of the managed voice stack, not something a customer connects.
 */
export const INTEGRATIONS = [
  { id: 'zoho', name: 'Zoho CRM', role: 'Lead and outcome sync' },
  { id: 'google-calendar', name: 'Google Calendar', role: 'Booking via Nylas' },
  { id: 'outlook', name: 'Outlook', role: 'Booking via Nylas' },
  { id: 'twilio', name: 'Twilio', role: 'Numbers and calls' },
  { id: 'vapi', name: 'Vapi', role: 'Voice runtime' },
];

/** Netsmartz company facts approved for the public site (as published on netsmartz.com). */
export const NETSMARTZ_FACTS = [
  { value: '27', label: 'years, since 1999' },
  { value: '2000+', label: 'global clients' },
  { value: '1500+', label: 'people' },
];

export const NETSMARTZ_URL = 'https://www.netsmartz.com/';
