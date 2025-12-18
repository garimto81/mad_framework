/**
 * ChatGPT Adapter Tests
 *
 * TDD RED Phase: ChatGPT 사이트 특화 테스트
 * - ChatGPT 특정 셀렉터
 * - 로그인 확인 (profile-button)
 * - 스트리밍 상태 (result-streaming)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatGPTAdapter } from '../../../electron/browser/adapters/chatgpt-adapter';

const createMockWebContents = () => ({
  executeJavaScript: vi.fn(),
  loadURL: vi.fn(),
  getURL: vi.fn().mockReturnValue('https://chat.openai.com'),
  on: vi.fn(),
});

describe('ChatGPTAdapter', () => {
  let mockWebContents: ReturnType<typeof createMockWebContents>;
  let adapter: ChatGPTAdapter;

  beforeEach(() => {
    mockWebContents = createMockWebContents();
    adapter = new ChatGPTAdapter(mockWebContents as any);
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct provider name', () => {
      expect(adapter.provider).toBe('chatgpt');
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://chat.openai.com');
    });

    it('should have correct selectors', () => {
      expect(adapter.selectors.inputTextarea).toBe('#prompt-textarea');
      expect(adapter.selectors.sendButton).toBe('[data-testid="send-button"]');
      expect(adapter.selectors.loginCheck).toBe('[data-testid="profile-button"]');
      expect(adapter.selectors.typingIndicator).toBe('.result-streaming');
    });
  });

  describe('isLoggedIn', () => {
    it('should check for profile button to verify login', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[data-testid="profile-button"]');
    });
  });

  describe('inputPrompt', () => {
    it('should input to #prompt-textarea', async () => {
      // Mock successful input and verification
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, method: 'contenteditable' }) // inputPrompt script
        .mockResolvedValueOnce(true); // verifyInput script

      await adapter.inputPrompt('Test prompt');

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('#prompt-textarea');
      expect(script).toContain('Test prompt');
    });

    it('should throw error when input fails', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: false, error: 'textarea not found' });

      await expect(adapter.inputPrompt('Test')).rejects.toThrow('ChatGPT enterPrompt failed');
    });

    it('should throw error when verification fails', async () => {
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: true, method: 'contenteditable' })
        .mockResolvedValueOnce(false); // verifyInput returns false

      await expect(adapter.inputPrompt('Test')).rejects.toThrow('verification failed');
    });
  });

  describe('isWriting', () => {
    it('should check for .result-streaming class', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('.result-streaming');
    });
  });

  describe('getTokenCount', () => {
    it('should count characters from last assistant message', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(500);

      const count = await adapter.getTokenCount();

      expect(count).toBe(500);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[data-message-author-role="assistant"]');
    });
  });

  describe('extractResponse', () => {
    it('should extract text from last assistant message', async () => {
      const response = 'This is ChatGPT response';
      // ChatGPT adapter returns { success, content } object
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: response,
        selector: '[data-message-author-role="assistant"]'
      });

      const result = await adapter.extractResponse();

      console.log('[chatgpt] extractResponse result:', JSON.stringify(result).substring(0, 100));
      expect(result).toBe(response);
    });

    it('should return empty string when no messages found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        content: '',
        error: 'no messages found'
      });

      const result = await adapter.extractResponse();

      expect(result).toBe('');
    });
  });
});
