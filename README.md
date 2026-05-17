# commercial-vacancy

**Smart Vacancy Reuse Platform** — a civic web app that helps identify and repurpose vacant or underused properties in New York City. It connects renters, landlords, and contractors in one place, combining user-submitted listings with NYC open datasets (zoning, transit, vacancy) and Google Maps to support short- and long-term reuse of commercial space.

Built with Next.js, Node.js/Express, Supabase, and Stripe.

## Running with Docker

Run the entire application (frontend + backend) with a single command. Requires only **Docker** and **Git**—no Node.js or npm needed.

**Environment:** Create a `.env` file at the repo root with your Supabase URL, anon key, and service role key, plus Stripe and Google Maps keys. Never commit `.env`. Then run the SQL migrations in `supabase/migrations/` from the Supabase Dashboard → SQL Editor, in numeric order (`001_profiles.sql` through `013_booking_reserved_email_sent.sql`).

### Required environment variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Google Maps / Places
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...

# Stripe (Checkout + Connect)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Gemini (AI assistant) — optional
GEMINI_API_KEY=...

# Resend (transactional email) — optional
RESEND_API_KEY=...
```

### Start the application

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001

### Stop the application

```bash
docker compose down
```

Hot reload is enabled for both services—edit the code and changes will apply automatically.

## Local development (without Docker)

1. Create a `.env` at the repo root with the variables listed above.
2. For the frontend to load `.env`, create a symlink (or use `frontend/.env.local`):
   ```bash
   ln -sf ../.env frontend/.env
   ```
3. Kill any existing Next.js process if you get port/lock errors:
   ```bash
   pkill -f "next dev"
   rm -f frontend/.next/dev/lock
   ```
4. Start backend: `cd backend && npm install && npm run dev`  (defaults to `PORT=3001` unless overridden; set `PORT=5001` to match the Docker setup and `NEXT_PUBLIC_API_URL`)
5. Start frontend: `cd frontend && npm install && npm run dev`

## Troubleshooting: Next.js stuck on "Starting"

| Cause | Fix |
|-------|-----|
| **Corrupted `.next` cache** | `rm -rf frontend/.next` then `npm run dev` |
| **Port 3000 in use** | `npm run dev -- -p 3001` (or any free port) |
| **Stale lock / other instance** | `pkill -f "next dev"` and `rm -f frontend/.next/dev/lock` |
| **Corrupted dependencies** | `rm -rf frontend/node_modules frontend/package-lock.json` then `npm install` |
| **Turbopack hang** | Dev script uses `--webpack` as fallback. If still stuck, ensure `package.json` has `"dev": "next dev --webpack"` |
| **Code errors / infinite loops** | Check terminal for errors; inspect `loading.tsx`, data fetching, or server components |
| **Low memory** | Close other apps; Node needs ~1–2GB during build |

**Quick reset (frontend):**
```bash
cd frontend
pkill -f "next dev" 2>/dev/null
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

---

# Project Scope

## Overview

The Smart Vacancy Reuse Platform is a civic-tech web application that helps identify and repurpose vacant or underused commercial and mixed-use properties in New York City. It combines user-submitted listings with structured NYC open datasets to give renters, landlords, and contractors a single place to discover opportunities, evaluate locations, and connect with one another.

By analyzing zoning constraints, transit access, amenities, and neighborhood context, the platform generates practical reuse insights and supports both short-term (pop-ups, workshops, events) and long-term rental scenarios. The goal is to reduce vacancy duration, improve community use of space, and streamline the reuse process for everyone involved.

## Objectives

* Provide a centralized marketplace for listing, discovering, and booking vacant commercial spaces
* Support three distinct user roles with dedicated dashboards and workflows
* Enrich every listing with NYC open data (zoning, transit, neighborhood vacancy)
* Enable end-to-end negotiation and secure booking with Stripe payments
* Give landlords easy access to contractors who can prepare spaces for reuse

## User Roles

* **Renter / Event Host**
  * Registers and logs in
  * Browses listings on a list view or map view
  * Reads listing detail pages enriched with city-data insights
  * Sends inquiries, negotiates offers, and books spaces via Stripe Checkout
  * Tracks reservations and conversations from a dashboard
* **Landlord**
  * Publishes property listings through a guided flow (with imported NYC data where available)
  * Manages images, pricing, and availability
  * Responds to inquiries, counters offers, and accepts bookings
  * Onboards to Stripe Connect to receive payouts
  * Posts contractor job requests
* **Contractor**
  * Creates a public service profile (services, rates, service radius, availability)
  * Receives, accepts, declines, and completes job requests from landlords
  * Tracks job status from a dedicated dashboard

## Core Features (MVP)

* **Authentication & Authorization** — Supabase Auth, role flags on profile, RLS-aware data access
* **Listings & Discovery** — guided listing creation, image uploads, list/map browse, listing detail pages
* **City-Data Insights** — zoning/land-use context, MTA transit proximity, neighborhood vacancy context, Google Maps/Places integration
* **Inquiries & Messaging** — conversation threads between renters, landlords, and contractors
* **Offers & Negotiation** — offer creation, counter-offers, acceptance/rejection, status transitions
* **Bookings & Payments** — Stripe Checkout, Stripe Connect payouts, webhooks, refunds, PDF rental agreements
* **Contractor Marketplace** — contractor profiles, job requests, accept/decline/complete flow
* **Role-Specific Dashboards** — separate dashboards for renters, landlords, and contractors
* **AI Assistant** — Gemini-powered helper for surfacing listings and answering platform questions (rate-limited)
* **Transactional Email** — booking confirmation and reservation notifications via Resend
* **Saved Listings & Reviews** — favorites for renters, bidirectional reviews for trust/reputation

## Future Work

* Stronger adaptive reuse recommendation scoring and ranking models
* Expanded civic data coverage and automated zoning/policy change alerts
* Smarter contractor matching based on historical outcomes and SLA preferences
* Calendar synchronization for tours, bookings, and contractor scheduling
* Mobile-first optimization, accessibility expansion, and multilingual support
* Advanced marketplace analytics (vacancy duration, conversion rates, neighborhood demand)

## Data Flow

### Property search & booking
1. Renter searches/filters listings or browses the map view
2. Platform retrieves listings from Supabase and enriches them with NYC Open Data + MTA transit + Google Places
3. Renter inquires, negotiates an offer, then books via Stripe Checkout
4. On `payment_intent.succeeded` webhook, booking is confirmed and confirmation emails are sent

### Property listing
1. Landlord submits a listing through the guided flow
2. Optional import from NYC datasets; otherwise custom fields
3. Listing is validated, persisted, and indexed for browse/map

### Contractor job
1. Landlord posts a job request to a contractor profile
2. Contractor accepts, declines, or proposes terms
3. Status updates are tracked in both dashboards through to completion

## Tech Stack

### Frontend
* Next.js 16 (App Router)
* React 19, TypeScript
* Tailwind CSS v4
* `@react-google-maps/api` for the map view

### Backend
* Node.js + Express + TypeScript
* Supabase JS SDK
* Stripe (Checkout + Connect + webhooks)
* PDFKit for rental agreement generation
* Resend for transactional email
* Gemini for the AI assistant

### Database / Auth
* Supabase (PostgreSQL, Auth, Storage, RPC functions)
* Schema in 3NF — see `supabase/migrations/`

### Data Sources / APIs
* NYC Open Data (zoning, storefront vacancy)
* NY Open Data — MTA station data
* Google Maps / Places API

### DevOps
* Docker Compose for full-stack local development
* Containerized backend and frontend with hot reload

## Team

* Arif Manawer
* Ahmed Hamouda
* Muhammad Ahmed
* Mohammad Kabir
* Abdul Muswara
