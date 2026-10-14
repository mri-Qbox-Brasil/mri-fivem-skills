/**
 * Print de uma página com game-glass no Chrome headless, em tempo real (o --virtual-time-budget
 * quase não roda requestAnimationFrame e o fence do blur nunca libera).
 *
 * Uso: node shot.mjs <url> <saida.png> [espera-ms] [js-pra-avaliar]
 * Ex.: node shot.mjs "http://localhost:6016/iframe.html?id=lib-gameglass--showcase&viewMode=story" ./glass.png 10000
 *
 * Pra NUI de resource, passe fallbackImage no startGameGlass (fora do jogo não há frame do GTA).
 * Precisa do Google Chrome (caminho em CHROME ou o padrão do SO).
 */
import { openBrowser, sleep } from './cdp.mjs';

const [url, out = './shot.png', waitArg = '2500', expr] = process.argv.slice(2);
if (!url) {
  console.error('uso: node shot.mjs <url> <saida.png> [espera-ms] [js-pra-avaliar]');
  process.exit(1);
}

// Real time on purpose (no --virtual-time-budget), and SwiftShader so WebGL works headless.
const browser = await openBrowser({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  viewport: { width: 1280, height: 600 },
});
try {
  browser.on('Runtime.consoleAPICalled', (p) => console.log('[console]', p.args.map((a) => a.value ?? a.description).join(' ')));
  browser.on('Runtime.exceptionThrown', (p) => console.log('[erro]', p.exceptionDetails.exception?.description));
  await browser.send('Page.navigate', { url });
  await sleep(Number(waitArg));
  if (expr) console.log(JSON.stringify(await browser.evaluate(expr, { awaitPromise: true })));
  console.log(await browser.screenshot(out));
} finally {
  await browser.close();
}
