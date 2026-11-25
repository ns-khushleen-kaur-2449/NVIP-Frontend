---
name: NVIP public site
description: The public NVIP marketplace after the approved mockup. Warm cream page, white cards, Netsmartz orange, navy ink, Inter; a dark theme lit with orange like the SmartSDR site.
colors:
  cream-ground: "#FFF8F3"
  hero-wash: "#FFEFE3"
  white-surface: "#FFFFFF"
  peach-surface: "#FFF2E8"
  warm-hairline: "#F1E1D3"
  ink: "#141A33"
  muted-ink: "#535B70"
  netsmartz-orange: "#FE7725"
  orange-hover: "#FF8A45"
  orange-display-text: "#E4580B"
  orange-ink: "#AD4A0C"
  orange-soft: "#FFEADB"
  on-orange: "#0B1220"
  deep-navy: "#0B1220"
  navy-raised: "#111A2E"
  navy-fg: "#F3F5F9"
  navy-muted: "#A9B3C6"
  dark-ground: "#0B0C11"
  dark-surface: "#13151D"
  dark-surface-2: "#171A23"
  dark-line: "#262A37"
  dark-ink: "#F2F3F7"
  dark-muted: "#A6ABBA"
  dark-band: "#06070B"
typography:
  wordmark:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.5rem, 2rem + 1.6vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.45rem + 1.7vw, 2.9rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 1.7vw, 2.85rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.05rem, 1rem + 0.25vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  button: "9999px"
  chip: "16px"
  card: "22px"
  strip: "24px"
  cta-panel: "28px"
  full: "9999px"
spacing:
  gutter-sm: "16px"
  gutter: "24px"
  card: "28px"
  section: "96px"
  container: "1280px"
components:
  button-primary:
    backgroundColor: "{colors.netsmartz-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.button}"
    height: "40px"
  button-primary-lg:
    backgroundColor: "{colors.netsmartz-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.button}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "40px"
  agent-card:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  agent-icon:
    backgroundColor: "{colors.orange-soft}"
    textColor: "{colors.orange-display-text}"
    rounded: "{rounded.full}"
    size: "64px"
  header:
    backgroundColor: "rgba(255, 248, 243, 0.86)"
    textColor: "{colors.ink}"
    height: "76px"
---

# Design System: NVIP public site

Scope: this document governs the public site only, meaning everything rendered inside the public layout's `.nv-public` scope: `/`, `/marketplace/:slug`, `/pricing`, `/how-it-works`, `/request-demo` and `/request-quote`. The public tokens are scoped overrides of the same `--nv-*` names (src/index.css, "NVIP public site" block), so shared primitives read correctly in both places.

The signed-in workspace (2026-11-25) wears the same NVIP look: its shadcn HSL tokens, `.mk` tokens and `:root` `--nv-*` tokens use this palette (cream / white / navy ink in light, #0B0C11 lit with orange in dark), Inter throughout, pill buttons with navy labels on orange, and the Netsmartz logo with the N·VIP wordmark in the sidebar. Its shell styles (sidebar, top bar, page glow, agent cards) are the `nvw-*` classes in src/index.css, "NVIP signed-in workspace" block. The SmartSDR wordmark remains only as `product="smartsdr"` on BrandLockup.

## Overview

**Creative North Star: "The agent on the stand"**

The look follows the user's approved mockup (2026-11-19). It is a warm cream page with white cards, Netsmartz orange and navy ink. The Netsmartz logo sits at the top-left of the header on every page. The hero opens with the full product name, "Netsmartz Voice Intelligence Platform", with its initials N, V, I and P in orange so they spell NVIP, then the headline, CTAs and three true proof points. On the right, a dark glass voice orb wears headphones and floats over a glowing pedestal, with four capability chips around it. An integrations strip sits under the hero, followed by the centred agent catalog.

The dark theme is the SmartSDR look: a near-black ground, orange light, and a faint grid in the hero. Light is the default theme, and the public site opens light unless the visitor has saved a choice.

**Key Characteristics:**
- Cream ground (#FFF8F3) with a peach wash and an orange glow behind the orb, white cards and warm hairlines.
- Pill buttons with navy text on orange, because white on #FE7725 fails AA.
- Inter only, with semibold display headings (600) and negative tracking; 700 is kept for small titles and the NVIP tag.
- Large orange text uses #E4580B, which passes AA for large text on cream. Body-size orange text uses orange-ink #AD4A0C.
- Navy bands remain for the sample call, the Netsmartz proof band and the footer. The close is an orange panel.

## Colors

### Primary
- **Netsmartz Orange** (`netsmartz-orange`): primary buttons, the active filter pill, the active nav underline, the Most popular badge and border, the orb's ring and stand rim, and caller bubbles in the transcript.
- **Navy on Orange** (`on-orange`): every label on an orange fill.
- **Orange Display Text** (`orange-display-text`): "your business forward." in the H1, icons in the agent circles, filter and proof icons. It becomes #FF8A45 on navy and in dark.
- **Orange Ink** (`orange-ink`): small orange text such as "Explore agent", text links and the focus ring. It becomes #FF9555 on navy and in dark.
- **Orange Soft** (`orange-soft`): the agent icon circles, chip icon squares and the popular card's top wash.

### Neutral
- **Cream Ground**, **White Surface** and **Peach Surface**: the page, then cards, chips, the strip and secondary buttons, then the use-cases section and the custom-agent card.
- **Warm Hairline**: every border and divider.
- **Ink** and **Muted Ink**: headings and body text, then secondary text.
- **Deep Navy**: band grounds (call demo, Netsmartz proof, footer), which re-point the tokens through `.nvp-band`.
- **Dark theme**: a near-black ramp; bands go one step deeper with a 1px border.

### Named Rules
**The Navy Text Rule.** Anything set on an orange fill is navy #0B1220, never white. On the orange CTA panel (`.nvp-cta`), the action colour flips to navy with white text.

**The Band Flip Rule.** Navy bands and the CTA panel re-point the neutral tokens instead of restyling components.

**The True Claims Rule.** The hero proof row, chips and integrations only state what the platform does. The integrations are Zoho CRM, Google Calendar and Outlook (via Nylas), Twilio, Vapi and ElevenLabs. HubSpot and Salesforce are not shown until they ship.

## Typography

Inter throughout. It is a brand commitment, so do not substitute another face.
- **Product name** (`.nvp-fullname`: 800, 25.6px to 38.4px, -0.035em, with a thin orange bar at left): "Netsmartz" in muted ink over "Voice Intelligence Platform" in ink, initials in orange. /login uses the same block, above its own medium-weight headline. The H1 sits 40px to 48px below it, so the two read as separate.
- **Wordmark**: "NVIP" is always one word in one colour (orange), never split as N + VIP.
- **Display** (500, 30px to 43px, 1.14, -0.03em): the hero H1, held to about 19ch. It stays light so the product name above it leads.
- **Headline** (600, 30px to 41.6px): section H2s. The catalog H2 is centred.
- **Title** (700, 1.2rem): card names.
- **Lede** (400, 16.8px to 19.2px, 1.6) in muted ink.

## Layout

The container is 1280px (max-w-7xl) with 16px gutters on mobile and 24px from sm upward. The hero is a 6/6 split at lg: the logo stack on the left, the orb scene (an 11:10 box up to 610px) on the right. The integrations strip spans the container under both. The catalog has a centred heading, then centred wrapping filter pills, then a 1 / 2 / 3 column grid with 24px gaps. Below lg everything stacks in reading order: copy, then the orb.

The header is 76px, sticky and translucent cream with a backdrop blur. The desktop nav shows from xl; below xl there is the theme toggle, Book a demo (from sm) and a menu. Every page, `/` included, shows the Netsmartz | NVIP lockup at the header's left.

## Elevation & Depth

Shadows are soft, offset downward and tinted warm brown (`rgba(120,53,15,…)`).
- **Card rest:** `0 1px 2px rgba(120,53,15,0.05), 0 16px 36px -22px rgba(120,53,15,0.28)`.
- **Card lift:** an orange-tinted drop plus a -6px rise, with the pointer tilt on fine pointers only.
- **Chip:** `0 18px 36px -18px rgba(120,53,15,0.32)`.
- **Primary buttons** carry an orange drop shadow in the header and hero.

## Components

- **Buttons:** fully rounded pills, 40px or 48px tall. Primary is orange with a navy label. Secondary is white with an ink label and a hairline border. "Book a demo" carries a phone icon and "Explore AI agents" a play icon.
- **Filter pills:** a tablist with an icon, label and "(count)" in each pill. The active pill is an orange fill that slides between tabs. Pills wrap instead of scrolling. Arrow, Home and End keys move between tabs.
- **Agent card:** 22px radius, white, hairline border. A 64px orange-soft circle holds the agent icon, with the name and summary beside it. Below are three tools with orange check circles, then a hairline footer with "From $X/mo" and "Explore agent". The Most popular card has an orange border, a peach top wash and a badge straddling its top edge.
- **Custom card:** a dashed orange border on peach.
- **Hero chips:** white, 16px radius, with an orange-soft icon square and a two-line label that drifts slowly.
- **Integrations strip:** a white 24px panel with a short heading at left and six tiles. Each tile shows a logo (Zoho, Twilio) or an icon and name, with its role underneath.
- **Voice orb (signature):** a three.js scene with a smoked-glass sphere, an orange equalizer inside, a metal headband and ear cups with orange rings, a tilted orange orbit with a travelling light, and a two-tier dark stand with an orange rim and rising light. Faint sound-wave bars sit either side. Hovering makes it "talk" and turn toward the pointer. The loop pauses off-screen, and reduced motion gets one still frame. An SVG fallback in the same coordinates draws the scene while it loads or without WebGL.
- **Call demo (signature):** a navy band that plays a labelled sample call and fills a captured-fields panel.
- **Closing CTA:** an orange gradient panel (28px) with a navy primary and a white secondary button.

## Do's and Don'ts

### Do:
- **Do** keep labels on orange in navy.
- **Do** use #E4580B for large orange text, and #AD4A0C or #FF9555 for small orange text.
- **Do** keep the hero order: product name, H1, lede, CTAs, proof.
- **Do** label illustrative calls as samples and keep integrations to shipped ones.
- **Do** honour reduced motion: a still orb, the full transcript, and no drift or tilt.

### Don't:
- **Don't** put white text on #FE7725.
- **Don't** add eyebrow labels above headings, or gradient text.
- **Don't** claim speed or scale ("deploy in minutes", "enterprise ready") the product has not committed to.
- **Don't** reintroduce the SmartSDR wordmark or Manrope/Outfit in the signed-in workspace.
