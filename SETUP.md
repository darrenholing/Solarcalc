# SolarCalc — Setup Guide

## 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full schema: `src/lib/supabase/schema.sql`
3. Copy your project URL and anon key from **Settings → API**

## 2. Google APIs

Enable these APIs in [Google Cloud Console](https://console.cloud.google.com):
- **Maps JavaScript API** — satellite map view and drawing
- **Geocoding API** — address → coordinates
- **Maps Static API** — optional static tile fallback
- **Solar API** — 3D roof analysis and shade modelling

Create one API key, restrict it to the above APIs and your domain.

For the Solar API, create a **separate server-side key** (used in `NEXT_PUBLIC_GOOGLE_SOLAR_API_KEY` — called server-side via `/api/solar`).

## 3. Environment variables

Copy `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_SOLAR_API_KEY=AIza...

# Optional — monitoring integrations
VICTRON_VRM_API_TOKEN=...
SOLAREDGE_API_KEY=...

NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — redirects to `/calculator`. Register an account to start.

## 5. Deploy to Vercel

```bash
vercel --prod
```

Set all env vars in Vercel dashboard under Project → Settings → Environment Variables.

---

## Feature overview

| Route | Feature |
|---|---|
| `/calculator` | System design calculator with KNMI irradiance data |
| `/clients` | Client list and management |
| `/clients/[id]` | Client detail + satellite roof assessment + Solar API |
| `/clients/[id]/new-project` | Design a system and save as project |
| `/projects` | Kanban pipeline (drag & drop) |
| `/projects/[id]` | Project detail + proposal generation |
| `/proposals` | All proposals with status tracking |
| `/sign/[token]` | Public e-signature page (no auth required) |
| `/monitoring` | Live production monitoring (Victron / SolarEdge / simulated) |
| `/settings` | Profile, market config, subscription tier |

## Monitoring integrations

### Victron Energy VRM
1. Get your API token from [VRM Portal → Profile → Access Tokens](https://vrm.victronenergy.com/profile)
2. Find your installation's Site ID in the VRM URL
3. Add both to the installation record in Supabase

### SolarEdge
1. Get your API key from [monitoring.solaredge.com → Admin → API Access](https://monitoring.solaredge.com)
2. Find your Site ID in the portal
3. Add both to the installation record in Supabase

If no API key is set, the monitoring dashboard shows simulated data based on system size and KNMI irradiance.

## Market configuration

Switch between **NL** and **ZA** in Settings → Market.

| | Netherlands | South Africa |
|---|---|---|
| Currency | EUR (€) | ZAR (R) |
| Tax | BTW 21% | No VAT on solar |
| Net metering | Saldering | Feed-in tariff |
| Tariff escalation | 3%/yr | 12%/yr (Eskom) |
| Subsidy flag | SDE++ for ≥15 kWp | — |
| Irradiance | KNMI data | SA provincial data |

## Subscription tiers

| Tier | Proposals | CRM | E-signature | Monitoring |
|---|---|---|---|---|
| Free | 5/month | ✓ | — | — |
| Pro €99/mo | Unlimited | ✓ | ✓ | ✓ |
| Platform €199/mo | Unlimited | ✓ | ✓ | ✓ + marketplace |

Tier enforcement is implemented via `proposals_this_month` on the `users` table. Add a Supabase Edge Function or cron to reset it monthly.
