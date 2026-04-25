# Paladeium — AR Restaurant Menu Platform

**Paladeium** lets restaurants give customers a zero-install AR menu experience. Customers scan a physical menu card — a 3D dish model appears on the card. They browse the full menu in AR, all in the browser with no app download.

---

## Project Structure

```
paladeium/
├── apps/
│   ├── lens/          ← Customer AR Lens  (static site → Vercel / Cloudflare Pages)
│   └── dashboard/     ← Admin Dashboard   (Next.js  → Vercel)
├── docs/              ← PRD, Roadmap, Architecture, API reference, Schema
├── .gitignore
└── README.md
```

---

## Deploying to Vercel (Step-by-Step)

### 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/paladeium.git
git push -u origin main
```

---

### 2 — Deploy the Dashboard

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. In **Configure Project**, set **Root Directory** to `apps/dashboard`
3. Vercel auto-detects Next.js — leave Framework as **Next.js**
4. Click **Deploy** (first deploy will fail at KV — that's expected, fix in step 3)

---

### 3 — Set Up Vercel KV (persistent storage)

The dashboard needs Vercel KV to store restaurants and menus. Without it, data resets on every cold start.

1. In your Vercel project → **Storage** tab → **Create Database** → **KV**
2. Name it `paladeium-kv` → Create
3. Click **Connect to Project** → select your dashboard project
4. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project env vars
5. **Redeploy** the project (Deployments → three-dot menu → Redeploy)

On first request, the dashboard will auto-seed KV with the demo restaurant from `data/db.json`.

---

### 4 — Set the Lens URL env var

In your Vercel dashboard project → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `LENS_URL` | `https://your-lens.vercel.app` (or leave blank to skip the AR preview links for now) |

---

### 5 — Deploy the Lens

1. In Vercel → **Add New Project** → same GitHub repo
2. Set **Root Directory** to `apps/lens`
3. Vercel detects it as a **static site** (Other framework)
4. After deploy, copy the production URL (e.g. `https://paladeium-lens.vercel.app`)

**Tell the lens where the dashboard is:**

Open `apps/lens/config.js` and set the dashboard URL:
```javascript
window.__PALADEIUM_API__ = 'https://paladeium-dashboard.vercel.app';
```

Commit and push — the lens redeploys automatically.

---

### 6 — Test End-to-End

```
Dashboard:  https://paladeium-dashboard.vercel.app
AR Lens:    https://paladeium-lens.vercel.app?r=the-grand-spice
```

1. Open the dashboard → **The Grand Spice** is already seeded
2. Open the AR lens URL on your phone (must be HTTPS for camera)
3. Allow camera → point at the anchor card → menu appears
4. Add a restaurant in the dashboard → visit its AR link

---

## Running Locally

Two terminals — dashboard on `:3000`, lens on `:3001`.

```bash
# Terminal 1 — Dashboard
cd apps/dashboard
npm install
npm run dev
# → http://localhost:3000

# Terminal 2 — Lens
cd apps/lens
npm run dev
# → http://localhost:3001

# For phone testing, tunnel the lens with ngrok:
ngrok http 3001
# Open the ngrok HTTPS URL on your phone with ?r=the-grand-spice
```

The lens reads from `http://localhost:3000` by default — no config needed for local dev.

---

## How the Two Apps Connect

```
Customer phone
  → opens https://lens.vercel.app?r=the-grand-spice
  → lens reads config.js: DASHBOARD_API = 'https://dashboard.vercel.app'
  → fetch('https://dashboard.vercel.app/api/restaurants/the-grand-spice/menu')
  → CORS headers allow it ✓
  → menu JSON arrives → renders category pills + dish cards dynamically
  → customer taps dish with AR badge → 3D model loads
```

---

## Dashboard: Key Pages

| Route | What it does |
|---|---|
| `/restaurants` | List all restaurants with AR preview links |
| `/restaurants/new` | Add a restaurant (name → auto-slug → status) |
| `/restaurants/[id]/menu` | Manage menu items: add, edit, toggle available, delete |
| `/restaurants/[id]/menu/new` | Add or edit a dish (category, price, emoji, AR 3D model) |

---

## Adding a 3D Model to a Dish

1. Get a `.glb` file — keep under 5 MB (Sketchfab free downloads work)
2. Place it in `apps/lens/`
3. In the dashboard → menu item → toggle **Enable AR** → enter filename (e.g. `burger.glb`)
4. Commit and push to redeploy the lens

---

## Compiling AR Targets (one-time per restaurant)

```bash
cd apps/lens

# Option A — MindAR online tool (no install):
# 1. Search "MindAR compile tool" → upload targets/anchor.jpg
# 2. Download targets.mind → place in apps/lens/targets/

# Option B — Node script (auto-generates 5 perspective warps):
npm install
node compile-puppeteer.js
```

Place the restaurant's menu card / coaster photo as `targets/anchor.jpg` before compiling.

---

## Environment Variables

| Variable | App | Description |
|---|---|---|
| `SESSION_SECRET` | Dashboard | Random string ≥32 chars — signs the session cookie. **Required in production.** |
| `DASHBOARD_EMAIL` | Dashboard | Admin login email (default: `admin@paladeium.com`) |
| `DASHBOARD_PASSWORD` | Dashboard | Admin login password (default: `changeme`) **Change this!** |
| `UPSTASH_REDIS_REST_URL` | Dashboard | Upstash Redis REST URL for persistent storage |
| `UPSTASH_REDIS_REST_TOKEN` | Dashboard | Upstash Redis REST token |
| `LENS_URL` | Dashboard | URL of the deployed lens (shown in AR link copy box) |

Generate a `SESSION_SECRET` with: `openssl rand -base64 32`

All other vars are in [docs/.env.example](docs/.env.example) for future phases.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AR tracking | MindAR (image-based) + Three.js |
| Dashboard | Next.js 14 App Router + Tailwind CSS |
| Storage (dev) | JSON file (`data/db.json`) |
| Storage (prod) | Vercel KV (Redis) |
| API | Next.js API Routes |

Full architecture in [docs/Architecture.md](docs/Architecture.md).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Lens shows default menu not restaurant menu | Check `config.js` has the correct dashboard URL; check dashboard is live |
| Dashboard shows seeded data only, changes don't save | Set up Vercel KV and redeploy (see Step 3 above) |
| Camera shows but no AR lock | Improve lighting; recompile `targets.mind` with a better anchor image |
| 3D model 404 | Filename in dashboard must match `.glb` file in `apps/lens/` exactly |
| Black screen on phone | Lens must be served over HTTPS — Vercel gives this automatically |
| CORS error in console | Make sure `DASHBOARD_API` in `config.js` matches the exact Vercel URL (no trailing slash) |
