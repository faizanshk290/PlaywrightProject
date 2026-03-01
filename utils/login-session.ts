import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.resolve('playwright/.auth');

function getSessionFile(username: string, portal: string): string {
  return path.join(AUTH_DIR, `${portal}-${username}.json`);
}

async function loadCachedSession(page: Page, sessionFile: string): Promise<boolean> {
  if (!fs.existsSync(sessionFile)) return false;
  const storageState = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
  await page.context().addCookies(storageState.cookies || []);
  return true;
}

async function saveSession(page: Page, sessionFile: string): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  const state = await page.context().storageState();
  fs.writeFileSync(sessionFile, JSON.stringify(state));
}

export async function loginRahulAcademy(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  const sessionFile = getSessionFile(username, 'rahul');
  if (await loadCachedSession(page, sessionFile)) {
    await page.goto('https://rahulshettyacademy.com/angularpractice/shop');
    const isValid = await page.locator('.card').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (isValid) return;
  }
  await page.goto('https://rahulshettyacademy.com/loginpagePractise/');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#terms').check();
  await page.locator('#signInBtn').click();
  await expect(page).toHaveURL(/angularpractice\/shop/, { timeout: 20000 });
  await saveSession(page, sessionFile);
}

export async function loginPracticePortal(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  const sessionFile = getSessionFile(username, 'practice');
  if (await loadCachedSession(page, sessionFile)) {
    await page.goto('https://practicetestautomation.com/logged-in-successfully/');
    const isValid = await page.getByText('Congratulations').isVisible({ timeout: 5000 }).catch(() => false);
    if (isValid) return;
  }
  await page.goto('https://practicetestautomation.com/practice-test-login/');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#submit').click();
  await expect(page).toHaveURL(/logged-in-successfully/, { timeout: 20000 });
  await saveSession(page, sessionFile);
}

