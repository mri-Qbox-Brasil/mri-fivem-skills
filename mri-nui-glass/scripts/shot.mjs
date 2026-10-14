/**
 * Screenshot of a page with game glass in headless Chrome, in real time (--virtual-time-budget
 * barely runs requestAnimationFrame and the blur fence never releases).
 *
 * Usage: node shot.mjs <url> <out.png> [wait-ms] [js-to-evaluate]
 * Ex.: node shot.mjs "http://localhost:6016/iframe.html?id=lib-gameglass--showcase&viewMode=story" ./glass.png 10000
 *
 * For a resource NUI, pass fallbackImage to startGameGlass (outside the game there is no GTA frame).
 * Needs Google Chrome (path in CHROME or the OS default).
 */
import { openBrowser, sleep } from './cdp.mjs';

const [url, out = './shot.png', waitArg = '2500', expr] = process.argv.slice(2);
if (!url) {
  console.error('usage: node shot.mjs <url> <out.png> [wait-ms] [js-to-evaluate]');
  process.exit(1);
}

// Real time on purpose (no --virtual-time-budget), and SwiftShader so WebGL works headless.
const browser = await openBrowser({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  viewport: { width: 1280, height: 600 },
});
try {
  browser.on('Runtime.consoleAPICalled', (p) => console.log('[console]', p.args.map((a) => a.value ?? a.description).join(' ')));
  browser.on('Runtime.exceptionThrown', (p) => console.log('[error]', p.exceptionDetails.exception?.description));
  await browser.send('Page.navigate', { url });
  await sleep(Number(waitArg));
  if (expr) console.log(JSON.stringify(await browser.evaluate(expr, { awaitPromise: true })));
  console.log(await browser.screenshot(out));
} finally {
  await browser.close();
}
