import { Page, expect } from '@playwright/test';

export async function login(
  page: Page,
  username: string,
  password: string,
  storageStatePath?: string
): Promise<void> {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-button').click();
  await expect(page).toHaveURL(/\/dashboard/);
  if (storageStatePath) {
    await page.context().storageState({ path: storageStatePath });
  }
}
