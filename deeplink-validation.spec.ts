import { test, expect } from "@playwright/test";
import { LoginPage } from "./po/login.po";
import { FormsPage } from "./po/forms.po";
import { DeepLinkValidator } from "./po/deeplink-validator.po";

test.describe("Deep Link Validation", () => {
  let loginPage: LoginPage;
  let formsPage: FormsPage;
  let deepLinkValidator: DeepLinkValidator;
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    formsPage = new FormsPage(page);
    deepLinkValidator = new DeepLinkValidator(page, {
      linkContainerSelector: "#main, #content",
      requiredUrlPattern: "/rsc-ang/",
      maxDepth: 10,
      pageTimeout: 15000,
      waitBetween: 1000,
      screenshotDir: "./test-results/screenshots",
      fullPageScreenshot: true,
      reportPath: "./test-results/deeplink-report.html",
      skipPdfLinks: true,
      skipDomains: [
        // "docs.google.com",
        // "cdn.example.com",
      ],
    });
  });
  test("validate all deep links — URL must contain /rsc-ang/", async () => {
    await loginPage.loginToPortal();
    await formsPage.navigateToFormsScreen();
    const report = await deepLinkValidator.doDeepLinkValidation();
    expect(
      report.urlValidationFailed,
      `${report.urlValidationFailed} links missing /rsc-ang/ in URL! Check screenshots in test-results/screenshots/`
    ).toBe(0);
    expect(
      report.brokenLinks,
      `${report.brokenLinks} broken links found!`
    ).toBe(0);
    console.log(`\n✅ Validation complete:`);
    console.log(`   Pages      : ${report.totalPagesVisited}`);
    console.log(`   Links      : ${report.totalLinksTested}`);
    console.log(`   URL PASS   : ${report.urlValidationPassed}`);
    console.log(`   URL FAIL   : ${report.urlValidationFailed}`);
    console.log(`   Boundaries : ${report.domainBoundaryHits}`);
    console.log(`   Duration   : ${(report.durationMs / 1000).toFixed(1)}s`);
    console.log(`   Screenshots: test-results/screenshots/`);
    console.log(`   Report     : test-results/deeplink-report.html\n`);
  });
});
