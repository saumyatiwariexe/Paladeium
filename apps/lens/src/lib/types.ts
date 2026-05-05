export interface Dish {
  id: string;
  name: string;
  desc: string;
  price: string;
  emoji: string;
  cat: string;
  model: string | null;
  modelScale: number;
  hasAR: boolean;
}

export interface Restaurant {
  name: string;
  uiType: 'ar' | 'dynamic';
  paymentEnabled: boolean;
  markerDetectionEnabled: boolean;
  targetsUrl: string | null;
}

export interface AppState {
  dishes: Dish[];
  categories: string[];
  activeDishId: string | null;
  activeCategory: string;
  viewMode: 'preview' | 'ar';
  cart: { dish: Dish; qty: number }[];
  restaurant: Restaurant | null;
}
