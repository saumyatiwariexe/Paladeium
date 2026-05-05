'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingBag, CheckCircle2, XCircle, Clock, Bell, BellOff, ChevronDown, ChevronUp, Package } from 'lucide-react'

interface OrderItem { id: string; name: string; price: string; qty: number }
interface Order {
  id: string
  restaurantId: string
  customer: { name: string; phone: string; address: string; gender: string; age: number }
  items: OrderItem[]
  total: number
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const map = {
    pending:   { cls: 'bg-amber-500/10 text-amber-400',   label: 'Pending',   icon: Clock },
    confirmed: { cls: 'bg-[#22C55E]/10 text-[#22C55E]',  label: 'Confirmed', icon: CheckCircle2 },
    rejected:  { cls: 'bg-red-500/10 text-red-400',       label: 'Rejected',  icon: XCircle },
  }
  const { cls, label, icon: Icon } = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  )
}

function OrderCard({
  order, onConfirm, onReject, updating,
}: {
  order: Order
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  updating: boolean
}) {
  const [expanded, setExpanded] = useState(order.status === 'pending')

  return (
    <div className={`bg-[#13151E] border rounded-2xl overflow-hidden transition-all ${
      order.status === 'pending' ? 'border-amber-500/30' : 'border-white/[0.07]'
    }`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          order.status === 'pending' ? 'bg-amber-500/10' : 'bg-[#1A1D2A]'
        }`}>
          <ShoppingBag size={16} className={order.status === 'pending' ? 'text-amber-400' : 'text-[#4B4F65]'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[#E8EAFF] text-sm font-bold">{order.customer.name}</p>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-[#4B4F65] text-xs mt-0.5">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·
            ₹{order.total.toFixed(2)} · {timeAgo(order.createdAt)}
          </p>
        </div>

        <div className="shrink-0 text-[#4B4F65]">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.05]">
          <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
            <div>
              <p className="text-[#4B4F65] text-[10px] font-semibold uppercase tracking-wider mb-1">Customer</p>
              <p className="text-[#E8EAFF] text-sm font-semibold">{order.customer.name}</p>
              <p className="text-[#8B90B0] text-xs">{order.customer.phone}</p>
              <p className="text-[#8B90B0] text-xs mt-0.5">{order.customer.address}</p>
            </div>
            <div>
              <p className="text-[#4B4F65] text-[10px] font-semibold uppercase tracking-wider mb-1">Order Total</p>
              <p className="text-[#E8EAFF] text-xl font-black">₹{order.total.toFixed(2)}</p>
              <p className="text-[#4B4F65] text-xs mt-0.5 font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="bg-[#1A1D2A] rounded-xl overflow-hidden mb-4">
            {order.items.map((item, i) => (
              <div key={item.id + i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#7C5CFC]/20 flex items-center justify-center text-[10px] font-black text-[#A78BFA]">
                    {item.qty}
                  </span>
                  <span className="text-[#E8EAFF] text-sm">{item.name}</span>
                </div>
                <span className="text-[#8B90B0] text-sm">{item.price}</span>
              </div>
            ))}
          </div>

          {order.status === 'pending' && (
            <div className="flex gap-3">
              <button
                onClick={() => onReject(order.id)}
                disabled={updating}
                className="flex-1 h-10 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <XCircle size={14} /> Reject
              </button>
              <button
                onClick={() => onConfirm(order.id)}
                disabled={updating}
                className="flex-1 h-10 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Confirm
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Tiny beep using Web Audio API
function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35)
  } catch { /* ignore */ }
}

export default function OrdersPage() {
  const params = useParams<{ id: string }>()
  // The [id] param is the restaurant id; orders API uses slug-or-id
  const restaurantId = params.id

  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [updating, setUpdating]       = useState<string | null>(null)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [toast, setToast]             = useState<string | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res  = await fetch(`/api/restaurants/${restaurantId}/orders`)
      if (!res.ok) { setError('Failed to load orders'); return }
      const data = await res.json() as Order[]

      if (!isFirstLoad.current) {
        // Check for new pending orders
        const newPending = data.filter(
          o => o.status === 'pending' && !knownIdsRef.current.has(o.id)
        )
        if (newPending.length > 0) {
          beep()
          showToast(`${newPending.length} new order${newPending.length > 1 ? 's' : ''} arrived!`)
          if (notifEnabled && Notification.permission === 'granted') {
            new Notification('New order — Paladeium', {
              body: `${newPending.length} new order${newPending.length > 1 ? 's' : ''} waiting for confirmation`,
              icon: '/favicon.ico',
            })
          }
        }
      }

      data.forEach(o => knownIdsRef.current.add(o.id))
      isFirstLoad.current = false
      setOrders(data)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [restaurantId, notifEnabled, showToast])

  // Initial load + poll every 8 seconds
  useEffect(() => {
    fetchOrders()
    const id = setInterval(fetchOrders, 8000)
    return () => clearInterval(id)
  }, [fetchOrders])

  async function handleStatus(orderId: string, status: 'confirmed' | 'rejected') {
    setUpdating(orderId)
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/orders`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch {
      showToast('Failed to update order status')
    } finally {
      setUpdating(null)
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifEnabled(perm === 'granted')
  }

  const pending   = orders.filter(o => o.status === 'pending')
  const confirmed = orders.filter(o => o.status === 'confirmed')
  const rejected  = orders.filter(o => o.status === 'rejected')

  return (
    <div className="p-8 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-[#7C5CFC] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl shadow-[#7C5CFC]/30 animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[#E8EAFF] font-black text-2xl mb-1">Orders</h1>
          <p className="text-[#8B90B0] text-sm">
            {loading ? 'Loading…' : `${pending.length} pending · ${confirmed.length} confirmed · ${rejected.length} rejected`}
          </p>
        </div>

        <button
          onClick={notifEnabled ? () => setNotifEnabled(false) : enableNotifications}
          title={notifEnabled ? 'Notifications on' : 'Enable notifications'}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            notifEnabled ? 'bg-[#7C5CFC]/20 text-[#A78BFA]' : 'bg-[#13151E] border border-white/[0.07] text-[#4B4F65] hover:text-[#8B90B0]'
          }`}>
          {notifEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-[#13151E] border border-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Pending orders — always first */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em]">Pending</p>
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                  {pending.length}
                </span>
              </div>
              <div className="space-y-3">
                {pending.map(o => (
                  <OrderCard key={o.id} order={o}
                    onConfirm={id => handleStatus(id, 'confirmed')}
                    onReject={id => handleStatus(id, 'rejected')}
                    updating={updating === o.id} />
                ))}
              </div>
            </div>
          )}

          {/* Confirmed */}
          {confirmed.length > 0 && (
            <div className="mb-6">
              <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] mb-3">Confirmed</p>
              <div className="space-y-2">
                {confirmed.map(o => (
                  <OrderCard key={o.id} order={o}
                    onConfirm={() => {}} onReject={() => {}} updating={false} />
                ))}
              </div>
            </div>
          )}

          {/* Rejected */}
          {rejected.length > 0 && (
            <div className="mb-6">
              <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] mb-3">Rejected</p>
              <div className="space-y-2">
                {rejected.map(o => (
                  <OrderCard key={o.id} order={o}
                    onConfirm={() => {}} onReject={() => {}} updating={false} />
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {orders.length === 0 && (
            <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1A1D2A] flex items-center justify-center mx-auto mb-4">
                <Package size={20} className="text-[#4B4F65]" />
              </div>
              <p className="text-[#E8EAFF] font-bold text-sm mb-1">No orders yet</p>
              <p className="text-[#4B4F65] text-xs">Orders will appear here automatically as they come in.</p>
            </div>
          )}
        </>
      )}

      {/* Live indicator */}
      <div className="flex items-center gap-2 mt-8">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
        <p className="text-[#4B4F65] text-xs">Auto-refreshes every 8 seconds</p>
      </div>
    </div>
  )
}
