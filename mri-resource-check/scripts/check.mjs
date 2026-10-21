#!/usr/bin/env node
// Parses every .lua of a FiveM resource (CfxLua syntax included), checks natives and flags the usual pitfalls.
// Usage: node check.mjs <resource folder | file.lua ...> [--no-natives]
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { loadNatives } from './natives.mjs'

const luaparse = createRequire(import.meta.url)('./vendor/luaparse.cjs')
const SKIP_DIRS = new Set(['node_modules', '.git', 'stream', 'web', 'html', 'ui', 'dist', 'build'])
// Test harnesses define their own globals and never run in game.
const TEST_DIR = /(^|\/)(tests?|spec|__tests__)\//i
const FILE_EXT = /\.(lua|js|html|json|css|ogg|png)$/i
// Snippets to paste elsewhere (`!INSTALLATION`, `[install]`) are not loaded by the game.
const INSTALL_DIR = /^[![_]?install/i
// Globals the Lua runtime adds on top of the natives.
const RUNTIME = new Set([
  'CreateThread', 'CreateThreadNow', 'Wait', 'SetTimeout', 'ClearTimeout', 'AddEventHandler', 'RemoveEventHandler',
  'RegisterNetEvent', 'RegisterServerEvent', 'TriggerEvent', 'TriggerServerEvent', 'TriggerClientEvent',
  'TriggerLatentServerEvent', 'TriggerLatentClientEvent', 'RegisterNUICallback', 'SendNUIMessage',
  'GetPlayerIdentifiers', 'GetPlayerTokens', 'GetPlayers', 'PerformHttpRequest', 'Entity', 'Player', 'NewStateBag',
])

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
    .replace(/([{,]\s*)\.(?=[A-Za-z_])/g, '$1 ')
    .replace(/(\blocal\s+[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*\s+)in(?=\s)/g, '$1= ')
}

const blank = (text) => text.replace(/[^\n]/g, ' ')

function longBracketEnd(src, from) {
  const open = src.slice(from, from + 64).match(/^\[(=*)\[/)
  if (!open) return -1
  const close = `]${open[1]}]`
  const end = src.indexOf(close, from + open[0].length)
  return end < 0 ? src.length : end + close.length
}

// 'parse': strings kept, comments without backticks (luaparse reads them as code). 'code': strings and comments blanked.
function transform(src, mode) {
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
    let kind = null
    if (c === '-' && src[i + 1] === '-') {
      end = longBracketEnd(src, i + 2)
      if (end < 0) end = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i)
      kind = 'comment'
    } else if (c === '/' && src[i + 1] === '*') {
      end = src.indexOf('*/', i + 2)
      end = end < 0 ? src.length : end + 2
      kind = 'block'
    } else if (c === '"' || c === "'") {
      end = i + 1
      while (end < src.length && src[end] !== c && src[end] !== '\n') end += src[end] === '\\' ? 2 : 1
      end = Math.min(end + 1, src.length)
      kind = 'string'
    } else if (c === '[' && (end = longBracketEnd(src, i)) >= 0) {
      kind = 'string'
    } else {
      code += c
      i++
      continue
    }
    flush()
    const text = src.slice(i, end)
    if (kind === 'block' || mode === 'code') out += kind === 'string' ? `"${blank(text.slice(2))}"`.slice(0, text.length) : blank(text)
    else out += kind === 'comment' ? text.replace(/`/g, ' ') : text
    i = end
  }
  flush()
  return out
}

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !INSTALL_DIR.test(entry.name)) walk(join(dir, entry.name), out)
    } else if (entry.name.endsWith('.lua')) out.push(join(dir, entry.name))
  }
  return out
}

const globToRegex = (glob) =>
  new RegExp(
    `^${glob
      .replace(/^\.\//, '')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*\*/g, '\u0001')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '(?:.*/)?')
      .replace(/\u0001/g, '.*')}$`,
    'i',
  )

// Which side runs each file, from the manifest; files it doesn't list fall back to a client/server folder name.
function readManifest(dir) {
  const file = join(dir, 'fxmanifest.lua')
  const result = { side: new Map(), patterns: { client: [], server: [], shared: [] }, imports: [] }
  if (!existsSync(file)) return result
  const src = transform(readFileSync(file, 'utf8'), 'parse').replace(/--.*$/gm, '')
  for (const [, side, , body] of src.matchAll(/\b(client|server|shared)_(scripts?)\s*(\{[\s\S]*?\}|(['"])[^'"]*\4)/g)) {
    for (const [, path] of (body ?? '').matchAll(/['"]([^'"]+)['"]/g)) {
      if (path.startsWith('@')) result.imports.push(path.slice(1))
      else result.patterns[side].push(globToRegex(path))
    }
  }
  return result
}

function sideOf(manifest, rel) {
  const on = (side) => manifest.patterns[side].some((re) => re.test(rel))
  const client = on('client')
  const server = on('server')
  if (on('shared') || (client && server)) return 'shared'
  if (client) return 'client'
  if (server) return 'server'
  const parts = rel.toLowerCase().split('/')
  if (parts.includes('client')) return 'client'
  if (parts.includes('server')) return 'server'
  return 'shared'
}

const DEFINITIONS = [
  /\bfunction\s+([A-Za-z_]\w*)\s*\(/g,
  /\blocal\s+function\s+([A-Za-z_]\w*)/g,
  /^\s*([A-Za-z_]\w*)\s*=[^=]/gm,
  /\blocal\s+([A-Za-z_][\w\s,]*?)\s*(?:=|$)/gm,
  /\b_G\s*\.\s*([A-Za-z_]\w*)\s*=/g,
  /\b_ENV\s*\.\s*([A-Za-z_]\w*)\s*=/g,
]

function definedNames(code, into) {
  for (const re of DEFINITIONS) {
    for (const match of code.matchAll(re)) for (const name of match[1].split(',')) into.add(name.trim())
  }
  return into
}

function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

// A typo is at most 2 edits away from a real native name.
function closest(name, names) {
  let best = null
  let bestDistance = 3
  for (const candidate of names) {
    const d = distance(name.toLowerCase(), candidate.toLowerCase(), 2)
    if (d < bestDistance) [best, bestDistance] = [candidate, d]
  }
  return best
}

// `@resource/file.lua` imports resolved inside the server's resources folder, when there is one above.
let resourceDirs = null
function findResource(from, name) {
  if (!resourceDirs) {
    resourceDirs = new Map()
    const parts = resolve(from).split(sep)
    const at = parts.map((p) => p.toLowerCase()).lastIndexOf('resources')
    const root = at > 0 ? parts.slice(0, at + 1).join(sep) : dirname(resolve(from))
    ;(function scan(dir, depth) {
      if (depth > 6) return
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      if (entries.some((e) => e.name === 'fxmanifest.lua' || e.name === '__resource.lua')) return resourceDirs.set(basename(dir), dir)
      for (const e of entries) if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) scan(join(dir, e.name), depth + 1)
    })(root, 0)
  }
  return resourceDirs.get(name)
}

const args = process.argv.slice(2)
const checkNatives = !args.includes('--no-natives')
const targets = args.filter((a) => !a.startsWith('--'))
if (!targets.length) {
  console.log('usage: node check.mjs <resource folder | file.lua ...> [--no-natives]')
  process.exit(2)
}

const files = []
let resourceDir = null
for (const arg of targets) {
  if (!existsSync(arg)) {
    console.log(`not found: ${arg}`)
    process.exit(2)
  }
  if (statSync(arg).isDirectory()) {
    walk(arg, files)
    resourceDir ??= arg
    if (existsSync(join(arg, '__resource.lua'))) console.log(`WARN __resource.lua: legacy manifest, use fxmanifest.lua with fx_version 'cerulean'`)
  } else files.push(arg)
}
// Single files: the resource is the nearest folder above with a manifest.
if (!resourceDir) {
  let dir = dirname(resolve(targets[0]))
  while (dir !== dirname(dir) && !existsSync(join(dir, 'fxmanifest.lua'))) dir = dirname(dir)
  resourceDir = existsSync(join(dir, 'fxmanifest.lua')) ? dir : dirname(resolve(targets[0]))
}

const base = statSync(targets[0]).isDirectory() ? targets[0] : resourceDir
const show = (file) => (relative(base, file) || basename(file)).replace(/\\/g, '/')
const lineAt = (text, index) => text.slice(0, index).split('\n').length
let failed = 0
let warned = 0
const warn = (where, message) => {
  warned++
  console.log(`WARN ${where} ${message}`)
}

const hasLocales = existsSync(join(resourceDir, "locales"))
const sides = readManifest(resourceDir)
// Server events the framework fires with TriggerEvent; a net handler lets any client fake them.
const LOCAL_SERVER_EVENTS = /^(QBCore:Server:(PlayerLoaded|OnPlayerUnload|OnJobUpdate|OnGangUpdate|SetDuty|OnMoneyChange|OnPermissionUpdate)|qbx_core:server:(playerLoggedOut|onJobUpdate|onGangUpdate|onGroupUpdate|onSetMetaData|characterDeleted)|esx:(playerLoaded|playerDropped|setJob))$/
// Event names that look like qbx_core's but it never fires: the handler silently never runs.
const DEAD_QBX_EVENTS = {
  playerLoaded: { server: "QBCore:Server:PlayerLoaded (AddEventHandler)", client: "QBCore:Client:OnPlayerLoaded" },
  playerUnloaded: { server: "qbx_core:server:playerLoggedOut", client: "qbx_core:client:playerLoggedOut" },
  jobChanged: { server: "qbx_core:server:onJobUpdate", client: "qbx_core:client:onJobUpdate" },
  gangChanged: { server: "qbx_core:server:onGangUpdate", client: "qbx_core:client:onGangUpdate" },
}
const DEAD_QBX_EVENT = /\b(?:RegisterNetEvent|AddEventHandler)\s*\(\s*['"]qbx_core:(server|client):(playerLoaded|playerUnloaded|jobChanged|gangChanged)['"]/g
// Old natives with a cheaper equivalent.
const SLOW_NATIVES = [
  [/\bGetPlayerPed\s*\(\s*-1\s*\)/, 'GetPlayerPed(-1): use cache.ped (ox_lib) or PlayerPedId()'],
  [/\bGetDistanceBetweenCoords\s*\(/, 'GetDistanceBetweenCoords: use #(a - b) on vectors'],
]
const codeByFile = new Map()
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  try {
    luaparse.parse(transform(src, 'parse'), { luaVersion: '5.3', comments: false })
  } catch (error) {
    failed++
    console.log(`FAIL ${show(file)} ${error.message}`)
    continue
  }
  const code = transform(src, 'code')
  codeByFile.set(file, code)
  // Test fixtures copy old code on purpose; their warnings buried the real ones.
  if (TEST_DIR.test(relative(resourceDir, file).replace(/\\/g, '/'))) continue
  code.split('\n').forEach((text, i) => {
    if (/\band\s+(false|nil)\s+or\b/.test(text)) warn(`${show(file)}:${i + 1}`, '`and false/nil or x` always gives x; use if/else')
    for (const [pattern, message] of SLOW_NATIVES) if (pattern.test(text)) warn(`${show(file)}:${i + 1}`, message)
  })
  for (const match of src.matchAll(DEAD_QBX_EVENT)) {
    warn(`${show(file)}:${lineAt(src, match.index)}`, `qbx_core:${match[1]}:${match[2]} is never fired by qbx_core; listen to ${DEAD_QBX_EVENTS[match[2]][match[1]]}`)
  }
  // SetTimeout calls its callback with the timer id: a function that takes arguments gets a number.
  for (const match of code.matchAll(/\bSetTimeout\s*\(\s*[^,()]+,\s*([A-Za-z_][\w.:]*)\s*\)/g)) {
    const name = match[1].replace(/[.:]/g, '[.:]')
    const params = new RegExp(`(?:function\\s+${name}\\s*\\(|\\b${name}\\s*=\\s*function\\s*\\()\\s*([^)\\s])`).exec(code)
    if (params) warn(`${show(file)}:${lineAt(code, match.index)}`, `SetTimeout passes its timer id as ${match[1]}'s first argument; wrap it: function() ${match[1]}() end`)
  }
  // Player-facing text belongs in the locale files when the resource has them.
  if (hasLocales) {
    src.split('\n').forEach((text, i) => {
      if (!/\b(Notify|notify|ShowNotification|ShowHelpNotification|showTextUI)\b/.test(text)) return
      // Literals paired left to right, so the code between two strings never reads as a phrase.
      if ([...text.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)].some((m) => /\p{L}{2,}\s+\p{L}/u.test(m[2])))
        warn(`${show(file)}:${i + 1}`, 'fixed player text in a notify; put it in locales/*.json and use locale()')
    })
  }
  // These events carry the new value, and qbx_core fires them before PlayerData is updated.
  for (const match of src.matchAll(/\b(?:RegisterNetEvent|AddEventHandler)\s*\(\s*['"](QBCore:Client:(?:OnJobUpdate|OnGangUpdate|SetDuty))['"]\s*,\s*function\s*\(\s*\)/g)) {
    warn(`${show(file)}:${lineAt(src, match.index)}`, `${match[1]} handler ignores the value it carries; PlayerData still has the old one when it runs`)
  }
  if (sideOf(sides, relative(resourceDir, file).replace(/\\/g, '/')) === 'server') {
    for (const match of src.matchAll(/\bRegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/g)) {
      if (LOCAL_SERVER_EVENTS.test(match[1]))
        warn(`${show(file)}:${lineAt(src, match.index)}`, `${match[1]} is fired by the framework on the server; RegisterNetEvent lets any client fake it, use AddEventHandler`)
    }
  }
}

const manifestFile = join(resourceDir, 'fxmanifest.lua')
if (existsSync(manifestFile)) {
  const src = readFileSync(manifestFile, 'utf8')
  const hasUi = /^\s*ui_page\b/m.test(src)
  src.split('\n').forEach((text, i) => {
    const code = text.replace(/--.*$/, '')
    const where = `fxmanifest.lua:${i + 1}`
    const version = code.match(/^\s*fx_version\s+['"](\w+)['"]/)
    if (version && version[1] !== 'cerulean') {
      warn(where, `fx_version '${version[1]}'${hasUi ? ': the NUI may lose secure-context APIs on CEF 144' : ''}, use 'cerulean'`)
    }
    for (const [, path] of code.matchAll(/['"]([^'"]+)['"]/g)) {
      if (/(^|\/)\*(\/|$)/.test(path) && !path.endsWith('/*') && /\*\/./.test(path)) {
        warn(where, `'${path}': a single * in the middle of a path matches nothing, use **`)
      } else if (!path.includes('*') && !path.startsWith('@') && !/^https?:/.test(path) && FILE_EXT.test(path) && path !== 'fxmanifest.lua') {
        if (!existsSync(join(resourceDir, path))) warn(where, `'${path}' not found`)
      }
    }
  })
}

// A module the manifest already runs as a script and that is also `require`d runs twice: two caches, two start handlers.
if (existsSync(manifestFile)) {
  const manifest = readManifest(resourceDir)
  const listed = (rel) => ['client', 'server', 'shared'].some((side) => manifest.patterns[side].some((re) => re.test(rel)))
  const reported = new Set()
  for (const file of walk(resourceDir, [])) {
    const src = readFileSync(file, 'utf8')
    for (const match of src.matchAll(/\brequire\s*\(?\s*['"]([\w.]+)['"]/g)) {
      const rel = `${match[1].replace(/\./g, '/')}.lua`
      if (reported.has(rel) || !existsSync(join(resourceDir, rel)) || !listed(rel)) continue
      reported.add(rel)
      warn(`${show(file)}:${lineAt(src, match.index)}`, `require '${match[1]}' loads ${rel}, which the manifest also runs as a script: it runs twice; list only the entry files`)
    }
  }
}

let nativeSummary = 'natives: skipped (--no-natives)'
if (checkNatives && codeByFile.size) {
  let natives = null
  try {
    natives = await loadNatives()
  } catch (error) {
    nativeSummary = `natives: skipped (${error.message})`
  }
  if (natives) {
    const manifest = readManifest(resourceDir)
    // Every name the resource (and what it imports) defines can shadow a native or look like an unknown one.
    const defined = new Set(RUNTIME)
    for (const code of codeByFile.values()) definedNames(code, defined)
    for (const file of walk(resourceDir, [])) if (!codeByFile.has(file)) definedNames(transform(readFileSync(file, 'utf8'), 'code'), defined)
    for (const imp of manifest.imports) {
      const [res, ...rest] = imp.split('/')
      const dir = findResource(resourceDir, res)
      const path = dir && join(dir, ...rest)
      if (path && existsSync(path) && statSync(path).isFile()) definedNames(transform(readFileSync(path, 'utf8'), 'code'), defined)
    }

    const unknown = new Map()
    let calls = 0
    for (const [file, code] of codeByFile) {
      const rel = relative(resourceDir, file).replace(/\\/g, '/')
      if (TEST_DIR.test(rel)) continue
      const side = sideOf(manifest, rel)
      for (const match of code.matchAll(/(?<![\w.:])([A-Z][A-Za-z0-9]*)\s*\(/g)) {
        const name = match[1]
        if (/function\s*$/.test(code.slice(Math.max(0, match.index - 12), match.index))) continue
        if (defined.has(name) || /^N_0x/i.test(name)) continue
        calls++
        const native = natives.get(name)
        const where = `${show(file)}:${lineAt(code, match.index)}`
        if (!native) {
          // `if Name then Name()` probes for a native that may not exist on this build.
          if (new RegExp(`\\b(if|and|or|not)\\s+${name}\\b(?!\\s*\\()`).test(code)) continue
          const seen = unknown.get(name) ?? { where, count: 0 }
          seen.count++
          unknown.set(name, seen)
        } else if (side !== 'shared' && !native.sides.has(side)) {
          warn(where, `${name} is a ${[...native.sides][0]}-only native, this file runs on the ${side}`)
        }
      }
    }
    for (const [name, seen] of unknown) {
      const near = closest(name, natives.keys())
      warn(
        seen.where,
        `${name}() is not a native and not defined in this resource or its @imports${seen.count > 1 ? ` (${seen.count} calls)` : ''}${near ? `; did you mean ${near}?` : ''}`,
      )
    }
    nativeSummary = `natives: ${calls} calls checked, ${unknown.size} unknown`
  }
}

console.log(`${files.length} lua files, ${failed} failed, ${warned} warnings; ${nativeSummary}`)
process.exit(failed ? 1 : 0)
