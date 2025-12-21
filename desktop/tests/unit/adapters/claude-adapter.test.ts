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
    it('should check stop button and send button state', async () => {
      // Issue #11: 2025-12 DOM - stop/send button 기반 감지
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'stopButton: button[aria-label="응답 중지"]',
        debug: { stopButton: true, sendButton: { exists: true, disabled: true } },
        responseContent: ''
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      // Issue #11: 이제 stop 버튼, send 버튼 상태를 체크
      expect(script).toContain('stopButton');
      expect(script).toContain('sendButton');
    });

    it('should return false when not writing', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: false,
        reason: 'none',
        debug: { stopButton: false, sendButton: { exists: true, disabled: false } },
        responseContent: ''
      });

      const isWriting = await adapter.isWriting();

      expect(isWriting).toBe(false);
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

  // Issue #9: Claude submitMessage 버튼 클릭 테스트
  describe('submitMessage', () => {
    it('should dispatch PointerEvent and MouseEvent sequence', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="메시지 보내기"]',
        debug: { tried: [], clicked: 'button[aria-label="메시지 보내기"]' }
      });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      // MouseEvent 시퀀스 확인
      expect(script).toContain('PointerEvent');
      expect(script).toContain('pointerdown');
      expect(script).toContain('mousedown');
      expect(script).toContain('mouseup');
      expect(script).toContain('click');
    });

    it('should try Enter key when button click fails', async () => {
      // 첫 번째 호출: 버튼 클릭 실패
      // 두 번째 호출: Enter 키 성공
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({
          success: false,
          error: 'send button not found',
          debug: { tried: [] }
        })
        .mockResolvedValueOnce({
          success: true,
          method: 'enter-key'
        });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(true);
      // Enter 키 스크립트가 호출되었는지 확인
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledTimes(2);
    });

    it('should try multiple selectors including Korean labels', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="메시지 보내기"]'
      });

      await adapter.submitMessage();

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      // 한국어 셀렉터 포함 확인
      expect(script).toContain('aria-label="메시지 보내기"');
      expect(script).toContain('aria-label="Send message"');
    });
  });
});
