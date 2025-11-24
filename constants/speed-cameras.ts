import type { SpeedCamera } from '@/types/map';

// Predefined speed cameras that are always visible on the map
// These are example locations - you should replace with real speed camera data for your area
export const PREDEFINED_SPEED_CAMERAS: SpeedCamera[] = [
  // Example speed cameras - London area
  {
    id: 'cam_london_001',
    type: 'fixed',
    latitude: 51.5074,
    longitude: -0.1278,
    speedLimit: 30,
    name: 'A4 Westbound - Central London',
  },
  {
    id: 'cam_london_002',
    type: 'fixed',
    latitude: 51.5155,
    longitude: -0.1410,
    speedLimit: 20,
    name: 'Oxford Street',
  },
  {
    id: 'cam_london_003',
    type: 'average-speed',
    latitude: 51.5234,
    longitude: -0.1589,
    speedLimit: 30,
    name: 'Marylebone Road',
  },
  {
    id: 'cam_london_004',
    type: 'red-light',
    latitude: 51.4994,
    longitude: -0.1248,
    speedLimit: 30,
    name: 'Westminster Bridge',
  },
  
  // Example speed cameras - New York area
  {
    id: 'cam_ny_001',
    type: 'fixed',
    latitude: 40.7128,
    longitude: -74.0060,
    speedLimit: 25,
    name: 'Broadway & Wall St',
  },
  {
    id: 'cam_ny_002',
    type: 'fixed',
    latitude: 40.7589,
    longitude: -73.9851,
    speedLimit: 25,
    name: 'Times Square Area',
  },
  {
    id: 'cam_ny_003',
    type: 'red-light',
    latitude: 40.7614,
    longitude: -73.9776,
    speedLimit: 25,
    name: '6th Avenue & 50th St',
  },
  
  // Example speed cameras - Los Angeles area
  {
    id: 'cam_la_001',
    type: 'fixed',
    latitude: 34.0522,
    longitude: -118.2437,
    speedLimit: 35,
    name: 'Downtown LA - Spring St',
  },
  {
    id: 'cam_la_002',
    type: 'fixed',
    latitude: 34.0407,
    longitude: -118.2468,
    speedLimit: 35,
    name: 'S Figueroa St',
  },
  {
    id: 'cam_la_003',
    type: 'red-light',
    latitude: 34.0456,
    longitude: -118.2513,
    speedLimit: 35,
    name: 'W 3rd St & S Hill St',
  },
  
  // Example speed cameras - Paris area
  {
    id: 'cam_paris_001',
    type: 'fixed',
    latitude: 48.8566,
    longitude: 2.3522,
    speedLimit: 50,
    name: 'Boulevard de Sébastopol',
  },
  {
    id: 'cam_paris_002',
    type: 'fixed',
    latitude: 48.8738,
    longitude: 2.2950,
    speedLimit: 70,
    name: 'Avenue des Champs-Élysées',
  },
  {
    id: 'cam_paris_003',
    type: 'average-speed',
    latitude: 48.8629,
    longitude: 2.2874,
    speedLimit: 50,
    name: 'Avenue Kléber',
  },
  
  // Example speed cameras - Sydney area
  {
    id: 'cam_sydney_001',
    type: 'fixed',
    latitude: -33.8688,
    longitude: 151.2093,
    speedLimit: 60,
    name: 'George Street',
  },
  {
    id: 'cam_sydney_002',
    type: 'red-light',
    latitude: -33.8715,
    longitude: 151.2006,
    speedLimit: 50,
    name: 'Harbour Bridge Approach',
  },
  {
    id: 'cam_sydney_003',
    type: 'mobile',
    latitude: -33.8830,
    longitude: 151.2167,
    speedLimit: 40,
    name: 'Oxford Street - Mobile Zone',
  },
  
  // Example speed cameras - Tokyo area
  {
    id: 'cam_tokyo_001',
    type: 'fixed',
    latitude: 35.6762,
    longitude: 139.6503,
    speedLimit: 60,
    name: 'Shibuya Crossing Area',
  },
  {
    id: 'cam_tokyo_002',
    type: 'fixed',
    latitude: 35.6586,
    longitude: 139.7454,
    speedLimit: 50,
    name: 'Rainbow Bridge',
  },
  {
    id: 'cam_tokyo_003',
    type: 'red-light',
    latitude: 35.6894,
    longitude: 139.6917,
    speedLimit: 40,
    name: 'Shinjuku Station West',
  },
];

// Function to get cameras near user's location
export function getNearbyPredefinedCameras(
  userLat: number,
  userLon: number,
  radiusKm: number = 50
): SpeedCamera[] {
  return PREDEFINED_SPEED_CAMERAS.filter(camera => {
    const distance = calculateDistance(userLat, userLon, camera.latitude, camera.longitude);
    return distance <= radiusKm * 1000; // Convert km to meters
  });
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Function to check if user is approaching camera in the same direction
export function isApproachingCamera(
  userLat: number,
  userLon: number,
  userHeading: number | null,
  cameraLat: number,
  cameraLon: number,
  maxAngleDeviation: number = 45
): boolean {
  if (userHeading === null) return false;

  // Calculate bearing to camera
  const bearingToCamera = calculateBearing(userLat, userLon, cameraLat, cameraLon);
  
  // Calculate angle difference
  let angleDiff = Math.abs(bearingToCamera - userHeading);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;
  
  // Check if user is heading towards camera (within angle tolerance)
  return angleDiff <= maxAngleDeviation;
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}