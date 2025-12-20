/**
 * PresetSelector Component Tests
 *
 * 프리셋 선택기 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetSelector } from '../../../src/components/PresetSelector';

describe('PresetSelector', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render label', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      expect(screen.getByText('토론 프리셋')).toBeInTheDocument();
    });

    it('should render all three presets', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      expect(screen.getByText('코드 리뷰')).toBeInTheDocument();
      expect(screen.getByText('Q&A 정확도')).toBeInTheDocument();
      expect(screen.getByText('의사결정')).toBeInTheDocument();
    });

    it('should render preset descriptions', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      expect(screen.getByText('보안, 성능, 가독성, 유지보수성 평가')).toBeInTheDocument();
      expect(screen.getByText('정확성, 완전성, 명확성 검증')).toBeInTheDocument();
      expect(screen.getByText('장점, 단점, 위험, 기회 분석')).toBeInTheDocument();
    });

    it('should render preset icons', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      // Icons are rendered as text
      expect(screen.getByText('💻')).toBeInTheDocument();
      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('⚖️')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('should highlight selected preset', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      const codeReviewButton = screen.getByText('코드 리뷰').closest('button');
      expect(codeReviewButton).toHaveClass('border-blue-500');
    });

    it('should not highlight unselected presets', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      const qaButton = screen.getByText('Q&A 정확도').closest('button');
      expect(qaButton).toHaveClass('border-gray-600');
    });

    it('should call onChange when preset is clicked', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('Q&A 정확도'));
      expect(mockOnChange).toHaveBeenCalledWith('qa_accuracy');
    });

    it('should call onChange with decision preset', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('의사결정'));
      expect(mockOnChange).toHaveBeenCalledWith('decision');
    });

    it('should call onChange when clicking already selected preset', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} />);

      fireEvent.click(screen.getByText('코드 리뷰'));
      expect(mockOnChange).toHaveBeenCalledWith('code_review');
    });
  });

  describe('disabled state', () => {
    it('should disable all buttons when disabled', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} disabled={true} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should not call onChange when disabled', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} disabled={true} />);

      fireEvent.click(screen.getByText('Q&A 정확도'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should apply disabled styling', () => {
      render(<PresetSelector selected="code_review" onChange={mockOnChange} disabled={true} />);

      const button = screen.getByText('코드 리뷰').closest('button');
      expect(button).toHaveClass('opacity-50');
    });
  });

  describe('different selected states', () => {
    it('should highlight qa_accuracy when selected', () => {
      render(<PresetSelector selected="qa_accuracy" onChange={mockOnChange} />);

      const qaButton = screen.getByText('Q&A 정확도').closest('button');
      expect(qaButton).toHaveClass('border-blue-500');
    });

    it('should highlight decision when selected', () => {
      render(<PresetSelector selected="decision" onChange={mockOnChange} />);

      const decisionButton = screen.getByText('의사결정').closest('button');
      expect(decisionButton).toHaveClass('border-blue-500');
    });
  });
});
