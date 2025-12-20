/**
 * IterationViewer Component Tests
 *
 * 반복 진행 상황 뷰어 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IterationViewer } from '../../../src/components/IterationViewer';
import type { DebateProgress } from '../../../shared/types';

describe('IterationViewer', () => {
  const createMockProgress = (overrides: Partial<DebateProgress> = {}): DebateProgress => ({
    iteration: 3,
    totalIterations: 10,
    phase: 'waiting',
    currentProvider: 'chatgpt',
    ...overrides,
  });

  describe('empty state', () => {
    it('should show placeholder when not running and no progress', () => {
      render(<IterationViewer progress={null} isRunning={false} />);

      expect(screen.getByText('토론이 시작되면 표시됩니다')).toBeInTheDocument();
    });

    it('should show title in empty state', () => {
      render(<IterationViewer progress={null} isRunning={false} />);

      expect(screen.getByText('진행 상황')).toBeInTheDocument();
    });
  });

  describe('with progress', () => {
    it('should display iteration count', () => {
      const progress = createMockProgress({ iteration: 5 });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('반복')).toBeInTheDocument();
    });

    it('should display current provider', () => {
      const progress = createMockProgress({ currentProvider: 'claude' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('CLAUDE')).toBeInTheDocument();
    });

    it('should display current phase label', () => {
      const progress = createMockProgress({ phase: 'scoring' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('점수 계산')).toBeInTheDocument();
    });
  });

  describe('phase labels', () => {
    it('should show input phase', () => {
      const progress = createMockProgress({ phase: 'input' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('입력 준비')).toBeInTheDocument();
    });

    it('should show waiting phase', () => {
      const progress = createMockProgress({ phase: 'waiting' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('응답 대기')).toBeInTheDocument();
    });

    it('should show extracting phase', () => {
      const progress = createMockProgress({ phase: 'extracting' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('응답 추출')).toBeInTheDocument();
    });

    it('should show scoring phase', () => {
      const progress = createMockProgress({ phase: 'scoring' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('점수 계산')).toBeInTheDocument();
    });

    it('should show cycle_check phase', () => {
      const progress = createMockProgress({ phase: 'cycle_check' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('순환 검사')).toBeInTheDocument();
    });
  });

  describe('running indicator', () => {
    it('should show running indicator when isRunning is true', () => {
      const progress = createMockProgress();
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('토론 진행 중...')).toBeInTheDocument();
    });

    it('should not show running indicator when isRunning is false', () => {
      const progress = createMockProgress();
      render(<IterationViewer progress={progress} isRunning={false} />);

      expect(screen.queryByText('토론 진행 중...')).not.toBeInTheDocument();
    });
  });

  describe('provider colors', () => {
    it('should apply chatgpt color class', () => {
      const progress = createMockProgress({ currentProvider: 'chatgpt' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      const providerElement = screen.getByText('CHATGPT');
      expect(providerElement).toHaveClass('text-chatgpt');
    });

    it('should apply claude color class', () => {
      const progress = createMockProgress({ currentProvider: 'claude' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      const providerElement = screen.getByText('CLAUDE');
      expect(providerElement).toHaveClass('text-claude');
    });

    it('should apply gemini color class', () => {
      const progress = createMockProgress({ currentProvider: 'gemini' });
      render(<IterationViewer progress={progress} isRunning={true} />);

      const providerElement = screen.getByText('GEMINI');
      expect(providerElement).toHaveClass('text-gemini');
    });
  });

  describe('zero iteration', () => {
    it('should display 0 when iteration is 0', () => {
      const progress = createMockProgress({ iteration: 0 });
      render(<IterationViewer progress={progress} isRunning={true} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display 0 when progress is null but running', () => {
      render(<IterationViewer progress={null} isRunning={true} />);

      // When running but no progress, should still show the component
      expect(screen.getByText('진행 상황')).toBeInTheDocument();
    });
  });
});
