import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  constructor(public page: Page) {}

  async visit(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).click();
  }

  async type(selector: string, text: string): Promise<void> {
    await this.page.locator(selector).fill(text);
  }

  getElement(selector: string): Locator {
    return this.page.locator(selector);
  }

  async isVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async containsText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async waitForElement(selector: string, timeout: number = 10000): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }

  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  getCurrentUrl(): string {
    return this.page.url();
  }

  async verifyUrlContains(urlFragment: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(urlFragment));
  }

  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  async selectByValue(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).selectOption(value);
  }

  async check(selector: string): Promise<void> {
    await this.page.locator(selector).check();
  }

  async uncheck(selector: string): Promise<void> {
    await this.page.locator(selector).uncheck();
  }

  async clear(selector: string): Promise<void> {
    await this.page.locator(selector).clear();
  }
}
