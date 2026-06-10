// Browser end-to-end test: a candidate completes the full sim, submits, and
// the evidence pack renders their attempt. Run: node tests/e2e.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  if (req.method === 'POST') { res.writeHead(200).end('ok'); return; } // stands in for Netlify
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log('  ok  ' + name);
  else { failures++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

// Prefer the environment's pre-installed Chromium when the Playwright-pinned
// revision isn't downloadable (e.g. sandboxed CI without CDN access).
import { existsSync } from 'fs';
const prebaked = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(prebaked) ? { executablePath: prebaked } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // candidate on a phone
page.on('pageerror', e => { failures++; console.error('FAIL  page error: ' + e.message); });

// Role page links to the sim from the apply success state.
await page.goto(`${base}/sparklps/roles/math-sped-teacher.html`);
check('role page links to sim', await page.locator('#successMsg a[href*="sim/index.html"]').count() === 1);

// Candidate runs the whole sim.
await page.goto(`${base}/sparklps/sim/index.html?pack=math`);
check('intro renders', await page.locator('h1').innerText() === 'Spend 10 minutes in our classroom.');
await page.click('#startBtn');

// Act 1: student work + two typed responses.
check('Jayden’s work is shown', await page.locator('.sim-work .ln').count() === 3);
await page.fill('#a1q1', 'Jayden understands adding fractions with like denominators — the first one is right. The misconception is adding across the numerator and denominator, which makes sense to him because that is how multiplying works.');
await page.fill('#a1q2', 'I would cover the answers and ask him to estimate whether 3/4 plus 2/5 should be more or less than one whole, so his benchmark collides with 5/9.');
await page.click('.sim-actions .btn');

// Act 2: chat moment — choices appear sequentially.
await page.waitForSelector('[data-opt="c1a"]');
check('Maria opens the scene', (await page.locator('.sim-bubble.them').first().innerText()).includes('bad at math'));
await page.click('[data-opt="c1a"]');
await page.waitForSelector('[data-opt="c2a"]');
check('choice 1 echoes into the chat', await page.locator('.sim-bubble.you').count() === 1);
await page.click('[data-opt="c2a"]');
await page.waitForSelector('#a2q1');
await page.fill('#a2q1', 'Maria, your way makes sense for multiplying — that is the frustrating part. The denominator tells the size of the piece, not how many, so fourths and fifths cannot be counted together until the pieces are the same size. Want to draw it with me?');
await page.click('.sim-field .btn');
await page.waitForSelector('[data-opt="c3a"]');
await page.click('[data-opt="c3a"]');
await page.waitForSelector('.sim-actions .btn');
await page.click('.sim-actions .btn');

// Act 3: adapt.
await page.waitForSelector('#a3q1');
await page.fill('#a3q1', 'Add fraction tiles and a number line to every table and pre-teach the warm-up to my five IEP students during intervention. What stays the same: every student works the same grade-level problems toward the same goal.');
await page.click('.sim-actions .btn');

// Validation: identity gate refuses an empty name.
await page.waitForSelector('#submitBtn');
await page.click('#submitBtn');
check('identity validation blocks empty submit', await page.locator('.sim-err.show').count() === 1);
await page.fill('#candName', 'E2E Candidate');
await page.fill('#candEmail', 'e2e@example.com');
const postSent = page.waitForRequest(r => r.method() === 'POST');
await page.click('#submitBtn');
await postSent;
await page.waitForSelector('#doneCard');
check('completion screen shows', (await page.locator('#doneCard h2').innerText()).includes('Thank you'));
await page.screenshot({ path: 'tests/screenshots/candidate-done.png' });

// Evidence pack renders this attempt from the stored payload.
await page.goto(`${base}/sparklps/sim/review.html`);
check('evidence pack names the candidate', (await page.locator('.ep-head .cand').innerText()) === 'E2E Candidate');
check('all four dimensions render', await page.locator('.ep-dim').count() === 4);
check('verbatim quotes are shown', await page.locator('.ep-quote').count() >= 7);
const pips = await page.locator('.ep-pips i.on').count();
check('strong run scores high overall', pips >= 12, `${pips}/16 pips`);
check('no follow-ups for a strong run', await page.locator('.ep-next li').count() === 0);
await page.screenshot({ path: 'tests/screenshots/evidence-pack.png', fullPage: true });

// Demo mode works on a clean profile (what we send principals).
const clean = await browser.newPage();
clean.on('pageerror', e => { failures++; console.error('FAIL  demo page error: ' + e.message); });
await clean.goto(`${base}/sparklps/sim/review.html?demo=1`);
check('demo evidence pack renders', (await clean.locator('.ep-head .cand').innerText()) === 'Sample Candidate');

await browser.close();
server.close();
console.log(failures ? `\n${failures} failing` : '\nend-to-end passing');
process.exit(failures ? 1 : 0);
