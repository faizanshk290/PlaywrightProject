import { test, expect } from '@playwright/test';
import { loginPracticePortal } from '../../utils/login-session';

test.describe('Practice Test Automation Test Suite', () => {
  test('Test Case 1', async ({ page }) => {
    await loginPracticePortal(page, 'student', 'Password123');
    await expect(page.locator('p.has-text-align-center')).toContainText(
      'Congratulations student. You successfully logged in!'
    );
  });

  test('Test Case 2', async ({ page }) => {
    await loginPracticePortal(page, 'student', 'Password123');
    await expect(page.getByText('Log out')).toBeVisible();
  });
});
