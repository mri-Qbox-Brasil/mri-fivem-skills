/**
 * Runs steps on a NUI in browser mode (vite dev) through headless Chrome: posts messages
 * as Lua would, clicks, takes screenshots and measures opacity per frame.
 *
 * Usage: node nui-probe.mjs <url> <out-dir> <steps.json> [initial-wait-ms]
 * E.g.:  node nui-probe.mjs http://localhost:5173/ ./shots steps.json 10000
 *
 * Injects window.invokeNative before the page loads, so fetchNui reaches the dev mock
 * instead of answering a fixed { success: true }. Step format in
 * references/verification.md. Needs Google Chrome (path in CHROME or the default).
 */
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser, sleep } from './cdp.mjs';

const [url, outDir = './shots', stepsFile, waitArg = '10000'] = process.argv.slice(2);
if (!url || !stepsFile) {
  console.error('usage: node nui-probe.mjs <url> <out-dir> <steps.json> [initial-wait-ms]');
  process.exit(1);
}
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// Sky and ground backdrop so scrims and light text show (the dev body is light).
const BACKDROP = 'linear-gradient(180deg, #3a2a4a 0%, #6b4a55 40%, #1d2733 62%, #0c1118 100%)';

const browser = await openBrowser({ viewport: { width: 1600, height: 900 } });
try {
  const errors = [];
  browser.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.exception?.description));
  browser.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
  });
  const { send } = browser;
  const run = (expression, awaitPromise = false) => browser.evaluate(expression, { awaitPromise });
  const shot = async (name) => console.log('print', await browser.screenshot(path.join(outDir, `${name}.png`)));
  const clickJs = (label) =>
    `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return 'button not found: ' + ${JSON.stringify(label)}; b.click(); return 'ok' })()`;

  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.invokeNative = function () {}' });
  await send('Page.navigate', { url });
  await sleep(Number(waitArg));
  await run(`document.querySelector('#root') && (document.querySelector('#root').style.background = '${BACKDROP}')`);

  for (const step of steps) {
    if (step.measure) {
      // Effective opacity per frame from the click (or right away, without one).
      const expr = `new Promise((res) => {
        const out = []; const t0 = performance.now();
        const eff = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o };
        const tick = () => {
          const els = [...document.querySelectorAll(${JSON.stringify(step.measure)})];
          out.push(Math.round(performance.now() - t0) + 'ms:' + (els.map((e) => eff(e).toFixed(2)).join(',') || 'none'));
          if (performance.now() - t0 < ${Number(step.ms) || 450}) requestAnimationFrame(tick); else res(out.join(' '));
        };
        ${step.click ? `${clickJs(step.click)};` : ''}
        tick();
      })`;
      console.log('measure', step.measure, await run(expr, true));
    } else {
      if (step.post) console.log('post', step.post.action, await run(`window.postMessage(${JSON.stringify(step.post)}, '*'), 'ok'`));
      if (step.click) console.log('click', step.click, await run(clickJs(step.click)));
      if (step.key) console.log('key', step.key, await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(step.key)} })), 'ok'`));
    }
    await sleep(Number(step.wait) || 0);
    if (step.eval) console.log('eval', step.eval, '=>', JSON.stringify(await run(step.eval)));
    if (step.shot) await shot(step.shot);
  }

  console.log('errors:', JSON.stringify(errors));
} finally {
  await browser.close();
}
