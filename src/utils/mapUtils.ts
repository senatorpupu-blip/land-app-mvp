import { LandPlot } from '../types';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

const isValidLatitude = (lat: unknown): lat is number => {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
};

const isValidLongitude = (lng: unknown): lng is number => {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
};

export const isValidCoordinate = (coord: Partial<Coordinate> | null | undefined): boolean => {
  if (!coord) return false;
  return isValidLatitude(coord.latitude) && isValidLongitude(coord.longitude);
};

export const validatePlotData = (data: Record<string, unknown>): boolean => {
  if (!data) return false;
  
  const requiredFields = ['title', 'location', 'status'];
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }

  const location = data.location as Record<string, unknown> | undefined;
  if (!location) return false;
  
  if (!isValidLatitude(location.latitude) || !isValidLongitude(location.longitude)) {
    return false;
  }

  return true;
};

export const filterValidCoordinates = (plots: LandPlot[]): LandPlot[] => {
  return plots.filter(plot => {
    if (!plot.location) return false;
    return isValidCoordinate(plot.location);
  });
};

export const removeDuplicatePlots = (plots: LandPlot[]): LandPlot[] => {
  const seen = new Set<string>();
  return plots.filter(plot => {
    if (seen.has(plot.id)) return false;
    seen.add(plot.id);
    return true;
  });
};

export const calculateRegionForCoordinates = (
  coordinates: Coordinate[],
  padding = 1.5
): MapRegion | null => {
  const validCoords = coordinates.filter(isValidCoordinate);
  
  if (validCoords.length === 0) {
    return null;
  }

  const latitudes = validCoords.map(c => c.latitude);
  const longitudes = validCoords.map(c => c.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latDelta = Math.max((maxLat - minLat) * padding, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * padding, 0.01);

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};

export const regionToBoundingBox = (region: MapRegion): BoundingBox => {
  const halfLatDelta = region.latitudeDelta / 2;
  const halfLngDelta = region.longitudeDelta / 2;

  return {
    north: region.latitude + halfLatDelta,
    south: region.latitude - halfLatDelta,
    east: region.longitude + halfLngDelta,
    west: region.longitude - halfLngDelta,
  };
};

export const boundingBoxToRegion = (box: BoundingBox): MapRegion => {
  return {
    latitude: (box.north + box.south) / 2,
    longitude: (box.east + box.west) / 2,
    latitudeDelta: box.north - box.south,
    longitudeDelta: box.east - box.west,
  };
};

export const isPointInBoundingBox = (
  point: Coordinate,
  box: BoundingBox
): boolean => {
  return (
    point.latitude >= box.south &&
    point.latitude <= box.north &&
    point.longitude >= box.west &&
    point.longitude <= box.east
  );
};

export const expandBoundingBox = (
  box: BoundingBox,
  factor: number
): BoundingBox => {
  const latCenter = (box.north + box.south) / 2;
  const lngCenter = (box.east + box.west) / 2;
  const latHalf = ((box.north - box.south) / 2) * factor;
  const lngHalf = ((box.east - box.west) / 2) * factor;

  return {
    north: latCenter + latHalf,
    south: latCenter - latHalf,
    east: lngCenter + lngHalf,
    west: lngCenter - lngHalf,
  };
};

export const calculateDistance = (
  coord1: Coordinate,
  coord2: Coordinate
): number => {
  const R = 6371;
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLng = toRadians(coord2.longitude - coord1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
    Math.cos(toRadians(coord2.latitude)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

export const extractUniqueRegions = (plots: LandPlot[]): string[] => {
  const regions = plots
    .map(p => p.region)
    .filter((region): region is string => Boolean(region) && region.trim() !== '');
  return [...new Set(regions)].sort();
};

export const getPlotCoordinates = (plots: LandPlot[]): Coordinate[] => {
  return plots
    .filter(p => p.location && isValidCoordinate(p.location))
    .map(p => ({
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    }));
};

export const UKRAINE_CENTER: MapRegion = {
  latitude: 48.3794,
  longitude: 31.1656,
  latitudeDelta: 8.0,
  longitudeDelta: 8.0,
};

export const UKRAINE_BOUNDS: BoundingBox = {
  north: 52.3797,
  south: 44.3864,
  east: 40.2275,
  west: 22.1371,
};
