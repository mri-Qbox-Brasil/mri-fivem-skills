#!/usr/bin/env node
// Parses every .lua of a FiveM resource (CfxLua syntax included) and flags the usual pitfalls.
// Usage: node check.mjs <resource folder | file.lua ...>
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const luaparse = createRequire(import.meta.url)('./vendor/luaparse.cjs')
const SKIP_DIRS = new Set(['node_modules', '.git', 'stream', 'web', 'html', 'ui', 'dist', 'build'])
const FILE_EXT = /\.(lua|js|html|json|css|ogg|png|ytyp)$/i

// CfxLua extensions luaparse doesn't know, rewritten keeping every line and column in place.
function desugarCode(code) {
  return code
    .replace(/`[^`\n]*`/g, (m) => '0'.padEnd(m.length))
    .replace(/\?\.(?=\s*[[(])/g, '  ')
    .replace(/\?\./g, ' .')
    .replace(/\?(?=\s*\[)/g, ' ')
    .replace(/(\.\.|\/\/|<<|>>)=/g, '  =')
    .replace(/([+\-*/%^&|])=(?!=)/g, ' =')
    .replace(/<\s*(const|close)\s*>/g, (m) => ' '.repeat(m.length))
}

function longBracketEnd(src, from) {
  const open = src.slice(from, from + 64).match(/^\[(=*)\[/)
  if (!open) return -1
  const close = `]${open[1]}]`
  const end = src.indexOf(close, from + open[0].length)
  return end < 0 ? src.length : end + close.length
}

// Only code is rewritten; strings stay as they are and comments lose their backticks (luaparse reads them as code).
function desugar(src) {
  let out = ''
  let code = ''
  let i = 0
  const flush = () => {
    out += desugarCode(code)
    code = ''
  }
  while (i < src.length) {
    const c = src[i]
    let end = -1
    if (c === '-' && src[i + 1] === '-') {
      end = longBracketEnd(src, i + 2)
      if (end < 0) end = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i)
      flush()
      out += src.slice(i, end).replace(/`/g, ' ')
    } else if (c === '"' || c === "'") {
      end = i + 1
      while (end < src.length && src[end] !== c && src[end] !== '\n') end += src[end] === '\\' ? 2 : 1
      end = Math.min(end + 1, src.length)
      flush()
      out += src.slice(i, end)
    } else if (c === '[' && (end = longBracketEnd(src, i)) >= 0) {
      flush()
      out += src.slice(i, end)
    } else {
      code += c
      i++
      continue
    }
    i = end
  }
  flush()
  return out
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out)
    } else if (entry.name.endsWith('.lua')) out.push(join(dir, entry.name))
  }
  return out
}

const args = process.argv.slice(2)
if (!args.length) {
  console.log('usage: node check.mjs <resource folder | file.lua ...>')
  process.exit(2)
}

const files = []
const manifests = []
for (const arg of args) {
  if (!existsSync(arg)) {
    console.log(`not found: ${arg}`)
    process.exit(2)
  }
  if (statSync(arg).isDirectory()) {
    walk(arg, files)
    if (existsSync(join(arg, 'fxmanifest.lua'))) manifests.push(join(arg, 'fxmanifest.lua'))
    if (existsSync(join(arg, '__resource.lua'))) console.log(`WARN ${join(arg, '__resource.lua')}: legacy manifest, use fxmanifest.lua with fx_version 'cerulean'`)
  } else files.push(arg)
}

const base = statSync(args[0]).isDirectory() ? args[0] : dirname(args[0])
const show = (file) => (relative(base, file) || basename(file)).replace(/\\/g, '/')
let failed = 0
let warned = 0
const warn = (file, line, message) => {
  warned++
  console.log(`WARN ${show(file)}:${line} ${message}`)
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  try {
    luaparse.parse(desugar(src), { luaVersion: '5.3', comments: false })
  } catch (error) {
    failed++
    console.log(`FAIL ${show(file)} ${error.message}`)
    continue
  }
  src.split('\n').forEach((text, i) => {
    const code = text.replace(/--.*$/, '')
    if (/\band\s+(false|nil)\s+or\b/.test(code)) warn(file, i + 1, '`and false/nil or x` always gives x; use if/else')
  })
}

for (const manifest of manifests) {
  const dir = dirname(manifest)
  const src = readFileSync(manifest, 'utf8')
  const lines = src.split('\n')
  const hasUi = /^\s*ui_page\b/m.test(src)
  lines.forEach((text, i) => {
    const code = text.replace(/--.*$/, '')
    const version = code.match(/^\s*fx_version\s+['"](\w+)['"]/)
    if (version && version[1] !== 'cerulean') {
      warn(manifest, i + 1, `fx_version '${version[1]}'${hasUi ? ': the NUI may lose secure-context APIs on CEF 144' : ''}, use 'cerulean'`)
    }
    for (const [, path] of code.matchAll(/['"]([^'"]+)['"]/g)) {
      if (/(^|\/)\*(\/|$)/.test(path) && !path.endsWith('/*') && /\*\/./.test(path)) {
        warn(manifest, i + 1, `'${path}': a single * in the middle of a path matches nothing, use **`)
      } else if (!path.includes('*') && !path.startsWith('@') && !/^https?:/.test(path) && FILE_EXT.test(path) && path !== 'fxmanifest.lua') {
        if (!existsSync(join(dir, path))) warn(manifest, i + 1, `'${path}' not found`)
      }
    }
  })
}

console.log(`${files.length} lua files, ${failed} failed, ${warned} warnings`)
process.exit(failed ? 1 : 0)
