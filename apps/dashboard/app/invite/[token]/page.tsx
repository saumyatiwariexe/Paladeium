'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

interface InviteInfo {
  email: string
  role: string
  restaurants: { id: string; name: string }[]
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager', staff: 'Staff', superadmin: 'Super Admin',
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()

  const [info,      setInfo]      = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [show,      setShow]      = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then((d: InviteInfo & { error?: string }) => {
        if (d.error) setLoadError(d.error)
        else setInfo(d)
      })
      .catch(() => setLoadError('Failed to load invite'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setSubmitting(true); setError('')

    const res  = await fetch(`/api/invites/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; role?: string }

    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setSubmitting(false); return }

    setDone(true)
    setTimeout(() => {
      router.push(data.role === 'superadmin' ? '/company' : '/restaurants')
      router.refresh()
    }, 1500)
  }

  // ── Error / expired ──────────────────────────────────────────
  if (loadError) return (
    <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-6">
      <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-10 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🔗</span>
        </div>
        <h2 className="text-[#E8EAFF] text-xl font-black mb-2">Link invalid</h2>
        <p className="text-[#8B90B0] text-sm leading-relaxed">{loadError}</p>
      </div>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────
  if (!info) return (
    <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-[#7C5CFC] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Success ──────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-6">
      <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-10 max-w-sm w-full text-center">
        <CheckCircle2 size={48} className="text-[#22C55E] mx-auto mb-4" />
        <h2 className="text-[#E8EAFF] text-xl font-black mb-2">All set!</h2>
        <p className="text-[#8B90B0] text-sm">Signing you in…</p>
      </div>
    </div>
  )

  // ── Set password form ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#7C5CFC] mb-4">
            <span className="text-white font-black text-lg">P</span>
          </div>
          <h1 className="text-[#E8EAFF] font-black text-2xl">Paladeium</h1>
        </div>

        <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-8">
          {/* Invite context */}
          <div className="bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 rounded-xl px-4 py-3 mb-6">
            <p className="text-[#E8EAFF] text-sm font-bold">{info.email}</p>
            <p className="text-[#8B90B0] text-xs mt-0.5">
              {ROLE_LABELS[info.role] ?? info.role}
              {info.restaurants.length > 0 && ` · ${info.restaurants.map(r => r.name).join(', ')}`}
            </p>
          </div>

          <h2 className="text-[#E8EAFF] font-black text-lg mb-1">Set your password</h2>
          <p className="text-[#8B90B0] text-sm mb-6">Choose a strong password to secure your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoFocus
                  className="w-full bg-[#1A1D2A] border border-white/[0.07] rounded-xl px-4 py-3 pr-11 text-sm text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 transition-all"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B4F65] hover:text-[#8B90B0]">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">Confirm password</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full bg-[#1A1D2A] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !password || !confirm}
              className="w-full h-12 bg-[#7C5CFC] hover:bg-[#8D6FFD] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {submitting ? 'Setting up…' : 'Create account & sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
