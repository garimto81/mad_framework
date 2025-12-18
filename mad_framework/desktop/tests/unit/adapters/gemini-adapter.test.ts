/**
 * Gemini Adapter Tests
 *
 * TDD RED Phase: Gemini 사이트 특화 테스트
 * - ql-editor 입력
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiAdapter } from '../../../electron/browser/adapters/gemini-adapter';

const createMockWebContents = () => ({
  executeJavaScript: vi.fn(),
  loadURL: vi.fn(),
  getURL: vi.fn().mockReturnValue('https://gemini.google.com'),
  on: vi.fn(),
});

describe('GeminiAdapter', () => {
  let mockWebContents: ReturnType<typeof createMockWebContents>;
  let adapter: GeminiAdapter;

  beforeEach(() => {
    mockWebContents = createMockWebContents();
    adapter = new GeminiAdapter(mockWebContents as any);
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct provider name', () => {
      expect(adapter.provider).toBe('gemini');
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://gemini.google.com');
    });

    it('should have correct selectors', () => {
      expect(adapter.selectors.inputTextarea).toBe('.ql-editor');
      expect(adapter.selectors.sendButton).toBe('.send-button');
      expect(adapter.selectors.loginCheck).toBe('[data-user-email]');
    });
  });

  describe('isLoggedIn', () => {
    it('should check for user email attribute', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[data-user-email]');
    });
  });

  describe('inputPrompt', () => {
    it('should input to .ql-editor', async () => {
      // enterPrompt returns {success: true} object from script execution
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      await adapter.inputPrompt('Test prompt');

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('.ql-editor');
    });

    it('should throw error when input fails', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: false, error: 'editor not found' });

      await expect(adapter.inputPrompt('Test')).rejects.toThrow('Gemini enterPrompt failed');
    });
  });
});
