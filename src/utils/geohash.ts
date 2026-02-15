const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const encodeGeohash = (latitude: number, longitude: number, precision: number = 9): string => {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let minLat = -90.0;
  let maxLat = 90.0;
  let minLon = -180.0;
  let maxLon = 180.0;

  while (geohash.length < precision) {
    if (evenBit) {
      const midLon = (minLon + maxLon) / 2;
      if (longitude >= midLon) {
        idx = idx * 2 + 1;
        minLon = midLon;
      } else {
        idx = idx * 2;
        maxLon = midLon;
      }
    } else {
      const midLat = (minLat + maxLat) / 2;
      if (latitude >= midLat) {
        idx = idx * 2 + 1;
        minLat = midLat;
      } else {
        idx = idx * 2;
        maxLat = midLat;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
};

export const decodeGeohash = (geohash: string): { latitude: number; longitude: number } => {
  let evenBit = true;
  let minLat = -90.0;
  let maxLat = 90.0;
  let minLon = -180.0;
  let maxLon = 180.0;

  for (let i = 0; i < geohash.length; i++) {
    const chr = geohash.charAt(i);
    const idx = BASE32.indexOf(chr);
    if (idx === -1) throw new Error('Invalid geohash');

    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const midLon = (minLon + maxLon) / 2;
        if (bitN === 1) {
          minLon = midLon;
        } else {
          maxLon = midLon;
        }
      } else {
        const midLat = (minLat + maxLat) / 2;
        if (bitN === 1) {
          minLat = midLat;
        } else {
          maxLat = midLat;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  };
};

export const getGeohashRange = (
  latitude: number,
  longitude: number,
  radiusKm: number
): { lower: string; upper: string } => {
  const precision = getGeohashPrecisionForRadius(radiusKm);
  const geohash = encodeGeohash(latitude, longitude, precision);
  
  return {
    lower: geohash,
    upper: geohash + '\uf8ff',
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

export const getNeighborGeohashes = (geohash: string): string[] => {
  const neighbors: string[] = [];
  const { latitude, longitude } = decodeGeohash(geohash);
  const precision = geohash.length;
  
  const latStep = 180 / Math.pow(2, Math.floor((precision * 5) / 2));
  const lonStep = 360 / Math.pow(2, Math.ceil((precision * 5) / 2));
  
  for (let latOffset = -1; latOffset <= 1; latOffset++) {
    for (let lonOffset = -1; lonOffset <= 1; lonOffset++) {
      const neighborLat = latitude + latOffset * latStep;
      const neighborLon = longitude + lonOffset * lonStep;
      
      if (neighborLat >= -90 && neighborLat <= 90 && neighborLon >= -180 && neighborLon <= 180) {
        neighbors.push(encodeGeohash(neighborLat, neighborLon, precision));
      }
    }
  }
  
  return [...new Set(neighbors)];
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);
