/**
 * ResponseViewer Component Tests
 *
 * 응답 뷰어 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponseViewer } from '../../../src/components/ResponseViewer';
import type { DebateResponse } from '../../../shared/types';

describe('ResponseViewer', () => {
  const createMockResponse = (overrides: Partial<DebateResponse> = {}): DebateResponse => ({
    sessionId: 'session-1',
    iteration: 1,
    provider: 'chatgpt',
    content: 'Test response content',
    timestamp: '2024-01-01T12:00:00Z',
    ...overrides,
  });

  describe('empty state', () => {
    it('should show placeholder when no responses', () => {
      render(<ResponseViewer responses={[]} />);

      expect(screen.getByText('응답이 표시됩니다')).toBeInTheDocument();
    });

    it('should show title in empty state', () => {
      render(<ResponseViewer responses={[]} />);

      expect(screen.getByText('응답 로그')).toBeInTheDocument();
    });
  });

  describe('with responses', () => {
    it('should display response provider', () => {
      const response = createMockResponse({ provider: 'chatgpt' });
      render(<ResponseViewer responses={[response]} />);

      expect(screen.getByText('CHATGPT')).toBeInTheDocument();
    });

    it('should display response iteration', () => {
      const response = createMockResponse({ iteration: 3 });
      render(<ResponseViewer responses={[response]} />);

      expect(screen.getByText('반복 #3')).toBeInTheDocument();
    });

    it('should display multiple responses', () => {
      const responses = [
        createMockResponse({ provider: 'chatgpt', iteration: 1 }),
        createMockResponse({ provider: 'claude', iteration: 2 }),
        createMockResponse({ provider: 'gemini', iteration: 3 }),
      ];
      render(<ResponseViewer responses={responses} />);

      expect(screen.getByText('CHATGPT')).toBeInTheDocument();
      expect(screen.getByText('CLAUDE')).toBeInTheDocument();
      expect(screen.getByText('GEMINI')).toBeInTheDocument();
    });

    it('should show most recent responses first', () => {
      const responses = [
        createMockResponse({ provider: 'chatgpt', iteration: 1 }),
        createMockResponse({ provider: 'claude', iteration: 2 }),
      ];
      render(<ResponseViewer responses={responses} />);

      const providerElements = screen.getAllByRole('button');
      // First button should be Claude (most recent)
      expect(providerElements[0]).toHaveTextContent('CLAUDE');
    });
  });

  describe('expand/collapse', () => {
    it('should not show content by default', () => {
      const response = createMockResponse({ content: 'Hidden content' });
      render(<ResponseViewer responses={[response]} />);

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('should show content when clicked', () => {
      const response = createMockResponse({ content: 'Visible content' });
      render(<ResponseViewer responses={[response]} />);

      fireEvent.click(screen.getByText('CHATGPT'));
      expect(screen.getByText('Visible content')).toBeInTheDocument();
    });

    it('should hide content when clicked again', () => {
      const response = createMockResponse({ content: 'Toggle content' });
      render(<ResponseViewer responses={[response]} />);

      // Click to expand
      fireEvent.click(screen.getByText('CHATGPT'));
      expect(screen.getByText('Toggle content')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByText('CHATGPT'));
      expect(screen.queryByText('Toggle content')).not.toBeInTheDocument();
    });

    it('should only expand one response at a time', () => {
      const responses = [
        createMockResponse({ provider: 'chatgpt', content: 'ChatGPT content' }),
        createMockResponse({ provider: 'claude', content: 'Claude content' }),
      ];
      render(<ResponseViewer responses={responses} />);

      // Expand Claude
      fireEvent.click(screen.getByText('CLAUDE'));
      expect(screen.getByText('Claude content')).toBeInTheDocument();

      // Expand ChatGPT - Claude should collapse
      fireEvent.click(screen.getByText('CHATGPT'));
      expect(screen.getByText('ChatGPT content')).toBeInTheDocument();
      expect(screen.queryByText('Claude content')).not.toBeInTheDocument();
    });
  });

  describe('provider colors', () => {
    it('should apply chatgpt border color', () => {
      const response = createMockResponse({ provider: 'chatgpt' });
      const { container } = render(<ResponseViewer responses={[response]} />);

      const responseElement = container.querySelector('.border-chatgpt');
      expect(responseElement).toBeInTheDocument();
    });

    it('should apply claude border color', () => {
      const response = createMockResponse({ provider: 'claude' });
      const { container } = render(<ResponseViewer responses={[response]} />);

      const responseElement = container.querySelector('.border-claude');
      expect(responseElement).toBeInTheDocument();
    });

    it('should apply gemini border color', () => {
      const response = createMockResponse({ provider: 'gemini' });
      const { container } = render(<ResponseViewer responses={[response]} />);

      const responseElement = container.querySelector('.border-gemini');
      expect(responseElement).toBeInTheDocument();
    });
  });

  describe('timestamp display', () => {
    it('should display formatted timestamp', () => {
      const response = createMockResponse({
        timestamp: '2024-01-15T14:30:00Z'
      });
      render(<ResponseViewer responses={[response]} />);

      // The timestamp should be rendered (exact format depends on locale)
      // Just check that some time-like text is present
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });
  });
});
