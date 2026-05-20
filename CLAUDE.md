# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RULES - NEVER DO THESE

- Never run `npm run build` or `wrangler pages deploy` automatically — always ask first
- Never run `wrangler deploy` automatically — always ask first
- Never run DELETE, DROP, or ALTER on the D1 database
- Never modify `wrangler.toml` secrets or environment variables
- Before making any changes, state exactly which files will be edited and what will change — wait for explicit approval before proceeding
- This is a live production app with real user data — treat every change with care
- Never touch the D1 database schema or run any SQL that modifies data

## Project Overview

Eshopbox Sales Assist is a B2B sales tool for Eshopbox logistics reps to log product demos, score deals, generate AI-drafted follow-up emails, and monitor deals against attention rules. It integrates with Zoho CRM as the source of truth and Claude AI for email drafting.

## Repository Structure

Monorepo with two independent projects:

- `eshopbox-sales-assist-frontend/` — React 18 + Vite SPA
- `eshopbox-sales-assist-backend/` — Hono on Cloudflare Workers

## Commands

### Frontend
```bash
cd eshopbox-sales-assist-frontend
npm install
npm run dev       # Dev server at http://localhost:5173
npm run build     # Outputs single-file bundle: dist/bundle.js + dist/bundle.css
npm run preview   # Preview production build
```

### Backend
```bash
cd eshopbox-sales-assist-backend
npm install
npm run dev       # Local Cloudflare Worker emulation via wrangler
npm run deploy    # Deploy to Cloudflare Workers
```

There are no test commands configured in either project.

## Architecture

### Frontend

- **No router library** — view state managed via `useState` in `App.jsx`; each page component receives a `navigate()` callback prop
- **Auth** — JWT stored in `localStorage`, injected via `apiFetch()` helper in `src/api.js`
- **Attention rules** — computed client-side in `src/utils/attentionRules.js` (mirrors server-side logic in `backend/src/services/attentionRules.js`)
- **Build output** — Vite configured to produce a single `bundle.js` + `bundle.css` with all assets inlined (large `assetsInlineLimit`); deployed to Cloudflare Pages at `https://eshopbox-sales-assist.pages.dev`

### Backend

- **Framework** — Hono 4.0 running on Cloudflare Workers
- **All routes** — defined in `src/index.js` (route files in `src/routes/` exist but are merged into index.js)
- **Database** — Cloudflare D1 (SQLite), bound as `DB`; schema in `src/db/schema.sql`
- **Token cache** — Cloudflare KV, bound as `TOKEN_CACHE`; used to cache the Zoho OAuth access token
- **Cron** — Cloudflare trigger fires daily at 4am UTC → `src/cron/dailyDigest.js` sends scheduled emails via Zoho

### Key Services

| File | Responsibility |
|------|---------------|
| `src/services/zoho.js` | All Zoho CRM v2 API calls; handles OAuth token refresh via KV cache |
| `src/services/claude.js` | Claude API calls (Sonnet) to generate day-1/day-3/day-4 follow-up email drafts |
| `src/services/grading.js` | Scores demo form data → numeric score → grade A/B/C/D |
| `src/services/attentionRules.js` | Evaluates 11 business rules against deal state to produce attention flags |
| `src/middleware/auth.js` | JWT validation middleware; reads role from token; sales reps only see their own deals |
| `src/db/users.js` | User and invite CRUD against D1 |

### Deal Grading

Scoring is computed from demo form fields (max 22 pts):
- Pain clarity: 3/1/0 | DM present: 3/1/0 | Budget signal: 2/1/0
- Purchase timeline: 3/2/1/0 | Engagement: 2/1/0 | Champion strength: 2/1
- SMB procurement complexity: 2/1 | Next step booked: 2/1/0
- Demo format (warehouse/in-person/virtual): 3/2/0

Grade thresholds: **A ≥14**, **B 9–13**, **C 5–8**, **D <5**

### Data Flow: Demo Submission

1. Rep submits `DemoForm` → `POST /api/deals/sync`
2. Backend calculates grade via `grading.js`
3. Updates Zoho deal fields and creates a Day 2 task in Zoho
4. Calls Claude API to generate 3 email drafts (day1, day3, day4)
5. Saves drafts to D1 `deal_emails` table with `scheduled_for` dates
6. Daily cron checks for emails due → sends via Zoho email API → marks `sent`

### Attention Rules (11 total)

Flags are computed against deal stage, last activity date, email send status, and grade. Both frontend (`attentionRules.js`) and backend (`services/attentionRules.js`) implementations must stay in sync.

## Environment Variables

Backend secrets are set via `wrangler secret put` (not in `wrangler.toml`):
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`

Non-secret vars are in `wrangler.toml` under `[vars]`: `ZOHO_API_BASE`, `ZOHO_ACCOUNTS_URL`, `FRONTEND_URL`.

## Role System

Three roles stored in `users.role` and encoded in JWT:
- `admin` — full access, can manage team, sees all deals
- `manager` — sees all deals, cannot manage team
- `sales_rep` — sees only their own deals (filtered by `rep_email` matching JWT)

User emails must end with `@eshopbox.com`.
