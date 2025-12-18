/**
 * Base Adapter Tests
 *
 * TDD RED Phase: 테스트 먼저 작성
 * - 로그인 상태 확인
 * - 입력 준비 확인
 * - 프롬프트 입력
 * - 응답 대기
 * - 응답 추출
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLLMAdapter } from '../../../electron/browser/adapters/base-adapter';
import type { LLMProvider, LLMStatus } from '../../../shared/types';

// Mock WebContents
const createMockWebContents = () => ({
  executeJavaScript: vi.fn(),
  loadURL: vi.fn(),
  getURL: vi.fn(),
  on: vi.fn(),
});

describe('BaseLLMAdapter', () => {
  let mockWebContents: ReturnType<typeof createMockWebContents>;

  beforeEach(() => {
    mockWebContents = createMockWebContents();
    vi.clearAllMocks();
  });

  describe('isLoggedIn', () => {
    it('should return true when login selector exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const result = await adapter.isLoggedIn();

      expect(result).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should return false when login selector does not exist', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const result = await adapter.isLoggedIn();

      expect(result).toBe(false);
    });

    it('should return false when browser throws error (graceful fallback)', async () => {
      mockWebContents.executeJavaScript.mockRejectedValue(new Error('Page not loaded'));

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const result = await adapter.isLoggedIn();

      // executeScript returns defaultValue (false) on error
      expect(result).toBe(false);
    });
  });

  describe('waitForInputReady', () => {
    it('should resolve when input textarea is ready', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await expect(adapter.waitForInputReady()).resolves.toBeUndefined();
    });

    it('should timeout after specified duration', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      await expect(adapter.waitForInputReady(100)).rejects.toThrow('Input not ready');
    });
  });

  describe('inputPrompt', () => {
    it('should input prompt text into textarea', async () => {
      // enterPrompt script returns {success: true} object
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const prompt = 'Test prompt for debate';

      await adapter.inputPrompt(prompt);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      const call = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(call).toContain('Test prompt for debate');
    });

    it('should escape special characters in prompt', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const prompt = 'Test with "quotes" and \'apostrophes\'';

      await adapter.inputPrompt(prompt);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should throw error when input fails', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: false, error: 'selector not found' });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      await expect(adapter.inputPrompt('test')).rejects.toThrow('Failed to input prompt');
    });
  });

  describe('sendMessage', () => {
    it('should click send button', async () => {
      // submitMessage script returns {success: true} object
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await adapter.sendMessage();

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should throw error when send button not found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: false, error: 'send button not found' });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await expect(adapter.sendMessage()).rejects.toThrow('Failed to send message');
    });
  });

  describe('waitForResponse', () => {
    it('should resolve when typing indicator disappears', async () => {
      // Step 1: isWriting returns true (typing started)
      // Step 2: isWriting returns false (typing finished)
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // waitForCondition: typing started
        .mockResolvedValueOnce(false); // waitForCondition: typing finished

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await expect(adapter.waitForResponse(15000)).resolves.toBeUndefined();
    }, 20000);

    it('should timeout if typing never finishes', async () => {
      // Always return true (typing never finishes)
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // Short timeout to trigger failure quickly
      await expect(adapter.waitForResponse(500)).rejects.toThrow('timeout');
    }, 10000);
  });

  describe('extractResponse', () => {
    it('should extract last response content', async () => {
      const expectedResponse = 'This is the LLM response';
      mockWebContents.executeJavaScript.mockResolvedValue(expectedResponse);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const response = await adapter.extractResponse();

      expect(response).toBe(expectedResponse);
    });

    it('should return empty string when no response exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue('');

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const response = await adapter.extractResponse();

      expect(response).toBe('');
    });
  });

  describe('isWriting', () => {
    it('should return true when typing indicator is visible', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
    });

    it('should return false when typing indicator is not visible', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(false);
    });
  });

  describe('getTokenCount', () => {
    it('should return approximate token count from response length', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(1234);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const tokenCount = await adapter.getTokenCount();

      expect(tokenCount).toBe(1234);
    });

    it('should return 0 when no response exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(0);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const tokenCount = await adapter.getTokenCount();

      expect(tokenCount).toBe(0);
    });
  });
});
