#!/usr/bin/env node
// Checks every skill folder: frontmatter, README listing, self-contained scripts, no secrets, sane sizes.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME = 64
const MAX_DESCRIPTION = 1024
const MAX_SKILL_LINES = 200
const MAX_FILE_BYTES = 5 * 1024 * 1024
const TEXT = /\.(md|mjs|js|cjs|ts|tsx|lua|json|ps1|sh|py|txt|ya?ml)$/i
const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS key'],
  [/\bsk-(ant-)?[A-Za-z0-9_-]{20,}/, 'API key'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i, 'Discord webhook'],
  [/[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}/, 'Discord bot token'],
  [/"password"\s*:\s*"[^"]+"/i, 'password value'],
]

const errors = []
const fail = (file, message) => errors.push(`${relative(root, file) || file}: ${message}`)

// Only tracked (or staged) files: local ignored ones like mri-txadmin/config.json never ship.
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

function frontmatter(text) {
  const match = text.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  const fields = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z_-]+):\s*(.*)$/i)
    if (!field) continue
    const value = field[2].trim()
    if (value.startsWith('"')) {
      try {
        fields[field[1]] = JSON.parse(value)
      } catch {
        fields[field[1]] = value
        fields.yamlError = `${field[1]}: broken double-quoted string (escape " and \\ inside)`
      }
    } else {
      fields[field[1]] = value
      // Strict YAML (GitHub, skill uploads) reads ": " or " #" in a plain value as a new key or a comment.
      if (/: | #/.test(value)) fields.yamlError = `${field[1]}: wrap the value in double quotes, it has ": " or " #"`
    }
  }
  return fields
}

const readme = readFileSync(join(root, 'README.md'), 'utf8')
const skills = [...new Set(tracked.filter((file) => file.includes('/') && !file.startsWith('.')).map((file) => file.split('/')[0]))]

for (const skill of skills) {
  const dir = join(root, skill)
  const skillFile = join(dir, 'SKILL.md')
  let text
  try {
    text = readFileSync(skillFile, 'utf8')
  } catch {
    fail(dir, 'top-level folders are skills and need a SKILL.md')
    continue
  }

  const fields = frontmatter(text)
  if (!fields) fail(skillFile, 'missing frontmatter (--- name / description ---)')
  else {
    if (fields.yamlError) fail(skillFile, fields.yamlError)
    if (fields.name !== skill) fail(skillFile, `name "${fields.name}" must match the folder "${skill}"`)
    if (!NAME.test(skill) || skill.length > MAX_NAME) fail(dir, `folder name must be lowercase kebab-case, up to ${MAX_NAME} characters`)
    if (!fields.description) fail(skillFile, 'missing description')
    else if (fields.description.length > MAX_DESCRIPTION) fail(skillFile, `description has ${fields.description.length} characters, max ${MAX_DESCRIPTION}`)
  }
  const lines = text.split('\n').length
  if (lines > MAX_SKILL_LINES) fail(skillFile, `${lines} lines, keep it under ${MAX_SKILL_LINES} and move details to references/`)
  if (!readme.includes(`](${skill})`)) fail(join(root, 'README.md'), `add "${skill}" to the skills table`)

  for (const file of tracked.filter((f) => f.startsWith(`${skill}/`)).map((f) => join(root, f))) {
    if (statSync(file).size > MAX_FILE_BYTES) fail(file, 'file larger than 5 MB')
    if (!TEXT.test(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const [pattern, label] of SECRETS) if (pattern.test(content)) fail(file, `looks like a ${label}`)
    // Skills get copied alone, so scripts can't reach outside their own folder.
    if (/\.(mjs|js|cjs|ts|tsx)$/.test(file) && /(from\s+|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\//.test(content)) {
      fail(file, 'imports from outside the skill folder; keep a copy inside the skill')
    }
  }
}

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join('\n'))
  process.exit(1)
}
console.log(`${skills.length} skills ok`)
