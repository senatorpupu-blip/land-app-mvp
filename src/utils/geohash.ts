const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const encodeGeohash = (latitude: number, longitude: number, precision: number = 9): string => {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
};

export const decodeGeohash = (geohash: string): { latitude: number; longitude: number } => {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let isLng = true;

  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (bitValue === 1) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitValue === 1) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLng = !isLng;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lngMin + lngMax) / 2,
  };
};

export const getGeohashPrecisionForRadius = (radiusKm: number): number => {
  if (radiusKm <= 0.019) return 9;
  if (radiusKm <= 0.076) return 8;
  if (radiusKm <= 0.61) return 7;
  if (radiusKm <= 2.4) return 6;
  if (radiusKm <= 19) return 5;
  if (radiusKm <= 76) return 4;
  if (radiusKm <= 610) return 3;
  if (radiusKm <= 2400) return 2;
  return 1;
};

export const getGeohashesForBoundingBox = (
  north: number,
  south: number,
  east: number,
  west: number,
  precision: number = 5
): string[] => {
  const geohashes = new Set<string>();
  
  const latStep = (north - south) / 10;
  const lngStep = (east - west) / 10;
  
  for (let lat = south; lat <= north; lat += latStep) {
    for (let lng = west; lng <= east; lng += lngStep) {
      geohashes.add(encodeGeohash(lat, lng, precision));
    }
  }
  
  geohashes.add(encodeGeohash(north, east, precision));
  geohashes.add(encodeGeohash(north, west, precision));
  geohashes.add(encodeGeohash(south, east, precision));
  geohashes.add(encodeGeohash(south, west, precision));
  
  return Array.from(geohashes);
};

export const getNeighborGeohashes = (geohash: string): string[] => {
  const neighbors: string[] = [geohash];
  const precision = geohash.length;
  
  if (precision > 1) {
    const parent = geohash.slice(0, -1);
    for (let i = 0; i < 32; i++) {
      const neighbor = parent + BASE32[i];
      neighbors.push(neighbor);
    }
  }
  
  return [...new Set(neighbors)];
};
