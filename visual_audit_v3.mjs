/**
 * VISUAL AUDIT v3
 * ─────────────────────────────────────────────────────────────────
 * Single run — all viewports, all pages, all themes. Read-only.
 * No data is created, modified, or deleted.
 *
 * Viewports tested per page:
 *   mobile  — 390×844   (iPhone 14 Pro, touch enabled)
 *   tablet  — 768×1024  (iPad, touch enabled)
 *   desktop — 1440×900  (standard widescreen)
 *
 * Run: node visual_audit_v3.mjs
 * Requires: frontend on :3000, backend on :8001
 * Output:  audit_screenshots/v3/{mobile,tablet,desktop}/
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';

// ── Config ────────────────────────────────────────────────────────
const BASE    = 'http://localhost:3000';
const OUT_ROOT = 'D:/Retail Code/Retail/audit_screenshots/v3';

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844,  deviceScaleFactor: 1, hasTouch: true,  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'tablet',  width: 768,  height: 1024, deviceScaleFactor: 1, hasTouch: true,  ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'desktop', width: 1440, height: 900,  deviceScaleFactor: 1, hasTouch: false, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
];

// ── Chromium resolver (works with Playwright local installs on Windows) ──
function resolveChromium() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (override && fs.existsSync(override)) return override;
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(root)) return null;
  const parseBuild = n => { const m = n.match(/-(\d+)/); return m ? +m[1] : 0; };
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const prefix of ['chromium_headless_shell-', 'chromium-']) {
    const sorted = dirs.filter(n => n.startsWith(prefix)).sort((a, b) => parseBuild(b) - parseBuild(a));
    for (const d of sorted) {
      const exe = prefix.startsWith('chromium_headless_shell')
        ? path.join(root, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
        : path.join(root, d, 'chrome-win', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

// ── Auth ──────────────────────────────────────────────────────────
function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost', port: 8001, path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data).access_token); } catch { reject(new Error('Auth failed: ' + data)); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── Screenshot helpers ────────────────────────────────────────────
let shotCount = 0;
async function shot(page, outDir, name) {
  const file = path.join(outDir, `${String(shotCount++).padStart(3, '0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${String(shotCount - 1).padStart(3, '0')} ${name}`);
}
async function shotFull(page, outDir, name) {
  const file = path.join(outDir, `${String(shotCount++).padStart(3, '0')}_${name}_full.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${String(shotCount - 1).padStart(3, '0')} ${name} (full-page)`);
}

// ── Navigation ────────────────────────────────────────────────────
async function nav(page, route, wait = 1200) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

// ── Scroll the main content container (not window) ────────────────
async function scrollMain(page, y) {
  await page.evaluate(top => {
    const el = [...document.querySelectorAll('div')]
      .filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > window.innerHeight; })
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (el) el.scrollTop = top;
    else window.scrollTo(0, top);
  }, y);
  await page.waitForTimeout(250);
}

// ── Tap text helper ───────────────────────────────────────────────
async function tapText(page, text) {
  await page.locator(`text="${text}"`).first().tap({ timeout: 3000 }).catch(async () => {
    await page.locator(`button:has-text("${text}")`).first().click({ timeout: 3000 }).catch(() => {});
  });
}

// ── Close any open modal/overlay ─────────────────────────────────
async function closeModal(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ── Inject auth token ─────────────────────────────────────────────
async function injectAuth(page, token) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(t => sessionStorage.setItem('token', t), token);
  await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

// ── Open mobile sidebar ───────────────────────────────────────────
async function openSidebar(page) {
  await page.locator('header button').first().tap({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function closeSidebar(page) {
  await page.locator('aside button[aria-label="Close sidebar"]').first().tap({ timeout: 2000 }).catch(async () => {
    await page.locator('.fixed.inset-0.bg-black\\/30').first().tap({ timeout: 2000 }).catch(() => {});
  });
  await page.waitForTimeout(300);
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT FUNCTION — run once per viewport context
// READ-ONLY: no data is submitted, created, or modified.
// ═══════════════════════════════════════════════════════════════════
async function auditViewport(browser, token, vp) {
  const outDir = path.join(OUT_ROOT, vp.name);
  fs.mkdirSync(outDir, { recursive: true });

  // Reset per-viewport counter prefix
  shotCount = 0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  VIEWPORT: ${vp.name.toUpperCase()}  (${vp.width}×${vp.height})`);
  console.log(`${'═'.repeat(60)}`);

  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    hasTouch: vp.hasTouch,
    userAgent: vp.ua,
    ignoreHTTPSErrors: true,
  });
  const p = await ctx.newPage();
  const isMobile = vp.width < 768;
  const isTablet = vp.width >= 768 && vp.width < 1200;

  await injectAuth(p, token);
  console.log(`  ✓ Auth injected`);

  // ─────────────────────────────────────────────────────────────
  // 0. LOGIN PAGE (must logout first)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 0. LOGIN PAGE');
  await p.evaluate(() => { sessionStorage.clear(); });
  await nav(p, '/login', 1200);
  await shot(p, outDir, '00_login_light');
  // Toggle to dark — just the login page dark mode appearance
  await p.locator('button[title*="dark"], button[title*="Dark"], button[title*="Switch to dark"]').first().click({ timeout: 3000 }).catch(async () => {
    await p.locator('button').filter({ has: p.locator('svg') }).nth(0).click({ timeout: 2000 }).catch(() => {});
  });
  await p.waitForTimeout(600);
  await shot(p, outDir, '00_login_dark');
  // Toggle back to light
  await p.locator('button[title*="light"], button[title*="Light"], button[title*="Switch to light"]').first().click({ timeout: 3000 }).catch(async () => {
    await p.locator('button').filter({ has: p.locator('svg') }).nth(0).click({ timeout: 2000 }).catch(() => {});
  });
  await p.waitForTimeout(400);
  // Re-inject auth and continue
  await injectAuth(p, token);

  // ─────────────────────────────────────────────────────────────
  // 1. DASHBOARD
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 1. DASHBOARD');
  await nav(p, '/', 2000);
  await shot(p, outDir, '01_dashboard_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '01_dashboard_stat_cards');
  await scrollMain(p, 900);
  await shot(p, outDir, '01_dashboard_pipeline');
  await scrollMain(p, 1600);
  await shot(p, outDir, '01_dashboard_financial_exposure');
  await scrollMain(p, 2400);
  await shot(p, outDir, '01_dashboard_ledger');
  await scrollMain(p, 0);
  if (isMobile) {
    // Sidebar open state on dashboard
    await openSidebar(p);
    await shot(p, outDir, '01_dashboard_sidebar_open');
    await closeSidebar(p);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DARK MODE — snapshot key pages in dark theme
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 2. DARK MODE');
  // Enable dark via sidebar (all viewports have sidebar footer)
  if (isMobile) { await openSidebar(p); }
  await tapText(p, 'Dark').catch(() => {});
  await p.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(400);
  if (isMobile) { await closeSidebar(p); }
  await shot(p, outDir, '02_dark_dashboard');
  await nav(p, '/daybook', 1500);
  await shot(p, outDir, '02_dark_daybook');
  await nav(p, '/labour', 1200);
  await shot(p, outDir, '02_dark_labour');
  await nav(p, '/items', 1500);
  await shot(p, outDir, '02_dark_items');
  await nav(p, '/new-bill', 1200);
  await shot(p, outDir, '02_dark_newbill');
  // Disable dark — go back to light
  if (isMobile) { await openSidebar(p); }
  await tapText(p, 'Light').catch(() => {});
  await p.waitForFunction(() => !document.documentElement.classList.contains('dark'), { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(400);
  if (isMobile) { await closeSidebar(p); }

  // ─────────────────────────────────────────────────────────────
  // 3. DAYBOOK
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 3. DAYBOOK');
  await nav(p, '/daybook', 1500);
  await shot(p, outDir, '03_daybook_pending_top');
  await scrollMain(p, 600);
  await shot(p, outDir, '03_daybook_pending_cards');
  await scrollMain(p, 0);
  // Switch to Tallied tab (read-only view)
  await tapText(p, 'Tallied');
  await p.waitForTimeout(800);
  await shot(p, outDir, '03_daybook_tallied_top');
  await scrollMain(p, 600);
  await shot(p, outDir, '03_daybook_tallied_cards');
  await scrollMain(p, 0);
  // Date filter (read-only — just changes filter, no data write)
  const dateSelect = p.locator('[data-testid="daybook-date-filter"]');
  if (await dateSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dateSelect.selectOption({ index: 1 }).catch(() => {});
    await p.waitForTimeout(600);
    await shot(p, outDir, '03_daybook_date_filtered');
    await dateSelect.selectOption({ index: 0 }).catch(() => {});
    await p.waitForTimeout(400);
  }
  // Switch back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(500);
  await shot(p, outDir, '03_daybook_pending_final');
  if (isMobile) { await shotFull(p, outDir, '03_daybook_mobile_full'); }

  // ─────────────────────────────────────────────────────────────
  // 4. MANAGE ORDERS (ItemsManager)
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 4. MANAGE ORDERS');
  await nav(p, '/items', 1800);
  await shot(p, outDir, '04_items_list_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '04_items_list_scrolled');
  await scrollMain(p, 0);
  // Open detail pane (tap a row — READ ONLY)
  await p.locator('[data-testid="order-row"], div[class*="cursor-pointer"][class*="border-b"]').first().tap({ timeout: 5000 }).catch(async () => {
    await p.locator('div.border-b').filter({ hasText: /₹/ }).first().tap({ timeout: 3000 }).catch(() => {});
  });
  await p.waitForTimeout(800);
  await shot(p, outDir, '04_items_detail_open');
  await scrollMain(p, 400);
  await shot(p, outDir, '04_items_detail_scrolled');
  await scrollMain(p, 900);
  await shot(p, outDir, '04_items_detail_bottom');
  await scrollMain(p, 0);
  // Invoice modal (read-only — just displays PDF preview)
  await p.locator('button[title="Invoice"], button:has([data-icon="printer"])').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(800);
  await shot(p, outDir, '04_items_invoice_modal');
  await closeModal(p);
  // Back to list on mobile
  if (isMobile) {
    await p.locator('button:has-text("Orders")').first().tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  // Filter panel — open and screenshot, DO NOT apply/submit any filter with data writes
  await p.locator('button:has([data-icon="funnel"]), button[aria-label*="filter" i], button:has-text("Filters")').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, outDir, '04_items_filter_panel');
  await closeModal(p);
  // Search (read-only — filters displayed list, no backend write)
  await p.locator('input[placeholder*="earch" i]').fill('Raj', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(900);
  await shot(p, outDir, '04_items_search_results');
  // Open search result detail
  await p.locator('div[class*="cursor-pointer"][class*="border-b"]').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, outDir, '04_items_search_detail');
  // Close and clear search
  if (isMobile) { await p.locator('button:has-text("Orders")').first().tap({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); }
  await p.locator('input[placeholder*="earch" i]').fill('', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(400);

  // ─────────────────────────────────────────────────────────────
  // 5. NEW BILL
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 5. NEW BILL');
  await nav(p, '/new-bill', 1200);
  await shot(p, outDir, '05_newbill_empty_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '05_newbill_empty_form');
  await scrollMain(p, 0);
  // Fill customer name to see suggestions — read-only (not submitted)
  await p.fill('[data-testid="customer-name-input"]', 'Raj', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, outDir, '05_newbill_customer_suggestions');
  // Dismiss suggestions
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.fill('[data-testid="customer-name-input"]', '', { timeout: 3000 }).catch(() => {});
  // Fill item form — not submitted, just to show the form state
  await p.fill('[data-testid="barcode-input"]', 'SHIRT001', { timeout: 3000 }).catch(() => {});
  await p.fill('[data-testid="qty-input"]', '2', { timeout: 3000 }).catch(() => {});
  await p.fill('[data-testid="price-input"]', '850', { timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(300);
  await shot(p, outDir, '05_newbill_item_form_filled');
  // Add item (local state only — nothing persisted until "Commit Invoice")
  await p.locator('[data-testid="add-item-btn"]').tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, outDir, '05_newbill_one_item_added');
  // Second item
  await p.fill('[data-testid="barcode-input"]', 'PANT002', { timeout: 3000 }).catch(() => {});
  await p.fill('[data-testid="qty-input"]', '1', { timeout: 3000 }).catch(() => {});
  await p.fill('[data-testid="price-input"]', '1200', { timeout: 3000 }).catch(() => {});
  await p.locator('[data-testid="add-item-btn"]').tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, outDir, '05_newbill_two_items');
  // Scroll to show payment section
  await scrollMain(p, 99999);
  await p.waitForTimeout(500);
  await shot(p, outDir, '05_newbill_payment_settlement');
  await scrollMain(p, 0);
  // Open tailoring modal (read-only preview — not submitted)
  await p.locator('button:has-text("Configure Tailoring"), button:has-text("Tailoring")').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, outDir, '05_newbill_tailoring_modal');
  await scrollMain(p, 400);
  await shot(p, outDir, '05_newbill_tailoring_modal_items');
  await scrollMain(p, 0);
  await closeModal(p);
  // Add-on modal
  await p.locator('button:has-text("Add-on"), button:has-text("Configure Add-on")').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, outDir, '05_newbill_addon_modal');
  await closeModal(p);
  // Barcode scanner modal (camera request will be denied in headless — just screenshot the modal)
  await p.locator('[data-testid="scan-barcode-btn"]').tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  await shot(p, outDir, '05_newbill_scanner_modal');
  await p.locator('[data-testid="close-scanner-btn"]').tap({ timeout: 2000 }).catch(async () => { await closeModal(p); });
  await p.waitForTimeout(400);

  // ─────────────────────────────────────────────────────────────
  // 6. JOB WORK
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 6. JOB WORK');
  await nav(p, '/jobwork', 1500);
  await shot(p, outDir, '06_jobwork_pending_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '06_jobwork_pending_list');
  await scrollMain(p, 0);
  // Stitched tab
  await tapText(p, 'Stitched');
  await p.waitForTimeout(700);
  await shot(p, outDir, '06_jobwork_stitched_tab');
  await scrollMain(p, 400);
  await shot(p, outDir, '06_jobwork_stitched_list');
  await scrollMain(p, 0);
  // Delivered tab
  await tapText(p, 'Delivered');
  await p.waitForTimeout(700);
  await shot(p, outDir, '06_jobwork_delivered_tab');
  // Embroidery tab
  await tapText(p, 'Embroidery');
  await p.waitForTimeout(800);
  await shot(p, outDir, '06_jobwork_embroidery_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '06_jobwork_embroidery_list');
  await scrollMain(p, 0);
  // Karigar filter (read-only)
  const karigarSel = p.locator('select').nth(1);
  const karigarOpts = await karigarSel.locator('option').count().catch(() => 0);
  if (karigarOpts > 1) {
    await karigarSel.selectOption({ index: 1 });
    await p.waitForTimeout(500);
    await shot(p, outDir, '06_jobwork_karigar_filtered');
    await karigarSel.selectOption({ index: 0 });
    await p.waitForTimeout(300);
  }
  // Back to Pending
  await tapText(p, 'Pending');
  await p.waitForTimeout(400);
  // Open edit panel for an item (double-click/tap — READ ONLY view, no save triggered)
  await scrollMain(p, 300);
  const jobItem = p.locator('div.cursor-pointer').filter({ hasText: /Kurta|Pant|Jacket|Shirt|Kurti/ }).first();
  await jobItem.dblclick({ timeout: 4000 }).catch(async () => {
    await jobItem.tap({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(150);
    await jobItem.tap({ timeout: 3000 }).catch(() => {});
  });
  await p.waitForTimeout(800);
  await shot(p, outDir, '06_jobwork_item_detail_panel');
  await closeModal(p);
  await scrollMain(p, 0);

  // ─────────────────────────────────────────────────────────────
  // 7. ORDER STATUS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 7. ORDER STATUS');
  await nav(p, '/order-status', 1500);
  await shot(p, outDir, '07_orderstatus_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '07_orderstatus_stats');
  await scrollMain(p, 900);
  await shot(p, outDir, '07_orderstatus_grid_top');
  await scrollMain(p, 1600);
  await shot(p, outDir, '07_orderstatus_grid_rows');
  await scrollMain(p, 0);
  // Customer filter (select — read-only, then click the testid filter button)
  const custSel = p.locator('select').first();
  const custOpts = await custSel.locator('option').count().catch(() => 0);
  if (custOpts > 1) {
    await custSel.selectOption({ index: 1 });
    await p.locator('[data-testid="order-status-filter-btn"]').click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(700);
    await scrollMain(p, 800);
    await shot(p, outDir, '07_orderstatus_customer_filtered');
    await custSel.selectOption({ index: 0 });
    await p.locator('[data-testid="order-status-filter-btn"]').click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
  }
  await scrollMain(p, 0);

  // ─────────────────────────────────────────────────────────────
  // 8. REPORTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 8. REPORTS');
  await nav(p, '/reports', 2500);
  await shot(p, outDir, '08_reports_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '08_reports_summary_cards');
  await scrollMain(p, 900);
  await shot(p, outDir, '08_reports_tab_bar');
  // Revenue tab
  await tapText(p, 'Revenue');
  await p.waitForTimeout(1200);
  await scrollMain(p, 700);
  await shot(p, outDir, '08_reports_revenue_chart');
  await scrollMain(p, 1400);
  await shot(p, outDir, '08_reports_revenue_table');
  // Customers tab
  await scrollMain(p, 900);
  await tapText(p, 'Customers');
  await p.waitForTimeout(1500);
  await shot(p, outDir, '08_reports_customers_tab');
  await scrollMain(p, 1000);
  await shot(p, outDir, '08_reports_customers_table');
  // Breakdown tab
  await scrollMain(p, 900);
  await tapText(p, 'Breakdown');
  await p.waitForTimeout(1500);
  await shot(p, outDir, '08_reports_breakdown_tab');
  await scrollMain(p, 1200);
  await shot(p, outDir, '08_reports_breakdown_charts');
  // Period filters (read-only)
  await scrollMain(p, 600);
  for (const period of ['Today', 'This Week', 'This Month', 'This Year']) {
    await tapText(p, period);
    await p.waitForTimeout(1000);
    await shot(p, outDir, `08_reports_period_${period.toLowerCase().replace(' ', '_')}`);
  }
  await scrollMain(p, 0);
  await shot(p, outDir, '08_reports_export_btn_visible');

  // ─────────────────────────────────────────────────────────────
  // 9. LABOUR PAYMENTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 9. LABOUR PAYMENTS');
  await nav(p, '/labour', 1500);
  await shot(p, outDir, '09_labour_pending_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '09_labour_pending_list');
  await scrollMain(p, 0);
  // Select items to show sticky bar — NO PAY button will be clicked
  const cb1 = p.locator('input[type="checkbox"]').nth(1);
  const cb2 = p.locator('input[type="checkbox"]').nth(2);
  const hasCb = await cb1.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasCb) {
    await cb1.tap();
    await p.waitForTimeout(350);
    await shot(p, outDir, '09_labour_one_selected');
    await cb2.tap().catch(() => {});
    await p.waitForTimeout(300);
    await shot(p, outDir, '09_labour_multi_selected');
    // Scroll to bottom to show sticky pay bar in context
    await scrollMain(p, 99999);
    await p.waitForTimeout(400);
    await shot(p, outDir, '09_labour_sticky_bar_bottom');
    await scrollMain(p, 300);
    await shot(p, outDir, '09_labour_sticky_bar_with_list');
    // Deselect all — do NOT submit
    await cb1.tap().catch(() => {});
    await cb2.tap().catch(() => {});
    await p.waitForTimeout(300);
  }
  // Select-all
  const headerCb = p.locator('input[type="checkbox"]').first();
  if (await headerCb.isVisible({ timeout: 2000 }).catch(() => false)) {
    await headerCb.tap();
    await p.waitForTimeout(300);
    await shot(p, outDir, '09_labour_select_all');
    await headerCb.tap(); // deselect
    await p.waitForTimeout(300);
  }
  // Type filter
  const typeFilter = p.locator('[data-testid="labour-type-filter"]');
  if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
    await typeFilter.selectOption({ index: 1 }).catch(() => {});
    await p.waitForTimeout(500);
    await shot(p, outDir, '09_labour_type_filtered');
    await typeFilter.selectOption({ index: 0 }).catch(() => {});
    await p.waitForTimeout(300);
  }
  // Settled (paid) tab
  await tapText(p, 'Settled');
  await p.waitForTimeout(800);
  await shot(p, outDir, '09_labour_settled_tab');
  await scrollMain(p, 400);
  await shot(p, outDir, '09_labour_settled_entries');
  await scrollMain(p, 0);
  // Expand a payment row (accordion — read-only)
  await p.locator('tr[class*="cursor-pointer"], tr button').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(400);
  await shot(p, outDir, '09_labour_settled_expanded');
  // Desktop: action panel visible
  if (!isMobile) {
    await shot(p, outDir, '09_labour_action_panel_desktop');
  }

  // ─────────────────────────────────────────────────────────────
  // 10. SETTINGS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 10. SETTINGS');
  await nav(p, '/settings', 1500);
  await shot(p, outDir, '10_settings_top');
  for (const [scroll, name] of [[400,'article_types'],[900,'payment_modes'],[1400,'addon_items'],[1900,'karigars'],[2500,'firm_details'],[99999,'bottom']]) {
    await scrollMain(p, scroll);
    await shot(p, outDir, `10_settings_${name}`);
  }
  if (!isMobile) { await shotFull(p, outDir, '10_settings_full'); }
  await scrollMain(p, 0);

  // ─────────────────────────────────────────────────────────────
  // 11. DATA MANAGER
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 11. DATA MANAGER');
  await nav(p, '/data', 1200);
  await shot(p, outDir, '11_data_import_tab');
  // Tab bar scroll test on mobile
  if (isMobile || isTablet) {
    await p.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"], .overflow-x-auto');
      if (tabs) tabs.scrollLeft = 300;
    });
    await p.waitForTimeout(300);
    await shot(p, outDir, '11_data_tabbar_scrolled');
    await p.evaluate(() => {
      const tabs = document.querySelector('[role="tablist"], .overflow-x-auto');
      if (tabs) tabs.scrollLeft = 0;
    });
  }
  for (const tab of ['Export Data', 'Cloud Backup', 'Data Integrity']) {
    await tapText(p, tab);
    await p.waitForTimeout(600);
    await shot(p, outDir, `11_data_${tab.toLowerCase().replace(/[\s&]+/g, '_')}`);
    await scrollMain(p, 400);
    await shot(p, outDir, `11_data_${tab.toLowerCase().replace(/[\s&]+/g, '_')}_scrolled`);
    await scrollMain(p, 0);
  }

  // ─────────────────────────────────────────────────────────────
  // 12. USERS
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 12. USERS');
  await nav(p, '/users', 1200);
  await shot(p, outDir, '12_users_list');
  // Horizontal scroll on mobile (table min-w-[560px])
  if (isMobile || isTablet) {
    await p.evaluate(() => { const t = document.querySelector('.overflow-x-auto'); if (t) t.scrollLeft = 300; });
    await p.waitForTimeout(300);
    await shot(p, outDir, '12_users_table_scrolled');
    await p.evaluate(() => { const t = document.querySelector('.overflow-x-auto'); if (t) t.scrollLeft = 0; });
  }
  // Edit modal (read-only — just open and screenshot, don't save)
  await p.locator('button[title="Edit"], button:has([data-icon="pencil-simple"])').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, outDir, '12_users_edit_modal');
  await closeModal(p);
  // Reset password modal (read-only — just open and screenshot)
  await p.locator('button[title="Reset password"], button:has([data-icon="lock-key"])').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, outDir, '12_users_reset_pwd_modal');
  await closeModal(p);
  // Page permissions modal
  await p.locator('button[title="Page permissions"], button:has([data-icon="shield-check"])').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(500);
  await shot(p, outDir, '12_users_permissions_modal');
  await closeModal(p);
  // Add Personnel modal (read-only — open and screenshot, then escape without submitting)
  // Button text is "Add Personnel" (not "Add User") — uses UserPlus icon
  await p.locator('button:has-text("Add Personnel"), button:has([data-icon="user-plus"])').last().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, outDir, '12_users_add_modal_empty');
  await closeModal(p);

  // ─────────────────────────────────────────────────────────────
  // 13. AUDIT LOG
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 13. AUDIT LOG');
  await nav(p, '/audit', 1500);
  await shot(p, outDir, '13_auditlog_top');
  await scrollMain(p, 400);
  await shot(p, outDir, '13_auditlog_entries');
  await scrollMain(p, 0);
  // Filters panel (read-only)
  await p.locator('button:has-text("Filters")').first().tap({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(600);
  await shot(p, outDir, '13_auditlog_filters_panel');
  await closeModal(p);

  // ─────────────────────────────────────────────────────────────
  // 14. SIDEBAR — desktop collapse states
  // ─────────────────────────────────────────────────────────────
  if (!isMobile) {
    console.log('\n── 14. SIDEBAR DESKTOP STATES');
    await nav(p, '/', 1000);
    await shot(p, outDir, '14_sidebar_expanded');
    // Collapse
    await p.locator('button[title="Collapse sidebar"]').first().click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(400);
    await shot(p, outDir, '14_sidebar_collapsed_rail');
    // Expand back
    await p.locator('button[title="Expand sidebar"]').first().click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(400);
    await shot(p, outDir, '14_sidebar_expanded_again');
  } else {
    // Mobile: sidebar open/close/overlay
    console.log('\n── 14. SIDEBAR MOBILE STATES');
    await nav(p, '/', 800);
    await openSidebar(p);
    await shot(p, outDir, '14_sidebar_mobile_open');
    await scrollMain(p, 200); // scroll nav
    await shot(p, outDir, '14_sidebar_mobile_scrolled');
    await closeSidebar(p);
    await shot(p, outDir, '14_sidebar_mobile_closed');
  }

  // ─────────────────────────────────────────────────────────────
  // Done
  // ─────────────────────────────────────────────────────────────
  await ctx.close();
  const total = fs.readdirSync(outDir).length;
  console.log(`\n  ✅ ${vp.name}: ${total} screenshots → ${outDir}`);
  return total;
}

// ── Entry point ───────────────────────────────────────────────────
async function run() {
  const executablePath = resolveChromium();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const token = await getToken();
  console.log('✓ Token acquired');
  console.log(`✓ Output root: ${OUT_ROOT}`);

  let grand = 0;
  for (const vp of VIEWPORTS) {
    grand += await auditViewport(browser, token, vp);
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ✅ AUDIT COMPLETE — ${grand} total screenshots`);
  console.log(`  📁 ${OUT_ROOT}/{mobile,tablet,desktop}/`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
