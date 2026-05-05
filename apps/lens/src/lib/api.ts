import { Dish, Restaurant } from './types';

const DASHBOARD_API = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://paladeium-lens.vercel.app';

export async function fetchRestaurantData(slug: string): Promise<{ menu: Dish[], restaurant: Restaurant, categories: string[] }> {
  const res = await fetch(`${DASHBOARD_API}/api/restaurants/${slug}/menu`);
  if (!res.ok) throw new Error('Failed to fetch menu');
  
  const data = await res.json();
  
  const menu: Dish[] = (data.menu || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    desc: item.desc || '',
    price: typeof item.price === 'number' ? '₹' + item.price : (item.price || ''),
    emoji: item.emoji || '🍽️',
    cat: (item.cat || 'other').toLowerCase(),
    model: item.model ? (item.model.startsWith('http') ? item.model : `${DASHBOARD_API}${item.model}`) : null,
    modelScale: item.modelScale || 1.0,
    hasAR: item.hasAR ?? false,
  }));

  return {
    menu,
    categories: ['all', ...(data.categories || []).map((c: any) => c.name.toLowerCase())],
    restaurant: {
      name: data.restaurant?.name || 'Paladeium',
      uiType: data.restaurant?.uiType || 'dynamic',
      paymentEnabled: data.restaurant?.paymentEnabled || false,
      markerDetectionEnabled: data.restaurant?.markerDetectionEnabled ?? true,
      targetsUrl: data.restaurant?.targetsUrl ?? null,
    }
  };
}
