import { createClient } from '@supabase/supabase-js'

const url   = process.env.NEXT_PUBLIC_SUPABASE_URL   ?? ''
const anon  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? ''

export function hasSupabase() {
  return !!(url && (anon || svcKey))
}

// Browser / server-component client (uses anon key, obeys RLS)
export const supabase = url
  ? createClient(url, anon)
  : null

// Service-role client (bypasses RLS — only use in API routes)
export const supabaseAdmin = url && svcKey
  ? createClient(url, svcKey, { auth: { persistSession: false } })
  : null

export type { SupabaseClient } from '@supabase/supabase-js'

// ── Typed row shapes that mirror the SQL schema ───────────────

export interface DbRestaurant {
  id: string; company_id: string | null; name: string; slug: string
  description: string; status: string; plan: string
  monthly_fee: number; ui_type: string; payment_enabled: boolean
  ar_overlay_enabled: boolean; marker_detection_enabled: boolean
  targets_url: string | null; created_at: string; updated_at: string
}

export interface DbMenuItem {
  id: string; restaurant_id: string; category_id: string | null
  name: string; description: string; price: number; emoji: string
  image_url: string; model_url: string; model_scale: number | null
  has_ar: boolean; dietary_tags: string[]; available: boolean; created_at: string
}

export interface DbOrder {
  id: string; restaurant_id: string; restaurant_slug: string
  customer_name: string | null; total: number; status: string; created_at: string
}

export interface DbEvent {
  id: number; session_id: string | null; restaurant_id: string
  menu_item_id: string | null; event_type: string
  properties: Record<string, unknown>; created_at: string
}

export interface DbDishStat {
  menu_item_id: string; restaurant_id: string; name: string; price: number
  emoji: string; has_ar: boolean; views: number; ar_views: number
  cart_adds: number; orders: number; revenue: number
  conversion_rate: number; ar_engagement_rate: number
}
