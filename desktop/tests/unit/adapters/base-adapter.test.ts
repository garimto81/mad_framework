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

  describe('selector fallback system (Issue #18)', () => {
    it('should have selectorSets with primary and fallbacks', () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      expect(adapter.selectorSets).toBeDefined();
      expect(adapter.selectorSets.inputTextarea.primary).toBe('#prompt-textarea');
      expect(adapter.selectorSets.inputTextarea.fallbacks).toContain('[contenteditable="true"]');
    });

    it('should find element with primary selector first', async () => {
      mockWebContents.executeJavaScript.mockResolvedValueOnce(true);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(true);
      // Should only check primary selector when it exists
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledTimes(1);
    });

    it('should try fallback selectors when primary fails', async () => {
      // Primary fails, first fallback fails, second fallback succeeds
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(false)  // primary fails
        .mockResolvedValueOnce(false)  // fallback 1 fails
        .mockResolvedValueOnce(true);  // fallback 2 succeeds

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(true);
      // Should have tried primary + 2 fallbacks
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledTimes(3);
    });

    it('should return false when all selectors fail', async () => {
      // All selectors fail
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(false);
    });

    it('should have different fallbacks for each provider', () => {
      const chatgpt = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const claude = new BaseLLMAdapter('claude', mockWebContents as any);
      const gemini = new BaseLLMAdapter('gemini', mockWebContents as any);

      // Each provider has different primary selectors
      // Issue #11: Claude의 primary selector가 2025-12 DOM 업데이트로 변경됨
      expect(chatgpt.selectorSets.inputTextarea.primary).toBe('#prompt-textarea');
      expect(claude.selectorSets.inputTextarea.primary).toBe('textarea[data-testid="chat-input-ssr"]');
      expect(gemini.selectorSets.inputTextarea.primary).toBe('.ql-editor');
    });
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
      // findElement returns true (selector found), enterPrompt script returns {success: true}
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // findElement: selector exists
        .mockResolvedValueOnce({ success: true }); // enterPrompt: input success

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const prompt = 'Test prompt for debate';

      await adapter.inputPrompt(prompt);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      // Second call contains the actual prompt
      const call = mockWebContents.executeJavaScript.mock.calls[1][0];
      expect(call).toContain('Test prompt for debate');
    });

    it('should escape special characters in prompt', async () => {
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // findElement
        .mockResolvedValueOnce({ success: true }); // input script

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const prompt = 'Test with "quotes" and \'apostrophes\'';

      await adapter.inputPrompt(prompt);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should throw error when input fails', async () => {
      // findElement returns false (no selector found)
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      await expect(adapter.inputPrompt('test')).rejects.toThrow('no input found');
    });
  });

  describe('sendMessage', () => {
    it('should click send button', async () => {
      // findElement returns true, submitMessage script returns {success: true}
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // findElement: button found
        .mockResolvedValueOnce({ success: true }); // click success

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await adapter.sendMessage();

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    });

    it('should throw error when send button not found', async () => {
      // All selectors fail, then Enter key fallback also fails
      mockWebContents.executeJavaScript.mockResolvedValue(false);

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      await expect(adapter.sendMessage()).rejects.toThrow('Send button not found');
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
      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, content: expectedResponse });

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const response = await adapter.extractResponse();

      expect(response).toBe(expectedResponse);
    });

    it('should return empty string when no response exists', async () => {
      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: false, content: '', error: 'no messages found' });

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
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(true)  // findElement
        .mockResolvedValueOnce(1234); // count

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const tokenCount = await adapter.getTokenCount();

      expect(tokenCount).toBe(1234);
    });

    it('should return 0 when no response exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(false); // findElement fails

      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);
      const tokenCount = await adapter.getTokenCount();

      expect(tokenCount).toBe(0);
    });
  });

  // Issue #33: awaitResponse improvements
  describe('awaitResponse improvements (Issue #33)', () => {
    it('should use DOM stabilization fallback when typing detection fails', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // isWriting returns false (typing detection fails)
      // hasValidResponse returns true eventually
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(false)  // isWriting (typing never starts)
        .mockResolvedValueOnce(true)   // DOM stabilization check
        .mockResolvedValueOnce(true)   // findElement for getResponse
        .mockResolvedValueOnce('Valid response content over 10 chars'); // getResponse

      await expect(adapter.waitForResponse(5000)).resolves.toBeUndefined();
    }, 10000);

    it('should check hasValidResponse after DOM stabilization', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // isWriting returns false
      // DOM stabilization returns true
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce(false)  // isWriting check 1
        .mockResolvedValueOnce(true);  // DOM stabilized

      await expect(adapter.waitForResponse(3000)).resolves.toBeUndefined();
    }, 10000);

    it('should filter out loading placeholder responses', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, content: 'loading...' });

      // hasValidResponse should return false for loading placeholder
      const hasValid = await (adapter as any).hasValidResponse();
      expect(hasValid).toBe(false);
    });

    it('should accept valid response over minimum length', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, content: 'This is a valid response with enough characters' });

      const hasValid = await (adapter as any).hasValidResponse();
      expect(hasValid).toBe(true);
    });

    it('should reject very short responses', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, content: 'Hi' });

      const hasValid = await (adapter as any).hasValidResponse();
      expect(hasValid).toBe(false);
    });

    it('should reject ellipsis-only responses', async () => {
      const adapter = new BaseLLMAdapter('chatgpt', mockWebContents as any);

      // Issue #31: extractResponseFromSelectors returns object with success/content
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, content: '...' });

      const hasValid = await (adapter as any).hasValidResponse();
      expect(hasValid).toBe(false);
    });
  });
});
