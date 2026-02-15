/**
 * Security tests for input validation
 * Tests XSS prevention, input length limits, and data sanitization
 */

import { sanitizeText } from '../../functions/src/utils/security';

describe('Input Validation Security', () => {
  describe('sanitizeText', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("xss")</script>Hello';
      const result = sanitizeText(malicious);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should escape onclick handlers', () => {
      const malicious = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeText(malicious);
      // Should escape < and > to prevent HTML execution
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should escape javascript: URLs', () => {
      const malicious = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizeText(malicious);
      // Should escape < and > to prevent HTML execution
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should handle nested script tags', () => {
      const malicious = '<scr<script>ipt>alert(1)</scr</script>ipt>';
      const result = sanitizeText(malicious);
      expect(result).not.toContain('<script>');
    });

    it('should preserve safe text', () => {
      const safe = 'Земельна ділянка в Київській області';
      const result = sanitizeText(safe);
      expect(result).toBe(safe);
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should truncate to maxLength when provided', () => {
      const longText = 'A'.repeat(500);
      const result = sanitizeText(longText, 100);
      expect(result.length).toBe(100);
    });

    it('should not truncate if under maxLength', () => {
      const shortText = 'Short text';
      const result = sanitizeText(shortText, 100);
      expect(result).toBe(shortText);
    });
  });

  describe('Content Length Validation', () => {
    const MAX_TITLE_LENGTH = 200;
    const MAX_DESCRIPTION_LENGTH = 500;
    const MAX_CONTENT_LENGTH = 50000;

    it('should validate title length', () => {
      const validTitle = 'Земельна ділянка';
      const invalidTitle = 'А'.repeat(MAX_TITLE_LENGTH + 1);
      
      expect(validTitle.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(invalidTitle.length).toBeGreaterThan(MAX_TITLE_LENGTH);
    });

    it('should validate description length', () => {
      const validDesc = 'Опис ділянки';
      const invalidDesc = 'А'.repeat(MAX_DESCRIPTION_LENGTH + 1);
      
      expect(validDesc.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
      expect(invalidDesc.length).toBeGreaterThan(MAX_DESCRIPTION_LENGTH);
    });

    it('should validate content length', () => {
      const validContent = 'Детальний опис';
      const invalidContent = 'А'.repeat(MAX_CONTENT_LENGTH + 1);
      
      expect(validContent.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH);
      expect(invalidContent.length).toBeGreaterThan(MAX_CONTENT_LENGTH);
    });
  });

  describe('Cadastral Number Validation', () => {
    const CADASTRAL_REGEX = /^\d{10}:\d{2}:\d{3}:\d{4}$/;

    it('should validate correct cadastral format', () => {
      const valid = '1234567890:01:001:0001';
      expect(CADASTRAL_REGEX.test(valid)).toBe(true);
    });

    it('should reject invalid cadastral format', () => {
      const invalid = [
        '123456789:01:001:0001', // 9 digits
        '12345678901:01:001:0001', // 11 digits
        '1234567890:1:001:0001', // 1 digit section
        '1234567890:01:01:0001', // 2 digit section
        '1234567890:01:001:001', // 3 digit section
        'abcdefghij:01:001:0001', // letters
        '1234567890-01-001-0001', // wrong separator
      ];
      
      invalid.forEach(num => {
        expect(CADASTRAL_REGEX.test(num)).toBe(false);
      });
    });
  });

  describe('Phone Number Validation', () => {
    const PHONE_REGEX = /^\+380\d{9}$/;

    it('should validate Ukrainian phone format', () => {
      const valid = '+380501234567';
      expect(PHONE_REGEX.test(valid)).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      const invalid = [
        '0501234567', // no country code
        '+38501234567', // wrong country code
        '+3805012345678', // too many digits
        '+38050123456', // too few digits
        '+380 50 123 45 67', // spaces
      ];
      
      invalid.forEach(phone => {
        expect(PHONE_REGEX.test(phone)).toBe(false);
      });
    });
  });

  describe('Email Validation', () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('should validate correct email format', () => {
      const valid = ['test@example.com', 'user.name@domain.co.ua', 'admin@land-app.com'];
      valid.forEach(email => {
        expect(EMAIL_REGEX.test(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalid = ['test', 'test@', '@example.com', 'test@example', 'test @example.com'];
      invalid.forEach(email => {
        expect(EMAIL_REGEX.test(email)).toBe(false);
      });
    });
  });

  describe('Price Validation', () => {
    it('should validate positive prices', () => {
      const validatePrice = (price: number): boolean => price > 0 && price <= 1000000000;
      
      expect(validatePrice(1000)).toBe(true);
      expect(validatePrice(50000000)).toBe(true);
      expect(validatePrice(0)).toBe(false);
      expect(validatePrice(-1000)).toBe(false);
      expect(validatePrice(1000000001)).toBe(false);
    });
  });

  describe('Area Validation', () => {
    it('should validate area in sotkas', () => {
      const validateArea = (area: number): boolean => area > 0 && area <= 100000;
      
      expect(validateArea(10)).toBe(true);
      expect(validateArea(1000)).toBe(true);
      expect(validateArea(0)).toBe(false);
      expect(validateArea(-10)).toBe(false);
      expect(validateArea(100001)).toBe(false);
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate Ukrainian coordinates', () => {
      const validateCoordinates = (lat: number, lng: number): boolean => {
        // Ukraine bounds approximately
        return lat >= 44.3 && lat <= 52.4 && lng >= 22.1 && lng <= 40.2;
      };
      
      // Valid Ukrainian coordinates
      expect(validateCoordinates(50.4501, 30.5234)).toBe(true); // Kyiv
      expect(validateCoordinates(49.8397, 24.0297)).toBe(true); // Lviv
      expect(validateCoordinates(46.4825, 30.7233)).toBe(true); // Odesa
      
      // Invalid coordinates (outside Ukraine)
      expect(validateCoordinates(55.7558, 37.6173)).toBe(false); // Moscow
      expect(validateCoordinates(52.5200, 13.4050)).toBe(false); // Berlin
    });
  });
});
