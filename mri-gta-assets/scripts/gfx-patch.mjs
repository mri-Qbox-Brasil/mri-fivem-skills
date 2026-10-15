#!/usr/bin/env node
// Decompiles and recompiles Scaleform .gfx files with JPEXS FFDec, importing only the changed AS2 classes.
//   node gfx-patch.mjs export <file.gfx> <outDir>
//   node gfx-patch.mjs build <original.gfx> <scriptsDir> <out.gfx>
// FFDec: --ffdec <ffdec.jar> or the FFDEC_JAR variable. Needs Java 8+.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const args = process.argv.slice(2)
const flag = args.indexOf('--ffdec')
const jar = flag >= 0 ? args.splice(flag, 2)[1] : process.env.FFDEC_JAR
const [command, ...rest] = args

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!jar || !existsSync(jar)) fail('FFDec not found: pass --ffdec <ffdec.jar> or set FFDEC_JAR (https://github.com/jindrapetrik/jpexs-decompiler/releases)')

// FFDec reads [ and ] in paths as patterns, so every file goes through a plain temp folder.
const work = mkdtempSync(join(tmpdir(), 'gfx-patch-'))
process.on('exit', () => rmSync(work, { recursive: true, force: true }))

function ffdec(...params) {
  const run = spawnSync('java', ['-jar', jar, ...params], { encoding: 'utf8' })
  if (run.status !== 0) fail(`ffdec ${params[0]} failed:\n${run.stdout}\n${run.stderr}`)
  return run.stdout
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.as') ? [path] : []
  })
}

function exportScripts(gfx, outDir) {
  const input = join(work, 'in.gfx')
  copyFileSync(gfx, input)
  ffdec('-export', 'script', outDir, input)
}

// AS2 keeps `this` in register 1, and FFDec compiles a local named _loc1_ into that same register.
function lint(file) {
  const problems = []
  const text = readFileSync(file, 'utf8')
  for (const body of text.split(/\n\s*function /).slice(1)) {
    const name = body.match(/^(?:get |set )?(\w+)/)?.[1]
    if (/\b_loc1_\b/.test(body) && /\bthis\b/.test(body)) problems.push(`${name}: _loc1_ next to this; rename the local`)
  }
  return problems
}

if (command === 'export') {
  const [gfx, outDir] = rest
  if (!gfx || !outDir) fail('usage: export <file.gfx> <outDir>')
  exportScripts(gfx, outDir)
  console.log(`scripts exported to ${outDir}`)
} else if (command === 'build') {
  const [base, scripts, out] = rest
  if (!base || !scripts || !out) fail('usage: build <original.gfx> <scriptsDir> <out.gfx>')
  const sources = walk(scripts)
  if (!sources.length) fail(`no .as files under ${scripts}`)

  const problems = sources.flatMap((file) => lint(file).map((p) => `${relative(scripts, file)}: ${p}`))
  if (problems.length) fail(`fix before building:\n${problems.join('\n')}`)

  const input = join(work, 'base.gfx')
  const output = join(work, 'out.gfx')
  copyFileSync(base, input)
  ffdec('-importScript', input, output, scripts)

  // Decompile the result: every class must come back with its functions and no register clash.
  const check = join(work, 'check')
  ffdec('-export', 'script', check, output)
  const errors = []
  for (const file of sources) {
    const rel = relative(scripts, file)
    const back = join(check, rel.replace(/^scripts[\\/]/, 'scripts/'))
    if (!existsSync(back)) { errors.push(`${rel}: missing after build`); continue }
    const built = readFileSync(back, 'utf8')
    if (/\bthis\s*=[^=]/.test(built)) errors.push(`${rel}: compiled with an assignment to this (register clash)`)
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/function (?:get |set )?(\w+)\(/g)) {
      if (!new RegExp(`function (?:get |set )?${name}\\(`).test(built)) errors.push(`${rel}: ${name} missing after build`)
    }
  }
  if (errors.length) fail(`build check failed:\n${errors.join('\n')}`)

  // Write next to the target and rename, so a stream folder never holds a half written file.
  const temp = `${out}.tmp`
  copyFileSync(output, temp)
  renameSync(temp, out)
  console.log(`${out}: ${statSync(out).size} bytes, ${sources.length} classes checked`)
} else {
  fail('usage: gfx-patch.mjs export <file.gfx> <outDir> | build <original.gfx> <scriptsDir> <out.gfx> [--ffdec <ffdec.jar>]')
}
