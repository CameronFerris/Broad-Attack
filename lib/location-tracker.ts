import * as Location from 'expo-location';

export interface TrackedLocation {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
  timestamp: number;
  accuracy: number;
}

class KalmanFilter {
  private q: number;
  private r: number;
  private p: number = 1;
  private x: number = 0;
  private k: number = 0;
  private initialized: boolean = false;
  private lastMeasurement: number = 0;
  private outlierThreshold: number = 3;

  constructor(q: number = 0.005, r: number = 0.3) {
    this.q = q;
    this.r = r;
  }

  filter(measurement: number, accuracy: number = 1): number {
    if (!this.initialized) {
      this.x = measurement;
      this.lastMeasurement = measurement;
      this.initialized = true;
      return measurement;
    }

    const deviation = Math.abs(measurement - this.lastMeasurement);
    const expectedDeviation = Math.sqrt(this.p + this.r);
    
    if (deviation > expectedDeviation * this.outlierThreshold) {
      console.log('Outlier detected, smoothing more aggressively');
      const smoothedMeasurement = this.lastMeasurement + (measurement - this.lastMeasurement) * 0.3;
      measurement = smoothedMeasurement;
    }

    const adjustedR = this.r * Math.max(0.1, Math.min(3, accuracy / 10));
    
    this.p = this.p + this.q;
    this.k = this.p / (this.p + adjustedR);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;
    
    this.lastMeasurement = this.x;
    return this.x;
  }

  reset() {
    this.p = 1;
    this.x = 0;
    this.k = 0;
    this.initialized = false;
  }
}

class HeadingFilter {
  private values: number[] = [];
  private maxSize: number = 5;

  filter(heading: number | null): number | null {
    if (heading === null) {
      return this.getSmoothedHeading();
    }

    this.values.push(heading);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }

    return this.getSmoothedHeading();
  }

  private getSmoothedHeading(): number | null {
    if (this.values.length === 0) return null;
    if (this.values.length === 1) return this.values[0];

    let sumSin = 0;
    let sumCos = 0;

    for (const angle of this.values) {
      const rad = (angle * Math.PI) / 180;
      sumSin += Math.sin(rad);
      sumCos += Math.cos(rad);
    }

    const avgRad = Math.atan2(sumSin / this.values.length, sumCos / this.values.length);
    let result = (avgRad * 180) / Math.PI;
    
    if (result < 0) result += 360;
    
    return result;
  }

  reset() {
    this.values = [];
  }
}

export class LocationTracker {
  private latFilter: KalmanFilter;
  private lonFilter: KalmanFilter;
  private speedFilter: KalmanFilter;
  private headingFilter: HeadingFilter;
  private lastLocation: TrackedLocation | null = null;
  private velocityLat: number = 0;
  private velocityLon: number = 0;

  constructor() {
    this.latFilter = new KalmanFilter(0.005, 0.3);
    this.lonFilter = new KalmanFilter(0.005, 0.3);
    this.speedFilter = new KalmanFilter(0.03, 0.8);
    this.headingFilter = new HeadingFilter();
  }

  process(location: Location.LocationObject): TrackedLocation {
    const accuracy = location.coords.accuracy || 10;
    const clampedAccuracy = Math.min(accuracy, 50);
    
    const filteredLat = this.latFilter.filter(location.coords.latitude, clampedAccuracy);
    const filteredLon = this.lonFilter.filter(location.coords.longitude, clampedAccuracy);
    
    const rawSpeed = (location.coords.speed || 0) * 3.6;
    const speedAccuracy = Math.min(accuracy, 20);
    const filteredSpeed = Math.max(0, this.speedFilter.filter(rawSpeed, speedAccuracy));

    if (this.lastLocation) {
      const dt = (location.timestamp - this.lastLocation.timestamp) / 1000;
      if (dt > 0) {
        const dLat = filteredLat - this.lastLocation.latitude;
        const dLon = filteredLon - this.lastLocation.longitude;
        
        this.velocityLat = dLat / dt;
        this.velocityLon = dLon / dt;
      }
    }

    const filteredHeading = this.headingFilter.filter(location.coords.heading);
    
    const calculatedHeading = this.calculateHeading(
      this.lastLocation?.latitude,
      this.lastLocation?.longitude,
      filteredLat,
      filteredLon
    );

    const finalHeading = filteredHeading !== null 
      ? filteredHeading 
      : calculatedHeading;

    const tracked: TrackedLocation = {
      latitude: filteredLat,
      longitude: filteredLon,
      speed: filteredSpeed,
      heading: finalHeading,
      timestamp: location.timestamp,
      accuracy,
    };

    this.lastLocation = tracked;
    return tracked;
  }

  predict(deltaTime: number): TrackedLocation | null {
    if (!this.lastLocation) return null;

    const predictedLat = this.lastLocation.latitude + this.velocityLat * deltaTime;
    const predictedLon = this.lastLocation.longitude + this.velocityLon * deltaTime;

    return {
      latitude: predictedLat,
      longitude: predictedLon,
      speed: this.lastLocation.speed,
      heading: this.lastLocation.heading,
      timestamp: this.lastLocation.timestamp + deltaTime * 1000,
      accuracy: this.lastLocation.accuracy * 1.5,
    };
  }

  private calculateHeading(
    lat1: number | undefined,
    lon1: number | undefined,
    lat2: number,
    lon2: number
  ): number | null {
    if (lat1 === undefined || lon1 === undefined) return null;

    const dLon = lon2 - lon1;
    const y = Math.sin(dLon * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon * Math.PI / 180);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    heading = (heading + 360) % 360;
    
    return heading;
  }

  reset() {
    this.latFilter.reset();
    this.lonFilter.reset();
    this.speedFilter.reset();
    this.headingFilter.reset();
    this.lastLocation = null;
    this.velocityLat = 0;
    this.velocityLon = 0;
  }
}

export class BatchedLocationUploader {
  private queue: {
    partyId: string;
    userId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
  }[] = [];
  private uploading: boolean = false;
  private lastUploadTime: number = 0;
  private minUploadInterval: number = 300;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  add(data: {
    partyId: string;
    userId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
  }) {
    this.queue = [data];
  }

  async flush(uploadFn: (data: any) => Promise<boolean>): Promise<void> {
    const now = Date.now();
    
    if (this.uploading || this.queue.length === 0) {
      return;
    }

    if (now - this.lastUploadTime < this.minUploadInterval) {
      return;
    }

    this.uploading = true;
    const data = this.queue[this.queue.length - 1];
    this.queue = [];

    try {
      const success = await uploadFn(data);
      if (success) {
        this.lastUploadTime = now;
        this.retryCount = 0;
      } else if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.queue.push(data);
      }
    } catch (error) {
      console.error('Error uploading location:', error);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.queue.push(data);
      }
    } finally {
      this.uploading = false;
    }
  }
}

export function interpolatePosition(
  pos1: { latitude: number; longitude: number; timestamp: number },
  pos2: { latitude: number; longitude: number; timestamp: number },
  targetTimestamp: number
): { latitude: number; longitude: number } {
  const totalTime = pos2.timestamp - pos1.timestamp;
  
  if (totalTime <= 0) {
    return { latitude: pos2.latitude, longitude: pos2.longitude };
  }

  const elapsedTime = targetTimestamp - pos1.timestamp;
  const factor = Math.min(1, Math.max(0, elapsedTime / totalTime));

  return {
    latitude: pos1.latitude + (pos2.latitude - pos1.latitude) * factor,
    longitude: pos1.longitude + (pos2.longitude - pos1.longitude) * factor,
  };
}
