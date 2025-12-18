/**
 * Claude Adapter Tests
 *
 * TDD RED Phase: Claude.ai 사이트 특화 테스트
 * - contenteditable div 입력
 * - 스트리밍 상태 (data-is-streaming)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeAdapter } from '../../../electron/browser/adapters/claude-adapter';

const createMockWebContents = () => ({
  executeJavaScript: vi.fn(),
  loadURL: vi.fn(),
  getURL: vi.fn().mockReturnValue('https://claude.ai'),
  on: vi.fn(),
});

describe('ClaudeAdapter', () => {
  let mockWebContents: ReturnType<typeof createMockWebContents>;
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    mockWebContents = createMockWebContents();
    adapter = new ClaudeAdapter(mockWebContents as any);
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct provider name', () => {
      expect(adapter.provider).toBe('claude');
    });

    it('should have correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://claude.ai');
    });

    it('should have correct selectors for contenteditable input', () => {
      expect(adapter.selectors.inputTextarea).toBe('[contenteditable="true"]');
      expect(adapter.selectors.sendButton).toBe('[aria-label="Send message"]');
      expect(adapter.selectors.typingIndicator).toBe('[data-is-streaming="true"]');
    });
  });

  describe('inputPrompt', () => {
    it('should input to contenteditable div using innerText', async () => {
      // enterPrompt returns {success: true} object from script execution
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      await adapter.inputPrompt('Test prompt');

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[contenteditable="true"]');
      expect(script).toContain('innerText');
    });

    it('should dispatch InputEvent for contenteditable', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: true });

      await adapter.inputPrompt('Test');

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('InputEvent');
    });

    it('should throw error when input fails', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({ success: false, error: 'editor not found' });

      await expect(adapter.inputPrompt('Test')).rejects.toThrow('Claude enterPrompt failed');
    });
  });

  describe('isWriting', () => {
    it('should check data-is-streaming attribute', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[data-is-streaming="true"]');
    });
  });

  describe('isLoggedIn', () => {
    it('should check for user menu element', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue(true);

      const isLoggedIn = await adapter.isLoggedIn();

      expect(isLoggedIn).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('[data-testid="user-menu"]');
    });
  });
});
