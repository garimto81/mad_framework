/**
 * ParticipantSelector Component Tests
 *
 * LLM 선택 버튼 클릭 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParticipantSelector } from '../../../src/components/ParticipantSelector';
import { useLoginStore } from '../../../src/stores/login-store';

// Mock the store
vi.mock('../../../src/stores/login-store');

describe('ParticipantSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all providers logged in
    vi.mocked(useLoginStore).mockReturnValue({
      status: {
        chatgpt: { isLoggedIn: true, lastChecked: new Date().toISOString() },
        claude: { isLoggedIn: true, lastChecked: new Date().toISOString() },
        gemini: { isLoggedIn: true, lastChecked: new Date().toISOString() },
      },
    } as ReturnType<typeof useLoginStore>);
  });

  describe('rendering', () => {
    it('should render all three provider buttons', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude']}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });

    it('should show minimum selection hint', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude']}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('최소 2개 선택')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('should call onChange when unselected provider is clicked', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude']}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('Gemini'));
      expect(mockOnChange).toHaveBeenCalledWith(['chatgpt', 'claude', 'gemini']);
    });

    it('should remove provider when already selected (if more than 2)', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude', 'gemini']}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('Gemini'));
      expect(mockOnChange).toHaveBeenCalledWith(['chatgpt', 'claude']);
    });

    it('should NOT remove provider if only 2 selected', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude']}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('Claude'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('login status', () => {
    it('should show login required for logged out providers', () => {
      vi.mocked(useLoginStore).mockReturnValue({
        status: {
          chatgpt: { isLoggedIn: true, lastChecked: new Date().toISOString() },
          claude: { isLoggedIn: false, lastChecked: new Date().toISOString() },
          gemini: { isLoggedIn: true, lastChecked: new Date().toISOString() },
        },
      } as ReturnType<typeof useLoginStore>);

      render(
        <ParticipantSelector
          selected={['chatgpt', 'gemini']}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('로그인 필요')).toBeInTheDocument();
    });

    it('should disable button for logged out provider', () => {
      vi.mocked(useLoginStore).mockReturnValue({
        status: {
          chatgpt: { isLoggedIn: true, lastChecked: new Date().toISOString() },
          claude: { isLoggedIn: false, lastChecked: new Date().toISOString() },
          gemini: { isLoggedIn: true, lastChecked: new Date().toISOString() },
        },
      } as ReturnType<typeof useLoginStore>);

      render(
        <ParticipantSelector
          selected={['chatgpt', 'gemini']}
          onChange={mockOnChange}
        />
      );

      const claudeButton = screen.getByText('Claude').closest('button');
      expect(claudeButton).toBeDisabled();
    });

    it('should not call onChange when clicking disabled button', () => {
      vi.mocked(useLoginStore).mockReturnValue({
        status: {
          chatgpt: { isLoggedIn: true, lastChecked: new Date().toISOString() },
          claude: { isLoggedIn: false, lastChecked: new Date().toISOString() },
          gemini: { isLoggedIn: true, lastChecked: new Date().toISOString() },
        },
      } as ReturnType<typeof useLoginStore>);

      render(
        <ParticipantSelector
          selected={['chatgpt', 'gemini']}
          onChange={mockOnChange}
        />
      );

      fireEvent.click(screen.getByText('Claude'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should not call onChange when disabled', () => {
      render(
        <ParticipantSelector
          selected={['chatgpt', 'claude']}
          onChange={mockOnChange}
          disabled={true}
        />
      );

      fireEvent.click(screen.getByText('Gemini'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });
});
