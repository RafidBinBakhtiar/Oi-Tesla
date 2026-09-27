# Deployment (free tier only)

Nothing here costs money. The API and web images are the same ones `docker compose up` builds.

| Piece | Service (free tier) | Why |
|---|---|---|
| PostgreSQL | **Neon** (free project, no expiry) | Managed Postgres with a pooled connection string; Render's free Postgres expires after 30 days. |
| API | **Render** free Web Service, Docker runtime, root `api/` | Builds `api/Dockerfile` as-is; runs migrations + seed on boot. Free instances sleep after ~15 min idle (first request takes ~30–60 s). |
| Web | **Vercel** Hobby, root `web/` | Native Next.js hosting. (Render can also run `web/Dockerfile` if you prefer one provider.) |

## 1. Database: Neon

1. Create a project and database `oi_tesla`.
2. Copy the connection string and append `?sslmode=require`:
   `postgresql://USER:PASSWORD@HOST/oi_tesla?sslmode=require`

## 2. API: Render

1. New → Web Service → connect the repo → **Root directory `api`**, runtime **Docker**, branch `release/v1.0.0`.
2. Environment:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon string from step 1 |
   | `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `CORS_ORIGIN` | your Vercel URL, e.g. `https://oi-tesla.vercel.app` |
   | `NODE_ENV` | `production` |
   | `SEED_ON_START` | `true` (idempotent; seeds zones and sub-locations) |

   Render sets `PORT` itself. The API reads it.
3. Health check path: `/health`.
4. Deploy. The logs should show `applying database migrations → seeding … → Oi Tesla API listening`.

## 3. Web: Vercel

1. Import the repo → **Root directory `web`** (framework preset: Next.js).
2. Environment: `PUBLIC_API_URL = https://<your-render-service>.onrender.com`
3. Deploy. The layout reads `PUBLIC_API_URL` per request, so changing it needs no rebuild, only a redeploy or restart.

## 4. Check it

```bash
curl https://<api>/health                 # {"status":"ok","database":"up",...}
curl https://<api>/api/locations | head   # zones
```

Then open the web URL, create a passenger account and follow the walkthrough in the README (§13).

## If free hosting is unavailable

Everything runs reproducibly with `docker compose up --build` on any machine or VM that has Docker. Put
Caddy or nginx in front for HTTPS, set `PUBLIC_API_URL` and `CORS_ORIGIN` to the public hostnames, and
set a real `JWT_SECRET` in `.env`.
