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

  // Issue #33: isWriting 강화 테스트
  describe('isWriting', () => {
    it('should return true when loading indicator exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'loading',
        debug: { loading: true },
      });

      const isWriting = await adapter.isWriting();
      expect(isWriting).toBe(true);
    });

    it('should return true when stop button exists', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'stopButton',
        debug: { stopButton: true },
      });

      const isWriting = await adapter.isWriting();
      expect(isWriting).toBe(true);
    });

    it('should return true when send button is disabled', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'sendDisabled',
        debug: { sendButton: { exists: true, disabled: true } },
      });

      const isWriting = await adapter.isWriting();
      expect(isWriting).toBe(true);
    });

    it('should return true when aria-busy is true', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: true,
        reason: 'ariaBusy',
        debug: { ariaBusy: true },
      });

      const isWriting = await adapter.isWriting();
      expect(isWriting).toBe(true);
    });

    it('should return false when no indicators present', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: false,
        reason: 'none',
        debug: {},
      });

      const isWriting = await adapter.isWriting();
      expect(isWriting).toBe(false);
    });

    it('should check multiple selector types', async () => {
      // 스크립트가 올바른 셀렉터들을 체크하는지 확인
      mockWebContents.executeJavaScript.mockResolvedValue({
        writing: false,
        reason: 'none',
        debug: {},
      });

      await adapter.isWriting();

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      // 다양한 셀렉터 체크 확인
      expect(script).toContain('.loading-indicator');
      expect(script).toContain('[aria-busy="true"]');
      expect(script).toContain('Stop');
    });
  });

  // Issue #33: getResponse 강화 테스트
  describe('getResponse', () => {
    it('should extract response from .response-container', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: 'Test response content',
        selector: '.response-container',
      });

      const result = await adapter.getResponse();
      expect(result.success).toBe(true);
      expect(result.data).toBe('Test response content');
    });

    it('should try fallback selectors when primary fails', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: 'Fallback content from model-response',
        selector: '.model-response',
      });

      const result = await adapter.getResponse();
      expect(result.success).toBe(true);
      expect(result.data).toBe('Fallback content from model-response');
    });

    it('should return empty string when no response found', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        content: '',
        error: 'no messages found',
      });

      const result = await adapter.getResponse();
      expect(result.success).toBe(false);
    });

    it('should filter out short responses (less than 10 chars)', async () => {
      // 첫 번째 호출은 짧은 응답
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: false,
        content: '',
        error: 'response too short',
      });

      const result = await adapter.getResponse();
      expect(result.success).toBe(false);
    });

    it('should check multiple selectors in script', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        content: 'Response content',
        selector: '.response-container',
      });

      await adapter.getResponse();

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('.response-container');
      expect(script).toContain('.model-response');
    });
  });

  // Issue #52: submitMessage 특화 구현 테스트
  describe('submitMessage', () => {
    it('should try Material Design selectors in order', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="Submit prompt"]',
        debug: { tried: ['button[aria-label="Submit prompt"]'] },
      });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('aria-label="Submit prompt"');
      expect(script).toContain('aria-label="프롬프트 보내기"');
    });

    it('should use PointerEvent + MouseEvent sequence', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: '.send-button',
      });

      await adapter.submitMessage();

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('PointerEvent');
      expect(script).toContain('MouseEvent');
      expect(script).toContain('pointerdown');
      expect(script).toContain('mousedown');
    });

    it('should fallback to Enter key when button click fails', async () => {
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: false, error: 'button not found' })
        .mockResolvedValueOnce({ success: true, method: 'enter-key' });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(true);
      expect(mockWebContents.executeJavaScript).toHaveBeenCalledTimes(2);
    });

    it('should support Korean aria-labels', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="프롬프트 보내기"]',
      });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(true);
      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('프롬프트 보내기');
      expect(script).toContain('보내');
    });

    it('should return error when all methods fail', async () => {
      mockWebContents.executeJavaScript
        .mockResolvedValueOnce({ success: false, error: 'button not found' })
        .mockResolvedValueOnce({ success: false, error: 'editor not found' });

      const result = await adapter.submitMessage();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEND_FAILED');
    });

    it('should include Japanese aria-label for internationalization', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        success: true,
        selector: 'button[aria-label="プロンプトを送信"]',
      });

      await adapter.submitMessage();

      const script = mockWebContents.executeJavaScript.mock.calls[0][0];
      expect(script).toContain('プロンプトを送信');
    });
  });
});
