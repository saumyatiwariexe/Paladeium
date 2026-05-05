'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { UserPlus, Trash2, Mail, Clock, CheckCircle2, Copy, X, ChevronDown } from 'lucide-react'

type UserRole = 'owner' | 'manager' | 'staff'
type UserStatus = 'active' | 'invited'

interface TeamMember {
  id: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  restaurantIds: string[]
}

const ROLE_COLORS: Record<UserRole | 'superadmin', string> = {
  superadmin: 'bg-[#7C5CFC]/20 text-[#A78BFA]',
  owner:      'bg-amber-500/10 text-amber-400',
  manager:    'bg-sky-500/10 text-sky-400',
  staff:      'bg-[#1A1D2A] text-[#8B90B0]',
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  owner:      'Owner',
  manager:    'Manager',
  staff:      'Staff',
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role as UserRole] ?? 'bg-[#1A1D2A] text-[#8B90B0]'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#22C55E]">
        <CheckCircle2 size={11} /> Active
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
      <Clock size={11} /> Pending invite
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 30) return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (days > 0) return `${days}d ago`
  const hrs = Math.floor(diff / 3600000)
  if (hrs > 0) return `${hrs}h ago`
  return 'Just now'
}

interface InviteFormProps {
  restaurantId: string
  sessionRole: string
  onInvited: (inviteUrl: string, email: string) => void
  onClose: () => void
}

function InviteForm({ restaurantId, sessionRole, onInvited, onClose }: InviteFormProps) {
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState<UserRole>('staff')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const allowedRoles: UserRole[] = sessionRole === 'owner' || sessionRole === 'superadmin'
    ? ['manager', 'staff']
    : ['staff']
  if (sessionRole === 'superadmin') allowedRoles.unshift('owner')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/invites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, restaurantId }),
      })
      const data = await res.json().catch(() => ({})) as { inviteUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')
      onInvited(data.inviteUrl ?? '', email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#E8EAFF] font-bold text-sm">Invite team member</h3>
        <button onClick={onClose} className="text-[#4B4F65] hover:text-[#8B90B0] transition-colors">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="colleague@example.com" required autoFocus
            className="w-full px-4 py-3 text-sm rounded-xl bg-[#1A1D2A] border border-white/[0.07] text-[#E8EAFF] placeholder-[#4B4F65] focus:outline-none focus:border-[#7C5CFC]/50 transition-all" />
        </div>

        <div>
          <label className="block text-[#8B90B0] text-xs font-semibold uppercase tracking-wider mb-1.5">
            Role
          </label>
          <div className="relative">
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="w-full appearance-none px-4 py-3 text-sm rounded-xl bg-[#1A1D2A] border border-white/[0.07] text-[#E8EAFF] focus:outline-none focus:border-[#7C5CFC]/50 transition-all pr-10">
              {allowedRoles.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4B4F65] pointer-events-none" />
          </div>
        </div>

        <div className="bg-[#1A1D2A] rounded-xl px-4 py-3 text-xs text-[#4B4F65]">
          {role === 'manager'
            ? 'Manager can manage menu, view analytics, handle orders and invite staff.'
            : role === 'owner'
            ? 'Owner has full control over this restaurant including team management.'
            : 'Staff can view menu and manage orders only.'}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 text-sm rounded-xl bg-[#1A1D2A] border border-white/[0.07] text-[#8B90B0] hover:text-[#E8EAFF] transition-all">
            Cancel
          </button>
          <button type="submit" disabled={loading || !email}
            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-[#7C5CFC] hover:bg-[#8D6FFD] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all">
            {loading ? 'Sending…' : 'Send invite →'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface InviteSuccessProps {
  inviteUrl: string
  email: string
  onDismiss: () => void
}

function InviteSuccess({ inviteUrl, email, onDismiss }: InviteSuccessProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="bg-[#13151E] border border-[#22C55E]/20 rounded-2xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="text-[#22C55E] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[#E8EAFF] text-sm font-semibold mb-0.5">Invite sent to {email}</p>
          <p className="text-[#8B90B0] text-xs mb-3">Share this link if the email doesn't arrive.</p>
          <div className="flex items-center gap-2 bg-[#1A1D2A] border border-white/[0.07] rounded-xl px-3 py-2">
            <p className="flex-1 text-[#8B90B0] text-xs font-mono truncate">{inviteUrl}</p>
            <button onClick={copy} className="shrink-0 text-[#7C5CFC] hover:text-[#A78BFA] transition-colors">
              {copied ? <CheckCircle2 size={14} className="text-[#22C55E]" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-[#4B4F65] hover:text-[#8B90B0] transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const params       = useParams<{ id: string }>()
  const restaurantId = params.id

  const [members, setMembers]       = useState<TeamMember[]>([])
  const [sessionRole, setSessionRole] = useState<string>('staff')
  const [loading, setLoading]       = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; email: string } | null>(null)
  const [removing, setRemoving]     = useState<string | null>(null)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch(`/api/users?restaurantId=${restaurantId}`),
        fetch('/api/auth/me'),
      ])
      const users = await usersRes.json().catch(() => []) as TeamMember[]
      const me    = await meRes.json().catch(() => ({})) as { role?: string }
      setMembers(Array.isArray(users) ? users : [])
      setSessionRole(me.role ?? 'staff')
    } catch {
      setError('Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  async function handleRemove(memberId: string) {
    setRemoving(memberId)
    try {
      const res = await fetch(`/api/users/${memberId}?restaurantId=${restaurantId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to remove')
      }
      setMembers(m => m.filter(u => u.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  function handleInvited(url: string, email: string) {
    setShowInvite(false)
    setInviteResult({ url, email })
    load()
  }

  const canManage = sessionRole === 'superadmin' || sessionRole === 'owner' || sessionRole === 'manager'

  const active  = members.filter(m => m.status === 'active')
  const pending = members.filter(m => m.status === 'invited')

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[#E8EAFF] font-black text-2xl mb-1">Team</h1>
          <p className="text-[#8B90B0] text-sm">
            {loading ? 'Loading…' : `${active.length} active · ${pending.length} pending`}
          </p>
        </div>
        {canManage && !showInvite && (
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-[#7C5CFC] hover:bg-[#8D6FFD] text-white transition-all">
            <UserPlus size={15} />
            Invite member
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <InviteForm
          restaurantId={restaurantId}
          sessionRole={sessionRole}
          onInvited={handleInvited}
          onClose={() => setShowInvite(false)}
        />
      )}

      {/* Invite success */}
      {inviteResult && (
        <InviteSuccess
          inviteUrl={inviteResult.url}
          email={inviteResult.email}
          onDismiss={() => setInviteResult(null)}
        />
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-[#13151E] border border-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Active members */}
          {active.length > 0 && (
            <div className="mb-6">
              <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] mb-2">Members</p>
              <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {active.map(member => (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-[#7C5CFC]/20 flex items-center justify-center shrink-0">
                      <span className="text-[#A78BFA] text-[12px] font-black">
                        {member.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E8EAFF] text-sm font-semibold truncate">{member.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={member.status} />
                        <span className="text-[#4B4F65] text-[10px]">·</span>
                        <span className="text-[#4B4F65] text-[10px]">Joined {timeAgo(member.createdAt)}</span>
                      </div>
                    </div>
                    <RoleBadge role={member.role} />
                    {canManage && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removing === member.id}
                        title="Remove member"
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-40 shrink-0">
                        <Trash2 size={14} className="text-[#4B4F65] hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {pending.length > 0 && (
            <div className="mb-6">
              <p className="text-[#4B4F65] text-[9px] font-black uppercase tracking-[0.15em] mb-2">Pending invites</p>
              <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {pending.map(member => (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Mail size={16} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E8EAFF] text-sm font-semibold truncate">{member.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={member.status} />
                        <span className="text-[#4B4F65] text-[10px]">·</span>
                        <span className="text-[#4B4F65] text-[10px]">Invited {timeAgo(member.createdAt)}</span>
                      </div>
                    </div>
                    <RoleBadge role={member.role} />
                    {canManage && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removing === member.id}
                        title="Revoke invite"
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-40 shrink-0">
                        <X size={14} className="text-[#4B4F65] hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {members.length === 0 && (
            <div className="bg-[#13151E] border border-white/[0.07] rounded-2xl p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1A1D2A] flex items-center justify-center mx-auto mb-4">
                <UserPlus size={20} className="text-[#4B4F65]" />
              </div>
              <p className="text-[#E8EAFF] font-bold text-sm mb-1">No team members yet</p>
              <p className="text-[#4B4F65] text-xs">
                {canManage ? 'Invite your first team member using the button above.' : 'Your team will appear here.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
