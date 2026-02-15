import {
  calculatePremiumPrice,
  formatPrice,
  getPremiumBenefits,
  PREMIUM_PRICING,
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
  it('should correctly check if premium is active', () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 86400000);
    const pastDate = new Date(now.getTime() - 86400000);
    
    const isPremiumActive = (expiresAt: Date | undefined): boolean => {
      if (!expiresAt) return true;
      return new Date() < expiresAt;
    };
    
    expect(isPremiumActive(futureDate)).toBe(true);
    expect(isPremiumActive(pastDate)).toBe(false);
    expect(isPremiumActive(undefined)).toBe(true);
  });

  it('should calculate correct expiration date', () => {
    const now = new Date();
    const durationDays = 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    
    expect(diffDays).toBe(30);
  });
});
