import {
  toDate,
  toDateOrNow,
  isPromotedAndActive,
  isPremiumAndActive,
  sortWithPromotedFirst,
} from '../../src/utils/firestoreParser';
import { LandPlot } from '../../src/types';

describe('firestoreParser', () => {
  describe('toDate', () => {
    it('should return undefined for null/undefined', () => {
      expect(toDate(null)).toBeUndefined();
      expect(toDate(undefined)).toBeUndefined();
    });

    it('should return Date as-is', () => {
      const date = new Date('2024-01-15');
      expect(toDate(date)).toBe(date);
    });

    it('should convert Firestore Timestamp-like object', () => {
      const timestamp = { toDate: () => new Date('2024-01-15') };
      const result = toDate(timestamp);
      expect(result).toEqual(new Date('2024-01-15'));
    });
  });

  describe('toDateOrNow', () => {
    it('should return current date for null/undefined', () => {
      const before = new Date();
      const result = toDateOrNow(null);
      const after = new Date();
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should return Date as-is', () => {
      const date = new Date('2024-01-15');
      expect(toDateOrNow(date)).toBe(date);
    });
  });

  describe('isPromotedAndActive', () => {
    it('should return false if not promoted', () => {
      const plot = { premium: { isPromoted: false } } as LandPlot;
      expect(isPromotedAndActive(plot)).toBe(false);
    });

    it('should return false if no premium object', () => {
      const plot = {} as LandPlot;
      expect(isPromotedAndActive(plot)).toBe(false);
    });

    it('should return true if promoted with no expiration', () => {
      const plot = { premium: { isPromoted: true } } as LandPlot;
      expect(isPromotedAndActive(plot)).toBe(true);
    });

    it('should return true if promoted and not expired', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const plot = { premium: { isPromoted: true, promotedExpiresAt: futureDate } } as LandPlot;
      expect(isPromotedAndActive(plot)).toBe(true);
    });

    it('should return false if promoted but expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      const plot = { premium: { isPromoted: true, promotedExpiresAt: pastDate } } as LandPlot;
      expect(isPromotedAndActive(plot)).toBe(false);
    });
  });

  describe('isPremiumAndActive', () => {
    it('should return false if not premium', () => {
      const plot = { premium: { isPremium: false } } as LandPlot;
      expect(isPremiumAndActive(plot)).toBe(false);
    });

    it('should return false if no premium object', () => {
      const plot = {} as LandPlot;
      expect(isPremiumAndActive(plot)).toBe(false);
    });

    it('should return true if premium with no expiration', () => {
      const plot = { premium: { isPremium: true } } as LandPlot;
      expect(isPremiumAndActive(plot)).toBe(true);
    });

    it('should return true if premium and not expired', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const plot = { premium: { isPremium: true, premiumExpiresAt: futureDate } } as LandPlot;
      expect(isPremiumAndActive(plot)).toBe(true);
    });

    it('should return false if premium but expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      const plot = { premium: { isPremium: true, premiumExpiresAt: pastDate } } as LandPlot;
      expect(isPremiumAndActive(plot)).toBe(false);
    });
  });

  describe('sortWithPromotedFirst', () => {
    it('should put promoted plots first', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const plots = [
        { id: '1', premium: { isPromoted: false } } as LandPlot,
        { id: '2', premium: { isPromoted: true, promotedExpiresAt: futureDate } } as LandPlot,
        { id: '3' } as LandPlot,
        { id: '4', premium: { isPromoted: true } } as LandPlot,
      ];
      
      const sorted = sortWithPromotedFirst(plots);
      
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('4');
      expect(sorted.slice(2).map(p => p.id)).toContain('1');
      expect(sorted.slice(2).map(p => p.id)).toContain('3');
    });

    it('should handle empty array', () => {
      expect(sortWithPromotedFirst([])).toEqual([]);
    });

    it('should handle array with no promoted plots', () => {
      const plots = [
        { id: '1' } as LandPlot,
        { id: '2' } as LandPlot,
      ];
      
      const sorted = sortWithPromotedFirst(plots);
      expect(sorted).toHaveLength(2);
    });
  });
});
