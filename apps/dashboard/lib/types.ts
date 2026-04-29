export type RestaurantStatus = 'active' | 'inactive' | 'pending' | 'pendingDeletion'

export interface Restaurant {
  id: string
  name: string
  slug: string
  description: string
  status: RestaurantStatus
  targetsUrl: string | null
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

export interface ModelDimensions {
  length: number
  breadth: number
  height: number
  unit: 'm' | 'cm' | 'in'
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
  hasAr: boolean
  dietaryTags: string[]
  available: boolean
  createdAt: string
  dimensions?: ModelDimensions
}

export interface Database {
  restaurants: Restaurant[]
  categories: MenuCategory[]
  items: MenuItem[]
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
  hasAR: boolean
  dimensions?: ModelDimensions
}

export interface LensMenuResponse {
  restaurant: {
    id: string
    name: string
    slug: string
    targetsUrl: string | null
    currency: string
  }
  menu: LensMenuItem[]
  categories: Array<{ id: string; name: string; emoji: string }>
}
