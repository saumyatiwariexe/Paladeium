# Paladeium — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Draft  
**Owner:** Paladeium

---

## 1. Executive Summary

Paladeium is a SaaS platform that enables restaurants to offer an **Augmented Reality (AR) dining menu experience** to customers via their smartphones — no app install required. Customers scan the restaurant's physical menu card with their phone camera, see 3D dish previews in AR, and place orders directly. The restaurant receives orders on a hybrid online/offline POS dashboard. Paladeium provides analytics back to restaurants and manages the entire platform through an internal admin panel.

---

## 2. Problem Statement

- Paper menus are static, uninformative, and unhygienic.
- Restaurant POS systems are expensive, complex to set up, and require dedicated hardware.
- Customers cannot visualise dishes before ordering, leading to order regret and lower average ticket sizes.
- Restaurant owners lack data on customer behaviour, peak hours, and dish popularity.
- Existing AR menu solutions require native app downloads, which kills adoption.

---

## 3. Goals

| Goal | Metric |
|---|---|
| Zero-friction AR for customers | AR loads in < 3 seconds on mid-range Android/iOS |
| Restaurants live within 24 hours | Onboarding-to-live time < 1 business day |
| POS works without internet | Orders accepted and queued when offline |
| Increase average ticket size | Target: 15% increase via AR dish visualisation |
| Rich analytics for restaurants | Dashboard shows peak hours, top dishes, revenue trends |

---

## 4. Non-Goals (v1)

- Native iOS / Android apps (PWA covers this)
- Table-side self-service kiosks (hardware)
- Delivery / takeaway logistics
- Multi-language menus (planned v2)
- Loyalty / rewards programme (planned v2)
- Inventory management integration

---

## 5. Users & Personas

### 5.1 Customer (Diner)
- Age: 18–45, comfortable with smartphones
- Goal: See what a dish looks like, order quickly, pay at table
- Pain point: Menu descriptions are vague, photos are low quality or absent

### 5.2 Restaurant Owner / Manager
- Goal: Reduce staff burden, get data on their business, modernise their brand
- Pain point: POS systems cost ₹50,000+ upfront; no actionable analytics

### 5.3 Restaurant Staff (Waiter / Cashier)
- Goal: Accept/manage orders, print KOTs, generate bills
- Pain point: Running between tables and the kitchen

### 5.4 Kitchen Staff
- Goal: See orders clearly and in sequence
- Pain point: Misread paper tickets, unclear priorities

### 5.5 Paladeium Admin (Internal)
- Goal: Onboard restaurants, upload assets, manage subscriptions
- Pain point: Manual process needs to be fast and auditable

---

## 6. Product Overview

### 6.1 Application Surface Areas

| App | Users | Platform |
|---|---|---|
| **Customer AR Lens** | Diners | Mobile browser (iOS Safari, Android Chrome) |
| **Restaurant POS Dashboard** | Owner, Staff, Kitchen | PWA — Windows Chrome, Android tablet, iPad |
| **Paladeium Admin Panel** | Internal team | Web — desktop Chrome |
| **Restaurant Analytics** | Owner, Manager | Embedded in POS Dashboard |

### 6.2 Customer AR Lens — Feature Requirements

#### F-C1: AR Menu Scan
- Customer navigates to `paladeium.app/r/[restaurant-slug]` (via QR code on table or menu card)
- Camera opens; user points at restaurant's physical anchor card (menu card, table card, or coaster)
- AR detection locks within 2 seconds under normal indoor lighting
- 3D dish model appears anchored to the card surface
- Model auto-rotates and bobs gently (idle animation)

#### F-C2: 3D Model Interaction
- Single-finger drag: rotate model on Y and X axes
- Two-finger pinch: scale model up/down
- Double-tap: reset to default orientation
- Model remains anchored even when camera tilts ±45°

#### F-C3: Menu Browser
- Full scrollable menu accessible via slide-up panel
- Category filter pills (All, Starters, Mains, Desserts, Drinks, etc.)
- Each dish card: name, description, price, dietary badges, AR badge (if 3D model exists)
- Tapping a dish with AR badge loads its 3D model

#### F-C4: Cart & Order
- Add dish to cart from menu panel
- Cart badge shows item count
- Cart drawer: items, quantities, subtotal, special instructions per item
- Table number entry before checkout (manual, from QR or typed)
- Order confirmation screen with estimated wait time

#### F-C5: Payment
- Razorpay integration: UPI, credit/debit cards, wallets
- Order placed only after successful payment (or cash option if restaurant enables it)
- Digital receipt shown on-screen, email optional

#### F-C6: Fallback / Demo Mode
- If camera permission denied or WebGL fails: 3D preview mode (no camera)
- Menu browsing and ordering works in fallback mode

---

### 6.3 Restaurant POS Dashboard — Feature Requirements

#### F-P1: Order Queue (Live)
- Real-time incoming orders list (Socket.io)
- Each order: table number, items, special notes, time elapsed, total
- Actions: Accept, Reject, Mark Ready, Mark Delivered
- Audio alert on new order
- Filter by status: New / Preparing / Ready / Delivered

#### F-P2: Kitchen Display System (KDS) Mode
- Full-screen view optimised for kitchen TV or tablet
- Orders shown as cards, auto-sorted by time
- Green / yellow / red colour coding by age
- No interaction required — touch to mark as done

#### F-P3: Manual Order Entry
- Waiter can create an order for a table manually (walk-in, verbal order)
- Same menu as customer-facing, searchable
- Saved to order queue immediately

#### F-P4: Table Management
- Visual table map (configurable by manager)
- Table states: Empty / Occupied / Bill Requested / Closed
- Assign order to table

#### F-P5: Billing
- Generate itemised bill for any table
- Apply discounts (fixed or percentage)
- Split bill between guests
- Print via thermal printer (Web Serial API, Windows Chrome)
- Export as PDF

#### F-P6: Offline Mode
- Full menu available offline (Service Worker cache)
- Orders created offline stored in IndexedDB
- Sync queue uploads when internet returns
- Visual indicator: "Offline — X orders queued"
- Cash and UPI QR payments work offline; card payments require internet

#### F-P7: Menu Management (Restaurant Self-Service)
- Add / edit / disable menu items
- Set availability (time-based: breakfast / lunch / dinner)
- Update prices
- Upload dish photos
- Note: 3D model assignment done by Paladeium Admin

#### F-P8: Analytics (embedded)
- Peak hours heatmap (by day and hour)
- Top 10 dishes by orders and revenue
- Average order value over time
- Table turnover rate
- Daily / weekly / monthly revenue summary
- Export as CSV

#### F-P9: Staff Management
- Add staff accounts (role: manager, waiter, cashier, kitchen)
- Each role sees relevant screens only
- Activity log per staff member

---

### 6.4 Paladeium Admin Panel — Feature Requirements

#### F-A1: Restaurant Onboarding
- Manual registration form: name, address, GST number, bank details, plan, logo
- Approval workflow (pending → approved → live)
- Auto-generate restaurant slug and QR codes

#### F-A2: Menu & Asset Management
- Create menu categories and items per restaurant
- Upload dish images and 3D GLB models
- Assign models to dishes
- Trigger `targets.mind` recompilation (background job)
- Manage anchor images per restaurant

#### F-A3: QR Code Management
- Generate QR codes per table (links to AR Lens with table pre-filled)
- Bulk export as printable PDF sheet
- Regenerate / invalidate QR codes

#### F-A4: Subscription & Billing
- Manage restaurant plans (Basic, Pro, Enterprise)
- View payment history per restaurant
- Toggle features per plan

#### F-A5: Platform Analytics
- Total orders across all restaurants
- Revenue per restaurant (commission tracking)
- Active restaurants, churned restaurants
- AR scan events per day (funnel: scan → menu open → order placed)

---

## 7. AR Tracking Decision

**Technology: Image-Based AR (MindAR)**  
**Decision: Final — do not switch to plane detection**

Rationale:
- Image-based AR anchors the 3D model to the physical menu card — model stays exactly where it should be
- Plane detection (WebXR) floats in space, drifts on uneven table surfaces, poor UX
- Multi-angle 5-target approach (existing implementation) handles ±45° camera tilt
- No app install required — runs in Safari and Chrome via WebGL
- Full iOS support (plane detection WebXR has limited iOS support)

---

## 8. POS Platform Decision

**Technology: Progressive Web App (PWA) built with Next.js**  
**Runs on: Windows Chrome (primary POS), Android/iPad tablets, phones**

Rationale:
- Single codebase for all devices
- Installable via Chrome on Windows — behaves like a native app
- No App Store approval cycles
- Thermal printer support via Web Serial API (Chrome on Windows)
- Offline-first via Service Worker + IndexedDB

---

## 9. Hybrid Online/Offline Model

The POS operates in two modes:

**Online Mode:** Orders flow: Customer/Staff → API → PostgreSQL → Socket.io → Kitchen

**Offline Mode:** Orders flow: Staff → IndexedDB → local KDS queue → sync when online

Sync rules:
- Menu cached at app startup (Service Worker)
- Orders assigned a local UUID; merged on sync using timestamp + UUID
- No duplicate orders: idempotency key per order
- Payments: only cash or static UPI QR when offline; Razorpay requires internet

---

## 10. Data & Analytics

Events tracked (all timestamped, restaurant-scoped):
- `ar_scan_started` — customer opened AR lens
- `ar_anchor_found` — AR card detected
- `ar_model_loaded` — 3D model displayed
- `menu_item_viewed` — dish tapped in menu
- `cart_item_added`
- `order_placed`
- `order_paid`
- `order_accepted` / `rejected`
- `order_ready`
- `order_delivered`

All events stored in TimescaleDB hypertable for time-series queries. Analytics queries run against read replicas.

---

## 11. Security Requirements

- All API endpoints authenticated (JWT via Clerk)
- Row-level security in PostgreSQL: restaurants can only read their own data
- Paladeium admin has elevated role — full access
- Customer-facing endpoints are public (menu read, order create) but rate-limited
- Payment webhooks verified by Razorpay signature
- 3D model and asset URLs served via CDN with signed tokens (prevent hotlinking)
- PCI-DSS: no card data stored — Razorpay handles tokenisation

---

## 12. Performance Requirements

| Metric | Target |
|---|---|
| AR Lens initial load | < 3 seconds on 4G |
| AR target lock-on | < 2 seconds |
| 3D model load (GLB) | < 2 seconds (models < 5MB, CDN-served) |
| POS dashboard load | < 1.5 seconds |
| Order event latency (Socket.io) | < 500ms |
| API response time (p95) | < 200ms |
| Uptime | 99.9% |

---

## 13. Constraints

- Must work on 3-year-old mid-range Android phones (2GB RAM)
- Must work on iOS 15+ (Safari)
- No native app install required for customers
- Restaurant WiFi may be unreliable — offline mode is mandatory
- 3D models must be < 5MB each (bandwidth constraint)
- India-first: INR currency, Razorpay payments, GST billing

---

## 14. Open Questions

| # | Question | Decision Needed By |
|---|---|---|
| 1 | Self-service model upload by restaurant, or Paladeium-managed? | Phase 1 planning |
| 2 | Loyalty / points system in v1 or v2? | Phase 2 planning |
| 3 | Should customers create accounts, or guest checkout only? | Phase 1 planning |
| 4 | Commission model: per-order fee or monthly SaaS? | Business |
| 5 | Multi-branch restaurant support in v1? | Phase 1 planning |
