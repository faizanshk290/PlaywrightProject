import { Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────

export type LinkStatus =
  | "PASS"
  | "FAIL_URL"
  | "BROKEN"
  | "TIMEOUT"
  | "DOMAIN_BOUNDARY"
  | "SKIPPED"
  | "SKIPPED_PDF"
  | "SKIPPED_DOMAIN"
  | "ERROR"
  | "MAX_DEPTH";

export interface LinkResult {
  sourceUrl: string;
  linkUrl: string;
  linkText: string;
  depth: number;
  status: LinkStatus;
  finalUrl: string;
  isDomainChange: boolean;
  urlPatternValid: boolean;
  errorMessage: string;
  pageTitle: string;
  skipReason: string;
  screenshotPath: string;
}

export interface PageResult {
  url: string;
  depth: number;
  pageTitle: string;
  totalLinks: number;
  sameDomainLinks: number;
  crossDomainLinks: number;
  passedLinks: number;
  failedLinks: number;
  links: LinkResult[];
}

export interface DeepLinkReport {
  totalPagesVisited: number;
  totalLinksFound: number;
  totalLinksTested: number;
  urlValidationPassed: number;
  urlValidationFailed: number;
  brokenLinks: number;
  domainBoundaryHits: number;
  maxDepthHits: number;
  errors: number;
  pdfLinksSkipped: number;
  domainLinksSkipped: number;
  durationMs: number;
  pages: PageResult[];
  allLinks: LinkResult[];
}

export interface DeepLinkOptions {
  linkContainerSelector?: string;
  requiredUrlPattern?: string;
  maxDepth?: number;
  pageTimeout?: number;
  waitBetween?: number;
  reportPath?: string;
  screenshotDir?: string;
  fullPageScreenshot?: boolean;
  skipPatterns?: RegExp[];
  skipPdfLinks?: boolean;
  skipDomains?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function isSameDomain(url: string, baseDomain: string): boolean {
  const d = getDomain(url);
  return d === baseDomain || d.endsWith(`.${baseDomain}`);
}

function normalize(url: string): string {
  return url.split("#")[0].replace(/\/$/, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + "…" : s;
}

// ─── Page Object ────────────────────────────────────────────────

export class DeepLinkValidator {
  private context: BrowserContext;
  private baseDomain = "";
  private visitedUrls = new Set<string>();
  private allLinks: LinkResult[] = [];
  private pageResults: PageResult[] = [];
  private opts: Required<DeepLinkOptions>;
  private snapCounter = 0;
  private totalLinksFound = 0;
  private totalLinksTested = 0;
  private urlPassCount = 0;
  private urlFailCount = 0;
  private brokenCount = 0;
  private boundaryCount = 0;
  private maxDepthCount = 0;
  private errorCount = 0;
  private pdfSkipCount = 0;
  private domainSkipCount = 0;
  constructor(private page: Page, options?: DeepLinkOptions) {
    this.context = page.context();
    this.opts = {
      linkContainerSelector: options?.linkContainerSelector || "#main, #content",
      requiredUrlPattern: options?.requiredUrlPattern || "/rsc-ang/",
      maxDepth: options?.maxDepth ?? 10,
      pageTimeout: options?.pageTimeout ?? 15000,
      waitBetween: options?.waitBetween ?? 1000,
      reportPath: options?.reportPath || "./test-results/deeplink-report.html",
      screenshotDir: options?.screenshotDir || "./test-results/screenshots",
      fullPageScreenshot: options?.fullPageScreenshot ?? true,
      skipPdfLinks: options?.skipPdfLinks ?? true,
      skipDomains: options?.skipDomains || [],
      skipPatterns: options?.skipPatterns || [
        /^mailto:/i, /^tel:/i, /^javascript:/i, /^javascript\s*:/i,
        /^#$/, /^data:/i, /^blob:/i, /^ftp:/i,
      ],
    };
  }
  // ════════════════════════════════════════════════════════════
  //  PUBLIC
  // ════════════════════════════════════════════════════════════
  async doDeepLinkValidation(): Promise<DeepLinkReport> {
    const startUrl = this.page.url();
    this.baseDomain = getDomain(startUrl);
    const startTime = Date.now();
    fs.mkdirSync(this.opts.screenshotDir, { recursive: true });
    console.log("\n╔═══════════════════════════════════════════════╗");
    console.log("║   DEEP LINK VALIDATION + SCREENSHOT CAPTURE    ║");
    console.log("╚═══════════════════════════════════════════════╝");
    console.log(`🌐 Start URL        : ${startUrl}`);
    console.log(`🏠 Base domain      : ${this.baseDomain}`);
    console.log(`📦 Container        : ${this.opts.linkContainerSelector}`);
    console.log(`🔍 URL must contain : "${this.opts.requiredUrlPattern}"`);
    console.log(`📸 Screenshots      : ${this.opts.screenshotDir}`);
    console.log(`📏 Max depth        : ${this.opts.maxDepth}`);
    console.log(`🚫 Skip domains     : ${this.opts.skipDomains.length > 0 ? this.opts.skipDomains.join(", ") : "(none)"}\n`);
    await this.crawlPage(startUrl, 0);
    const durationMs = Date.now() - startTime;
    const report: DeepLinkReport = {
      totalPagesVisited: this.pageResults.length,
      totalLinksFound: this.totalLinksFound,
      totalLinksTested: this.totalLinksTested,
      urlValidationPassed: this.urlPassCount,
      urlValidationFailed: this.urlFailCount,
      brokenLinks: this.brokenCount,
      domainBoundaryHits: this.boundaryCount,
      maxDepthHits: this.maxDepthCount,
      errors: this.errorCount,
      pdfLinksSkipped: this.pdfSkipCount,
      domainLinksSkipped: this.domainSkipCount,
      durationMs,
      pages: this.pageResults,
      allLinks: this.allLinks,
    };
    this.printSummary(report);
    this.generateHtmlReport(report);
    return report;
  }
  // ════════════════════════════════════════════════════════════
  //  CORE DFS
  // ════════════════════════════════════════════════════════════
  private async crawlPage(url: string, depth: number): Promise<void> {
    const normUrl = normalize(url);
    if (this.visitedUrls.has(normUrl)) { this.log(depth, "⏭️", `Already visited`); return; }
    if (depth > this.opts.maxDepth) { this.log(depth, "🛑", `Max depth`); this.maxDepthCount++; return; }
    this.visitedUrls.add(normUrl);
    this.log(depth, "📄", `Opening: ${url}`);
    let tabPage: Page;
    let ownedTab = false;
    if (depth === 0) {
      tabPage = this.page;
    } else {
      tabPage = await this.context.newPage();
      ownedTab = true;
      try {
        await tabPage.goto(url, { waitUntil: "domcontentloaded", timeout: this.opts.pageTimeout });
        await tabPage.waitForTimeout(this.opts.waitBetween);
      } catch (err: any) {
        const errMsg = err.message || String(err);
        this.log(depth, "❌", `Failed: ${errMsg}`);
        this.brokenCount++; this.errorCount++;
        const snap = await this.takeScreenshot(tabPage, depth, "ERROR");
        this.allLinks.push({
          sourceUrl: url, linkUrl: url, linkText: "(page load failed)", depth,
          status: errMsg.includes("Timeout") ? "TIMEOUT" : "BROKEN",
          finalUrl: url, isDomainChange: false, urlPatternValid: false,
          errorMessage: errMsg.substring(0, 200), pageTitle: "",
          skipReason: "", screenshotPath: snap,
        });
        await tabPage.close();
        return;
      }
    }
    let pageTitle = "";
    try { pageTitle = await tabPage.title(); } catch { /* */ }
    const pageSnap = await this.takeScreenshot(tabPage, depth, this.sanitize(pageTitle || "page"));
    this.log(depth, "📸", `Screenshot: ${pageSnap}`);
    const currentUrl = tabPage.url();
    const urlValid = currentUrl.includes(this.opts.requiredUrlPattern);
    this.log(depth, urlValid ? "✅" : "❌",
      `URL ${urlValid ? "PASS" : "FAIL"} — ${urlValid ? "contains" : "MISSING"} "${this.opts.requiredUrlPattern}"`
    );
    const links = await this.getLinksFromContainer(tabPage);
    this.totalLinksFound += links.length;
    this.log(depth, "🔗", `${links.length} links in [${this.opts.linkContainerSelector}]`);
    const pageResult: PageResult = {
      url: currentUrl, depth, pageTitle, totalLinks: links.length,
      sameDomainLinks: 0, crossDomainLinks: 0, passedLinks: 0, failedLinks: 0, links: [],
    };
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const tag = `[${i + 1}/${links.length}]`;
      this.totalLinksTested++;
      const href = link.href.trim();
      // 1. javascript:void(0) etc.
      if (/^javascript\s*:\s*(void\s*\(\s*0?\s*\)\s*;?\s*|;?\s*|undefined\s*;?\s*)$/i.test(href)) {
        this.log(depth + 1, "⏭️", `${tag} Skip [js:void]`);
        const r = this.makeResult(url, link, depth, "SKIPPED"); r.skipReason = "javascript:void";
        pageResult.links.push(r); this.allLinks.push(r); continue;
      }
      // 2. Standard skip patterns
      if (this.opts.skipPatterns.some((rx) => rx.test(href))) {
        this.log(depth + 1, "⏭️", `${tag} Skip [pattern]`);
        const r = this.makeResult(url, link, depth, "SKIPPED"); r.skipReason = "pattern";
        pageResult.links.push(r); this.allLinks.push(r); continue;
      }
      const resolved = this.resolve(href, url);
      // 3. PDF skip
      if (this.opts.skipPdfLinks && this.isPdfUrl(resolved)) {
        this.log(depth + 1, "📄", `${tag} Skip [PDF]`);
        this.pdfSkipCount++;
        const r = this.makeResult(url, link, depth, "SKIPPED_PDF", resolved); r.skipReason = "pdf";
        pageResult.links.push(r); this.allLinks.push(r); continue;
      }
      // 4. Skip domains
      const linkDomain = getDomain(resolved);
      if (this.opts.skipDomains.some((sd) => linkDomain === sd || linkDomain.endsWith(`.${sd}`))) {
        this.log(depth + 1, "🚫", `${tag} Skip [domain: ${linkDomain}]`);
        this.domainSkipCount++;
        const r = this.makeResult(url, link, depth, "SKIPPED_DOMAIN", resolved); r.skipReason = `domain:${linkDomain}`;
        pageResult.links.push(r); this.allLinks.push(r); continue;
      }
      // 5. Domain boundary
      if (!isSameDomain(resolved, this.baseDomain)) {
        this.log(depth + 1, "🚧", `${tag} DOMAIN BOUNDARY → ${getDomain(resolved)}`);
        this.boundaryCount++; pageResult.crossDomainLinks++;
        const r = this.makeResult(url, link, depth, "DOMAIN_BOUNDARY", resolved, true);
        pageResult.links.push(r); this.allLinks.push(r); continue;
      }
      // Already visited?
      if (this.visitedUrls.has(normalize(resolved))) {
        this.log(depth + 1, "⏭️", `${tag} Already visited`);
        const r = this.makeResult(url, link, depth, "PASS", resolved);
        r.pageTitle = "(already visited)"; r.urlPatternValid = resolved.includes(this.opts.requiredUrlPattern);
        pageResult.links.push(r); pageResult.sameDomainLinks++; this.allLinks.push(r); continue;
      }
      // Same domain → OPEN, SCREENSHOT, VALIDATE
      this.log(depth + 1, "🔽", `${tag} "${link.text}" → ${resolved}`);
      pageResult.sameDomainLinks++;
      const { result: linkResult, goDeeper } = await this.openAndValidate(url, link, resolved, depth);
      pageResult.links.push(linkResult); this.allLinks.push(linkResult);
      if (linkResult.status === "PASS") pageResult.passedLinks++;
      if (linkResult.status === "FAIL_URL") pageResult.failedLinks++;
      if (goDeeper) {
        await this.crawlPage(resolved, depth + 1);
        this.log(depth + 1, "🔼", `Back to: ${url}`);
      }
    }
    this.pageResults.push(pageResult);
    if (ownedTab) await tabPage.close();
  }
  // ════════════════════════════════════════════════════════════
  //  OPEN LINK → SCREENSHOT → VALIDATE URL
  // ════════════════════════════════════════════════════════════
  private async openAndValidate(
    sourceUrl: string, link: { href: string; text: string },
    resolved: string, depth: number
  ): Promise<{ result: LinkResult; goDeeper: boolean }> {
    const linkPage = await this.context.newPage();
    let goDeeper = false;
    try {
      await linkPage.goto(resolved, { waitUntil: "domcontentloaded", timeout: this.opts.pageTimeout });
      await linkPage.waitForTimeout(this.opts.waitBetween);
      const finalUrl = linkPage.url();
      let title = ""; try { title = await linkPage.title(); } catch { /* */ }
      const snap = await this.takeScreenshot(linkPage, depth + 1, this.sanitize(link.text || "link"));
      const hasPattern = finalUrl.includes(this.opts.requiredUrlPattern);
      let status: LinkStatus;
      if (hasPattern) {
        status = "PASS"; this.urlPassCount++;
        this.log(depth + 1, "✅", `PASS — "${title}"`);
      } else {
        status = "FAIL_URL"; this.urlFailCount++;
        this.log(depth + 1, "❌", `FAIL — missing "${this.opts.requiredUrlPattern}" → ${finalUrl}`);
      }
      goDeeper = true;
      return {
        result: {
          sourceUrl, linkUrl: link.href, linkText: link.text, depth, status, finalUrl,
          isDomainChange: false, urlPatternValid: hasPattern, errorMessage: "",
          pageTitle: title, skipReason: "", screenshotPath: snap,
        },
        goDeeper,
      };
    } catch (err: any) {
      const errMsg = err.message || String(err);
      const status: LinkStatus = errMsg.includes("Timeout") ? "TIMEOUT" : "BROKEN";
      this.brokenCount++;
      const snap = await this.takeScreenshot(linkPage, depth + 1, "error");
      this.log(depth + 1, "❌", `${status}: ${errMsg.substring(0, 100)}`);
      return {
        result: {
          sourceUrl, linkUrl: link.href, linkText: link.text, depth, status,
          finalUrl: resolved, isDomainChange: false, urlPatternValid: false,
          errorMessage: errMsg.substring(0, 200), pageTitle: "", skipReason: "",
          screenshotPath: snap,
        },
        goDeeper: false,
      };
    } finally {
      await linkPage.close();
    }
  }
  // ════════════════════════════════════════════════════════════
  //  SCREENSHOT
  // ════════════════════════════════════════════════════════════
  private async takeScreenshot(targetPage: Page, depth: number, label: string): Promise<string> {
    this.snapCounter++;
    const filename = `${String(this.snapCounter).padStart(3, "0")}_d${depth}_${this.sanitize(label)}.png`;
    const fullPath = path.join(this.opts.screenshotDir, filename);
    try { await targetPage.screenshot({ path: fullPath, fullPage: this.opts.fullPageScreenshot }); } catch { /* */ }
    return filename;
  }
  private sanitize(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").substring(0, 50).replace(/^_|_$/g, "");
  }
  // ════════════════════════════════════════════════════════════
  //  LINK EXTRACTION: #main / #content only
  // ════════════════════════════════════════════════════════════
  private async getLinksFromContainer(targetPage: Page): Promise<{ href: string; text: string }[]> {
    const sel = this.opts.linkContainerSelector;
    return targetPage.evaluate((cs) => {
      const containers = document.querySelectorAll(cs);
      if (!containers.length) return [];
      const seen = new Set<string>();
      const out: { href: string; text: string }[] = [];
      containers.forEach((c) => {
        c.querySelectorAll("a[href]").forEach((el) => {
          const a = el as HTMLAnchorElement;
          if (a.href && !seen.has(a.href)) {
            seen.add(a.href);
            out.push({ href: a.href, text: (a.innerText?.trim() || "(no text)").substring(0, 100) });
          }
        });
      });
      return out;
    }, sel);
  }
  // ════════════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════════════
  private resolve(href: string, base: string): string {
    try { return new URL(href, base).href; } catch { return href; }
  }
  private makeResult(
    sourceUrl: string, link: { href: string; text: string },
    depth: number, status: LinkStatus, finalUrl = "", isDomainChange = false
  ): LinkResult {
    return {
      sourceUrl, linkUrl: link.href, linkText: link.text, depth, status,
      finalUrl: finalUrl || link.href, isDomainChange, urlPatternValid: false,
      errorMessage: "", pageTitle: "", skipReason: "", screenshotPath: "",
    };
  }
  private isPdfUrl(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.pathname.toLowerCase().endsWith(".pdf")) return true;
      if (/\/(download|export|view)\/(pdf|document)/i.test(u.pathname)) return true;
      for (const [, val] of u.searchParams) { if (val.toLowerCase() === "pdf") return true; }
      return false;
    } catch { return url.toLowerCase().includes(".pdf"); }
  }
  private log(depth: number, icon: string, msg: string): void {
    console.log(`${"  ".repeat(depth)}${icon} ${msg}`);
  }
  // ════════════════════════════════════════════════════════════
  //  CONSOLE SUMMARY
  // ════════════════════════════════════════════════════════════
  private printSummary(report: DeepLinkReport): void {
    const sec = (report.durationMs / 1000).toFixed(1);
    console.log("\n╔═══════════════════════════════════════════════╗");
    console.log("║              VALIDATION SUMMARY                ║");
    console.log("╠═══════════════════════════════════════════════╣");
    console.log(`║  Duration             : ${sec}s`);
    console.log(`║  Pages visited        : ${report.totalPagesVisited}`);
    console.log(`║  Links found          : ${report.totalLinksFound}`);
    console.log(`║  Links tested         : ${report.totalLinksTested}`);
    console.log(`║  ✅ URL pattern PASS  : ${report.urlValidationPassed}`);
    console.log(`║  ❌ URL pattern FAIL  : ${report.urlValidationFailed}`);
    console.log(`║  Domain boundaries    : ${report.domainBoundaryHits}`);
    console.log(`║  Broken / Errors      : ${report.brokenLinks}`);
    console.log("╚═══════════════════════════════════════════════╝");
    const failed = report.allLinks.filter((l) => l.status === "FAIL_URL");
    if (failed.length > 0) {
      console.log(`\n🚨 URL VALIDATION FAILURES (missing "${this.opts.requiredUrlPattern}"):`);
      failed.forEach((r) => {
        console.log(`   ❌ ${r.finalUrl}`);
        console.log(`      Text: "${r.linkText}" | From: ${r.sourceUrl}`);
        console.log(`      📸 ${r.screenshotPath}`);
      });
    }
    const broken = report.allLinks.filter((l) => l.status === "BROKEN" || l.status === "TIMEOUT");
    if (broken.length > 0) {
      console.log("\n🚨 BROKEN LINKS:");
      broken.forEach((r) => { console.log(`   ❌ ${r.linkUrl} — ${r.errorMessage}`); });
    }
    console.log(`📸 Screenshots: ${this.opts.screenshotDir}`);
    console.log(`📊 Report: ${this.opts.reportPath}\n`);
  }
  // ════════════════════════════════════════════════════════════
  //  HTML REPORT
  // ════════════════════════════════════════════════════════════
  private generateHtmlReport(report: DeepLinkReport): void {
    const sec = (report.durationMs / 1000).toFixed(1);
    const now = new Date().toISOString().replace("T", " ").split(".")[0];
    const statusIcon: Record<string, string> = {
      PASS: "✅", FAIL_URL: "❌", BROKEN: "💥", TIMEOUT: "⏱️", DOMAIN_BOUNDARY: "🚧",
      SKIPPED: "⏭️", SKIPPED_PDF: "📄", SKIPPED_DOMAIN: "🚫", ERROR: "💥", MAX_DEPTH: "🛑",
    };
    const statusColor: Record<string, string> = {
      PASS: "#22c55e", FAIL_URL: "#ef4444", BROKEN: "#ef4444", TIMEOUT: "#f59e0b",
      DOMAIN_BOUNDARY: "#3b82f6", SKIPPED: "#9ca3af", SKIPPED_PDF: "#f97316",
      SKIPPED_DOMAIN: "#a855f7", ERROR: "#ef4444", MAX_DEPTH: "#f59e0b",
    };
    const failed = report.allLinks.filter((l) => l.status === "FAIL_URL");
    const broken = report.allLinks.filter((l) => l.status === "BROKEN" || l.status === "TIMEOUT");
    const reportDir = path.dirname(path.resolve(this.opts.reportPath));
    const snapDir = path.resolve(this.opts.screenshotDir);
    const relSnap = path.relative(reportDir, snapDir);
    let pagesHtml = "";
    for (const pr of report.pages) {
      pagesHtml += `<div class="page-block" data-has-fail="${pr.links.some((l) => l.status === "FAIL_URL")}" data-has-broken="${pr.links.some((l) => ["BROKEN", "TIMEOUT", "ERROR"].includes(l.status))}" data-has-boundary="${pr.links.some((l) => l.status === "DOMAIN_BOUNDARY")}">
        <div class="page-header">
          <span class="depth-badge">Depth ${pr.depth}</span>
          <a href="${esc(pr.url)}" target="_blank">${esc(pr.url)}</a>
          <span class="page-title">${esc(pr.pageTitle)}</span>
        </div>
        <div class="page-stats">🔗 ${pr.totalLinks} links | ✅ ${pr.passedLinks} pass | ❌ ${pr.failedLinks} fail | 🚧 ${pr.crossDomainLinks} boundary</div>
        <table class="links-table">
          <thead><tr><th>#</th><th>Status</th><th>URL Valid</th><th>Link Text</th><th>Final URL</th><th>📸</th><th>Notes</th></tr></thead>
          <tbody>${pr.links.map((lr, i) => `<tr class="${lr.status === "FAIL_URL" ? "row-fail" : lr.status === "PASS" ? "row-pass" : ""}">
            <td>${i + 1}</td>
            <td><span class="status-badge" style="background:${statusColor[lr.status] || "#9ca3af"}">${statusIcon[lr.status] || "?"} ${lr.status}</span></td>
            <td>${lr.urlPatternValid ? '<span style="color:#22c55e;font-weight:700">✅ YES</span>' : ["SKIPPED", "SKIPPED_PDF", "SKIPPED_DOMAIN"].includes(lr.status) ? '<span style="color:#9ca3af">N/A</span>' : '<span style="color:#ef4444;font-weight:700">❌ NO</span>'}</td>
            <td class="link-text">${esc(lr.linkText)}</td>
            <td class="link-url"><a href="${esc(lr.finalUrl)}" target="_blank">${esc(truncate(lr.finalUrl, 65))}</a></td>
            <td>${lr.screenshotPath ? `<a href="${relSnap}/${lr.screenshotPath}" target="_blank" class="snap-link">📸</a>` : "-"}</td>
            <td>${lr.skipReason ? `Skip: ${lr.skipReason}` : ""}${lr.isDomainChange ? `Domain: ${getDomain(lr.linkUrl)}` : ""}${lr.errorMessage ? esc(lr.errorMessage) : ""}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>`;
    }
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Deep Link QA Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;line-height:1.5}
.header{background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:32px;margin-bottom:24px;border:1px solid #475569}
.header h1{font-size:28px;margin-bottom:8px}.header .meta{color:#94a3b8;font-size:14px}
.validation-rule{background:#1e293b;border:2px solid #6366f1;border-radius:8px;padding:16px;margin-bottom:24px;font-size:15px}
.validation-rule code{background:#334155;padding:3px 8px;border-radius:4px;color:#22d3ee;font-size:16px;font-weight:700}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:#1e293b;border-radius:10px;padding:16px;border:1px solid #334155;text-align:center}
.stat-card .number{font-size:32px;font-weight:700}.stat-card .label{color:#94a3b8;font-size:12px;margin-top:4px}
.container-note{background:#1e293b;border:1px solid #475569;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#94a3b8}
.container-note code{background:#334155;padding:2px 6px;border-radius:4px;color:#60a5fa}
.section-title{font-size:20px;margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid #334155}
.page-block{background:#1e293b;border-radius:10px;margin-bottom:16px;border:1px solid #334155;overflow:hidden}
.page-header{padding:14px 20px;background:#334155;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.page-header a{color:#60a5fa;text-decoration:none;word-break:break-all}
.page-title{color:#94a3b8;font-style:italic}
.depth-badge{background:#6366f1;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600}
.page-stats{padding:10px 20px;font-size:13px;color:#94a3b8}
.links-table{width:100%;border-collapse:collapse;font-size:12px}
.links-table th{text-align:left;padding:8px 10px;background:#1e293b;color:#94a3b8;font-weight:600;border-bottom:1px solid #334155}
.links-table td{padding:8px 10px;border-bottom:1px solid #1e293b;vertical-align:top}
.links-table tr:hover td{background:#334155}
.row-fail td{background:#1c0a0a!important}.row-pass td{background:#0a1c0a!important}
.status-badge{display:inline-block;padding:2px 8px;border-radius:6px;color:#fff;font-size:11px;font-weight:600;white-space:nowrap}
.link-text{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.link-url a{color:#60a5fa;text-decoration:none;word-break:break-all}
.snap-link{color:#fbbf24;text-decoration:none;font-weight:600}.snap-link:hover{text-decoration:underline}
.alert-box{border-radius:10px;padding:16px 20px;margin-bottom:12px}
.alert-fail{background:#7f1d1d;border:1px solid #ef4444}
.alert-broken{background:#451a03;border:1px solid #f59e0b}
.alert-box h3{margin-bottom:8px}.alert-box ul{list-style:none}.alert-box li{margin-bottom:8px;font-size:13px}.alert-box a{color:#93c5fd}
.filter-bar{margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap}
.filter-btn{background:#334155;border:1px solid #475569;color:#e2e8f0;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px}
.filter-btn:hover,.filter-btn.active{background:#6366f1;border-color:#6366f1}
</style></head><body>
<div class="header"><h1>🔗 Deep Link QA Report</h1>
<div class="meta">Generated: ${now} | Duration: ${sec}s | Domain: ${esc(this.baseDomain)}</div></div>
<div class="validation-rule">🔍 URL Validation Rule: Every link must contain <code>${esc(this.opts.requiredUrlPattern)}</code> in URL</div>
<div class="container-note">📦 Links from <code>${esc(this.opts.linkContainerSelector)}</code> only</div>
${this.opts.skipDomains.length > 0 ? `<div class="container-note">🚫 Skip domains: <code>${esc(this.opts.skipDomains.join(", "))}</code></div>` : ""}
<div class="summary-grid">
  <div class="stat-card"><div class="number">${report.totalPagesVisited}</div><div class="label">Pages</div></div>
  <div class="stat-card"><div class="number">${report.totalLinksTested}</div><div class="label">Links Tested</div></div>
  <div class="stat-card"><div class="number" style="color:#22c55e">${report.urlValidationPassed}</div><div class="label">✅ URL PASS</div></div>
  <div class="stat-card"><div class="number" style="color:#ef4444">${report.urlValidationFailed}</div><div class="label">❌ URL FAIL</div></div>
  <div class="stat-card"><div class="number" style="color:#3b82f6">${report.domainBoundaryHits}</div><div class="label">Boundaries</div></div>
  <div class="stat-card"><div class="number" style="color:${report.brokenLinks > 0 ? "#ef4444" : "#22c55e"}">${report.brokenLinks}</div><div class="label">Broken</div></div>
</div>
${failed.length > 0 ? `<div class="alert-box alert-fail"><h3>❌ URL Fails — missing "${esc(this.opts.requiredUrlPattern)}" (${failed.length})</h3><ul>${failed.map((r) => `<li>❌ <a href="${esc(r.finalUrl)}" target="_blank">${esc(truncate(r.finalUrl, 80))}</a> ${r.screenshotPath ? `<a href="${relSnap}/${r.screenshotPath}" target="_blank" class="snap-link">📸</a>` : ""}<br/><small>"${esc(r.linkText)}" from ${esc(r.sourceUrl)}</small></li>`).join("")}</ul></div>` : ""}
${broken.length > 0 ? `<div class="alert-box alert-broken"><h3>💥 Broken (${broken.length})</h3><ul>${broken.map((r) => `<li>💥 <a href="${esc(r.linkUrl)}" target="_blank">${esc(truncate(r.linkUrl, 80))}</a> ${r.screenshotPath ? `<a href="${relSnap}/${r.screenshotPath}" target="_blank" class="snap-link">📸</a>` : ""}<br/><small>${esc(r.errorMessage)}</small></li>`).join("")}</ul></div>` : ""}
<h2 class="section-title">📄 Page-by-Page</h2>
<div class="filter-bar">
  <button class="filter-btn active" onclick="f('all')">All</button>
  <button class="filter-btn" onclick="f('fail')">URL Fails</button>
  <button class="filter-btn" onclick="f('broken')">Broken</button>
  <button class="filter-btn" onclick="f('boundary')">Boundaries</button>
</div>
<div id="pages">${pagesHtml}</div>
<script>
function f(t){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');const m={fail:'hasFail',broken:'hasBroken',boundary:'hasBoundary'};document.querySelectorAll('.page-block').forEach(b=>{if(t==='all'){b.style.display='';return}b.style.display=b.dataset[m[t]]==='true'?'':'none';});}
</script></body></html>`;
    const dir = path.dirname(this.opts.reportPath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.opts.reportPath, html, "utf-8");
    console.log(`📊 Report: ${this.opts.reportPath}`);
  }
}
