import { Page, expect } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}
  // ── Locators ──────────────────────────────────
  private readonly usernameInput = this.page.locator("#username");
  private readonly passwordInput = this.page.locator("#password");
  private readonly loginButton = this.page.locator('button[type="submit"]');
  // ── Actions ───────────────────────────────────
  async loginToPortal(
    url: string = "https://your-portal.com/login",
    username: string = "testuser",
    password: string = "testpass"
  ): Promise<void> {
    await this.page.goto(url);
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForLoadState("domcontentloaded");
    // TODO: adjust this assertion to match your portal's post-login state
    await expect(this.page).not.toHaveURL(/login/);
  }
}
