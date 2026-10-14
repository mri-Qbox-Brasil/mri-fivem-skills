/**
 * Roda passos numa NUI em modo browser (vite dev) via Chrome headless: manda mensagens
 * como o Lua mandaria, clica, tira prints e mede opacidade por quadro.
 *
 * Uso: node nui-probe.mjs <url> <pasta-saida> <passos.json> [espera-inicial-ms]
 * Ex.: node nui-probe.mjs http://localhost:5173/ ./shots steps.json 10000
 *
 * Injeta window.invokeNative antes da página carregar, pra o fetchNui cair no mock de
 * dev em vez de responder { success: true } fixo. Formato dos passos em
 * references/verification.md. Precisa do Google Chrome (caminho em CHROME ou o padrão).
 */
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser, sleep } from './cdp.mjs';

const [url, outDir = './shots', stepsFile, waitArg = '10000'] = process.argv.slice(2);
if (!url || !stepsFile) {
  console.error('uso: node nui-probe.mjs <url> <pasta-saida> <passos.json> [espera-inicial-ms]');
  process.exit(1);
}
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

// fundo imitando céu e chão, pra scrims e textos claros aparecerem (o body do dev é claro)
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
    `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return 'botão não achado: ' + ${JSON.stringify(label)}; b.click(); return 'ok' })()`;

  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.invokeNative = function () {}' });
  await send('Page.navigate', { url });
  await sleep(Number(waitArg));
  await run(`document.querySelector('#root') && (document.querySelector('#root').style.background = '${BACKDROP}')`);

  for (const step of steps) {
    if (step.measure) {
      // opacidade efetiva por quadro a partir do clique (ou já, sem clique)
      const expr = `new Promise((res) => {
        const out = []; const t0 = performance.now();
        const eff = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o };
        const tick = () => {
          const els = [...document.querySelectorAll(${JSON.stringify(step.measure)})];
          out.push(Math.round(performance.now() - t0) + 'ms:' + (els.map((e) => eff(e).toFixed(2)).join(',') || 'nenhum'));
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

  console.log('erros:', JSON.stringify(errors));
} finally {
  await browser.close();
}
