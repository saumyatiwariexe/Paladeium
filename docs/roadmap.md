# Paladeium — Product Roadmap

**Last Updated:** 2026-04-25  
**Version:** 1.1 — Revised for MVP priority

---

## Strategy Shift: Menu + Dashboard First

Migrating restaurants from their existing POS is hard. The immediate unlock is the **AR Menu** — restaurants adopt it as an add-on without replacing their current workflow. Once they're on Paladeium's menu system, the POS follows naturally.

**MVP goal:** A restaurant can be onboarded, their menu built in the dashboard, and customers can browse it in AR the same day.

---

## Overview

```
Phase 0 (Done)          Phase 1 (Now)             Phase 2 (Next)          Phase 3 (Later)
AR Lens POC             Menu + Dashboard MVP        Ordering + Payments     POS + Analytics
✅ Complete             🔨 In Progress              🔜 Planned              🔜 Planned
```

---

## Phase 0 — AR Lens POC ✅ Complete

- [x] MindAR image-based AR tracking
- [x] Multi-angle 5-anchor targeting (±45° tilt)
- [x] Three.js 3D model rendering (GLB)
- [x] Touch interactions (rotate, pinch-scale)
- [x] Fallback demo mode (no camera)
- [x] Mobile-optimised UI (iOS + Android)

---

## Phase 1 — Menu + Dashboard MVP 🔨 In Progress

**Goal:** Admin adds a restaurant → builds their menu → shares AR link → customers browse in AR.

### Week 1 (Current): Foundation ✅
- [x] Project folder structure (`apps/lens/`, `apps/dashboard/`, `docs/`)
- [x] Next.js 14 dashboard scaffold (App Router, Tailwind, TypeScript)
- [x] JSON file data store (`data/db.json`) — no database needed for MVP
- [x] Restaurant CRUD (create, list, edit, delete)
- [x] Menu item CRUD (add, edit, toggle availability, delete)
- [x] Category management (create inline when adding items)
- [x] AR Lens connected to dashboard API (`?r=slug` → live menu load)
- [x] Dynamic category pills rendered from API data
- [x] CORS headers on menu API for cross-origin lens access
- [x] AR link copy button + direct preview on each restaurant card
- [x] Demo restaurant seeded in `db.json`

### Week 2: Polish + Real Restaurant Onboarding
- [ ] Image upload for menu items (local file → serve from `public/uploads/`)
- [ ] Targets.mind upload per restaurant (replace default with custom anchor)
- [ ] QR code generation per restaurant AR link (using `qrcode` npm package)
- [ ] Basic auth on dashboard (environment variable password gate — no Clerk yet)
- [ ] Restaurant status page with live stats (item count, AR-enabled count)
- [ ] Deploy dashboard to Railway / Vercel (HTTPS required for lens to call API)
- [ ] Deploy lens to Cloudflare Pages
- [ ] Test with 1 real restaurant end-to-end

### Week 3: Stability + Multi-Restaurant
- [ ] Validate: 5 restaurants simultaneously onboarded
- [ ] Per-restaurant targets.mind: lens loads the right anchor file per slug
- [ ] Menu item image display in AR Lens card UI
- [ ] Dietary badge display in AR Lens
- [ ] Responsive dashboard (tablet-friendly for on-site use)
- [ ] Error boundary and fallback states in dashboard

**Phase 1 Milestone:** 3 live restaurants with AR menus, accessible by QR code on their tables.

---

## Phase 2 — Ordering + Payments (Weeks 4–8)

**Goal:** Customer can order and pay from the AR Lens. Restaurant sees orders.

### Week 4–5: Cart + Order Flow
- [ ] Cart state in AR Lens (add/remove items, quantity)
- [ ] Cart drawer UI
- [ ] Table number input (from QR param or manual)
- [ ] Order submission to dashboard API
- [ ] Order confirmation screen in lens
- [ ] Orders list page in dashboard (simple table, no real-time yet)

### Week 6–7: Payments
- [ ] Razorpay integration (UPI, cards, wallets)
- [ ] Payment order creation in API
- [ ] Webhook handler (verify signature, confirm order)
- [ ] Cash payment option (restaurant-configurable toggle in dashboard)
- [ ] Digital receipt screen in lens

### Week 8: Real-time Order Queue
- [ ] Socket.io server (add to dashboard API)
- [ ] Live order queue page in dashboard
- [ ] Audio alert on new order
- [ ] Accept / reject / mark ready order actions
- [ ] Order status pushed to customer lens screen

**Phase 2 Milestone:** Full order-to-kitchen flow working. First real ₹ payment processed.

---

## Phase 3 — POS + Analytics (Weeks 9–14)

**Goal:** Restaurant has a full POS. Paladeium shows them data.

### Week 9–11: POS Dashboard (PWA)
- [ ] Separate Next.js PWA at `pos.paladeium.app`
- [ ] KDS (kitchen display) full-screen mode
- [ ] Manual order entry by staff
- [ ] Table management (visual map)
- [ ] Bill generation + thermal printer (Web Serial API)
- [ ] Split bill
- [ ] Staff accounts (role-based: manager, waiter, kitchen, cashier)

### Week 12–13: Offline Mode
- [ ] Service Worker: cache menu + app shell
- [ ] IndexedDB (Dexie.js): offline order queue
- [ ] Sync queue: upload on reconnect (idempotency keys)
- [ ] Cash / static UPI QR when offline

### Week 14: Analytics
- [ ] TimescaleDB hypertable for events
- [ ] Peak hours heatmap
- [ ] Top dishes by orders and revenue
- [ ] Average order value over time
- [ ] AR scan → order conversion funnel

**Phase 3 Milestone:** First restaurant fully migrated from their old POS.

---

## Phase 4 — Scale & Growth (Post-launch)

- [ ] Multi-language menus (Hindi, Tamil first)
- [ ] Multi-branch restaurant support
- [ ] Customer accounts + order history
- [ ] Loyalty points programme
- [ ] AI dish description generator
- [ ] Self-service 3D model upload by restaurant
- [ ] White-label option

---

## Current Focus

> **Right now: Phase 1 Week 2**
> Get the dashboard live on HTTPS, onboard the first real restaurant, hand them a QR code.

---

## Risks

| Risk | Mitigation |
|---|---|
| Targets.mind per restaurant (Puppeteer job is slow) | Show "processing" state; email when ready; queue with BullMQ in Phase 2 |
| Restaurants have poor WiFi for lens API call | Cache menu in Service Worker after first load |
| 3D model file sizes too large | Enforce 5 MB limit at upload; provide Draco compression guide |
| iOS camera permission UX friction | Clear onboarding copy; "tap to allow camera" overlay |

### Week 3–4: Backend API
- [ ] Core REST API (Express + tRPC)
  - Restaurants CRUD
  - Menu categories and items CRUD
  - Tables CRUD
  - Orders CRUD (create, update status)
  - Events ingestion endpoint
- [ ] Socket.io server (order events, table status)
- [ ] BullMQ queue setup
  - `targets-compiler` queue (MindAR job)
  - `qr-generator` queue
  - `sync-offline-orders` queue
- [ ] File upload API (GLB models, anchor images → R2)
- [ ] Row-level security policies in PostgreSQL

### Week 5–6: Paladeium Admin Panel
- [ ] Next.js app scaffold (`admin.paladeium.app`)
- [ ] Restaurant list + create + edit + approve
- [ ] Menu management: categories, items, images
- [ ] 3D model upload → R2 → assign to dish
- [ ] Trigger targets.mind recompilation job
- [ ] Table management + QR code generation
- [ ] QR code bulk PDF export

### Week 7–8: Customer AR Lens Upgrade
- [ ] Connect existing AR Lens to live API (replace hardcoded menu)
- [ ] Dynamic targets.mind loading per restaurant (from R2)
- [ ] Dynamic GLB model loading per dish (from R2)
- [ ] Cart state management (Zustand)
- [ ] Cart drawer UI
- [ ] Table number input (pre-filled from QR param or manual entry)
- [ ] Order submission to API
- [ ] Order confirmation screen

### Week 9–10: Restaurant POS Dashboard
- [ ] Next.js PWA scaffold (`pos.paladeium.app`)
- [ ] Auth (restaurant staff login via Clerk)
- [ ] Live order queue (Socket.io)
- [ ] Accept / reject / mark ready / mark delivered
- [ ] Manual order entry
- [ ] KDS (Kitchen Display) full-screen mode
- [ ] Basic table map
- [ ] PWA manifest + Service Worker (offline shell)

**Phase 1 Milestone:** One real restaurant can take orders end-to-end.

---

## Phase 2 — Payments + Offline (Weeks 11–18)

**Goal:** Revenue flows. POS works when WiFi dies.

### Week 11–12: Razorpay Integration
- [ ] Razorpay account setup + API keys
- [ ] Payment order creation (API)
- [ ] Razorpay checkout in Customer AR Lens
- [ ] Payment webhook handler (signature verification)
- [ ] Order confirmed only after `payment.captured` event
- [ ] Digital receipt screen
- [ ] Cash payment option (restaurant-configurable)
- [ ] Static UPI QR payment option (offline-safe)

### Week 13–14: Billing & Printing
- [ ] Itemised bill generation (PDF-lib)
- [ ] Discount application (fixed / percentage)
- [ ] Split bill (divide evenly or by item)
- [ ] Thermal printer integration (Web Serial API)
- [ ] KOT (Kitchen Order Ticket) printing
- [ ] Bill PDF download / share via WhatsApp

### Week 15–16: Full Offline Mode
- [ ] Service Worker: cache menu, app shell, assets
- [ ] IndexedDB schema (Dexie.js): offline orders, menu snapshot
- [ ] Offline order creation in POS
- [ ] Sync queue: upload when reconnected (idempotency keys)
- [ ] Conflict resolution (timestamp-based)
- [ ] Offline indicator UI
- [ ] Cash/UPI QR payment in offline mode

### Week 17–18: Staff Management
- [ ] Staff accounts (manager, waiter, cashier, kitchen roles)
- [ ] Role-based UI (kitchen sees KDS only, cashier sees billing only)
- [ ] Staff activity log
- [ ] PIN login option (quick switch between staff on shared tablet)
- [ ] Menu availability toggle (enable/disable items, time-based)

**Phase 2 Milestone:** First paying restaurant go-live.

---

## Phase 3 — Analytics + Polish (Weeks 19–24)

**Goal:** Restaurants get value from data. Platform feels production-grade.

### Week 19–20: Analytics Pipeline
- [ ] Event logging from all surfaces (AR Lens, POS)
- [ ] TimescaleDB hypertable for events
- [ ] Aggregation jobs (BullMQ daily summaries)
- [ ] Analytics API endpoints

### Week 21–22: Analytics Dashboard (in POS)
- [ ] Peak hours heatmap (Recharts)
- [ ] Top dishes by orders and revenue
- [ ] Average order value chart
- [ ] Daily / weekly / monthly revenue
- [ ] Table turnover rate
- [ ] AR scan funnel (scan → model → order conversion)
- [ ] CSV export
- [ ] Date range picker

### Week 23: Performance & Polish
- [ ] 3D model optimisation pipeline (compress GLB < 5MB)
- [ ] AR Lens load time optimisation (lazy load Three.js, prefetch models)
- [ ] POS dashboard Lighthouse audit (PWA score > 90)
- [ ] Error tracking (Sentry — all 4 apps)
- [ ] Rate limiting on public API endpoints
- [ ] CDN cache headers for static assets

### Week 24: Testing & Launch Prep
- [ ] End-to-end test suite (Playwright — critical order flows)
- [ ] Load testing (k6 — 500 concurrent orders)
- [ ] Security review (OWASP top 10 checklist)
- [ ] Runbook and incident response docs
- [ ] Staging environment identical to production
- [ ] Soft launch with 2–3 pilot restaurants

**Phase 3 Milestone:** Platform ready for public launch.

---

## Phase 4 — Scale & Growth (Post-launch, Ongoing)

### v1.1 (Month 4–5)
- [ ] Multi-language menu support (Hindi, Tamil, Telugu to start)
- [ ] Multi-branch restaurant support
- [ ] Customer accounts + order history
- [ ] Push notifications (order status updates)
- [ ] WhatsApp order notifications (Twilio / Meta API)

### v1.2 (Month 5–6)
- [ ] Loyalty points programme
- [ ] Discount codes / promotional offers
- [ ] Menu scheduling (breakfast / lunch / dinner auto-switch)
- [ ] Customer reviews per dish

### v2.0 (Month 7+)
- [ ] Self-service 3D model upload by restaurant (with AI-generated fallbacks)
- [ ] AI dish description generator
- [ ] Demand forecasting (predict peak hours, suggest staffing)
- [ ] Integration with Zomato / Swiggy for aggregated analytics
- [ ] White-label option (restaurant owns the domain)
- [ ] Tablet hardware bundle partnerships

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `targets.mind` compilation is slow (Puppeteer job) | Run in background queue, show "processing" state, email when ready |
| 3D model quality varies | Provide restaurant with asset guidelines + 5MB size limit enforced at upload |
| Restaurant WiFi unreliable | Offline mode mandatory from Phase 2 |
| iOS WebGL performance on older devices | Test on iPhone XR (A12), fall back to 2D image if framerate < 20fps |
| Razorpay settlement delays | Clear T+2 settlement communication to restaurants |
| Load spike during peak dinner hours | Redis caching on menu reads, read replicas for analytics |

---

## Success Metrics

| Phase | Metric | Target |
|---|---|---|
| Phase 1 | First live restaurant | 1 restaurant |
| Phase 2 | Revenue flowing | ₹1 in real payment processed |
| Phase 3 | Pilot launch | 5 restaurants live |
| 3 months post-launch | Restaurants | 25 active |
| 6 months post-launch | GMV | ₹10L/month through platform |
| 12 months post-launch | Restaurants | 100 active |
