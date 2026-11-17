# NVIP frontend plan: agent types, agent instances, campaign brief, shared assistants

**Date:** 17 November 2026 · **Backend:** `nvip/sdr-transformation` (Phases 1–10 done, head `f4b8d2e6a913`)
**Frontend branch:** `feature/nvip-rebase` (clean at start; no merge or rebase in progress).

What this covers: the frontend side of the backend's SDR transformation. Agent types (`sdr_outbound`, `sdr_inbound`,
`hiring`), agent instances with versions, the campaign brief, the Super Admin pieces (catalog follows, feature
switches, shared-assistant templates, number inbound mode). Every shape below was read from the backend source, not
guessed. Where the UI needs something the backend does not have, it is in the gap list (§3), with what the UI does
until it exists. No backend response is mocked as if it were real.

---

## 1. What was read

Frontend: `App.js` (routing, `SidebarShell` / `AppShell`), `lib/agents.js`, `lib/api.js`, `lib/rbac.js`
(`featureEnabled` reads `/api/auth/me` → `features`), `components/auth/FeatureRoute.jsx`, `pages/Agents.jsx`,
`pages/VoiceAgent.js` (Assistant builder tab, lead-to-campaign builder), `components/voice/LeadCampaignBuilder.js`,
`CampaignLaunchDialog.js`, `CampaignPitchCard.jsx`, `CampaignOfferFields.jsx`, `VoiceCampaignDetail.js`,
`lib/campaignView.js`, `lib/campaignOffer.js`, `CallLogsList.js`, `CallLogDetail.js`, `pages/admin/AgentsAdmin.jsx`,
`pages/admin/Tenants.jsx` (phone-number dialog), `components/admin/TenantSettingsDialog.jsx` (feature switches),
`components/admin/SharedAssistantVersionsDialog.jsx`, `components/ops/States.jsx`, `hooks/useApiAction.js`.

Backend: `docs/nvip-sdr-transformation.md`, `docs/agents/*.md`, `app/api/v1/endpoints/{agent_instances,agents,
tenants,admin_platform,call_logs,voice_campaigns,catalog,assistant_builder}.py`,
`app/schemas/requests/{agent_instances,agents,tenants,voice_campaigns,campaign_pitch}.py`,
`app/schemas/responses/{agents,tenants,voice_campaigns}.py`, `app/features/agent_instances/{schema,service}.py`,
`app/features/tenants/phone_numbers.py`, `app/features/call_logs/service.py::serialize`, `app/core/features.py`,
`app/core/auth.py::refuse_switched_off_feature`, `app/core/statuses.py`, `app/features/calls/dialer.py`,
`app/features/voice_campaigns/failures.py`, `app/features/voice/metrics.py` (problem labels),
`app/features/assistants/access.py` (assistant roles).

Facts that shape the UI:

* `/api/auth/me` returns `features: {key: bool}` for **every** key in `core.features.FEATURES`, with
  `OFF_BY_DEFAULT` (`agent_instances`, `shared_assistants`, `allow_platform_caller_id`) already resolved. The
  frontend's `featureEnabled` treats a missing key as on; for the off-by-default keys the UI uses a strict
  `=== true` check (`featureOn`), so a cached user from before the field never shows the new UI.
* A switched-off feature answers **403** `"This feature is switched off for your organisation"` on every route under
  its prefix (`/api/v1/agent-instances` → `agent_instances`).
* `/api/v1/agents/available` **leaves out** agent types without a screen (`settings.screen = null`), which is
  `sdr_inbound`. So the tenant Agents page never learns about Inbound SDR from the catalog.
* Agent-instance roles are the assistant roles: **Tenant Admin and Manager** for view, draft, publish, force, rebase
  and restore. Rep and Super Admin get 403.
* `POST /api/campaigns` (`CampaignCreateRequest`, `extra="forbid"`) has **no** `brief`, `goal`, `priority` or
  `agent_instance_version_id`. The backend reads the brief from the old `pitch` columns when the new ones are empty
  (`agent_instances.service.resolve_campaign_brief`, mapping in `legacy.brief_from_pitch`), so the UI writes the brief
  through `pitch` + `announce_to_leads` + `offer_valid_until` today.
* `GET /api/call-logs` (`call_logs.service.serialize`) returns `direction` but **not** `agent_type` or
  `agent_version_id`, and has no agent-type filter. It lists only SDR's two types.
* Tenant phone numbers are Super Admin only; their response has no inbound mode.

---

## 2. Endpoint inventory (what the UI uses)

Roles: **SA** Super Admin, **TA** Tenant Admin, **M** Manager, **R** Rep. "Flag": the tenant feature that gates the
route (403 when off).

### Agent catalog and instances

| Method | Path | Roles | Flag | Request → response fields used |
|---|---|---|---|---|
| GET | `/api/v1/agents/available` | TA M R | – | → `[{id, key, name, industry, description}]` (no `sdr_inbound`) |
| GET | `/api/v1/agent-instances` | TA M | `agent_instances` | → `[{id, agent_type, status, current_version, published_version, published_version_id, draft_version, created_at, updated_at}]` |
| GET | `/api/v1/agent-instances/{agent_type}` | TA M | `agent_instances` | → instance + `versions: [{id, version, status, restored_from_version, base_version, created_by, created_at, published_by, published_at, source}]` (newest first); 404 "This tenant has no instance of that agent type" |
| GET | `/api/v1/agent-instances/{agent_type}/versions/{n}` | TA M | `agent_instances` | → version summary + `payload` |
| POST | `/api/v1/agent-instances/{agent_type}/drafts` | TA M | `agent_instances` | `{payload?, from_version?}` → version (201). 409 open draft exists; 403 "Your tenant may not use this agent type"; 422 validation |
| PUT | `/api/v1/agent-instances/{agent_type}/drafts/{n}` | TA M | `agent_instances` | `{payload}` → version. 422 `detail: [{loc, msg, type}]` |
| DELETE | `/api/v1/agent-instances/{agent_type}/drafts/{n}` | TA M | `agent_instances` | 204 |
| POST | `/api/v1/agent-instances/{agent_type}/versions/{n}/publish?force=` | TA M | `agent_instances` | → version. 409 `detail: {code: "stale_draft", base_version, published_version, message}` |
| POST | `/api/v1/agent-instances/{agent_type}/drafts/{n}/rebase` | TA M | `agent_instances` | → `{draft, replaced_version, previous_payload}` (201) |
| POST | `/api/v1/agent-instances/{agent_type}/versions/{n}/restore` | TA M | `agent_instances` | → new draft (201); 409 if a draft is open |

`agent_type` accepts `sdr` for `sdr_outbound`. Payload (`InstancePayload`, unknown keys kept): `persona{name, gender}`,
`voice{provider, voice_id, model, speed, stack}`, `languages{primary, supported[]}`, `tone`, `goal`,
`sales_approach`, `conversation_length`, `target_customer`, `opener{first_message, mode, salutation_style,
mentions_reason, default_call_reason}`, `qualification_questions[]`, `dispositions`, `extraction_fields`,
`calendar{booking_enabled, meeting_types[]}`, `guardrails{}`, `call_behaviour{}`, `calling{window{days, start_time,
end_time}, max_attempts_per_lead, retry_no_answer_minutes, retry_busy_minutes, retry_failed_minutes, retry_on[]}`,
`inbound{business_hours, after_hours_instruction, non_sales_instruction, overflow{mode, message, transfer_number},
known_caller_greeting, new_caller_greeting, featured_product_ids[]}`.

### Supporting tenant routes

| Method | Path | Roles | Flag | Used for |
|---|---|---|---|---|
| GET | `/api/auth/me` | all | – | `features` (flags), role, tenant |
| GET | `/api/v1/assistant-builder/configs` | TA M | `voice_agent` | Business details, read-only: `latest.payload.business{company, description, vertical, locations}` |
| GET | `/api/v1/assistant-builder/languages` | TA M R | `voice_agent` | Language options `[{code, english_name, native_name, ...}]` |
| GET | `/api/v1/catalog/items` | TA M R | `product_catalog` | Featured products `{items: [{id, name, category}]}` (active only) |
| GET | `/api/v1/prospects?leads_only=true&include=score_summary` | TA M R | – | Campaign step 1 leads (existing builder) |
| GET | `/api/v1/assistants` | TA M | `voice_agent` | Campaign assistant choice (required by `POST /api/campaigns`) |
| POST | `/api/campaigns` | TA M R | `campaigns` | `{name, description, assistant_id, timezone, calling_window, calling_config, pitch, announce_to_leads, offer_valid_until, start, scheduled_at, prospect_ids \| contacts}` |
| POST | `/api/campaigns/offer-preview` | TA M R | `campaigns` | What the agent will tell leads about the offer (existing) |
| POST | `/api/campaigns/schedule-check` | TA M R | `campaigns` | Calling-hours warnings, retry defaults (existing) |
| GET | `/api/campaigns/{id}` | TA M R | `campaigns` | `pause_reason_code`, `paused_by_kind`, `last_transition.reason_text`, `pitch`, `announce_to_leads`, `offer_valid_until` |
| GET | `/api/campaigns/{id}/contacts` | TA M R | `campaigns` | `skip_reason` (`missing_call_details`), `last_error` |
| GET | `/api/call-logs`, `/api/call-logs/{id}` | TA M R | – | `direction` (agent type fallback) |

### Super Admin routes

| Method | Path | Used for |
|---|---|---|
| GET | `/api/v1/agents` | Catalog rows incl. `follows` (`"sdr"` on Inbound SDR while it follows) and `settings` |
| PUT | `/api/v1/agents/{id}/access` | `{access_scope, tenant_ids}`. On `sdr_inbound` it **detaches** it (removes `follows`) |
| PATCH | `/api/v1/agents/{id}` | `{settings: {..., follows: "sdr"}}` re-attaches and copies SDR's scope, grants and status (422 if invalid) |
| POST | `/api/v1/agents/{id}/assistants/{row}/versions/from-template` | Draft from the agent type's pack template (201) → then the existing check / publish |
| GET | `/api/admin/tenants/{id}/settings` | `features: [{key, label, enabled}]` (all keys, incl. `agent_instances`, `shared_assistants`) |
| PUT | `/api/admin/tenants/{id}/features` | `{key, enabled, reason}` (stores `true` while on for off-by-default keys) |
| GET/POST/DELETE | `/api/admin/tenants/{id}/phone-numbers[/{n}]` | List / add (409 cooldown message with the time it can be assigned again) / remove |
| POST | `/api/admin/tenants/{id}/phone-numbers/{n}/inbound-mode` | `{mode: "shared"\|"fixed", vapi_assistant_id?, reason (≥3)}` → `{id, vapi_phone_number_id, mode, ...}`; 409 "Switch shared_assistants on for this tenant first", 409 server-URL message, 422 "Name one of this tenant's own assistants" |

---

## 3. API gap list

### Status (17 November 2026, after backend group 1: backend `docs/nvip-sdr-transformation.md` §12)

| Gap | Status | Frontend now |
|---|---|---|
| G1, G2 | **Done** | Agents page (agent-instances mode) from `/api/v1/agents/available?include=agent_types` and `/api/v1/agents/catalog`; Not in plan cards for `usable: false`. The 403-on-draft fallback stays on the configuration page. |
| G3 | **Done** | Step 1 edits `/api/v1/business-profile` (Tenant Admin saves, Manager reads), shows `updated_by_name` / `updated_at`. |
| G4 | **Done** | Step 1 lists `/api/v1/phone-numbers`; a NULL E.164 shows "number not synced yet". |
| G8, G9 | **Done** | Campaign builder sends `goal` (all four), `priority`, `brief`; `qualification_overrides` is the ordered list (Edited / Added markers against the agent defaults, client-side); a disabled offer keeps its text. Campaign detail shows the brief with "from old pitch" per `brief_sources`. |
| G13 | **Done** | Call-log agent-type filter (`?agent_type=`); version number from `agent_version`. |
| G14 | **Done** | Version history shows `created_by_name` / `published_by_name`. |
| G15 | **Done** | Super Admin number list shows the stored `inbound_mode`, assistant and E.164 (or "number not synced yet"); reloads after a switch. |
| G6, G7, G10, G11, G12 | Open: backend group 2 | Unchanged interim behaviour (no test call; client-side preview; client-side limit check; no lead warnings or capacity). |
| G5, G16, G17 | Open: backend group 3 | Unchanged interim behaviour. |

The rows below are the original gap descriptions.

Each gap: what the UI needs → proposed endpoint → what the UI does until it exists.

| # | UI need | Proposed endpoint | Until then |
|---|---|---|---|
| G1 | Agents page must know about **Inbound SDR** and whether the tenant may use it (`/available` drops types with `screen: null`). | `GET /api/v1/agents/available?include=agent_types` → also `[{key: "sdr_inbound", name, usable: true, follows: "sdr"}]`, or a separate `GET /api/v1/agent-types/usable` → `[{key, name, direction, usable}]`. | Inbound SDR card is shown when Outbound SDR is available (it follows SDR by default). If creating its draft answers 403 "may not use", the card turns **Not in plan**. |
| G2 | "Not in plan" locked cards for catalog agents the tenant cannot use. | `GET /api/v1/agents/catalog` (tenant view) → `[{key, name, description, usable, plan_hint}]`. | Only G1's Inbound SDR case can show Not in plan; no other locked cards. |
| G3 | **Business profile** read and write for tenants (company name, description, industry, location, website, business hours, brochure). The backend has `tenants.business_profile` but no route. | `GET /api/v1/business-profile` → `BusinessProfile`; `PUT /api/v1/business-profile` `{company_name, company_description(≤300), industry, location, locations[], website, business_hours{days,start_time,end_time}, brochure}` (TA, M read). | Step 1 is **read-only**, filled from the published Assistant builder config's `business` block (the backend copies the profile from it on each builder publish), labelled as such, with a link to the Assistant builder. Website, business hours and brochure: "Not available yet". |
| G4 | **Caller ID** numbers for the tenant (read-only list). Numbers are Super Admin only. | `GET /api/v1/phone-numbers` → `[{id, label, e164?, inbound_mode}]` (TA M). | "Your platform administrator assigns caller ID numbers" note; no list. |
| G5 | **Voices** with sample URLs. | `GET /api/v1/agent-instances/voices?language=` → `[{provider, voice_id, name, gender, sample_url}]`. | Voice shown read-only (provider / voice id from the payload, else "the shared assistant's default voice"). Kept in the payload untouched. |
| G6 | **Test call** ("Call me") from agent review and campaign review. | `POST /api/v1/agent-instances/{type}/versions/{n}/test-call` `{phone_number}` and `POST /api/campaigns/test-call` `{brief, goal, prospect_id, phone_number}` → `{call_id}`. | Button not shown; review says test calls are not available yet. |
| G7 | **Server-rendered call preview** (opening line, variables, offer) for an instance version / campaign + lead. | `POST /api/v1/calls/preview` `{agent_type, version?, campaign_brief?, goal?, prospect_id}` → `{first_message, variables, missing_required[]}`. | Opening line rendered **client-side** and labelled "Preview — final wording is set when the call is placed", with a clearly labelled sample lead (agent setup) or a chosen selected lead (campaign). The offer text uses the existing `POST /api/campaigns/offer-preview` (real). |
| G8 | Campaign **brief, goal, priority** written directly (`campaigns.brief`, `goal`, `priority` exist in the database). `CampaignCreateRequest` forbids them. | Add to `CampaignCreateRequest` / `CampaignUpdateRequest`: `goal: Literal[...]`, `priority: int`, `brief: CampaignBrief`; return them (plus `brief_sources`) on `GET /api/campaigns/{id}`. Also accept `send_brochure` and `callback` in `GOALS` (today only `book_meeting`, `qualify_only`). | The builder serializes the brief (`lib/campaignBrief.js::serializeBrief`) and **sends it through the legacy fields** the backend already maps to the brief: `call_purpose → pitch.call_reason`, `spoken_name → pitch.offering_name`, `value_proposition → pitch.offering_one_liner`, `key_points → pitch.benefits` (≤3), `objections → pitch.objections`, offer → `pitch.offer_text` + `announce_to_leads` + `offer_valid_until`, goal → `pitch.objective` (`book_meeting → appointment`, `qualify_only → custom`). Goals `send_brochure` and `callback` are shown disabled ("not supported yet"). |
| G9 | Brief fields with no legacy home: **never-say list, when to mention the offer, featured products, qualification overrides, priority**. | Part of G8 (`brief.must_not_say`, `offer.when_to_mention`, `featured_product_ids`, `qualification_overrides`, `priority`). | Shown **disabled with a note** in the builder ("saved once the campaign brief API is available"); not sent. Featured products and qualification questions are shown (read from the catalog and the agent's published version) so the user sees what applies. |
| G10 | Calling window **validated against the agent's limits**. | `POST /api/campaigns/schedule-check` returning `agent_limits` (`calling.window`, `max_attempts_per_lead`) and `calling_limit_conflicts` (the backend has `agent_instances.service.calling_limit_conflicts`, report only). | The builder reads the agent's published `calling` limits from `GET /api/v1/agent-instances/sdr_outbound/versions/{n}` (when `agent_instances` is on) and checks the window / attempts client-side, showing the limits. Without the flag, no limit is shown. |
| G11 | **Lead warnings**: missing timezone, do-not-call removed, already in another running campaign (with skip / keep in both / move). | `POST /api/campaigns/lead-check` `{prospect_ids}` → `{ready[], missing_timezone[], do_not_call[], in_running_campaigns: [{prospect_id, campaign_id, campaign_name}]}` plus `overlap_action` on create. | Not shown. Step 1 shows selected count only; the backend's existing skips (`skipped_prospect_ids`, `skipped_contacts`) show on the campaign after creation. |
| G12 | **Capacity** on review (calls per day the window allows). | Part of `schedule-check`: `capacity{calls_per_day, days_needed}`. | Not shown. |
| G13 | Call logs: **agent type** and **agent version** per call, and an agent-type filter. Columns exist (`vapi_call_logs.agent_type`, `agent_version_id`) but `serialize` leaves them out. | Add `agent_type`, `agent_version_id`, `agent_version` (number) to `serialize`; `GET /api/call-logs?agent_type=`. | Agent type column shown from `agent_type` when present, else derived from `direction` exactly as the backend's backfill does for SDR calls (`inbound → sdr_inbound`, else `sdr_outbound`; `/api/call-logs` lists only SDR types). **No filter** (a client-side filter would only filter one page). Version shown only when `agent_version_id` is present (mapped to its number through the instance's version list). |
| G14 | Version history **"who"**: `created_by` / `published_by` are user ids. | Add `created_by_name`, `published_by_name` to `VersionSummary`. | Names looked up from `GET /api/users` (visible to TA and M); "user #id" when not found. |
| G15 | Phone number **current inbound mode**. | Add `inbound_mode` (`fixed`/`shared`) and `vapi_assistant_id` to `TenantPhoneNumberResponse`. | Mode control shows "Current mode: not reported"; after a change, the response's `mode` is shown for that row until reload. |
| G16 | Instance-level campaign defaults beyond questions: **dispositions** and **extraction fields** edit shapes. Both are `dict | None` (None = the agent type's rules) with no documented schema. | `GET /api/v1/agent-instances/{type}/defaults` → the agent type's default dispositions and extraction schema, so the UI can show and override them. | Shown read-only: "Uses the agent type's standard dispositions / extraction fields", or the stored JSON when set. |
| G17 | Platform guardrail chips and the never-say list as structured fields. `guardrails` is a free dict; the builder backfill writes `rules`, `custom_instructions`, `prompt_mode`. | Document `guardrails.never_say: list[str]`, `guardrails.recording_disclosure: str`. | The UI writes `guardrails.never_say` and `guardrails.recording_disclosure` (kept by `extra="allow"`; the variable builder does not read them yet). Fixed platform rules are non-editable chips. Labelled "Saved with the agent; applied on calls once the backend reads them" where the backend does not read them yet. |

---

## 4. What the UI does (by section)

**A. Agents page and agent types.** `lib/agents.js`: `sdr` and `sdr_outbound` → `/voice_agent`; `sdr_inbound` →
`/agents/sdr_inbound`; `hiring` → `/hiring_agent` (unchanged). `canonicalAgentType`, `agentTypeLabel`. Agents page:
when `featureOn(user, 'agent_instances')` and the role is TA/M, it loads `GET /api/v1/agent-instances` and shows a
state badge per SDR type (Not set up / Draft / Active with persona, languages, version, last edited / Not in plan per
G1). A 403 from that call, the flag off, or a Rep: today's cards exactly (Open → Assistant builder screen). Hiring card
unchanged.

**B. Agent configuration.** `/agents/:agentType` (TA/M, flag on; otherwise the flag-off notice or the legacy link).
Wizard on first setup (no published version), tabs afterwards, the same step components. Debounced autosave (PUT,
1 s) with a saved indicator; 409 on create opens the existing draft. 422 errors map to fields by `loc`, focus moves
to the first. Publish → 409 `stale_draft` dialog (Rebase / Publish anyway for **Tenant Admin only** with a
confirmation naming the version overwritten / Cancel). Rebase re-applies the user's edits (diff of
`previous_payload` against its base version) onto the new draft, keeps only paths that still exist, and highlights
paths also changed in the newer published version. Version history: list, view, restore (new draft); gaps in
numbers are normal. After publish: `shared_assistants` on → "Live on your next calls", off → "Saved. Your calls still
use the Assistant builder configuration."

**C. Campaign builder.** `/voice-campaigns/new`. Step 1 reuses `LeadCampaignBuilder` (filters, search, CSV and AI
filter import) with a Continue action. Step 2 is the brief (G8/G9 as above) with a live preview panel and a required
checklist. Step 3 review: summary, checks, sample openings for up to 3 selected leads, Schedule / Launch now / Save
draft (the existing `start` values). Existing campaigns keep opening as today (`CampaignPitchCard`). Campaign detail:
plain-language notices for `agent_not_ready`, `no_caller_id`, `missing_call_details` / `call_variables_missing` with
the server's own detail text and a fix link.

**D. Call logs.** Agent type badge per call (G13 fallback). Version in the detail only when the API sends it.

**E. Super Admin.** Catalog: "Follows Outbound SDR" badge; saving access on a follower asks first (it detaches);
"Follow Outbound SDR again" on a detached Inbound SDR. Feature switches: descriptions for `agent_instances`,
`shared_assistants`, `allow_platform_caller_id`. Shared assistant versions of `sdr`/`sdr_outbound`/`sdr_inbound`:
"Create draft from template", then the existing check / publish. Phone numbers: per number, inbound mode (Fixed /
Shared via NVIP) with a required reason and confirmation; "Shared" disabled with the reason when the tenant's
`shared_assistants` is off; server errors (cooldown, prerequisites) shown as sent.
