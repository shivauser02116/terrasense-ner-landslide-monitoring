# Build Spec — Landslide Decision-Support Prototype (Solo / AI-Tool Build)

## 1. One-liner
Convert a village-level landslide risk alert into a specific evacuation action plan (which households, which roads to avoid, which shelter) for Dakshina Kannada (DK) Incident Commanders/PDOs — delivered via web dashboard + SMS (Short Message Service).

## 2. Scope Boundaries — do NOT build these
- NOT a landslide predictor. Consumes an existing alert signal; never generates the risk score itself.
- NOT replacing Karnataka State Natural Disaster Monitoring Centre (KSNDMC) / Geological Survey of India (GSI).
- ONE district (DK), ONE pilot village for the demo — not multi-district from day one.
- NO live KSNDMC feed required — simulated alert is primary; live feed is stretch-only.
- NO real resident personally identifiable information (PII) — synthetic/anonymized household points only.
- NO native mobile app in this version — web (responsive) + SMS covers the actual need better.

## 3. Architecture (text flow)
```
Alert (simulated, or live if confirmed available)
        ↓
Fusion Engine — pulls household + road + shelter data for the alerted village
        ↓
Decision Engine — ranks households, flags unsafe roads, picks shelter + route
        ↓
   ┌─────────────────────┬─────────────────────┐
   Web Dashboard          SMS dispatch (to registered contact numbers)
   (Incident Commander)   (bilingual: Kannada + English)
```

## 4. Recommended Stack
- Backend: Python + FastAPI
- Database: PostgreSQL + PostGIS extension (needed for spatial queries — distance, containment, nearest-shelter lookups)
- Frontend: React + Leaflet (single responsive web app, works on desktop and phone browsers)
- SMS provider: Twilio (assumed default — fast signup, free trial; swap to MSG91 or other if you already hold an account)
- Hosting (demo): Render or Railway (backend+DB), Vercel (frontend)

## 5. Data Entities (schema keys)
- **Village**: id, name, gram_panchayat, current_risk_level, updated_at
- **Household**: id, village_id, lat, lng, vulnerability_score, nearest_road_id
- **Contact**: id, household_id, phone_number *(new — needed for SMS dispatch)*
- **RoadSegment**: id, village_id, geometry (linestring), status (normal / flagged / closed)
- **Shelter**: id, village_id, lat, lng, capacity, current_occupancy
- **Alert**: id, village_id, risk_level, timestamp, source (simulated / live)
- **ActionPlan**: id, alert_id, ranked_household_ids[], flagged_road_ids[], recommended_shelter_id, recommended_route, generated_at

## 6. Core Features — build in this exact order
1. Data model + seed data for ONE pilot village (manual entry is fine for demo)
2. Admin control: trigger a simulated alert (pick village + risk level)
3. Fusion engine: pull household/road/shelter data for the alerted village
4. Decision engine: rank households by vulnerability, flag unsafe roads, select shelter + route
5. Web dashboard: map with colour-coded risk, action-plan panel, Kannada + English text
6. SMS dispatch: on ActionPlan generation, send bilingual SMS to Contact numbers for priority households
7. *(stretch)* Live KSNDMC feed ingestion, only if KSNDMC confirms a usable feed exists
8. *(stretch)* Voice/IVR alert instead of text-only SMS, for low-literacy users

## 7. Suggested API Endpoints
- `POST /alerts/simulate` — {village_id, risk_level}
- `GET /villages/{id}/status`
- `GET /villages/{id}/action-plan` — latest generated plan
- `POST /admin/households`, `/admin/roads`, `/admin/shelters` — bulk upload/edit for demo data
- SMS dispatch is internal (triggered on ActionPlan creation), not a public endpoint

## 8. SMS Specification
- **Trigger:** ActionPlan generated for a village at High/Severe risk
- **Recipients:** Contact numbers linked to priority-ranked households (or one village-wide broadcast list, for demo simplicity)
- **Template (bilingual, keep under ~160 characters per language to fit one SMS segment):**
  `"[Village]: [Risk level] alert. Evacuate to [Shelter]. Avoid [Road]. / [Kannada translation]"`
- **Constraint:** SMS segments are ~160 characters each — long bilingual messages will split into multiple segments; keep the template tight or accept multi-segment cost.

## 9. Non-Functional Requirements
- Action plan generation: under 5 seconds for the pilot village dataset
- All UI and SMS text: Kannada + English minimum
- Simulated vs. real data must be visibly distinguished in the UI at all times — never let a judge or future user mistake demo data for live data
- No hardcoded DK-only logic where avoidable — village/road/shelter data should be config-driven so another district is a data change, not a rewrite
- If no safe route exists (all roads flagged), show an explicit escalation state — never silently fail or fabricate a route

## 10. Open Items / Assumptions to Confirm
- SMS provider account — set up the Twilio (or chosen alternative) trial early; signup has lead time
- Pilot village not yet chosen — pick one with usable Bhuvan/OpenStreetMap building and road data
- KSNDMC live feed access — unconfirmed, treat as stretch only
- Current District Disaster Management Plan (DDMP) for DK not yet obtained from the district office

## 11. Guardrails — carry these into the actual pitch, not just the code
- Never claim live KSNDMC integration unless it is actually wired up and tested
- Never use real household resident names or identity data, even for the demo
- Never present the escalation case (Section 9, no-safe-route) as if the system "handled it" — show it as a flagged limitation, honestly
- Build and prove ONE village first. Generalizing to other districts is a stated future direction, not something to claim as already done.
