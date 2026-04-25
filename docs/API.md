# Paladeium — API Reference

**Base URL:** `https://api.paladeium.app/v1`  
**Auth:** Bearer token (Clerk JWT) in `Authorization` header  
**Content-Type:** `application/json`  
**Version:** 1.0

---

## Authentication

All endpoints require a valid JWT unless marked `[PUBLIC]`.

```
Authorization: Bearer <clerk_jwt>
```

JWT payload contains:
- `sub` — user ID (Clerk)
- `restaurant_id` — scoped restaurant (null for Paladeium admin)
- `role` — `paladeium_admin` | `restaurant_owner` | `restaurant_manager` | `restaurant_staff` | `kitchen`

Rate limits:
- Public endpoints: 100 requests/minute per IP
- Authenticated endpoints: 300 requests/minute per user

---

## Errors

All errors follow this shape:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with id xxx does not exist",
    "status": 404
  }
}
```

Common error codes:

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed Zod validation |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Restaurants

### `GET /restaurants` — List all restaurants
**Auth:** `paladeium_admin`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "The Grand Spice",
      "slug": "the-grand-spice",
      "address": "12 MG Road, Bangalore",
      "status": "active",
      "plan": "pro",
      "logo_url": "https://cdn.paladeium.app/logos/xxx.jpg",
      "created_at": "2026-04-25T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

---

### `POST /restaurants` — Create restaurant
**Auth:** `paladeium_admin`

**Body:**
```json
{
  "name": "The Grand Spice",
  "slug": "the-grand-spice",
  "address": "12 MG Road, Bangalore",
  "gst_number": "27AABCU9603R1ZX",
  "bank_account": "XXXXXXXX",
  "ifsc_code": "HDFC0001234",
  "plan": "basic",
  "owner_email": "owner@grandspice.com",
  "owner_phone": "+919876543210"
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "slug": "the-grand-spice",
    "status": "pending_approval"
  }
}
```

---

### `GET /restaurants/:id` — Get restaurant
**Auth:** `paladeium_admin` or `restaurant_owner` (own restaurant)

**Response 200:** Full restaurant object with settings.

---

### `PATCH /restaurants/:id` — Update restaurant
**Auth:** `paladeium_admin` or `restaurant_owner`

**Body:** Any subset of restaurant fields.

---

### `PATCH /restaurants/:id/status` — Approve/suspend restaurant
**Auth:** `paladeium_admin`

**Body:**
```json
{ "status": "active" }
```

Status values: `pending_approval` | `active` | `suspended`

---

## Menu

### `GET /restaurants/:restaurantId/menu` — Get full menu [PUBLIC]

**Response 200:**
```json
{
  "restaurant": {
    "id": "uuid",
    "name": "The Grand Spice",
    "logo_url": "https://cdn.paladeium.app/...",
    "targets_url": "https://cdn.paladeium.app/targets/xxx.mind",
    "currency": "INR"
  },
  "categories": [
    {
      "id": "uuid",
      "name": "Starters",
      "sort_order": 1,
      "items": [
        {
          "id": "uuid",
          "name": "Wagyu Smash Burger",
          "description": "Double patty, aged cheddar, truffle aioli",
          "price": 649,
          "price_formatted": "₹649",
          "emoji": "🍔",
          "image_url": "https://cdn.paladeium.app/dishes/xxx.jpg",
          "model_url": "https://cdn.paladeium.app/models/burger.glb",
          "has_ar": true,
          "available": true,
          "dietary_tags": ["non-veg"],
          "allergens": ["gluten", "dairy"]
        }
      ]
    }
  ]
}
```

**Caching:** Redis cache, 5-minute TTL. Invalidated when restaurant updates menu.

---

### `POST /restaurants/:restaurantId/categories` — Create category
**Auth:** `paladeium_admin` or `restaurant_manager`

**Body:**
```json
{
  "name": "Desserts",
  "sort_order": 5
}
```

---

### `POST /restaurants/:restaurantId/items` — Create menu item
**Auth:** `paladeium_admin` or `restaurant_manager`

**Body:**
```json
{
  "category_id": "uuid",
  "name": "Chocolate Lava Cake",
  "description": "Warm chocolate centre, vanilla ice cream",
  "price": 349,
  "emoji": "🍫",
  "dietary_tags": ["vegetarian"],
  "allergens": ["gluten", "dairy", "eggs"],
  "available": true
}
```

**Response 201:** Full menu item object.

---

### `PATCH /restaurants/:restaurantId/items/:itemId` — Update menu item
**Auth:** `paladeium_admin` or `restaurant_manager`

Use to toggle availability, update price, etc.

**Body (partial):**
```json
{ "available": false }
```

---

### `DELETE /restaurants/:restaurantId/items/:itemId` — Delete menu item
**Auth:** `paladeium_admin` or `restaurant_manager`

---

## Assets

### `POST /assets/upload-url` — Get presigned upload URL
**Auth:** `paladeium_admin`

**Body:**
```json
{
  "filename": "burger.glb",
  "content_type": "model/gltf-binary",
  "asset_type": "model"
}
```

Asset types: `model` | `image` | `anchor` | `logo`

**Response 200:**
```json
{
  "upload_url": "https://r2.paladeium.app/...",
  "cdn_url": "https://cdn.paladeium.app/models/burger.glb",
  "expires_in": 3600
}
```

Client uploads directly to R2 using `PUT` to `upload_url`. Then calls `PATCH /items/:id` with the `cdn_url`.

---

### `POST /restaurants/:restaurantId/compile-targets` — Trigger AR target compilation
**Auth:** `paladeium_admin`

Enqueues a BullMQ job to:
1. Download anchor images from R2
2. Generate 5 perspective warps (Sharp)
3. Compile targets.mind (Puppeteer)
4. Upload result to R2
5. Update `restaurant.targets_url`

**Body:**
```json
{
  "anchor_url": "https://cdn.paladeium.app/anchors/xxx.jpg"
}
```

**Response 202:**
```json
{
  "job_id": "uuid",
  "status": "queued",
  "estimated_seconds": 45
}
```

---

### `GET /jobs/:jobId` — Get job status
**Auth:** `paladeium_admin` or `restaurant_owner`

**Response 200:**
```json
{
  "job_id": "uuid",
  "type": "compile-targets",
  "status": "completed",
  "result_url": "https://cdn.paladeium.app/targets/xxx.mind",
  "created_at": "2026-04-25T10:00:00Z",
  "completed_at": "2026-04-25T10:01:05Z"
}
```

Status values: `queued` | `active` | `completed` | `failed`

---

## Tables

### `GET /restaurants/:restaurantId/tables` — List tables
**Auth:** Restaurant staff

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "number": "T1",
      "label": "Window Table",
      "status": "occupied",
      "qr_code_url": "https://cdn.paladeium.app/qr/xxx.png",
      "ar_url": "https://paladeium.app/r/the-grand-spice?table=T1"
    }
  ]
}
```

---

### `POST /restaurants/:restaurantId/tables` — Create table
**Auth:** `paladeium_admin` or `restaurant_manager`

**Body:**
```json
{
  "number": "T1",
  "label": "Window Table"
}
```

Auto-generates QR code (background job).

---

### `POST /restaurants/:restaurantId/tables/generate-qr-pdf` — Export all QR codes
**Auth:** `paladeium_admin` or `restaurant_manager`

**Response 200:** PDF binary stream (application/pdf)

---

## Orders

### `POST /orders` — Create order [PUBLIC]

Called by Customer AR Lens after Razorpay payment succeeds.

**Body:**
```json
{
  "restaurant_id": "uuid",
  "table_number": "T1",
  "idempotency_key": "client-generated-uuid",
  "items": [
    {
      "menu_item_id": "uuid",
      "quantity": 2,
      "special_instructions": "Extra spicy"
    }
  ],
  "payment": {
    "razorpay_order_id": "order_xxx",
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "signature_xxx",
    "method": "upi",
    "amount": 1298
  }
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-0042",
    "status": "confirmed",
    "table_number": "T1",
    "items": [...],
    "total": 1298,
    "estimated_wait_minutes": 20
  }
}
```

**Side effects:**
- Emits `order:new` via Socket.io to `restaurant:{id}` room
- Logs `order_placed` event to analytics

---

### `GET /restaurants/:restaurantId/orders` — List orders
**Auth:** Restaurant staff

**Query params:**
- `status` — filter by status (comma-separated)
- `table` — filter by table number
- `date` — filter by date (YYYY-MM-DD), defaults to today
- `page`, `per_page`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "order_number": "ORD-0042",
      "table_number": "T1",
      "status": "preparing",
      "items": [
        {
          "id": "uuid",
          "name": "Wagyu Smash Burger",
          "quantity": 2,
          "price": 649,
          "special_instructions": "Extra spicy"
        }
      ],
      "subtotal": 1298,
      "discount": 0,
      "total": 1298,
      "payment_method": "upi",
      "payment_status": "paid",
      "created_at": "2026-04-25T19:32:00Z",
      "accepted_at": "2026-04-25T19:33:10Z"
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 50
}
```

---

### `PATCH /orders/:orderId/status` — Update order status
**Auth:** Restaurant staff

**Body:**
```json
{ "status": "preparing" }
```

Status flow: `confirmed` → `accepted` → `preparing` → `ready` → `delivered` | `cancelled`

**Side effects:** Emits `order:updated` to Socket.io room.

---

### `POST /orders/:orderId/items` — Add items to existing order (manual)
**Auth:** Restaurant staff

Used for manual waiter additions after initial order.

---

### `GET /orders/:orderId/bill` — Generate bill
**Auth:** Restaurant staff

**Query params:**
- `format` — `json` (default) | `pdf`

**Response (json):**
```json
{
  "order_number": "ORD-0042",
  "table": "T1",
  "items": [...],
  "subtotal": 1298,
  "discount_label": "",
  "discount_amount": 0,
  "gst_rate": 5,
  "gst_amount": 61.81,
  "total": 1359.81,
  "payment_status": "paid",
  "payment_method": "upi",
  "issued_at": "2026-04-25T20:45:00Z",
  "restaurant": {
    "name": "The Grand Spice",
    "address": "...",
    "gst_number": "..."
  }
}
```

---

## Payments

### `POST /payments/razorpay/create-order` — Create Razorpay order
**Auth:** Public (called from Customer AR Lens before checkout)

**Body:**
```json
{
  "restaurant_id": "uuid",
  "amount": 1298,
  "currency": "INR",
  "receipt": "paladeium-cart-uuid"
}
```

**Response 200:**
```json
{
  "razorpay_order_id": "order_xxx",
  "amount": 1298,
  "currency": "INR",
  "key_id": "rzp_live_xxx"
}
```

---

### `POST /payments/razorpay/webhook` — Razorpay webhook
**Auth:** Razorpay signature header (`X-Razorpay-Signature`)

Handles: `payment.captured`, `payment.failed`, `refund.created`

---

## Analytics

### `POST /events` — Log analytics event [PUBLIC, rate-limited]

**Body:**
```json
{
  "restaurant_id": "uuid",
  "event_type": "ar_anchor_found",
  "session_id": "client-uuid",
  "properties": {
    "table_number": "T1",
    "device_type": "android"
  },
  "ts": "2026-04-25T19:30:00Z"
}
```

Event types: `ar_scan_started` | `ar_anchor_found` | `ar_model_loaded` | `menu_item_viewed` | `cart_item_added` | `order_placed` | `order_paid`

---

### `GET /restaurants/:restaurantId/analytics/summary` — Analytics summary
**Auth:** `restaurant_owner` or `paladeium_admin`

**Query params:**
- `period` — `today` | `week` | `month` | `custom`
- `start_date`, `end_date` — for `custom` period

**Response 200:**
```json
{
  "period": "week",
  "revenue": {
    "total": 128450,
    "currency": "INR",
    "vs_previous_period_pct": 12.5
  },
  "orders": {
    "total": 189,
    "average_value": 679.63,
    "vs_previous_period_pct": 8.2
  },
  "ar_funnel": {
    "scans": 412,
    "anchors_found": 380,
    "menus_opened": 356,
    "orders_placed": 189,
    "conversion_pct": 45.9
  },
  "top_dishes": [
    { "name": "Wagyu Smash Burger", "orders": 68, "revenue": 44132 }
  ],
  "peak_hours": [
    { "hour": 13, "orders": 42 },
    { "hour": 20, "orders": 61 }
  ]
}
```

---

## Socket.io Events

**Connection:** `wss://api.paladeium.app`  
**Auth:** Same JWT as REST, passed in socket handshake `auth.token`

### Client → Server

| Event | Payload | Who sends |
|---|---|---|
| `join:restaurant` | `{ restaurant_id }` | POS Dashboard on login |
| `join:kitchen` | `{ restaurant_id }` | KDS screen on open |

### Server → Client

| Event | Payload | Who receives |
|---|---|---|
| `order:new` | Full order object | Restaurant room |
| `order:updated` | `{ order_id, status, updated_at }` | Restaurant room |
| `order:cancelled` | `{ order_id, reason }` | Restaurant room |
| `table:status_changed` | `{ table_id, status }` | Restaurant room |
| `menu:updated` | `{ restaurant_id }` | AR Lens (invalidate cache) |
