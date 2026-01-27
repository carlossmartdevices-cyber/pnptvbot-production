const GrokService = require('../../../src/bot/services/grokService');

// Mock the chat function to return predictable results for testing
jest.mock('../../../src/bot/services/grokService', () => {
  const originalModule = jest.requireActual('../../../src/bot/services/grokService');
  
  return {
    ...originalModule,
    chat: jest.fn().mockImplementation(({ language }) => {
      if (language === 'Spanish') {
        return Promise.resolve('Título sexy\n---\nDescripción del video con gancho\n---\n#categoría1#categoría2\n---\nArtista1, Artista2');
      } else {
        return Promise.resolve('Sexy title\n---\nVideo description with hook\n---\n#category1#category2\n---\nArtist1, Artist2');
      }
    }),
  };
});

describe('GrokService - generateSharePost', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should generate share post in single line format', async () => {
    const prompt = 'Anuncia un evento hoy, tono sexy, incluye CTA a membership';
    const hasMedia = true;

    const result = await GrokService.generateSharePost({ prompt, hasMedia });

    // Verify the result structure
    expect(result).toHaveProperty('spanish');
    expect(result).toHaveProperty('english');
    expect(result).toHaveProperty('combined');

    // Verify Spanish content follows single-line format
    expect(result.spanish).toMatch(/^\[.*\] \[.*\] #/);
    expect(result.spanish).not.toContain('\n');
    expect(result.spanish).not.toContain('---');

    // Verify English content follows single-line format
    expect(result.english).toMatch(/^\[.*\] \[.*\] #/);
    expect(result.english).not.toContain('\n');
    expect(result.english).not.toContain('---');

    // Verify combined format
    expect(result.combined).toContain('🇪🇸 ESPAÑOL');
    expect(result.combined).toContain('🇬🇧 ENGLISH');
    expect(result.combined).toContain(result.spanish);
    expect(result.combined).toContain(result.english);
  });

  test('should handle prompt without media', async () => {
    const prompt = 'Simple text post';
    const hasMedia = false;

    const result = await GrokService.generateSharePost({ prompt, hasMedia });

    // Should still generate structured content
    expect(result).toHaveProperty('spanish');
    expect(result).toHaveProperty('english');
    expect(result).toHaveProperty('combined');
  });
});
