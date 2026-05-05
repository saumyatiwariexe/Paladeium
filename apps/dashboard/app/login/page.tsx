'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [show,     setShow]     = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; role?: string }
      if (res.ok) {
        router.push(data.role === 'superadmin' ? '/company' : '/restaurants')
        router.refresh()
      } else {
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-[#0F1117] border-r border-white/[0.05] p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7C5CFC] flex items-center justify-center">
            <span className="text-white font-black text-base">P</span>
          </div>
          <span className="text-[#E8EAFF] font-black text-lg">Paladeium</span>
        </div>

        <div>
          <div className="space-y-4 mb-10">
            {[
              { icon: '🍽️', title: 'AR Menus', desc: 'Bring dishes to life in augmented reality' },
              { icon: '📊', title: 'Smart Analytics', desc: 'AI-powered dish scoring and recommendations' },
              { icon: '👥', title: 'Team Access', desc: 'Role-based access for owners, managers and staff' },
            ].map(f => (
              <div key={f.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1A1D2A] flex items-center justify-center shrink-0 text-lg">{f.icon}</div>
                <div>
                  <p className="text-[#E8EAFF] text-sm font-bold">{f.title}</p>
                  <p className="text-[#4B4F65] text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[#4B4F65] text-xs">© {new Date().getFullYear()} Paladeium. All rights reserved.</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-[#7C5CFC] flex items-center justify-center">
              <span className="text-white font-black text-sm">P</span>
            </div>
            <span className="text-[#E8EAFF] font-black">Paladeium</span>
          </div>

          <h1 className="text-[#E8EAFF] font-black text-3xl mb-1">Welcome back</h1>
          <p className="text-[#8B90B0] text-sm mb-8">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@example.com" autoFocus
                className="w-full bg-[#13151E] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 focus:bg-[#1A1D2A] transition-all"
              />
            </div>

            <div>
              <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••"
                  className="w-full bg-[#13151E] border border-white/[0.07] rounded-xl px-4 py-3 pr-11 text-sm text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 focus:bg-[#1A1D2A] transition-all"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B4F65] hover:text-[#8B90B0] transition-colors">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-12 bg-[#7C5CFC] hover:bg-[#8D6FFD] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
