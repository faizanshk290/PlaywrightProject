import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page/base-page.po';

export class LoginPage extends BasePage {
  private readonly selectors = {
    usernameInput: '#username',
    passwordInput: '#password',
    termsCheckbox: '#terms',
    signInButton: '#signInBtn',
    errorMessage: '.error-message',
    loginForm: '#login-form',
    successMessage: '.success-message',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigateToLoginPage(url: string = 'https://rahulshettyacademy.com/loginpagePractise/'): Promise<void> {
    await this.visit(url);
  }

  async enterUsername(username: string): Promise<void> {
    await this.type(this.selectors.usernameInput, username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.type(this.selectors.passwordInput, password);
  }

  async checkTerms(): Promise<void> {
    await this.check(this.selectors.termsCheckbox);
  }

  async clickSignIn(): Promise<void> {
    await this.click(this.selectors.signInButton);
  }

  async login(username: string, password: string): Promise<void> {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.checkTerms();
    await this.clickSignIn();
  }

  async verifyLoginFormIsVisible(): Promise<void> {
    await this.isVisible(this.selectors.loginForm);
  }

  async verifyErrorMessage(expectedMessage: string): Promise<void> {
    await this.isVisible(this.selectors.errorMessage);
    await this.containsText(this.selectors.errorMessage, expectedMessage);
  }

  async verifySuccessMessage(expectedMessage: string): Promise<void> {
    await this.isVisible(this.selectors.successMessage);
    await this.containsText(this.selectors.successMessage, expectedMessage);
  }


  async verifySuccessfulLogin(expectedUrl: string = '/angularpractice/shop'): Promise<void> {
    await this.verifyUrlContains(expectedUrl);
  }

  getUsernameInput(): Locator {
    return this.getElement(this.selectors.usernameInput);
  }

  getPasswordInput(): Locator {
    return this.getElement(this.selectors.passwordInput);
  }

  getSignInButton(): Locator {
    return this.getElement(this.selectors.signInButton);
  }

  async clearLoginForm(): Promise<void> {
    await this.clear(this.selectors.usernameInput);
    await this.clear(this.selectors.passwordInput);
  }
}
