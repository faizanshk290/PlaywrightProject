import { Page, expect } from "@playwright/test";

export class FormsPage {
  constructor(private page: Page) {}
  // ── Locators ──────────────────────────────────
  private readonly formsMenuLink = this.page.locator('a:has-text("Forms")');
  // ── Actions ───────────────────────────────────
  async navigateToFormsScreen(): Promise<void> {
    await this.formsMenuLink.click();
    await this.page.waitForLoadState("domcontentloaded");
    // TODO: adjust to match your forms screen's expected state
    await expect(this.page).toHaveURL(/forms/i);
  }
}
