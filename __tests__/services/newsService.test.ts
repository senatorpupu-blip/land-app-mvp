import {
  generateSlug,
  calculateReadingTime,
  getNewsCategoryLabel,
  getAllNewsCategories,
} from '../../src/services/newsService';

describe('newsService', () => {
  describe('generateSlug', () => {
    it('should transliterate Ukrainian characters to Latin', () => {
      const slug = generateSlug('Привіт світ');
      expect(slug).toBe('pryvit-svit');
    });

    it('should handle mixed Ukrainian and English text', () => {
      const slug = generateSlug('Новини про Land Market');
      expect(slug).toBe('novyny-pro-land-market');
    });

    it('should remove special characters', () => {
      const slug = generateSlug('Тест! @#$% Новина?');
      expect(slug).toBe('test-novyna');
    });

    it('should handle multiple spaces', () => {
      const slug = generateSlug('Багато    пробілів   тут');
      expect(slug).toBe('bahato-probiliv-tut');
    });

    it('should convert to lowercase', () => {
      const slug = generateSlug('ВЕЛИКІ ЛІТЕРИ');
      expect(slug).toBe('velyki-litery');
    });

    it('should handle empty string', () => {
      const slug = generateSlug('');
      expect(slug).toBe('');
    });

    it('should truncate long slugs to 100 characters', () => {
      const longTitle = 'Це дуже довгий заголовок який має бути обрізаний до ста символів тому що він занадто довгий для slug';
      const slug = generateSlug(longTitle);
      expect(slug.length).toBeLessThanOrEqual(100);
    });

    it('should handle all Ukrainian special characters', () => {
      const slug = generateSlug('їжак єнот ґава');
      expect(slug).toBe('yizhak-yenot-gava');
    });

    it('should handle apostrophe', () => {
      const slug = generateSlug("Об'єкт нерухомості");
      expect(slug).toBe('obyekt-nerukhomosti');
    });
  });

  describe('calculateReadingTime', () => {
    it('should return 1 minute for short content', () => {
      const content = 'Короткий текст';
      const time = calculateReadingTime(content);
      expect(time).toBe(1);
    });

    it('should calculate reading time based on 200 words per minute', () => {
      const words = Array(400).fill('слово').join(' ');
      const time = calculateReadingTime(words);
      expect(time).toBe(2);
    });

    it('should round up reading time', () => {
      const words = Array(250).fill('слово').join(' ');
      const time = calculateReadingTime(words);
      expect(time).toBe(2);
    });

    it('should handle empty content', () => {
      const time = calculateReadingTime('');
      expect(time).toBe(1);
    });

    it('should handle content with multiple spaces', () => {
      const content = 'Слово    ще    слово';
      const time = calculateReadingTime(content);
      expect(time).toBe(1);
    });
  });

  describe('getNewsCategoryLabel', () => {
    it('should return correct label for market-analysis', () => {
      const label = getNewsCategoryLabel('market-analysis');
      expect(label).toBe('Аналіз ринку');
    });

    it('should return correct label for legislation', () => {
      const label = getNewsCategoryLabel('legislation');
      expect(label).toBe('Законодавство');
    });

    it('should return correct label for platform-news', () => {
      const label = getNewsCategoryLabel('platform-news');
      expect(label).toBe('Новини платформи');
    });

    it('should return correct label for investment', () => {
      const label = getNewsCategoryLabel('investment');
      expect(label).toBe('Інвестиції');
    });

    it('should return correct label for other', () => {
      const label = getNewsCategoryLabel('other');
      expect(label).toBe('Інше');
    });
  });

  describe('getAllNewsCategories', () => {
    it('should return all 5 categories', () => {
      const categories = getAllNewsCategories();
      expect(categories).toHaveLength(5);
    });

    it('should return categories with value and label', () => {
      const categories = getAllNewsCategories();
      categories.forEach(cat => {
        expect(cat).toHaveProperty('value');
        expect(cat).toHaveProperty('label');
        expect(typeof cat.value).toBe('string');
        expect(typeof cat.label).toBe('string');
      });
    });

    it('should include all expected categories', () => {
      const categories = getAllNewsCategories();
      const values = categories.map(c => c.value);
      expect(values).toContain('market-analysis');
      expect(values).toContain('legislation');
      expect(values).toContain('platform-news');
      expect(values).toContain('investment');
      expect(values).toContain('other');
    });

    it('should have Ukrainian labels', () => {
      const categories = getAllNewsCategories();
      const labels = categories.map(c => c.label);
      expect(labels).toContain('Аналіз ринку');
      expect(labels).toContain('Законодавство');
      expect(labels).toContain('Новини платформи');
      expect(labels).toContain('Інвестиції');
      expect(labels).toContain('Інше');
    });
  });
});
