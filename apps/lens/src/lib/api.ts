import { Dish, Restaurant } from './types';

function getDashboardApiBase() {
  const configured = process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (/^(localhost|127\.0\.0\.1)$/.test(hostname)) {
      return 'http://localhost:3000';
    }
    if (hostname.includes('menu.')) {
      return origin.replace('://menu.', '://dashboard.');
    }
    if (hostname.includes('-lens.')) {
      return origin.replace('-lens.', '-dashboard.');
    }
  }

  return '';
}

export async function fetchRestaurantData(slug: string): Promise<{ menu: Dish[], restaurant: Restaurant, categories: string[] }> {
  const dashboardApi = getDashboardApiBase();
  if (!dashboardApi) {
    throw new Error('Dashboard API URL is not configured');
  }

  const res = await fetch(`${dashboardApi}/api/restaurants/${slug}/menu`);
  if (!res.ok) throw new Error('Failed to fetch menu');
  
  const data = await res.json();
  
  const menu: Dish[] = (data.menu || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    desc: item.desc || '',
    price: typeof item.price === 'number' ? '₹' + item.price : (item.price || ''),
    emoji: item.emoji || '🍽️',
    cat: (item.cat || 'other').toLowerCase(),
    model: item.model ? (item.model.startsWith('http') ? item.model : `${dashboardApi}${item.model}`) : null,
    modelScale: item.modelScale || 1.0,
    hasAR: item.hasAR ?? false,
  }));

  return {
    menu,
    categories: ['all', ...(data.categories || []).map((c: any) => c.name.toLowerCase())],
    restaurant: {
      slug: data.restaurant?.slug || slug,
      name: data.restaurant?.name || 'Paladeium',
      uiType: data.restaurant?.uiType || 'dynamic',
      paymentEnabled: data.restaurant?.paymentEnabled || false,
      markerDetectionEnabled: data.restaurant?.markerDetectionEnabled ?? true,
      targetsUrl: data.restaurant?.targetsUrl ?? null,
    }
  };
}
