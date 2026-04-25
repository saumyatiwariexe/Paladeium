'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push('/restaurants')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[#D4A853] font-bold text-2xl tracking-widest uppercase">Paladeium</div>
          <div className="text-white/30 text-sm mt-1">Admin Dashboard</div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#0F0F1A] border border-white/5 rounded-xl p-8 space-y-5"
        >
          <h1 className="text-white font-semibold text-lg">Sign in</h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#D4A853]/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4A853] hover:bg-[#C49840] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg px-4 py-2.5 transition-all"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
