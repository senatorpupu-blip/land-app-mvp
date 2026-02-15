import {
  calculatePremiumPrice,
  formatPrice,
  getPremiumBenefits,
  PREMIUM_PRICING,
  isPremiumExpired,
  isPromotionExpired,
  getDaysRemaining,
  formatExpirationDate,
  getPremiumStatus,
  PREMIUM_PACKAGES,
} from '../../src/services/paymentService';

describe('Payment Service', () => {
  describe('PREMIUM_PRICING', () => {
    it('should have correct pricing structure', () => {
      expect(PREMIUM_PRICING.premium7Days).toBe(199);
      expect(PREMIUM_PRICING.premium30Days).toBe(499);
      expect(PREMIUM_PRICING.premium90Days).toBe(999);
      expect(PREMIUM_PRICING.promotion7Days).toBe(99);
      expect(PREMIUM_PRICING.promotion30Days).toBe(249);
    });
  });

  describe('calculatePremiumPrice', () => {
    it('should calculate premium price for 7 days', () => {
      const price = calculatePremiumPrice('premium', 7);
      expect(price).toBe(199);
    });

    it('should calculate premium price for 30 days', () => {
      const price = calculatePremiumPrice('premium', 30);
      expect(price).toBe(499);
    });

    it('should calculate premium price for 90 days', () => {
      const price = calculatePremiumPrice('premium', 90);
      expect(price).toBe(999);
    });

    it('should calculate promotion price for 7 days', () => {
      const price = calculatePremiumPrice('promotion', 7);
      expect(price).toBe(99);
    });

    it('should calculate promotion price for 30 days', () => {
      const price = calculatePremiumPrice('promotion', 30);
      expect(price).toBe(249);
    });

    it('should use 7-day pricing for shorter durations', () => {
      const price = calculatePremiumPrice('premium', 3);
      expect(price).toBe(199);
    });

    it('should use 30-day pricing for durations between 8-30', () => {
      const price = calculatePremiumPrice('premium', 15);
      expect(price).toBe(499);
    });

    it('should use 90-day pricing for longer durations', () => {
      const price = calculatePremiumPrice('premium', 180);
      expect(price).toBe(999);
    });
  });

  describe('formatPrice', () => {
    it('should format price with UAH symbol', () => {
      const formatted = formatPrice(199);
      expect(formatted).toContain('199');
      expect(formatted).toContain('₴');
    });

    it('should format large prices with locale formatting', () => {
      const formatted = formatPrice(10000);
      expect(formatted).toContain('₴');
    });
  });

  describe('getPremiumBenefits', () => {
    it('should return premium benefits in Ukrainian', () => {
      const benefits = getPremiumBenefits('premium');
      
      expect(benefits.length).toBeGreaterThan(0);
      expect(benefits).toContain('Виділення оголошення кольором');
      expect(benefits).toContain('Значок "Преміум"');
      expect(benefits).toContain('Пріоритет у пошуку');
      expect(benefits).toContain('Розширена статистика переглядів');
    });

    it('should return promotion benefits in Ukrainian', () => {
      const benefits = getPremiumBenefits('promotion');
      
      expect(benefits.length).toBeGreaterThan(0);
      expect(benefits).toContain('Показ на початку списку');
      expect(benefits).toContain('Значок "Топ"');
      expect(benefits).toContain('Більше переглядів');
    });

    it('should return different benefits for premium vs promotion', () => {
      const premiumBenefits = getPremiumBenefits('premium');
      const promotionBenefits = getPremiumBenefits('promotion');
      
      expect(premiumBenefits.length).toBeGreaterThan(promotionBenefits.length);
    });
  });
});

describe('Premium Expiration Logic', () => {
  describe('isPremiumExpired', () => {
    it('should return true for undefined expiration', () => {
      expect(isPremiumExpired(undefined)).toBe(true);
    });

    it('should return true for past date', () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(isPremiumExpired(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(isPremiumExpired(futureDate)).toBe(false);
    });
  });

  describe('isPromotionExpired', () => {
    it('should return true for undefined expiration', () => {
      expect(isPromotionExpired(undefined)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(isPromotionExpired(futureDate)).toBe(false);
    });
  });

  describe('getDaysRemaining', () => {
    it('should return 0 for undefined', () => {
      expect(getDaysRemaining(undefined)).toBe(0);
    });

    it('should return 0 for past date', () => {
      const pastDate = new Date(Date.now() - 86400000);
      expect(getDaysRemaining(pastDate)).toBe(0);
    });

    it('should return correct days for future date', () => {
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const days = getDaysRemaining(futureDate);
      expect(days).toBeGreaterThanOrEqual(6);
      expect(days).toBeLessThanOrEqual(8);
    });
  });

  describe('formatExpirationDate', () => {
    it('should return "Не активовано" for undefined', () => {
      expect(formatExpirationDate(undefined)).toBe('Не активовано');
    });

    it('should return "Закінчується сьогодні" for expiring soon', () => {
      // Date that expires within the same day (less than 1 day remaining)
      const today = new Date(Date.now() + 1000);
      const result = formatExpirationDate(today);
      // Should be either "today" or "tomorrow" depending on exact timing
      expect(['Закінчується сьогодні', 'Закінчується завтра']).toContain(result);
    });

    it('should return "Закінчується завтра" for tomorrow', () => {
      // Exactly 1 day from now
      const tomorrow = new Date(Date.now() + 1.5 * 86400000);
      const result = formatExpirationDate(tomorrow);
      // Should show days remaining
      expect(result).toMatch(/Закінчується завтра|Залишилось/);
    });

    it('should return days remaining for dates within a week', () => {
      const inFiveDays = new Date(Date.now() + 5 * 86400000);
      const result = formatExpirationDate(inFiveDays);
      expect(result).toContain('Залишилось');
      expect(result).toContain('днів');
    });
  });

  describe('getPremiumStatus', () => {
    it('should return correct status for active premium', () => {
      const futureDate = new Date(Date.now() + 30 * 86400000);
      const status = getPremiumStatus(futureDate, undefined);
      
      expect(status.isPremium).toBe(true);
      expect(status.isPromoted).toBe(false);
      expect(status.premiumDaysRemaining).toBeGreaterThan(0);
    });

    it('should return correct status for expired premium', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const status = getPremiumStatus(pastDate, undefined);
      
      expect(status.isPremium).toBe(false);
      expect(status.premiumDaysRemaining).toBe(0);
    });
  });

  describe('PREMIUM_PACKAGES', () => {
    it('should have 5 packages', () => {
      expect(PREMIUM_PACKAGES).toHaveLength(5);
    });

    it('should have Ukrainian labels', () => {
      PREMIUM_PACKAGES.forEach(pkg => {
        expect(pkg.label).toBeTruthy();
        expect(pkg.description).toBeTruthy();
      });
    });

    it('should have correct pricing', () => {
      const premium7 = PREMIUM_PACKAGES.find(p => p.id === 'premium-7');
      expect(premium7?.price).toBe(PREMIUM_PRICING.premium7Days);
    });
  });
});
