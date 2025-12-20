/**
 * ElementScoreBoard Component Tests
 *
 * 요소별 점수 표시 테스트
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ElementScoreBoard } from '../../../src/components/ElementScoreBoard';
import type { DebateElement } from '../../../shared/types';

describe('ElementScoreBoard', () => {
  const createMockElement = (overrides: Partial<DebateElement> = {}): DebateElement => ({
    id: 'elem-1',
    name: 'Test Element',
    status: 'in_progress',
    currentScore: 75,
    scoreHistory: [70, 75],
    versionHistory: [],
    ...overrides,
  });

  describe('empty state', () => {
    it('should show placeholder when no elements', () => {
      render(<ElementScoreBoard elements={[]} threshold={90} />);

      expect(screen.getByText('토론이 시작되면 표시됩니다')).toBeInTheDocument();
    });

    it('should show title in empty state', () => {
      render(<ElementScoreBoard elements={[]} threshold={90} />);

      expect(screen.getByText('평가 요소')).toBeInTheDocument();
    });
  });

  describe('with elements', () => {
    it('should display element name', () => {
      const element = createMockElement({ name: 'Security Review' });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('Security Review')).toBeInTheDocument();
    });

    it('should display current score', () => {
      const element = createMockElement({ currentScore: 85 });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should display multiple elements', () => {
      const elements = [
        createMockElement({ id: '1', name: 'Element 1' }),
        createMockElement({ id: '2', name: 'Element 2' }),
        createMockElement({ id: '3', name: 'Element 3' }),
      ];
      render(<ElementScoreBoard elements={elements} threshold={90} />);

      expect(screen.getByText('Element 1')).toBeInTheDocument();
      expect(screen.getByText('Element 2')).toBeInTheDocument();
      expect(screen.getByText('Element 3')).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('should show pending status', () => {
      const element = createMockElement({ status: 'pending' });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('대기')).toBeInTheDocument();
    });

    it('should show in_progress status', () => {
      const element = createMockElement({ status: 'in_progress' });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('진행 중')).toBeInTheDocument();
    });

    it('should show completed status', () => {
      const element = createMockElement({ status: 'completed' });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('완료')).toBeInTheDocument();
    });

    it('should show cycle_detected status', () => {
      const element = createMockElement({ status: 'cycle_detected' });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('순환 감지')).toBeInTheDocument();
    });
  });

  describe('score history', () => {
    it('should show score history when more than one score', () => {
      const element = createMockElement({ scoreHistory: [60, 70, 80] });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.getByText('히스토리:')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should not show history when only one score', () => {
      const element = createMockElement({ scoreHistory: [75] });
      render(<ElementScoreBoard elements={[element]} threshold={90} />);

      expect(screen.queryByText('히스토리:')).not.toBeInTheDocument();
    });
  });

  describe('threshold indication', () => {
    it('should apply different style when score meets threshold', () => {
      const element = createMockElement({ currentScore: 95 });
      const { container } = render(<ElementScoreBoard elements={[element]} threshold={90} />);

      // Score above threshold should have green text
      const scoreElement = screen.getByText('95');
      expect(scoreElement).toHaveClass('text-green-400');
    });

    it('should apply default style when score below threshold', () => {
      const element = createMockElement({ currentScore: 80 });
      const { container } = render(<ElementScoreBoard elements={[element]} threshold={90} />);

      // Score below threshold should have white text
      const scoreElement = screen.getByText('80');
      expect(scoreElement).toHaveClass('text-white');
    });
  });
});
