/**
 * LoginStatusBoard Component Tests
 *
 * 로그인 상태 보드 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginStatusBoard } from '../../../src/components/LoginStatusBoard';
import { useLoginStore } from '../../../src/stores/login-store';

// Mock the store
vi.mock('../../../src/stores/login-store');

describe('LoginStatusBoard', () => {
  const mockCheckLoginStatus = vi.fn();
  const mockOpenLoginWindow = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockStore = (overrides: Partial<ReturnType<typeof useLoginStore>> = {}) => {
    vi.mocked(useLoginStore).mockReturnValue({
      status: {
        chatgpt: { provider: 'chatgpt', isLoggedIn: false, lastChecked: '' },
        claude: { provider: 'claude', isLoggedIn: false, lastChecked: '' },
        gemini: { provider: 'gemini', isLoggedIn: false, lastChecked: '' },
      },
      isChecking: false,
      checkLoginStatus: mockCheckLoginStatus,
      openLoginWindow: mockOpenLoginWindow,
      ...overrides,
    } as any);
  };

  describe('rendering', () => {
    it('should render title', () => {
      setupMockStore();
      render(<LoginStatusBoard />);

      expect(screen.getByText('로그인 상태')).toBeInTheDocument();
    });

    it('should render refresh button', () => {
      setupMockStore();
      render(<LoginStatusBoard />);

      expect(screen.getByText('새로고침')).toBeInTheDocument();
    });

    it('should render all three providers', () => {
      setupMockStore();
      render(<LoginStatusBoard />);

      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });
  });

  describe('login status display', () => {
    it('should show login button for logged out providers', () => {
      setupMockStore();
      render(<LoginStatusBoard />);

      // All providers logged out, should have 3 login buttons
      const loginButtons = screen.getAllByText('로그인');
      expect(loginButtons).toHaveLength(3);
    });

    it('should show logged in status for logged in providers', () => {
      setupMockStore({
        status: {
          chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: '' },
          claude: { provider: 'claude', isLoggedIn: false, lastChecked: '' },
          gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '' },
        },
      });
      render(<LoginStatusBoard />);

      // 2 providers logged in
      const loggedInIndicators = screen.getAllByText('로그인됨');
      expect(loggedInIndicators).toHaveLength(2);

      // 1 provider logged out
      const loginButtons = screen.getAllByText('로그인');
      expect(loginButtons).toHaveLength(1);
    });

    it('should show all logged in when all providers logged in', () => {
      setupMockStore({
        status: {
          chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: '' },
          claude: { provider: 'claude', isLoggedIn: true, lastChecked: '' },
          gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '' },
        },
      });
      render(<LoginStatusBoard />);

      const loggedInIndicators = screen.getAllByText('로그인됨');
      expect(loggedInIndicators).toHaveLength(3);

      // No login buttons
      expect(screen.queryByText('로그인')).not.toBeInTheDocument();
    });
  });

  describe('refresh functionality', () => {
    it('should call checkLoginStatus when refresh clicked', () => {
      setupMockStore();
      render(<LoginStatusBoard />);

      fireEvent.click(screen.getByText('새로고침'));
      expect(mockCheckLoginStatus).toHaveBeenCalled();
    });

    it('should show checking state', () => {
      setupMockStore({ isChecking: true });
      render(<LoginStatusBoard />);

      expect(screen.getByText('확인 중...')).toBeInTheDocument();
    });

    it('should disable refresh button when checking', () => {
      setupMockStore({ isChecking: true });
      render(<LoginStatusBoard />);

      const refreshButton = screen.getByText('확인 중...');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('login window', () => {
    it('should call openLoginWindow when login button clicked', () => {
      setupMockStore({
        status: {
          chatgpt: { provider: 'chatgpt', isLoggedIn: false, lastChecked: '' },
          claude: { provider: 'claude', isLoggedIn: true, lastChecked: '' },
          gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '' },
        },
      });
      render(<LoginStatusBoard />);

      // Click the login button for ChatGPT
      fireEvent.click(screen.getByText('로그인'));
      expect(mockOpenLoginWindow).toHaveBeenCalledWith('chatgpt');
    });
  });
});
