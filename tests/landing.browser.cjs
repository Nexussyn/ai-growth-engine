const { chromium, webkit, devices } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const events = [];
  const html = readFileSync(join(__dirname, '../src/landing/mobile.html'));
  const server = createServer((request, response) => {
    if (request.url === '/api/landing-events') {
      let body = '';
      request.on('data', (chunk) => body += chunk);
      request.on('end', () => {
        events.push(JSON.parse(body));
        response.writeHead(204).end();
      });
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const output = process.env.LANDING_EVIDENCE_DIR;
  if (output) { mkdirSync(output, { recursive: true }); }
  try {
    for (const [name, engine, options] of [
      ['android', chromium, devices['Pixel 5']],
      ['ios', webkit, devices['iPhone 13']],
      ['wide-ios', webkit, { ...devices['iPhone 13'], viewport: { width: 1024, height: 768 } }],
      ['desktop', chromium, { viewport: { width: 1280, height: 800 } }],
      ['narrow-desktop', chromium, { viewport: { width: 375, height: 700 } }],
    ]) {
      const browser = await engine.launch({ headless: true });
      try {
        const context = await browser.newContext(options);
        await context.route('**/*', (route) => route.request().url().startsWith(url) ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto(url);
        const mobile = name !== 'desktop';
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('a:visible').count(), 1);
        assert.equal(await page.locator('#wallet').isVisible(), mobile);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (output) { await page.screenshot({ path: join(output, `${name}.png`), fullPage: true }); }
        await page.locator('.cta').evaluate((element) => element.addEventListener('click', (event) => event.preventDefault()));
        for (const [wallet, href] of mobile
          ? [['metamask', 'metamask://'], ['coinbase', 'cbwallet://'], ['rainbow', 'rainbow://']]
          : [['browser', 'https://github.com/Nexussyn/ai-growth-engine/issues']]) {
          if (mobile) { await page.selectOption('#wallet', wallet); }
          assert.equal(await page.locator('.cta').getAttribute('href'), href);
          const previous = events.length;
          const recorded = page.waitForResponse((response) => response.url() === `${url}/api/landing-events`);
          await page.locator('.cta').click();
          await recorded;
          assert.equal(events.length, previous + 1);
          assert.deepEqual(events.at(-1), { wallet, device: mobile ? 'mobile' : 'desktop' });
        }
        if (name === 'desktop') {
          await page.setViewportSize({ width: 375, height: 700 });
          await page.waitForFunction(() => !document.getElementById('wallet-choice').hidden);
          await page.setViewportSize({ width: 1280, height: 800 });
          await page.waitForFunction(() => document.getElementById('wallet-choice').hidden);
        }
        console.log(`${name}: one CTA, layout, wallet targets and click events passed`);
      } finally { await browser.close(); }
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

