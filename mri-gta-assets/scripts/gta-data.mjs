#!/usr/bin/env node
// Real GTA V names from the DurtyFree gta-v-data-dumps (sounds, animations, props...), cached for a month. Data only.
// Usage: node gta-data.mjs <category> <words...> [--all]    node gta-data.mjs list
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master/'
const CACHE_DIR = join(tmpdir(), 'mri-fivem-data')
const MAX_AGE_MS = 30 * 24 * 3600 * 1000

// group: [name key, list key] for dictionaries of clips or effects.
const CATEGORIES = {
  sounds: { file: 'soundNames.json', what: 'PlaySoundFrontend name and soundset', fields: ['AudioName', 'AudioRef'] },
  anims: { file: 'animDictsCompact.json', what: 'TaskPlayAnim dictionary and clips', group: ['DictionaryName', 'Animations'] },
  scenarios: { file: 'scenariosCompact.json', what: 'TaskStartScenarioInPlace names' },
  props: { file: 'ObjectList.ini', what: 'object models' },
  peds: { file: 'PedList.ini', what: 'ped models and hashes' },
  vehicles: { file: 'VehicleList.ini', what: 'vehicle models' },
  weapons: { file: 'WeaponList.ini', what: 'weapon names and hashes' },
  particles: { file: 'particleEffectsCompact.json', what: 'ptfx asset and effect names', group: ['DictionaryName', 'EffectNames'] },
  clipsets: { file: 'movementClipsetsCompact.json', what: 'movement clipsets', group: ['Name', 'Clips'] },
  walkstyles: { file: 'movementClipsetsWalkingCompact.json', what: 'walking styles (SetPedMovementClipset)', group: ['Name', 'Clips'] },
  timecycles: { file: 'timecycleModifiers.json', what: 'SetTimecycleModifier names', fields: ['Name', 'DlcName'] },
  postfx: { file: 'animPostFxNamesCompact.json', what: 'AnimpostfxPlay names' },
  camshakes: { file: 'camShakeTypesCompact.json', what: 'ShakeGameplayCam names' },
  explosions: { file: 'explosionTypesCompact.json', what: 'explosion types' },
  interiors: { file: 'mloInteriors.json', what: 'MLO interiors', fields: ['Name', 'DlcName'] },
  ipls: { file: 'ipls.json', what: 'IPL names', fields: ['Name', 'DlcName'] },
  zones: { file: 'zones.json', what: 'map zone names', fields: ['Name', 'DisplayName'] },
  radio: { file: 'radioStations.json', what: 'radio stations', pick: (r) => `${r.RadioName}  ${r.TranslatedLabel?.English ?? ''}` },
  speech: { file: 'speeches.json', what: 'PlayPedAmbientSpeech voice and lines', group: ['Name', 'Speeches'], each: (s) => s.Name },
}

async function load(file) {
  const path = join(CACHE_DIR, `gta-${file}`)
  const fresh = existsSync(path) && Date.now() - statSync(path).mtimeMs < MAX_AGE_MS
  if (!fresh) {
    try {
      const res = await fetch(BASE + file)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(path, await res.text())
    } catch (error) {
      if (!existsSync(path)) throw new Error(`could not download ${file}: ${error.message}`)
    }
  }
  const text = readFileSync(path, 'utf8')
  return file.endsWith('.json') ? JSON.parse(text) : text.split(/\r?\n/).filter(Boolean)
}

const args = process.argv.slice(2)
const all = args.includes('--all')
const [category, ...words] = args.filter((a) => !a.startsWith('--'))
const spec = CATEGORIES[category]
if (!spec) {
  console.log('usage: node gta-data.mjs <category> <words...> [--all]\n')
  for (const [name, c] of Object.entries(CATEGORIES)) console.log(`  ${name.padEnd(11)} ${c.what}`)
  process.exit(category && category !== 'list' ? 2 : 0)
}

const terms = words.map((w) => w.toLowerCase())
const hit = (text) => terms.every((t) => text.toLowerCase().includes(t))
const data = await load(spec.file)
const lines = []

for (const item of data) {
  if (spec.group) {
    const [nameKey, listKey] = spec.group
    const name = item[nameKey]
    const list = [...new Set((item[listKey] ?? []).map(spec.each ?? ((x) => x)))]
    if (hit(name)) lines.push(`${name}  ${list.slice(0, 12).join(' ')}${list.length > 12 ? ` (+${list.length - 12})` : ''}`)
    else {
      const clips = list.filter((clip) => hit(`${name} ${clip}`))
      if (clips.length) lines.push(`${name}  ${clips.slice(0, 12).join(' ')}${clips.length > 12 ? ` (+${clips.length - 12})` : ''}`)
    }
  } else if (typeof item === 'string') {
    if (hit(item)) lines.push(item)
  } else {
    const text = spec.pick ? spec.pick(item) : spec.fields ? spec.fields.map((f) => item[f]).filter(Boolean).join('  ') : JSON.stringify(item)
    if (hit(text)) lines.push(text.length > 200 ? `${text.slice(0, 200)}...` : text)
  }
}

const shown = all ? lines : lines.slice(0, 40)
for (const line of shown) console.log(line)
console.log(`${lines.length} match${lines.length === 1 ? '' : 'es'}${shown.length < lines.length ? `, showing ${shown.length} (--all for every one, or add words)` : ''}`)
