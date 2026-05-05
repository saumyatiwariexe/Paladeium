import type { SessionData } from './session'
import type { UserRole } from './types'

export type Action =
  | 'read'          // view pages / GET data
  | 'write'         // create/update items
  | 'delete'        // hard delete items/restaurants
  | 'invite'        // send invitations to new users
  | 'manage_team'   // view/remove team members
  | 'system'        // system-level settings (AR config, payment toggle)

const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  owner:      3,
  manager:    2,
  staff:      1,
}

export function hasRole(session: SessionData, minimum: UserRole): boolean {
  const rank = ROLE_HIERARCHY[session.role ?? 'staff'] ?? 0
  return rank >= ROLE_HIERARCHY[minimum]
}

export function canAccessRestaurant(session: SessionData, restaurantId: string): boolean {
  if (session.role === 'superadmin') return true
  return session.restaurantIds?.includes(restaurantId) ?? false
}

export function canPerform(session: SessionData, action: Action, restaurantId?: string): boolean {
  const role = session.role ?? 'staff'

  if (role === 'superadmin') return true

  // Must have access to the specific restaurant
  if (restaurantId && !canAccessRestaurant(session, restaurantId)) return false

  switch (action) {
    case 'read':        return true
    case 'write':       return role === 'owner' || role === 'manager'
    case 'delete':      return role === 'owner'
    case 'invite':      return role === 'owner' || role === 'manager'
    case 'manage_team': return role === 'owner' || role === 'manager'
    case 'system':      return role === 'owner'
    default:            return false
  }
}

// Which roles can a given role invite?
export function invitableRoles(inviterRole: UserRole): UserRole[] {
  switch (inviterRole) {
    case 'superadmin': return ['owner', 'manager', 'staff']
    case 'owner':      return ['manager', 'staff']
    case 'manager':    return ['staff']
    default:           return []
  }
}
