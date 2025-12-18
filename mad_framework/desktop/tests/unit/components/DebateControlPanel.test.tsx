/**
 * DebateControlPanel Component Tests
 *
 * 버튼 클릭 동작 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebateControlPanel } from '../../../src/components/DebateControlPanel';
import { useDebateStore } from '../../../src/stores/debate-store';

// Mock the store
vi.mock('../../../src/stores/debate-store');

describe('DebateControlPanel', () => {
  const mockCancelDebate = vi.fn();
  const mockResetDebate = vi.fn();
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state (no session)', () => {
    beforeEach(() => {
      vi.mocked(useDebateStore).mockReturnValue({
        isRunning: false,
        session: null,
        error: null,
        cancelDebate: mockCancelDebate,
        resetDebate: mockResetDebate,
      } as ReturnType<typeof useDebateStore>);
    });

    it('should render start button', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('토론 시작')).toBeInTheDocument();
    });

    it('should call onStart when start button clicked', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      fireEvent.click(screen.getByText('토론 시작'));
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it('should not show cancel or reset buttons', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.queryByText('중지')).not.toBeInTheDocument();
      expect(screen.queryByText('초기화')).not.toBeInTheDocument();
    });
  });

  describe('running state', () => {
    beforeEach(() => {
      vi.mocked(useDebateStore).mockReturnValue({
        isRunning: true,
        session: {
          id: 'test-session',
          config: {} as never,
          status: 'running',
          currentIteration: 1,
          elements: [],
          createdAt: new Date().toISOString(),
        },
        error: null,
        cancelDebate: mockCancelDebate,
        resetDebate: mockResetDebate,
      } as ReturnType<typeof useDebateStore>);
    });

    it('should render cancel button when running', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('중지')).toBeInTheDocument();
    });

    it('should call cancelDebate when cancel button clicked', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      fireEvent.click(screen.getByText('중지'));
      expect(mockCancelDebate).toHaveBeenCalledTimes(1);
    });

    it('should not show start button when running', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.queryByText('토론 시작')).not.toBeInTheDocument();
    });

    it('should show running status indicator', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('진행 중')).toBeInTheDocument();
    });
  });

  describe('completed state', () => {
    beforeEach(() => {
      vi.mocked(useDebateStore).mockReturnValue({
        isRunning: false,
        session: {
          id: 'test-session',
          config: {} as never,
          status: 'completed',
          currentIteration: 5,
          elements: [],
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        error: null,
        cancelDebate: mockCancelDebate,
        resetDebate: mockResetDebate,
      } as ReturnType<typeof useDebateStore>);
    });

    it('should render reset button when completed', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('초기화')).toBeInTheDocument();
    });

    it('should call resetDebate when reset button clicked', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      fireEvent.click(screen.getByText('초기화'));
      expect(mockResetDebate).toHaveBeenCalledTimes(1);
    });

    it('should show completed status indicator', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('완료')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      vi.mocked(useDebateStore).mockReturnValue({
        isRunning: false,
        session: {
          id: 'test-session',
          config: {} as never,
          status: 'error',
          currentIteration: 0,
          elements: [],
          createdAt: new Date().toISOString(),
        },
        error: 'Connection failed',
        cancelDebate: mockCancelDebate,
        resetDebate: mockResetDebate,
      } as ReturnType<typeof useDebateStore>);
    });

    it('should display error message', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('should show error status indicator', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('오류')).toBeInTheDocument();
    });
  });

  describe('cancelled state', () => {
    beforeEach(() => {
      vi.mocked(useDebateStore).mockReturnValue({
        isRunning: false,
        session: {
          id: 'test-session',
          config: {} as never,
          status: 'cancelled',
          currentIteration: 2,
          elements: [],
          createdAt: new Date().toISOString(),
        },
        error: null,
        cancelDebate: mockCancelDebate,
        resetDebate: mockResetDebate,
      } as ReturnType<typeof useDebateStore>);
    });

    it('should show cancelled status indicator', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('취소됨')).toBeInTheDocument();
    });

    it('should show reset button when cancelled', () => {
      render(<DebateControlPanel onStart={mockOnStart} />);
      expect(screen.getByText('초기화')).toBeInTheDocument();
    });
  });
});
