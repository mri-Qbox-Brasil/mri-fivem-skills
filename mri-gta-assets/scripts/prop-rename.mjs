#!/usr/bin/env node
// Renames streamed props: swaps the joaat hashes inside .ytyp/.ymf and renames the files to match.
//   node prop-rename.mjs <streamDir> <map.json>                       # dry run, prints the hits
//   node prop-rename.mjs <streamDir> <map.json> --backup <dir> --apply
// map.json: { "old_name": "new_name", ... } covering models, texture dictionaries and .ytyp/.ymf names.
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const backupAt = args.indexOf('--backup')
const backupDir = backupAt >= 0 ? args[backupAt + 1] : null
const [streamDir, mapFile] = args.filter((a, i) => !a.startsWith('--') && (backupAt < 0 || i !== backupAt + 1))

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!streamDir || !mapFile) fail('usage: prop-rename.mjs <streamDir> <map.json> [--backup <dir> --apply]')
if (apply && !backupDir) fail('--apply needs --backup <dir> outside the resources folder')

const joaat = (text) => {
  let h = 0
  for (const c of Buffer.from(text.toLowerCase())) {
    h = (h + c) >>> 0
    h = (h + (h << 10)) >>> 0
    h = (h ^ (h >>> 6)) >>> 0
  }
  h = (h + (h << 3)) >>> 0
  h = (h ^ (h >>> 11)) >>> 0
  return (h + (h << 15)) >>> 0
}

const renames = Object.fromEntries(Object.entries(JSON.parse(readFileSync(mapFile, 'utf8'))).map(([o, n]) => [o.toLowerCase(), n.toLowerCase()]))
const byHash = new Map(Object.entries(renames).map(([o, n]) => [joaat(o), [o, n]]))
const files = readdirSync(streamDir, { recursive: true }).map((f) => join(streamDir, f)).filter((f) => statSync(f).isFile())

const taken = new Set(files.map((f) => basename(f, extname(f)).toLowerCase()))
for (const target of Object.values(renames)) if (taken.has(target) && !renames[target]) fail(`target name already exists: ${target}`)

if (apply) {
  if (existsSync(backupDir)) fail(`backup folder already exists, pick a new one: ${backupDir}`)
  cpSync(streamDir, backupDir, { recursive: true })
  console.log('backup:', backupDir)
}

for (const file of files) {
  if (!['.ytyp', '.ymf'].includes(extname(file))) continue
  const raw = readFileSync(file)
  const isRsc = raw.toString('ascii', 0, 4) === 'RSC7'
  const data = isRsc ? inflateRawSync(raw.subarray(16)) : Buffer.from(raw)
  const hits = {}
  // Archetype name, asset name and txd are stored as u32 LE hashes; a .ymf (PSO) is big-endian.
  for (let i = 0; i + 4 <= data.length; i++) {
    const hit = byHash.get(data.readUInt32LE(i))
    if (!hit) continue
    hits[hit[0]] = (hits[hit[0]] || 0) + 1
    if (apply) data.writeUInt32LE(joaat(hit[1]), i)
  }
  console.log(`${relative(streamDir, file)} ${isRsc ? 'RSC7 v' + raw.readUInt32LE(4) : 'raw'} hits ${JSON.stringify(hits)}`)
  if (!apply) continue
  const out = isRsc ? Buffer.concat([raw.subarray(0, 16), deflateRawSync(data, { level: 9 })]) : data
  if (isRsc && Buffer.compare(inflateRawSync(out.subarray(16)), data) !== 0) fail(`re-read mismatch: ${file}`)
  writeFileSync(file + '.tmp', out)
  renameSync(file + '.tmp', file)
}

for (const file of files) {
  const target = renames[basename(file, extname(file)).toLowerCase()]
  if (!target) {
    console.log('kept name:', relative(streamDir, file))
    continue
  }
  const dest = join(dirname(file), target + extname(file))
  if (apply) renameSync(file, dest)
  console.log(`${apply ? 'renamed' : 'would rename'}: ${relative(streamDir, file)} -> ${relative(streamDir, dest)}`)
}
