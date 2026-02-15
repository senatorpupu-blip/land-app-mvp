import {
  formatPriceUAH,
  formatPriceUAHCompact,
  formatPricePerSotkaUAH,
  formatPricePerHectareUAH,
  calculatePricePerHectare,
  calculateTotalPrice,
  formatArea,
  formatAreaWithBoth,
  sotkasToHectares,
  hectaresToSotkas,
} from '../../src/utils/currency';

describe('Currency Utility Functions', () => {
  describe('formatPriceUAH', () => {
    it('should format price in UAH', () => {
      const result = formatPriceUAH(50000);
      expect(result).toContain('50');
      expect(result).toContain('000');
    });

    it('should handle zero', () => {
      const result = formatPriceUAH(0);
      expect(result).toContain('0');
    });

    it('should handle NaN', () => {
      const result = formatPriceUAH(NaN);
      expect(result).toBe('0 ₴');
    });

    it('should handle negative numbers', () => {
      const result = formatPriceUAH(-1000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });
  });

  describe('formatPriceUAHCompact', () => {
    it('should format millions', () => {
      const result = formatPriceUAHCompact(1500000);
      expect(result).toContain('1.5');
      expect(result).toContain('млн');
    });

    it('should format thousands', () => {
      const result = formatPriceUAHCompact(50000);
      expect(result).toContain('50');
      expect(result).toContain('тис');
    });

    it('should format small numbers normally', () => {
      const result = formatPriceUAHCompact(500);
      expect(result).toContain('500');
    });

    it('should handle NaN', () => {
      const result = formatPriceUAHCompact(NaN);
      expect(result).toBe('0 ₴');
    });
  });

  describe('formatPricePerSotkaUAH', () => {
    it('should format price per sotka', () => {
      const result = formatPricePerSotkaUAH(5000);
      expect(result).toContain('5');
      expect(result).toContain('сотка');
    });
  });

  describe('formatPricePerHectareUAH', () => {
    it('should format price per hectare (100x sotka price)', () => {
      const result = formatPricePerHectareUAH(5000);
      expect(result).toContain('500');
      expect(result).toContain('га');
    });
  });

  describe('calculatePricePerHectare', () => {
    it('should multiply price per sotka by 100', () => {
      expect(calculatePricePerHectare(5000)).toBe(500000);
    });

    it('should handle zero', () => {
      expect(calculatePricePerHectare(0)).toBe(0);
    });

    it('should handle NaN', () => {
      expect(calculatePricePerHectare(NaN)).toBe(0);
    });
  });

  describe('calculateTotalPrice', () => {
    it('should multiply area by price per sotka', () => {
      expect(calculateTotalPrice(10, 5000)).toBe(50000);
    });

    it('should handle zero area', () => {
      expect(calculateTotalPrice(0, 5000)).toBe(0);
    });

    it('should handle zero price', () => {
      expect(calculateTotalPrice(10, 0)).toBe(0);
    });

    it('should handle NaN', () => {
      expect(calculateTotalPrice(NaN, 5000)).toBe(0);
      expect(calculateTotalPrice(10, NaN)).toBe(0);
    });
  });

  describe('formatArea', () => {
    it('should format small areas in sotkas', () => {
      const result = formatArea(50);
      expect(result).toContain('50');
      expect(result).toContain('соток');
    });

    it('should format large areas in hectares', () => {
      const result = formatArea(200);
      expect(result).toContain('2');
      expect(result).toContain('га');
    });

    it('should handle NaN', () => {
      const result = formatArea(NaN);
      expect(result).toBe('0 соток');
    });
  });

  describe('formatAreaWithBoth', () => {
    it('should show both hectares and sotkas for large areas', () => {
      const result = formatAreaWithBoth(200);
      expect(result).toContain('га');
      expect(result).toContain('200');
      expect(result).toContain('соток');
    });

    it('should show only sotkas for small areas', () => {
      const result = formatAreaWithBoth(50);
      expect(result).toContain('50');
      expect(result).toContain('соток');
      expect(result).not.toContain('га');
    });
  });

  describe('sotkasToHectares', () => {
    it('should convert sotkas to hectares', () => {
      expect(sotkasToHectares(100)).toBe(1);
      expect(sotkasToHectares(250)).toBe(2.5);
    });

    it('should handle zero', () => {
      expect(sotkasToHectares(0)).toBe(0);
    });

    it('should handle NaN', () => {
      expect(sotkasToHectares(NaN)).toBe(0);
    });
  });

  describe('hectaresToSotkas', () => {
    it('should convert hectares to sotkas', () => {
      expect(hectaresToSotkas(1)).toBe(100);
      expect(hectaresToSotkas(2.5)).toBe(250);
    });

    it('should handle zero', () => {
      expect(hectaresToSotkas(0)).toBe(0);
    });

    it('should handle NaN', () => {
      expect(hectaresToSotkas(NaN)).toBe(0);
    });
  });
});
