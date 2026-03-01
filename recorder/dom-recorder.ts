//run npm run record:url -- https://example.com
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const CAPTURES_DIR = path.resolve('recorder/captures');
const TARGET_URL = process.argv[2] || 'https://practicetestautomation.com/practice-test-login/';

(async () => {
  if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let captureCount = 0;
  let capturing = false;
  // Same DOM cleaning logic as Cypress e2e.ts
  const DOM_CLEAN_SCRIPT = `
    (() => {
      const SKIP_IDS = ['pw-capture-btn', 'pw-capture-status'];
      // Clone with shadow DOM support
      const cloneWithShadowDOM = (node) => {
        const clone = node.cloneNode(false);
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          const cloneEl = clone;
          if (el.shadowRoot) {
            for (const child of Array.from(el.shadowRoot.childNodes)) {
              cloneEl.appendChild(cloneWithShadowDOM(child));
            }
          }
        }
        for (const child of Array.from(node.childNodes)) {
          clone.appendChild(cloneWithShadowDOM(child));
        }
        return clone;
      };
      const clone = cloneWithShadowDOM(document.documentElement);
      // Remove our injected elements
      clone.querySelectorAll('#pw-capture-btn, #pw-capture-status').forEach(e => e.remove());
      // Remove scripts, styles, SVGs, noscript, head
      clone.querySelectorAll('script, noscript, style, link[rel="stylesheet"], svg, head').forEach(e => e.remove());
      // Clean img tags — remove src/srcset, keep alt
      clone.querySelectorAll('img').forEach(e => {
        const alt = e.getAttribute('alt') || '';
        e.removeAttribute('src');
        e.removeAttribute('srcset');
        if (alt) e.setAttribute('alt', alt);
      });
      // Remove hidden elements (unless they have data-testid/data-cy)
      clone.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden]').forEach(e => {
        if (!e.getAttribute('data-testid') && !e.getAttribute('data-cy')) {
          e.remove();
        }
      });
      // Keep only useful attributes
      const keepAttrs = [
        'id', 'class', 'role', 'type', 'name', 'value', 'placeholder',
        'href', 'for', 'action', 'method', 'disabled', 'checked', 'selected',
        'title', 'alt', 'tabindex', 'contenteditable', 'slot',
      ];
      clone.querySelectorAll('*').forEach(e => {
        const attrsToRemove = [];
        for (let i = 0; i < e.attributes.length; i++) {
          const nm = e.attributes[i].name.toLowerCase();
          if (
            !keepAttrs.includes(nm) &&
            !nm.startsWith('data-testid') &&
            !nm.startsWith('data-cy') &&
            !nm.startsWith('data-test') &&
            !nm.startsWith('data-qa') &&
            !nm.startsWith('aria-')
          ) {
            attrsToRemove.push(e.attributes[i].name);
          }
        }
        attrsToRemove.forEach(a => e.removeAttribute(a));
      });
      // Remove empty containers without meaningful content/attributes
      clone.querySelectorAll('div, span, p, li, ul, ol').forEach(e => {
        if (
          e.children.length === 0 &&
          !e.textContent?.trim() &&
          !e.getAttribute('data-testid') &&
          !e.getAttribute('data-cy') &&
          !e.getAttribute('id') &&
          !e.getAttribute('role')
        ) {
          e.remove();
        }
      });
      // Format HTML with newlines
      return clone.outerHTML
        .replace(/></g, '>\\n<')
        .replace(/\\n\\s*\\n/g, '\\n');
    })()
  `;

  await page.exposeFunction('__triggerCapture', async () => {
    if (capturing) return;
    capturing = true;
    try {
      captureCount++;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const currentUrl = page.url();
      const pageName = new URL(currentUrl).pathname
        .replace(/^\//, '')
        .replace(/\//g, '-')
        .replace(/[^a-zA-Z0-9\-_]/g, '_') || 'index';
      const fileName = `${pageName}.click${String(captureCount).padStart(3, '0')}`;
      const cleanHtml = await page.evaluate(DOM_CLEAN_SCRIPT);
      const header = [
        `<!-- DOM: ${currentUrl} -->`,
        `<!-- Click #${captureCount} -->`,
        `<!-- Time: ${new Date().toISOString()} -->`,
        '',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(CAPTURES_DIR, `${fileName}.html`), header + cleanHtml);
      await page.evaluate((count) => {
        const s = document.getElementById('pw-capture-status');
        if (s) {
          s.textContent = 'Captured #' + count;
          s.style.display = 'block';
          setTimeout(() => s.style.display = 'none', 2000);
        }
      }, captureCount);
      console.log(`\nCapture #${captureCount} saved!`);
      console.log(`   URL: ${currentUrl}`);
      console.log(`   File: ${fileName}.html\n`);
    } finally {
      capturing = false;
    }
  });

  async function injectCaptureUI() {
    await page.evaluate(`
      (() => {
        if (document.getElementById('pw-capture-btn')) return;
        const btn = document.createElement('div');
        btn.id = 'pw-capture-btn';
        btn.textContent = 'CAPTURE DOM (F4)';
        btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;background:#ff4444;color:white;padding:14px 24px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:Arial,sans-serif;user-select:none;';
        document.body.appendChild(btn);
        
        const status = document.createElement('div');
        status.id = 'pw-capture-status';
        status.style.cssText = 'position:fixed;bottom:75px;right:20px;z-index:999999;background:#333;color:#0f0;padding:8px 16px;border-radius:6px;font-size:13px;display:none;font-family:monospace;';
        document.body.appendChild(status);
        document.addEventListener('click', (e) => {
          if (e.target.id === 'pw-capture-btn') {
            window.__triggerCapture();
          }
        }, true);
        document.addEventListener('keydown', (e) => {
          if (e.key === 'F4' || (e.ctrlKey && e.shiftKey && e.code === 'KeyK')) {
            e.preventDefault();
            window.__triggerCapture();
          }
        }, true);
      })()
    `);
  }
  page.on('load', async () => {
    try { await injectCaptureUI(); } catch { }
  });
  await page.goto(TARGET_URL);
  await injectCaptureUI();
  console.log('\nDOM Recorder started!');
  console.log('----------------------------------');
  console.log('  Click RED "CAPTURE DOM" button');
  console.log('  Or press F4 / Ctrl+Shift+K');
  console.log('  Close browser when done');
  console.log(`  Captures: ${CAPTURES_DIR}`);
  console.log('----------------------------------\n');
  page.on('close', () => process.exit(0));
  context.on('close', () => process.exit(0));
  await new Promise(() => { });
})();
