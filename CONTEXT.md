# Paladeium — Project Context for AI Assistant

## What is Paladeium?

Paladeium is a **web-based AR restaurant menu platform**. Restaurants give customers a card (like a coaster or menu card). The customer scans it with their phone camera — a 3D dish model appears floating on the card in augmented reality. No app download needed; it runs entirely in the browser.

---

## Two Apps, One Repo

```
paladeium/
├── apps/
│   ├── lens/        ← Customer-facing AR experience  (static HTML/JS)
│   └── dashboard/   ← Restaurant admin panel         (Next.js 14)
├── apps/lens/targets/targets.mind   ← compiled AR target file
├── apps/lens/models/                ← 3D model files (.glb)
└── apps/dashboard/data/db.json      ← local dev database
```

Both apps are deployed separately on **Vercel**:
- **Lens** → `https://paladeium-lens.vercel.app`
- **Dashboard** → `https://paladeium-dashboard.vercel.app`

---

## App 1 — AR Lens (`apps/lens/`)

**What it is:** A single static `index.html` file. No framework, no build step.

**How it works:**
1. Customer opens `https://paladeium-lens.vercel.app?r=the-grand-spice`
2. Lens reads `config.js` to get the dashboard API URL
3. Fetches menu from `GET /api/restaurants/the-grand-spice/menu` on the dashboard
4. Renders a scrollable dish grid at the bottom of the screen
5. Customer taps "Start AR" → browser requests camera permission
6. **MindAR** (image tracking library) loads `targets/targets.mind` and starts tracking the physical card
7. When the card is detected (`onTargetFound`), the menu panel slides up
8. Customer taps a dish that has an AR badge → **Three.js GLTFLoader** loads the `.glb` model file
9. Model appears floating on the card; customer can drag to spin it, pinch to scale

**Key files:**
- `apps/lens/index.html` — entire lens app in one file
- `apps/lens/config.js` — sets `window.__PALADEIUM_API__` to the dashboard URL
- `apps/lens/targets/targets.mind` — compiled MindAR image target (binary, from anchor.jpg)
- `apps/lens/models/demo-restaurant-1/burger.glb` — 3D burger model (~5 MB)
- `apps/lens/models/demo-restaurant-1/pastameatballsample.glb`
- `apps/lens/models/demo-restaurant-1/pastrysample.glb`
- `apps/lens/models/demo-restaurant-1/sandwichsample.glb`

**Libraries (loaded from CDN, no npm build):**
- `MindAR 1.2.5` — image tracking (detects the physical card)
- `Three.js 0.160.0` — 3D rendering
- `es-module-shims 1.8.0` — importmap polyfill for older browsers

**Fallback (Demo Mode):** If MindAR fails (no camera, not HTTPS), the lens falls back to a plain 3D viewer on a dark background — same dish grid, same model loading, just no camera AR.

---

## App 2 — Dashboard (`apps/dashboard/`)

**What it is:** A Next.js 14 App Router application. Restaurant owners log in and manage menus.

**Tech stack:**
- Next.js 14 (App Router)
- Tailwind CSS
- TypeScript
- `iron-session` — cookie-based auth (no JWT library needed)
- `zod` — request validation
- `@upstash/redis` — persistent storage in production (Vercel)
- JSON file (`data/db.json`) — storage in local dev

**Authentication:**
- Single admin login (email + password set via env vars)
- Session stored in an encrypted, signed cookie via `iron-session`
- Middleware at `middleware.ts` protects all routes except `/login` and `GET /api/restaurants/[slug]/menu`
- Default credentials: `admin@paladeium.com` / `changeme` (change via env vars)

**Pages:**
| Route | Purpose |
|---|---|
| `/login` | Admin login form |
| `/restaurants` | List all restaurants |
| `/restaurants/new` | Create a new restaurant |
| `/restaurants/[id]/menu` | View/manage menu items for a restaurant |
| `/restaurants/[id]/menu/new` | Add or edit a menu item |
| `/restaurants/[id]/marker` | View/download the AR target image |

**API Routes:**
| Method + Path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | Public | Log in, set session cookie |
| `POST /api/auth/logout` | Public | Clear session cookie |
| `GET /api/restaurants` | Admin | List all restaurants |
| `POST /api/restaurants` | Admin | Create restaurant |
| `GET /api/restaurants/[slug]` | Admin | Get single restaurant |
| `PATCH /api/restaurants/[slug]` | Admin | Update restaurant |
| `DELETE /api/restaurants/[slug]` | Admin | Soft-delete (30-day grace period) |
| `POST /api/restaurants/[slug]/restore` | Admin | Restore a soft-deleted restaurant |
| `GET /api/restaurants/[slug]/menu` | **Public** | Menu data consumed by the AR Lens |
| `POST /api/restaurants/[slug]/menu` | Admin | Add menu item |
| `PATCH /api/restaurants/[slug]/menu/[itemId]` | Admin | Edit menu item |
| `DELETE /api/restaurants/[slug]/menu/[itemId]` | Admin | Delete menu item |
| `POST /api/upload` | Admin | Upload a `.glb` file to Vercel Blob storage |

---

## Data Model

```typescript
Restaurant {
  id: string           // e.g. "demo-restaurant-1"
  name: string         // e.g. "The Grand Spice"
  slug: string         // URL-safe, e.g. "the-grand-spice"
  description: string
  status: "active" | "inactive" | "pending" | "pendingDeletion"
  targetsUrl: string | null   // URL to a custom .mind file (overrides default)
  deleteAt: string | null     // ISO date — when pendingDeletion expires
  createdAt: string
  updatedAt: string
}

MenuCategory {
  id: string
  restaurantId: string
  name: string         // e.g. "Mains"
  emoji: string        // e.g. "🍽"
  sortOrder: number
}

MenuItem {
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string
  price: number        // in paise/cents (integer)
  emoji: string
  imageUrl: string     // optional photo URL
  modelUrl: string     // path to .glb file, e.g. "models/demo-restaurant-1/burger.glb"
  hasAr: boolean       // true = shows AR badge, loads 3D model
  dietaryTags: string[] // e.g. ["veg", "vegan"]
  available: boolean
  createdAt: string
}
```

**What `GET /api/restaurants/[slug]/menu` returns to the Lens:**
```json
{
  "restaurant": { "id": "...", "name": "...", "slug": "...", "targetsUrl": null },
  "categories": [{ "id": "...", "name": "Mains", "emoji": "🍽" }],
  "menu": [
    {
      "id": "item-1",
      "name": "Wagyu Smash Burger",
      "desc": "Double patty, aged cheddar, truffle aioli",
      "price": "₹649",
      "emoji": "🍔",
      "cat": "mains",
      "model": "models/demo-restaurant-1/burger.glb",
      "hasAR": true
    }
  ]
}
```

---

## Storage

**Local dev:** `apps/dashboard/data/db.json` — flat JSON file, read/written directly by Node.js `fs`.

**Production (Vercel):** Upstash Redis. The entire database is stored as a single JSON blob under key `paladeium_db`. On first request, it seeds itself from `db.json`.

**3D Models:** `.glb` files are stored:
- In the git repo under `apps/lens/models/[restaurant-id]/` (for small models)
- OR uploaded to **Vercel Blob** via `POST /api/upload` and stored by URL

---

## How the Lens Loads Models

1. Lens receives `model: "models/demo-restaurant-1/burger.glb"` from the dashboard API
2. Prepends `./` → `"./models/demo-restaurant-1/burger.glb"`
3. Resolved relative to the lens server → `https://paladeium-lens.vercel.app/models/demo-restaurant-1/burger.glb`
4. Three.js `GLTFLoader` fetches and parses the binary GLB file
5. Model is scaled to ~18cm, centered, added to the MindAR anchor group

If no `?r=` param or dashboard is unreachable, the lens uses a hardcoded fallback menu with `model: "burger.glb"`.

---

## AR Tracking (MindAR)

- Uses **image-based tracking** (not markerless, not face)
- The physical card/coaster image is compiled into `targets/targets.mind` using the MindAR compiler
- Up to 5 perspective warps are compiled per target (for better angle tolerance)
- Tracking params: `filterBeta: 1000`, `filterMinCF: 0.001`, `warmupTolerance: 5`, `missTolerance: 10`
- These params make the lock stable — it doesn't flicker when the card moves slightly
- When the card is found: `onTargetFound` → show menu, load last-selected model
- When the card is lost: `onTargetLost` → keep model loaded (MindAR hides it automatically, re-shows instantly when card is found again)

---

## Environment Variables (Dashboard)

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes (prod) | Random string ≥32 chars, signs the session cookie |
| `DASHBOARD_EMAIL` | No | Admin email (default: `admin@paladeium.com`) |
| `DASHBOARD_PASSWORD` | No | Admin password (default: `changeme`) |
| `UPSTASH_REDIS_REST_URL` | Yes (prod) | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (prod) | Upstash Redis token |
| `LENS_URL` | No | Lens URL shown in dashboard AR preview links |

---

## Current State / Known Issues

- **Demo restaurant:** "The Grand Spice" (`slug: the-grand-spice`) is pre-seeded. The Wagyu Smash Burger has a 3D model; other items do not.
- **3D models stored in repo:** The `.glb` files are committed directly to `apps/lens/models/demo-restaurant-1/`. For new restaurants, models need to be uploaded via the dashboard or committed manually.
- **One AR target for all restaurants:** Currently all restaurants share the same `targets/targets.mind` compiled from `targets/anchor.jpg`. Per-restaurant targets are supported via `restaurant.targetsUrl` but not yet implemented in the dashboard UI.
- **Mobile testing:** Use ngrok (`ngrok http 3001`) to get an HTTPS URL for phone testing — the browser camera API requires HTTPS.

---

## Local Dev Setup

```bash
# Terminal 1 — Dashboard (port 3000)
cd apps/dashboard
npm install
npm run dev

# Terminal 2 — Lens (port 3001)
cd apps/lens
npm run dev   # runs: npx serve . -p 3001 --cors

# Open in browser:
# http://localhost:3001/?r=the-grand-spice
```

No environment variables needed for local dev — the dashboard uses `db.json` and the lens defaults to `http://localhost:3000`.
