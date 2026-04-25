# Paladeium — System Architecture

**Version:** 1.0  
**Date:** 2026-04-25

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                         │
│                                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Customer        │  │  Restaurant POS  │  │  Paladeium       │                │
│  │  AR Lens         │  │  Dashboard       │  │  Admin Panel     │                │
│  │  Mobile Browser  │  │  PWA (Windows /  │  │  Web (Desktop)   │                │
│  │  iOS / Android   │  │  Tablet / Phone) │  │                  │                │
│  │                  │  │                  │  │                  │                │
│  │  MindAR          │  │  Next.js 14      │  │  Next.js 14      │                │
│  │  Three.js        │  │  Zustand         │  │  shadcn/ui       │                │
│  │  Vanilla JS      │  │  Socket.io       │  │  Recharts        │                │
│  │                  │  │  Dexie.js (IDB)  │  │                  │                │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘                │
└───────────┼────────────────────┼─────────────────────┼────────────────────────────┘
            │                    │                       │
            └────────────────────┼───────────────────────┘
                                 │ HTTPS / WSS
┌────────────────────────────────▼───────────────────────────────────────────────────┐
│                              EDGE / GATEWAY LAYER                                   │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Cloudflare (DNS, DDoS, WAF, CDN)                           │  │
│  │         paladeium.app  ·  pos.paladeium.app  ·  admin.paladeium.app           │  │
│  │         cdn.paladeium.app  (R2 CDN for GLB models, .mind files, images)       │  │
│  └────────────────────────────────────┬─────────────────────────────────────────┘  │
└───────────────────────────────────────┼────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│                              SERVER LAYER                                            │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         Nginx / Traefik (Reverse Proxy)                      │   │
│  │                    Route by subdomain → correct service                       │   │
│  └──────────────┬──────────────────────────────────┬──────────────────────────┘   │
│                 │                                    │                               │
│  ┌──────────────▼──────────────┐     ┌──────────────▼──────────────────────────┐  │
│  │  Core API Service            │     │  Real-time Service                       │  │
│  │  Node.js 20 + Express        │     │  Node.js + Socket.io                    │  │
│  │  tRPC router                 │     │                                          │  │
│  │  REST endpoints              │     │  Rooms: restaurant:{id}                 │  │
│  │  JWT auth (Clerk)            │     │  Events: order:new, order:updated,      │  │
│  │  Zod validation              │     │          table:status, kitchen:alert    │  │
│  │  Razorpay webhooks           │     │                                         │  │
│  │  File upload → R2            │     │  Scales: Redis pub/sub for multi-pod    │  │
│  └──────────────┬──────────────┘     └──────────────┬──────────────────────────┘  │
│                 │                                     │                              │
│  ┌──────────────▼──────────────┐                     │                              │
│  │  Job Queue Service           │                     │                              │
│  │  BullMQ + Redis              │                     │                              │
│  │                              │                     │                              │
│  │  Queues:                     │                     │                              │
│  │  • targets-compiler          │                     │                              │
│  │  • qr-generator              │                     │                              │
│  │  • offline-order-sync        │                     │                              │
│  │  • analytics-aggregation     │                     │                              │
│  │  • email-notifications       │                     │                              │
│  └──────────────┬──────────────┘                     │                              │
└─────────────────┼──────────────────────────────────── ┼────────────────────────────┘
                  │                                      │
┌─────────────────▼──────────────────────────────────── ▼────────────────────────────┐
│                              DATA LAYER                                              │
│                                                                                      │
│  ┌──────────────────────┐   ┌───────────────────┐   ┌─────────────────────────┐   │
│  │  PostgreSQL 16         │   │  Redis 7           │   │  Cloudflare R2          │   │
│  │  + TimescaleDB ext.    │   │                    │   │  (Object Storage)       │   │
│  │                        │   │  • Sessions        │   │                         │   │
│  │  Primary DB:           │   │  • API cache       │   │  • .glb 3D models       │   │
│  │  • All relational data │   │  • Rate limiting   │   │  • .mind AR targets     │   │
│  │  • Row-level security  │   │  • Socket.io rooms │   │  • Dish images          │   │
│  │                        │   │  • BullMQ queues   │   │  • Anchor images        │   │
│  │  TimescaleDB:          │   │  • Offline sync    │   │  • QR code PDFs         │   │
│  │  • events hypertable   │   │    buffer          │   │                         │   │
│  │  • analytics queries   │   │                    │   │  Served via CDN:        │   │
│  │                        │   └───────────────────┘   │  cdn.paladeium.app      │   │
│  │  Read replica for      │                            │                         │   │
│  │  analytics queries     │                            └─────────────────────────┘   │
│  └──────────────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure (Monorepo)

```
paladeium/
├── apps/
│   ├── lens/                    # Customer AR Lens (static HTML/JS — existing)
│   │   ├── index.html
│   │   ├── mindar.js
│   │   ├── targets/
│   │   └── ...
│   ├── pos/                     # Restaurant POS Dashboard (Next.js PWA)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── dashboard/
│   │   │   ├── orders/
│   │   │   ├── kitchen/
│   │   │   ├── tables/
│   │   │   ├── billing/
│   │   │   ├── menu/
│   │   │   └── analytics/
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── admin/                   # Paladeium Admin Panel (Next.js)
│   │   ├── app/
│   │   │   ├── restaurants/
│   │   │   ├── assets/
│   │   │   ├── qr-codes/
│   │   │   └── analytics/
│   │   └── ...
│   └── api/                     # Backend API (Node.js + Express)
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── services/
│       │   ├── jobs/
│       │   ├── sockets/
│       │   └── index.ts
│       └── ...
├── packages/
│   ├── db/                      # Drizzle ORM schema + migrations
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── index.ts
│   ├── types/                   # Shared TypeScript types
│   ├── validators/              # Shared Zod schemas
│   └── config/                  # Shared constants and configs
├── infra/
│   ├── docker-compose.yml       # Local dev: Postgres, Redis
│   ├── docker-compose.prod.yml
│   └── nginx.conf
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── turbo.json
└── package.json
```

---

## 3. Technology Stack (Full)

### Frontend

| App | Framework | UI | State | Real-time | Offline |
|---|---|---|---|---|---|
| AR Lens | Vanilla JS | Custom CSS | Global vars | — | Service Worker |
| POS Dashboard | Next.js 14 (App Router) | shadcn/ui + Tailwind | Zustand | Socket.io | Dexie.js + SW |
| Admin Panel | Next.js 14 (App Router) | shadcn/ui + Tailwind | Zustand | — | — |

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 LTS | Server runtime |
| Framework | Express.js | HTTP server |
| Type-safe API | tRPC | End-to-end type safety with Next.js |
| Auth | Clerk | Multi-tenant authentication, JWTs |
| Validation | Zod | Runtime schema validation |
| Real-time | Socket.io | Order events, kitchen alerts |
| Job queue | BullMQ | Background jobs, compilation pipeline |
| ORM | Drizzle ORM | Type-safe PostgreSQL queries |
| File storage | @aws-sdk/client-s3 | Cloudflare R2 (S3-compatible) |

### Database

| System | Use Case | Why |
|---|---|---|
| PostgreSQL 16 | All relational data | ACID, row-level security, excellent for multi-tenant |
| TimescaleDB | Events + analytics time-series | Postgres extension, no separate system |
| Redis 7 | Cache, sessions, queues, pub/sub | BullMQ + Socket.io adapter |

### Infrastructure

| Component | Technology | Notes |
|---|---|---|
| Container | Docker | Local dev + production |
| Orchestration | Docker Compose → Railway/Render → AWS ECS | Start simple, scale as needed |
| CDN + Storage | Cloudflare R2 + CDN | GLB, .mind, images — cheap bandwidth |
| DNS + WAF | Cloudflare | DDoS protection, WAF rules |
| CI/CD | GitHub Actions | Lint, test, deploy on push to main |
| Monitoring | Sentry | Error tracking across all 4 apps |
| Analytics | PostHog | Product analytics, funnel tracking |
| Logging | Pino → Loki (or CloudWatch) | Structured JSON logs |

### Payments

| Component | Technology |
|---|---|
| Payment gateway | Razorpay (UPI, cards, wallets, netbanking) |
| Webhooks | Razorpay signature verification |
| Settlement | T+2 to restaurant bank accounts |
| PDF receipts | PDF-lib (server) or jsPDF (client) |
| Printing | Web Serial API (Chrome on Windows) |

---

## 4. AR Lens Architecture

```
Browser (Mobile)
├── Camera Feed (getUserMedia API)
├── MindAR System
│   ├── targets.mind (loaded from CDN on first visit, cached)
│   ├── 5 anchors (center, N, S, E, W warps)
│   ├── Feature detection loop (WebWorker)
│   └── Anchor tracking → Three.js group transforms
├── Three.js Scene
│   ├── WebGL renderer (camera feed as background)
│   ├── GLTFLoader → dynamic GLB from CDN
│   ├── 3 lights (ambient + 2 directional)
│   └── Touch interaction handler
└── Menu UI Layer (HTML/CSS over canvas)
    ├── Slide-up panel
    ├── Category filters
    ├── Dish cards
    └── Cart / Checkout
```

**targets.mind generation pipeline (server-side):**
```
Restaurant uploads anchor.jpg
→ BullMQ job: warp-anchor (Sharp)
  → anchor.jpg → anchor_n, anchor_s, anchor_e, anchor_w
→ BullMQ job: compile-targets (Puppeteer + @midar/compiler)
  → 5 images → targets.mind
→ Upload targets.mind to R2
→ Update restaurant.targets_url in DB
→ Webhook: notify admin panel
```

---

## 5. Order Flow

```
Customer AR Lens                API Server              Restaurant POS
─────────────────               ──────────              ──────────────

1. Opens paladeium.app/r/slug
2. AR scans menu card
3. Browses menu (API call)      → GET /menu/:id
                                ← menu JSON (Redis cached)
4. Adds items to cart
5. Enters table number
6. Initiates payment            → POST /orders (create pending order)
                                ← { orderId, razorpayOrderId }
7. Razorpay checkout UI
8. Customer pays via UPI/card
   (Razorpay handles payment)
                                ← Razorpay webhook: payment.captured
                                → Verify signature
                                → Update order: status = CONFIRMED
                                → Emit socket: order:new             → Receives order:new
                                                                      → Audio alert
                                                                      → Order appears in queue
9. Shows confirmation screen
                                                                      Staff clicks Accept
                                → PATCH /orders/:id { status: PREPARING }
                                → Emit socket: order:updated         ← status: PREPARING
10. Customer sees "Preparing"

                                                                      Kitchen marks Ready
                                → PATCH /orders/:id { status: READY }
                                → Emit socket: order:updated         ← status: READY
11. Customer sees "Ready!"

                                                                      Waiter marks Delivered
                                → PATCH /orders/:id { status: DELIVERED }
```

---

## 6. Offline Order Flow (POS)

```
POS Dashboard (Offline)                     IndexedDB                  API (when online)
────────────────────────                    ─────────                  ─────────────────

1. Internet drops
   OfflineIndicator shows
2. Staff creates order manually
3. Order saved locally              → { id: uuid, status: PENDING_SYNC }
4. KDS shows local order queue (from IDB)

5. Internet returns
6. SyncService starts               → Reads all PENDING_SYNC orders
                                    → POST /orders (idempotency-key: uuid)  →
                                                                             ← 201 Created
                                    → Mark order: SYNCED                   → Socket emits to kitchen
7. Offline indicator clears
```

---

## 7. Multi-Tenancy

Every database table with restaurant-scoped data has a `restaurant_id` column.

PostgreSQL Row-Level Security policies:
```sql
-- Restaurant users can only see their own data
CREATE POLICY restaurant_isolation ON orders
  USING (restaurant_id = current_setting('app.current_restaurant_id')::uuid);
```

Clerk JWT contains `restaurant_id` claim. API middleware sets `app.current_restaurant_id` on each request.

Paladeium admin role bypasses RLS via a superuser connection.

---

## 8. Scaling Strategy

**Phase 1–2 (0–50 restaurants, ~5K orders/day):**
- Single API server (Railway/Render)
- Single PostgreSQL instance
- Single Redis instance
- Cloudflare CDN handles static asset load

**Phase 3 (50–200 restaurants, ~50K orders/day):**
- API: 2–3 replicas behind Nginx
- PostgreSQL: read replica for analytics queries
- Redis: Redis Cluster (3 nodes)
- Socket.io: multiple nodes with Redis pub/sub adapter

**Phase 4 (200+ restaurants, 500K+ orders/day):**
- AWS ECS (auto-scaling API pods)
- AWS RDS Aurora PostgreSQL (multi-AZ)
- AWS ElastiCache (Redis)
- Separate analytics service (Timescale Cloud)
- CDN: full Cloudflare Enterprise

---

## 9. Security Architecture

| Layer | Mechanism |
|---|---|
| Transport | TLS 1.3 everywhere (Cloudflare) |
| Auth | Clerk JWTs, short expiry (15 min) + refresh tokens |
| API | Rate limiting (Redis): 100 req/min per IP on public endpoints |
| DB | Row-level security per restaurant, parameterised queries only |
| Assets | Signed R2 URLs (1 hour expiry) for 3D models |
| Payments | Razorpay signature verification on every webhook |
| CORS | Strict allow-list (only paladeium.app subdomains) |
| Headers | Helmet.js (CSP, HSTS, X-Frame-Options) |
| Secrets | Environment variables, never in code, rotated quarterly |

---

## 10. Deployment Architecture

```
GitHub (main branch)
      │
      ▼  GitHub Actions CI
      ├── npm run lint
      ├── npm run type-check
      ├── npm run test
      └── if all pass → deploy
            │
            ├── apps/lens  → Cloudflare Pages (static deploy)
            ├── apps/pos   → Vercel or Railway (Next.js)
            ├── apps/admin → Vercel or Railway (Next.js)
            └── apps/api   → Railway / Docker container
                              ├── Postgres (Railway managed)
                              ├── Redis (Railway managed)
                              └── R2 (Cloudflare, external)
```

**Environments:**
- `local` — Docker Compose (Postgres + Redis locally)
- `staging` — Railway (auto-deploy from `develop` branch)
- `production` — Railway / AWS (deploy from `main` branch, manual approval)
