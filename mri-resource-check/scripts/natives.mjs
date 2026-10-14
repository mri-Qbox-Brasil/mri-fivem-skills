#!/usr/bin/env node
// FiveM natives from the official Cfx lists (static.cfx.re), cached for a week. Data only, no code is downloaded.
// Usage: node natives.mjs <name or words...> [--all]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCES = {
  gta: 'https://static.cfx.re/natives/natives.json',
  cfx: 'https://static.cfx.re/natives/natives_cfx.json',
}
const CACHE_DIR = join(tmpdir(), 'mri-fivem-data')
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

async function fetchCached(key, url) {
  const file = join(CACHE_DIR, `natives-${key}.json`)
  const fresh = existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS
  if (!fresh) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      JSON.parse(text)
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(file, text)
    } catch (error) {
      // Offline: a stale cache is still better than nothing.
      if (!existsSync(file)) throw new Error(`could not download ${url}: ${error.message}`)
    }
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}

// SET_ENTITY_HEADING -> SetEntityHeading, the name the Lua runtime exposes.
export const toLua = (name) =>
  name
    .replace(/^_/, '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')

/** Map of Lua name -> { name, lua, hash, ns, sides: Set<'client'|'server'>, params, results, description, alias } */
export async function loadNatives() {
  const [gta, cfx] = await Promise.all([fetchCached('gta', SOURCES.gta), fetchCached('cfx', SOURCES.cfx)])
  const index = new Map()
  const add = (native, sides) => {
    if (!native.name) return
    const lua = toLua(native.name)
    const entry = index.get(lua) ?? { ...native, lua, sides: new Set() }
    for (const side of sides) entry.sides.add(side)
    index.set(lua, entry)
    for (const alias of native.aliases ?? []) {
      if (alias.startsWith('0x')) continue
      const aliasLua = toLua(alias)
      if (!index.has(aliasLua)) index.set(aliasLua, { ...entry, alias: lua, lua: aliasLua })
      for (const side of sides) index.get(aliasLua).sides.add(side)
    }
  }
  for (const ns in gta) for (const hash in gta[ns]) add(gta[ns][hash], ['client'])
  for (const ns in cfx) {
    for (const hash in cfx[ns]) {
      const native = cfx[ns][hash]
      add(native, native.apiset === 'shared' ? ['client', 'server'] : [native.apiset === 'server' ? 'server' : 'client'])
    }
  }
  return index
}

const describe = (n) => {
  const params = n.params.map((p) => `${p.name}: ${p.type}`).join(', ')
  const sides = [...n.sides].sort().join(' + ')
  const text = (n.description || '').replace(/\s+/g, ' ').trim()
  return [
    `${n.lua}(${params}) -> ${n.results}   [${sides}]${n.alias ? `  old name of ${n.alias}` : ''}`,
    `  ${n.name} ${n.hash}  https://docs.fivem.net/natives/?_${n.hash}`,
    text ? `  ${text.length > 220 ? `${text.slice(0, 220)}...` : text}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const all = args.includes('--all')
  const words = args.filter((a) => !a.startsWith('--')).map((w) => w.toLowerCase().replace(/_/g, ''))
  if (!words.length) {
    console.log('usage: node natives.mjs <name or words...> [--all]')
    process.exit(2)
  }
  const index = await loadNatives()
  const exact = index.get(toLua(args.find((a) => !a.startsWith('--'))))
  const matches = exact && words.length === 1 ? [exact] : [...index.values()].filter((n) => words.every((w) => n.lua.toLowerCase().includes(w)))
  const shown = all ? matches : matches.slice(0, 25)
  for (const n of shown) console.log(describe(n))
  console.log(`${matches.length} match${matches.length === 1 ? '' : 'es'}${shown.length < matches.length ? `, showing ${shown.length} (--all for every one)` : ''}`)
}
