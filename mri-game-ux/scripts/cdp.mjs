// Headless Chrome over the DevTools Protocol, shared by the scripts that take screenshots or drive pages.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const found = candidates.find((p) => p && fs.existsSync(p))
  if (!found) throw new Error('Chrome nao encontrado (defina CHROME com o caminho)')
  return found
}

/**
 * Opens Chrome (headless by default) and connects to its first tab.
 * Without `profile` it uses a temporary one deleted on close; with it the profile is kept (saved logins).
 * Returns { send, evaluate, on, setViewport, screenshot, close }; always call close() (use try/finally).
 */
export async function openBrowser({ args = [], viewport, profile: keptProfile, headless = true } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500)
  const profile = keptProfile ?? fs.mkdtempSync(path.join(os.tmpdir(), 'web-check-'))
  if (keptProfile) fs.mkdirSync(keptProfile, { recursive: true })
  const mode = headless ? ['--headless=new', '--hide-scrollbars'] : ['--no-first-run', '--no-default-browser-check']
  const chrome = spawn(findChrome(), [...mode, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...args, 'about:blank'])
  const exited = new Promise((r) => chrome.once('exit', r))

  const close = async () => {
    // Graceful close first so a kept profile flushes its cookies to disk.
    try { ws?.send(JSON.stringify({ id: 1e9, method: 'Browser.close' })) } catch {}
    await Promise.race([exited, sleep(4000)])
    try { ws?.close() } catch {}
    chrome.kill()
    await sleep(400)
    if (!keptProfile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
  }

  let ws
  try {
    let tabs
    for (let i = 0; i < 60 && !tabs; i++) {
      await sleep(250)
      tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => undefined)
    }
    if (!tabs) throw new Error(`Chrome nao respondeu na porta ${port}`)
    ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })
  } catch (e) {
    await close()
    throw e
  }

  let id = 0
  const pending = new Map()
  const listeners = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) reject(new Error(`${m.error.message} (${m.error.code})`))
      else resolve(m.result ?? {})
    }
    if (m.method) for (const fn of listeners.get(m.method) ?? []) fn(m.params)
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id
      pending.set(i, { resolve, reject })
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  // Returns the value, or "EXC <message>" when the page code throws.
  const evaluate = async (expression, { awaitPromise = false } = {}) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
    if (r.exceptionDetails) return `EXC ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`
    return r.result?.value
  }

  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn])

  const setViewport = ({ width, height, mobile = false, scale = 1 }) =>
    Promise.all([
      send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile }),
      send('Emulation.setTouchEmulationEnabled', { enabled: mobile }),
    ])

  // fullPage captures beyond the viewport (capped at 12000 px of height).
  const screenshot = async (file, { fullPage = false } = {}) => {
    const params = { format: 'png' }
    if (fullPage) {
      const { cssContentSize } = await send('Page.getLayoutMetrics')
      const { clientWidth } = await evaluate('({ clientWidth: document.documentElement.clientWidth })')
      params.captureBeyondViewport = true
      params.clip = { x: 0, y: 0, width: clientWidth, height: Math.min(Math.ceil(cssContentSize.height), 12000), scale: 1 }
    }
    const { data } = await send('Page.captureScreenshot', params)
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
    fs.writeFileSync(file, Buffer.from(data, 'base64'))
    return file
  }

  await send('Runtime.enable')
  await send('Page.enable')
  if (viewport) await setViewport(viewport)

  return { send, evaluate, on, setViewport, screenshot, close }
}
