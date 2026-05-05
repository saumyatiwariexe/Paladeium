import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin, hasSupabase } from '@/lib/supabase'

const EventSchema = z.object({
  sessionId:    z.string().uuid().optional(),
  restaurantId: z.string().min(1),
  menuItemId:   z.string().uuid().optional(),
  eventType:    z.enum([
    'session_start','session_end',
    'dish_view','dish_select',
    'ar_start','ar_rotate','ar_zoom','ar_end',
    'add_to_cart','remove_from_cart',
    'checkout_start','order_placed',
  ]),
  properties:   z.record(z.unknown()).optional().default({}),
})

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => null)
    const parsed = EventSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid event' },
        { status: 422, headers: CORS }
      )
    }

    const { sessionId, restaurantId, menuItemId, eventType, properties } = parsed.data

    // If Supabase is configured, persist to DB
    if (hasSupabase() && supabaseAdmin) {
      const { error } = await supabaseAdmin.from('events').insert({
        session_id:    sessionId    ?? null,
        restaurant_id: restaurantId,
        menu_item_id:  menuItemId   ?? null,
        event_type:    eventType,
        properties,
      })
      if (error) console.error('[track/event] supabase error:', error.message)
    }
    // If no Supabase — event is accepted but not persisted (fire-and-forget mode)

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('[track/event]', err)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500, headers: CORS })
  }
}
