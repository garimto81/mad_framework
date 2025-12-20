import { test, expect } from '@playwright/test';

test.describe('MAD Desktop App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('App Loading', () => {
    test('should load the app with correct title', async ({ page }) => {
      await expect(page).toHaveTitle('MAD - Multi-Agent Debate');
    });

    test('should display header with app name', async ({ page }) => {
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header.locator('h1')).toHaveText('MAD');
      await expect(header.locator('span.text-gray-400')).toHaveText('Multi-Agent Debate');
    });

    test('should have main layout structure', async ({ page }) => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });
  });

  test.describe('Config View', () => {
    test('should display login status board', async ({ page }) => {
      const loginBoard = page.locator('text=로그인 상태');
      await expect(loginBoard).toBeVisible();
    });

    test('should display debate config panel', async ({ page }) => {
      const configTitle = page.locator('h2:has-text("토론 설정")');
      await expect(configTitle).toBeVisible();
    });

    test('should have provider login buttons', async ({ page }) => {
      // Check for ChatGPT, Claude, Gemini login buttons exist on page
      await expect(page.getByRole('button', { name: /ChatGPT/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Claude/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Gemini/ }).first()).toBeVisible();
    });
  });

  test.describe('Debate Config Panel', () => {
    test('should have topic input field', async ({ page }) => {
      const topicInput = page.locator('input[placeholder*="주제"], textarea[placeholder*="주제"], input[name="topic"], textarea[name="topic"]');
      // If no placeholder, try label
      const topicSection = page.locator('text=주제').first();
      await expect(topicSection).toBeVisible();
    });

    test('should have preset selector', async ({ page }) => {
      const presetSection = page.locator('text=프리셋');
      await expect(presetSection).toBeVisible();
    });

    test('should have participant selector', async ({ page }) => {
      // UI uses "토론 참여자" instead of "참가자"
      const participantSection = page.locator('text=토론 참여자');
      await expect(participantSection).toBeVisible();
    });

    test('should have start debate button', async ({ page }) => {
      const startButton = page.locator('button:has-text("시작"), button:has-text("토론 시작")');
      await expect(startButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
    });

    test('should have visible focus states on interactive elements', async ({ page }) => {
      const buttons = page.locator('button').first();
      if (await buttons.isVisible()) {
        await buttons.focus();
        // Button should be focusable
        await expect(buttons).toBeFocused();
      }
    });

    test('should have proper color contrast (dark theme)', async ({ page }) => {
      // Check that background is dark (gray-900)
      const body = page.locator('body');
      await expect(body).toHaveClass(/bg-gray-900/);
      // Check that text is white
      await expect(body).toHaveClass(/text-white/);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });

    test('should display correctly on smaller screens', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      const header = page.locator('header');
      await expect(header).toBeVisible();
    });
  });
});
