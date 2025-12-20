/**
 * DebateConfigPanel Component Tests
 *
 * 토론 설정 패널 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebateConfigPanel } from '../../../src/components/DebateConfigPanel';
import { useLoginStore } from '../../../src/stores/login-store';

// Mock child components and stores
vi.mock('../../../src/stores/login-store');
vi.mock('../../../src/components/ParticipantSelector', () => ({
  ParticipantSelector: ({ selected, onChange, disabled }: any) => (
    <div data-testid="participant-selector">
      <span>Selected: {selected.join(', ')}</span>
      <button onClick={() => onChange(['chatgpt', 'claude', 'gemini'])} disabled={disabled}>
        Add All
      </button>
    </div>
  ),
}));
vi.mock('../../../src/components/PresetSelector', () => ({
  PresetSelector: ({ selected, onChange, disabled }: any) => (
    <div data-testid="preset-selector">
      <span>Preset: {selected}</span>
      <button onClick={() => onChange('qa_accuracy')} disabled={disabled}>
        Change Preset
      </button>
    </div>
  ),
}));

describe('DebateConfigPanel', () => {
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLoginStore).mockReturnValue({
      status: {
        chatgpt: { isLoggedIn: true, lastChecked: '' },
        claude: { isLoggedIn: true, lastChecked: '' },
        gemini: { isLoggedIn: true, lastChecked: '' },
      },
    } as any);
  });

  describe('rendering', () => {
    it('should render topic input', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByPlaceholderText(/이 코드의 보안 취약점/)).toBeInTheDocument();
    });

    it('should render context textarea', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByPlaceholderText(/코드, 문서, 또는 추가 정보/)).toBeInTheDocument();
    });

    it('should render participant selector', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByTestId('participant-selector')).toBeInTheDocument();
    });

    it('should render preset selector', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByTestId('preset-selector')).toBeInTheDocument();
    });

    it('should render judge selector', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render threshold slider', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByRole('button', { name: '토론 시작' })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should disable submit button when topic is empty', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when topic has value', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: 'Test topic' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      expect(submitButton).not.toBeDisabled();
    });

    it('should not submit when topic is only whitespace', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: '   ' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('should call onStart with config when form is submitted', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: 'Test topic' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      fireEvent.click(submitButton);

      expect(mockOnStart).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'Test topic',
        preset: 'code_review',
        participants: ['chatgpt', 'claude'],
        judgeProvider: 'gemini',
        completionThreshold: 90,
      }));
    });

    it('should include context when provided', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: 'Test topic' } });

      const contextInput = screen.getByPlaceholderText(/코드, 문서, 또는 추가 정보/);
      fireEvent.change(contextInput, { target: { value: 'Some context' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      fireEvent.click(submitButton);

      expect(mockOnStart).toHaveBeenCalledWith(expect.objectContaining({
        context: 'Some context',
      }));
    });

    it('should not include context when empty', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: 'Test topic' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      fireEvent.click(submitButton);

      expect(mockOnStart).toHaveBeenCalledWith(expect.objectContaining({
        context: undefined,
      }));
    });
  });

  describe('threshold slider', () => {
    it('should display current threshold value', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      expect(screen.getByText(/90점/)).toBeInTheDocument();
    });

    it('should update threshold when slider changes', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '85' } });

      expect(screen.getByText(/85점/)).toBeInTheDocument();
    });
  });

  describe('judge selector', () => {
    it('should allow changing judge provider', () => {
      render(<DebateConfigPanel onStart={mockOnStart} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'claude' } });

      const topicInput = screen.getByPlaceholderText(/이 코드의 보안 취약점/);
      fireEvent.change(topicInput, { target: { value: 'Test' } });

      const submitButton = screen.getByRole('button', { name: '토론 시작' });
      fireEvent.click(submitButton);

      expect(mockOnStart).toHaveBeenCalledWith(expect.objectContaining({
        judgeProvider: 'claude',
      }));
    });
  });

  describe('disabled state', () => {
    it('should disable all inputs when disabled prop is true', () => {
      render(<DebateConfigPanel onStart={mockOnStart} disabled={true} />);

      expect(screen.getByPlaceholderText(/이 코드의 보안 취약점/)).toBeDisabled();
      expect(screen.getByPlaceholderText(/코드, 문서, 또는 추가 정보/)).toBeDisabled();
      expect(screen.getByRole('combobox')).toBeDisabled();
      expect(screen.getByRole('slider')).toBeDisabled();
    });
  });
});
