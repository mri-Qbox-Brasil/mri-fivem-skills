#!/usr/bin/env node
// Scans FiveM resources for NUI code that breaks or changes on CEF 144.
// Usage: node cef-scan.mjs <resources folder | resource folder> [--src-only]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'stream', '.vite', 'coverage'])
const WEB_EXT = /\.(m?js|jsx|tsx?|vue|svelte|html?|s?css)$/i
const MAX_BYTES = 4 * 1024 * 1024
const BUILD_DIR = /[\\/](dist|build)[\\/]/

const CHECKS = [
  { id: 'dialog', re: /(?<![\w.$])(?:window\.)?(alert|confirm)\s*\(\s*[`'"]/g, says: 'alert()/confirm() no longer exist in NUI: use your own modal or a hold-to-confirm' },
  { id: 'copy', re: /execCommand\(\s*['"]copy['"]\s*\)/g, says: "execCommand('copy') now needs the element focused: call el.focus() before select()", skipIf: (src, at) => /\.focus\(/.test(src.slice(Math.max(0, at - 250), at)) },
  { id: 'mutation', re: /DOMNodeInserted|DOMNodeRemoved|DOMSubtreeModified|DOMCharacterDataModified/g, says: 'mutation events were removed: use MutationObserver' },
  { id: 'zoom', css: /(?<![\w-])zoom\s*:\s*(?!1\b|normal|100%)[^;}"'\n]+/g, re: /\.style\.zoom\b|style=\{\{[^}]*\bzoom\s*:|\[zoom:/g, says: 'CSS zoom follows the standard now: check clicks, drag and popover positions inside it' },
  { id: 'device', re: /navigator\.(usb|bluetooth|hid|serial)\b|window\.print\s*\(|requestPictureInPicture/g, says: 'blocked in NUI on CEF 144' },
]

const args = process.argv.slice(2)
const srcOnly = args.includes('--src-only')
const target = args.find((a) => !a.startsWith('--'))
if (!target || !existsSync(target)) {
  console.log('usage: node cef-scan.mjs <resources folder | resource folder> [--src-only]')
  process.exit(2)
}

const resources = []
;(function find(dir) {
  if (existsSync(join(dir, 'fxmanifest.lua')) || existsSync(join(dir, '__resource.lua'))) return resources.push(dir)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) find(join(dir, entry.name))
  }
})(target)

function webFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) webFiles(path, out)
    } else if (WEB_EXT.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

const lineOf = (src, at) => src.slice(0, at).split('\n').length
let total = 0

for (const res of resources) {
  const found = []
  const legacy = existsSync(join(res, '__resource.lua'))
  const manifest = readFileSync(join(res, legacy ? '__resource.lua' : 'fxmanifest.lua'), 'utf8')
  const hasUi = /^\s*ui_page\b/m.test(manifest)
  const version = manifest.match(/^\s*fx_version\s+['"](\w+)['"]/m)?.[1]
  if (hasUi && (legacy || (version && version !== 'cerulean'))) {
    found.push(`manifest  ${legacy ? '__resource.lua' : `fx_version '${version}'`} with ui_page: use fxmanifest.lua with fx_version 'cerulean' (secure context)`)
  }

  for (const file of webFiles(res, [])) {
    if (srcOnly && BUILD_DIR.test(file)) continue
    if (statSync(file).size > MAX_BYTES) continue
    const src = readFileSync(file, 'utf8')
    // Bundled output: one huge line per chunk.
    if (srcOnly && src.length / (src.split('\n').length || 1) > 500) continue
    const isCss = /\.(s?css|html?)$/i.test(file)
    for (const check of CHECKS) {
      const re = isCss && check.css ? check.css : check.re
      for (const match of src.matchAll(re)) {
        if (check.skipIf?.(src, match.index)) continue
        found.push(`${check.id.padEnd(9)} ${relative(res, file).replace(/\\/g, '/')}:${lineOf(src, match.index)}  ${check.says}`)
        break
      }
    }
  }

  if (found.length) {
    total += found.length
    console.log(`\n${relative(target, res).replace(/\\/g, '/') || res}`)
    for (const line of found) console.log(`  ${line}`)
  }
}

console.log(`\n${resources.length} resources, ${total} findings`)
