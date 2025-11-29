import type { RouteOption } from '@/types/map';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const ROUTE_CACHE_DURATION = 300000;

interface CachedRoute {
  routes: RouteOption[];
  timestamp: number;
  key: string;
}

const routeCache = new Map<string, CachedRoute>();

interface OSRMResponse {
  code: string;
  routes: {
    geometry: {
      coordinates: number[][];
    };
    distance: number;
    duration: number;
  }[];
}

function simplifyPath(
  coordinates: { latitude: number; longitude: number }[],
  tolerance: number = 0.00005
): { latitude: number; longitude: number }[] {
  if (coordinates.length <= 2) return coordinates;

  let maxDistance = 0;
  let maxIndex = 0;

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  for (let i = 1; i < coordinates.length - 1; i++) {
    const distance = perpendicularDistance(coordinates[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPath(coordinates.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(coordinates.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: { latitude: number; longitude: number },
  lineStart: { latitude: number; longitude: number },
  lineEnd: { latitude: number; longitude: number }
): number {
  const dx = lineEnd.longitude - lineStart.longitude;
  const dy = lineEnd.latitude - lineStart.latitude;

  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) {
    return Math.sqrt(
      Math.pow(point.longitude - lineStart.longitude, 2) +
        Math.pow(point.latitude - lineStart.latitude, 2)
    );
  }

  const u =
    ((point.longitude - lineStart.longitude) * dx +
      (point.latitude - lineStart.latitude) * dy) /
    (mag * mag);

  const closestPoint = {
    longitude: lineStart.longitude + u * dx,
    latitude: lineStart.latitude + u * dy,
  };

  return Math.sqrt(
    Math.pow(point.longitude - closestPoint.longitude, 2) +
      Math.pow(point.latitude - closestPoint.latitude, 2)
  );
}

function createDirectRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): { latitude: number; longitude: number }[] {
  const distance = calculateDistance(startLat, startLon, endLat, endLon);
  const numPoints = Math.min(100, Math.max(20, Math.floor(distance / 50)));
  const coordinates: { latitude: number; longitude: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    coordinates.push({
      latitude: startLat + (endLat - startLat) * t,
      longitude: startLon + (endLon - startLon) * t,
    });
  }

  return coordinates;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function createAlternativeRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  offset: number
): { latitude: number; longitude: number }[] {
  const numPoints = 50;
  const coordinates: { latitude: number; longitude: number }[] = [];

  const midLat = (startLat + endLat) / 2;
  const midLon = (startLon + endLon) / 2;

  const dx = endLon - startLon;
  const dy = endLat - startLat;
  const perpX = -dy;
  const perpY = dx;
  const length = Math.sqrt(perpX * perpX + perpY * perpY);

  const offsetLat = midLat + (perpY / length) * offset;
  const offsetLon = midLon + (perpX / length) * offset;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    let lat: number;
    let lon: number;

    if (t < 0.5) {
      const localT = t * 2;
      lat = startLat + (offsetLat - startLat) * localT;
      lon = startLon + (offsetLon - startLon) * localT;
    } else {
      const localT = (t - 0.5) * 2;
      lat = offsetLat + (endLat - offsetLat) * localT;
      lon = offsetLon + (endLon - offsetLon) * localT;
    }

    coordinates.push({ latitude: lat, longitude: lon });
  }

  return coordinates;
}

export async function calculateRoutes(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteOption[]> {
  return calculateRoutesInternal([{ latitude: startLat, longitude: startLon }, { latitude: endLat, longitude: endLon }]);
}

export async function calculateRoutesWithCheckpoints(
  waypoints: { latitude: number; longitude: number }[]
): Promise<RouteOption[]> {
  return calculateRoutesInternal(waypoints);
}

async function calculateRoutesInternal(
  waypoints: { latitude: number; longitude: number }[]
): Promise<RouteOption[]> {
  if (waypoints.length < 2) {
    console.error('At least 2 waypoints required');
    return [];
  }

  const startLat = waypoints[0].latitude;
  const startLon = waypoints[0].longitude;
  const endLat = waypoints[waypoints.length - 1].latitude;
  const endLon = waypoints[waypoints.length - 1].longitude;
  const cacheKey = `${startLat.toFixed(5)}_${startLon.toFixed(5)}_${endLat.toFixed(5)}_${endLon.toFixed(5)}`;
  const cached = routeCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ROUTE_CACHE_DURATION) {
    console.log('Using cached routes');
    return cached.routes;
  }
  
  console.log('Calculating routes from', startLat, startLon, 'to', endLat, endLon);

  const routes: RouteOption[] = [];

  try {
    const waypointsStr = waypoints.map(wp => `${wp.longitude},${wp.latitude}`).join(';');
    const url = `${OSRM_BASE_URL}/${waypointsStr}?overview=full&geometries=geojson&alternatives=${waypoints.length === 2 ? '3' : '1'}&steps=true&continue_straight=false`;
    console.log('Fetching route from OSRM with', waypoints.length, 'waypoints:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM request failed: ${response.status}`);
    }

    const data: OSRMResponse = await response.json();
    console.log('OSRM response:', data.code, 'routes:', data.routes.length);

    if (data.code === 'Ok' && data.routes.length > 0) {
      for (let i = 0; i < Math.min(data.routes.length, 3); i++) {
        const route = data.routes[i];
        const coordinates = route.geometry.coordinates.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        const simplified = simplifyPath(coordinates, 0.00005);

        routes.push({
          id: `osrm_route_${i}`,
          coordinates: simplified,
          distance: route.distance,
          duration: route.duration,
          isMainRoute: i === 0,
        });
        console.log(`Route ${i}: ${route.distance}m, ${route.duration}s, ${simplified.length} points`);
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('OSRM request timed out');
    } else {
      console.error('Error fetching OSRM routes:', error);
    }
  }

  if (routes.length === 0) {
    console.log('No OSRM routes available, creating fallback routes');
    const directRoute = createDirectRoute(startLat, startLon, endLat, endLon);
    const distance = calculateDistance(startLat, startLon, endLat, endLon);

    routes.push({
      id: 'direct_route',
      coordinates: directRoute,
      distance,
      duration: distance / 13.89,
      isMainRoute: true,
    });

    const alt1 = createAlternativeRoute(startLat, startLon, endLat, endLon, 0.01);
    routes.push({
      id: 'alt_route_1',
      coordinates: alt1,
      distance: distance * 1.15,
      duration: (distance * 1.15) / 13.89,
      isMainRoute: false,
    });

    const alt2 = createAlternativeRoute(startLat, startLon, endLat, endLon, -0.01);
    routes.push({
      id: 'alt_route_2',
      coordinates: alt2,
      distance: distance * 1.18,
      duration: (distance * 1.18) / 13.89,
      isMainRoute: false,
    });
  }

  console.log('Total routes calculated:', routes.length);
  
  if (routes.length > 0) {
    routeCache.set(cacheKey, {
      routes,
      timestamp: now,
      key: cacheKey,
    });
    
    if (routeCache.size > 20) {
      const oldestKey = Array.from(routeCache.keys())[0];
      routeCache.delete(oldestKey);
    }
  }
  
  return routes;
}
