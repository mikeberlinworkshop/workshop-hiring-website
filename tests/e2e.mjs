// Browser end-to-end test: a candidate completes the full sim on a phone
// viewport, submits, and the evidence pack renders their attempt. Runs twice —
// once with no scorer function (v0 heuristic fallback) and once with a mocked
// AI scorer response (v1 path). Run: node tests/e2e.mjs
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, normalize } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const MOCK_AI = {
  scorer: 'ai-v1',
  scores: { diagnose: 4, mindset: 4, respond: 3, scaffold: 2 },
  evidence: [{ dim: 'diagnose', quote: 'that is how multiplying works', rationale: 'Names why the misconception makes sense to the student.' }],
  flags: [],
  followUps: [{ dim: 'scaffold', question: 'Walk me through keeping an IEP student on the grade-level goal in this lesson.' }]
};
let serveAiScorer = false;

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (req.method === 'POST') {
    if (path === '/.netlify/functions/score-sim') {
      if (!serveAiScorer) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(MOCK_AI));
      return;
    }
    res.writeHead(200).end('ok'); // stands in for Netlify form intake
    return;
  }
  try {
    const file = path.endsWith('/') ? path + 'index.html' : path;
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
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
const prebaked = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(prebaked) ? { executablePath: prebaked } : {});

async function runCandidate(page, name) {
  await page.goto(`${base}/sparklps/sim/index.html?pack=math`);
  await page.click('#startBtn');
  await page.fill('#a1q1', 'Jayden understands adding fractions with like denominators — the first one is right. The misconception is adding across the numerator and denominator, which makes sense to him because that is how multiplying works.');
  await page.fill('#a1q2', 'I would cover the answers and ask him to estimate whether 3/4 plus 2/5 should be more or less than one whole, so his benchmark collides with 5/9.');
  await page.click('.sim-actions .btn');
  await page.waitForSelector('[data-opt="c1a"]');
  await page.click('[data-opt="c1a"]');
  await page.waitForSelector('[data-opt="c2a"]');
  await page.click('[data-opt="c2a"]');
  await page.waitForSelector('#a2q1');
  await page.fill('#a2q1', 'Maria, your way makes sense for multiplying — that is the frustrating part. The denominator tells the size of the piece, not how many, so fourths and fifths cannot be counted together until the pieces are the same size. Want to draw it with me?');
  await page.click('.sim-field .btn');
  await page.waitForSelector('[data-opt="c3a"]');
  await page.click('[data-opt="c3a"]');
  await page.waitForSelector('.sim-actions .btn');
  await page.click('.sim-actions .btn');
  await page.waitForSelector('#a3q1');
  await page.fill('#a3q1', 'Add fraction tiles and a number line to every table and pre-teach the warm-up to my five IEP students during intervention. What stays the same: every student works the same grade-level problems toward the same goal.');
  await page.click('.sim-actions .btn');
  await page.waitForSelector('#submitBtn');
  await page.fill('#candName', name);
  await page.fill('#candEmail', 'e2e@example.com');
  await page.click('#submitBtn');
  await page.waitForSelector('#doneCard');
}

// ---- Pass 1: no scorer function — v0 heuristic fallback --------------------
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // candidate on a phone
page.on('pageerror', e => { failures++; console.error('FAIL  page error: ' + e.message); });

await page.goto(`${base}/sparklps/roles/math-sped-teacher.html`);
check('role page links to sim', await page.locator('#successMsg a[href*="sim/index.html"]').count() === 1);

await page.goto(`${base}/sparklps/sim/index.html?pack=math`);
check('intro renders', await page.locator('h1').innerText() === 'Spend 10 minutes in our classroom.');
await page.click('#startBtn');
check('Jayden’s work is shown', await page.locator('.sim-work .ln').count() === 3);
await page.goBack(); // restart cleanly via the helper

await runCandidate(page, 'E2E Candidate');
check('completion screen shows', (await page.locator('#doneCard h2').innerText()).includes('Thank you'));
await page.screenshot({ path: 'tests/screenshots/candidate-done.png' });

await page.goto(`${base}/sparklps/sim/review.html`);
check('evidence pack names the candidate', (await page.locator('.ep-head .cand').innerText()) === 'E2E Candidate');
check('all four dimensions render', await page.locator('.ep-dim').count() === 4);
check('verbatim quotes are shown', await page.locator('.ep-quote').count() >= 7);
const pips = await page.locator('.ep-pips i.on').count();
check('strong run scores high overall', pips >= 12, `${pips}/16 pips`);
check('no follow-ups for a strong run', await page.locator('.ep-next li').count() === 0);
check('footer reports the v0 heuristic scorer', (await page.locator('.ep-honest').innerText()).includes('v0'));
await page.screenshot({ path: 'tests/screenshots/evidence-pack.png', fullPage: true });

// ---- Pass 2: AI scorer responds — v1 path ----------------------------------
serveAiScorer = true;
const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
page2.on('pageerror', e => { failures++; console.error('FAIL  AI-pass page error: ' + e.message); });
await runCandidate(page2, 'AI Scored Candidate');
await page2.goto(`${base}/sparklps/sim/review.html`);
check('AI pass renders the candidate', (await page2.locator('.ep-head .cand').innerText()) === 'AI Scored Candidate');
check('footer reports the AI scorer', (await page2.locator('.ep-honest').innerText()).includes('AI scorer (v1)'));
check('AI rationale is shown with the quote', (await page2.locator('.ep-quote').allInnerTexts()).join(' ').includes('Names why the misconception makes sense'));
check('AI follow-up appears', (await page2.locator('.ep-next li').first().innerText()).includes('IEP student'));
const aiPips = await page2.locator('.ep-pips i.on').count();
check('AI scores drive the pips', aiPips === 13, `${aiPips}/16 pips`);

// Demo mode works on a clean profile (what we send principals).
const clean = await browser.newPage();
clean.on('pageerror', e => { failures++; console.error('FAIL  demo page error: ' + e.message); });
await clean.goto(`${base}/sparklps/sim/review.html?demo=1`);
check('demo evidence pack renders', (await clean.locator('.ep-head .cand').innerText()) === 'Sample Candidate');

await browser.close();
server.close();
console.log(failures ? `\n${failures} failing` : '\nend-to-end passing');
process.exit(failures ? 1 : 0);
