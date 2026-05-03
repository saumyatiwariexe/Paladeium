export type RestaurantStatus = 'active' | 'inactive' | 'pending' | 'pendingDeletion'

export type UIType = 'ar' | 'dynamic'

export interface Restaurant {
  id: string
  name: string
  slug: string
  description: string
  status: RestaurantStatus
  targetsUrl: string | null
  markerDetectionEnabled?: boolean
  arOverlayEnabled?: boolean
  uiType?: UIType
  paymentEnabled?: boolean
  deleteAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface MenuCategory {
  id: string
  restaurantId: string
  name: string
  emoji: string
  sortOrder: number
}

export interface MenuItem {
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string
  price: number
  emoji: string
  imageUrl: string
  modelUrl: string
  modelScale?: number
  hasAr: boolean
  dietaryTags: string[]
  available: boolean
  createdAt: string
}

export interface OrderItem {
  id: string
  name: string
  price: string
  qty: number
}

export interface Order {
  id: string
  restaurantId: string
  restaurantSlug: string
  customer: {
    name: string
    phone: string
    address: string
    gender: string
    age: number
  }
  items: OrderItem[]
  total: number
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
}

export interface Database {
  restaurants: Restaurant[]
  categories: MenuCategory[]
  items: MenuItem[]
  orders: Order[]
}

// Shape consumed by the AR Lens
export interface LensMenuItem {
  id: string
  name: string
  desc: string
  price: string
  emoji: string
  cat: string
  model: string | null
  modelScale?: number | null
  hasAR: boolean
}

export interface LensMenuResponse {
  restaurant: {
    id: string
    name: string
    slug: string
    targetsUrl: string | null
    currency: string
    markerDetectionEnabled: boolean
    arOverlayEnabled: boolean
    uiType: UIType
    paymentEnabled: boolean
  }
  menu: LensMenuItem[]
  categories: Array<{ id: string; name: string; emoji: string }>
}
