import { test, expect } from '@playwright/test';
import { loginRahulAcademy } from '../../utils/login-session';

test.describe('Rahul Academy Test Suite', () => {
  test('Rahul Academy Test Case 1', async ({ page }) => {
    await loginRahulAcademy(page, 'rahulshettyacademy', 'Learning@830$3mK2');
    await expect(page).toHaveURL(/angularpractice\/shop/);
  });

  test('Rahul Academy Test Case 2', async ({ page }) => {
    await loginRahulAcademy(page, 'rahulshettyacademy', 'Learning@830$3mK2');
    await page.click('text=Category 1');
  });
});
