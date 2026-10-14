#!/usr/bin/env node
// Builds the GitHub Pages site from the skills on main: one card per skill and a page per SKILL.md.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import { marked } from 'marked'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const out = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, '_site')
const REPO = 'mri-Qbox-Brasil/mri-fivem-skills'
const REPO_URL = `https://github.com/${REPO}`
const HERO = 'mri-nui-glass/assets/gta-sunset-player.webp'
const STRINGS = JSON.parse(readFileSync(join(here, 'strings.json'), 'utf8'))
const LANGS = Object.keys(STRINGS)
const t = (key) => STRINGS.en[key]
const INSTALL_WINDOWS = `git clone ${REPO_URL} "$HOME\\mri-fivem-skills"
New-Item -ItemType Directory -Force "$HOME\\.claude\\skills" | Out-Null
Get-ChildItem "$HOME\\mri-fivem-skills" -Directory | Where-Object { Test-Path "$($_.FullName)\\SKILL.md" } |
  ForEach-Object { New-Item -ItemType Junction -Path "$HOME\\.claude\\skills\\$($_.Name)" -Target $_.FullName }`
const INSTALL_UNIX = `git clone ${REPO_URL} ~/mri-fivem-skills
mkdir -p ~/.claude/skills
for d in ~/mri-fivem-skills/*/; do [ -f "$d/SKILL.md" ] && ln -s "\${d%/}" ~/.claude/skills/; done`

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// English goes in the HTML; the script at the end swaps it for the visitor's language.
const tr = (key, tag = 'span', attrs = '') => `<${tag} data-i18n="${key}"${attrs}>${t(key)}</${tag}>`

// Descriptions are double-quoted YAML (a JSON string is valid YAML); plain values pass through.
const unquote = (value) => (value.startsWith('"') ? JSON.parse(value) : value)

function parse(file) {
  const text = readFileSync(file, 'utf8').replace(/\r/g, '')
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  const fields = {}
  for (const line of (match ? match[1] : '').split('\n')) {
    const field = line.match(/^([a-z_-]+):\s*(.*)$/i)
    if (field) fields[field[1]] = unquote(field[2].trim())
  }
  return { fields, body: match ? text.slice(match[0].length) : text }
}

// The description mixes what the skill does with when to trigger it; the card shows only the headline.
function summary(description) {
  return description.split(/\s+-\s+|\.\s+Use when|\s+Use when/)[0].replace(/\.$/, '') + '.'
}

function files(dir, base = dir) {
  const list = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) list.push(...files(path, base))
    else list.push(path.slice(base.length + 1).replace(/\\/g, '/'))
  }
  return list.sort()
}

// Browser translators leave code, names and paths alone.
const noTranslate = (html) => html.replace(/<(pre|code)(?=[\s>])/g, '<$1 translate="no"').replace(/class="card-name"/g, 'class="card-name" translate="no"')

// Relative links in a SKILL.md point to files in the repo.
function absolutize(html, skill) {
  return html.replace(/href="(?!https?:|#|mailto:)([^"]+)"/g, (_, href) => `href="${REPO_URL}/blob/main/${skill}/${href}"`)
}

const skills = readdirSync(root)
  .filter((entry) => !entry.startsWith('.') && !entry.startsWith('_') && existsSync(join(root, entry, 'SKILL.md')))
  .sort()
  .map((name) => {
    const { fields, body } = parse(join(root, name, 'SKILL.md'))
    return { name, description: fields.description ?? '', body, files: files(join(root, name)).filter((f) => f !== 'SKILL.md') }
  })

const i18nScript = `<script>
(function () {
  var strings = ${JSON.stringify(STRINGS).replace(/</g, '\\u003c')};
  var langs = ${JSON.stringify(LANGS)};
  function pick() {
    try { var saved = localStorage.getItem('lang'); if (saved && strings[saved]) return saved } catch (e) {}
    var wanted = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < wanted.length; i++) {
      var code = String(wanted[i]).toLowerCase();
      for (var j = 0; j < langs.length; j++) if (code === langs[j].toLowerCase() || code.split('-')[0] === langs[j].toLowerCase().split('-')[0]) return langs[j];
    }
    return 'en';
  }
  function apply(lang) {
    var dict = strings[lang] || strings.en;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.innerHTML = dict[key] != null ? dict[key] : strings.en[key];
    });
    document.querySelectorAll('[data-lang-only]').forEach(function (el) { el.hidden = lang === 'en' });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)) });
  }
  var current = pick();
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      try { localStorage.setItem('lang', b.dataset.lang) } catch (e) {}
      current = b.dataset.lang;
      apply(current);
    });
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var source = document.getElementById(b.dataset.copy);
      var done = function () {
        var dict = strings[current] || strings.en;
        b.textContent = dict['install.copied'];
        setTimeout(function () { b.textContent = dict['install.copy'] }, 1600);
      };
      // Older or locked-down browsers refuse the async clipboard; selecting and copying still works there.
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(source);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        try { if (document.execCommand('copy')) done() } catch (e) {}
      };
      if (navigator.clipboard) navigator.clipboard.writeText(source.textContent).then(done, fallback);
      else fallback();
    });
  });
  apply(current);
})();
</script>`

function page({ title, description, depth, main }) {
  const up = depth ? '../' : ''
  const switcher = LANGS.map((lang) => `<button type="button" data-lang="${lang}" aria-pressed="${lang === 'en'}">${STRINGS[lang]['lang.short']}</button>`).join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}style.css">
</head>
<body>
<header class="bar">
  <a class="brand" href="${up}./"><span class="dot"></span>mri-fivem-skills</a>
  <nav>
    <a href="${up}./#skills" data-i18n="nav.skills">${t('nav.skills')}</a>
    <a href="${up}./#install" data-i18n="nav.install">${t('nav.install')}</a>
    <a href="${up}./#contribute" data-i18n="nav.contribute">${t('nav.contribute')}</a>
    <a href="${REPO_URL}">GitHub</a>
    <span class="lang" role="group" aria-label="Language">${switcher}</span>
  </nav>
</header>
${main}
<footer class="foot">
  <span>${tr('foot.license')} <a href="https://github.com/mri-Qbox-Brasil">MRI Brasil</a>.</span>
  <a href="${REPO_URL}">${REPO}</a>
</footer>
${i18nScript}
</body>
</html>
`
}

const cards = skills
  .map(
    (s) => `<a class="card" href="${s.name}/">
  <span class="card-name">${escape(s.name)}</span>
  <span class="card-text">${escape(summary(s.description))}</span>
  ${tr('card.more', 'span', ' class="card-more"')}
</a>`,
  )
  .join('\n')

const index = page({
  title: 'mri-fivem-skills',
  description: 'Agent skills for FiveM resource development.',
  depth: 0,
  main: `<section class="hero">
  <div class="hero-bg" style="background-image:url('hero.webp')"></div>
  <div class="hero-in">
    ${tr('hero.eyebrow', 'p', ' class="eyebrow"')}
    ${tr('hero.title', 'h1')}
    ${tr('hero.lead', 'p', ' class="lead"')}
    <div class="actions">
      <a class="btn primary" href="#install" data-i18n="hero.install">${t('hero.install')}</a>
      <a class="btn" href="${REPO_URL}" data-i18n="hero.github">${t('hero.github')}</a>
    </div>
  </div>
</section>
<main class="wrap">
  <section id="skills">
    ${tr('skills.title', 'h2')}
    <p class="note" data-lang-only hidden data-i18n="skills.note">${t('skills.note')}</p>
    <div class="grid">
${cards}
    </div>
  </section>
  <section id="install">
    ${tr('install.title', 'h2')}
    <div class="step">
      ${tr('install.agent.title', 'h3')}
      ${tr('install.agent.text', 'p')}
      <div class="prompt">
        <code id="install-prompt" data-i18n="install.prompt">${t('install.prompt')}</code>
        <button type="button" class="btn primary copy" data-copy="install-prompt" data-i18n="install.copy">${t('install.copy')}</button>
      </div>
    </div>
    <div class="step">
      ${tr('install.chat.title', 'h3')}
      ${tr('install.chat.text', 'p')}
      <div class="zips">${skills.map((s) => `<a class="btn" href="downloads/${s.name}.zip" download>${escape(s.name)}.zip</a>`).join('')}</div>
    </div>
    <details class="step">
      <summary data-i18n="install.terminal">${t('install.terminal')}</summary>
      <p class="label">Windows (PowerShell)</p>
      <pre><code>${escape(INSTALL_WINDOWS)}</code></pre>
      <p class="label">macOS / Linux</p>
      <pre><code>${escape(INSTALL_UNIX)}</code></pre>
      ${tr('install.other', 'p')}
    </details>
  </section>
  <section id="contribute">
    ${tr('contribute.title', 'h2')}
    ${tr('contribute.text', 'p')}
    <a class="btn" href="${REPO_URL}/blob/main/CONTRIBUTING.md" data-i18n="contribute.button">${t('contribute.button')}</a>
  </section>
</main>`,
})

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'index.html'), noTranslate(index))
copyFileSync(join(here, 'style.css'), join(out, 'style.css'))
copyFileSync(join(root, HERO), join(out, 'hero.webp'))
writeFileSync(join(out, '.nojekyll'), '')

// One zip per skill for the Claude app upload: the skill folder at the zip root, tracked files only.
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
mkdirSync(join(out, 'downloads'), { recursive: true })
for (const s of skills) {
  const entries = {}
  for (const file of tracked.filter((f) => f.startsWith(`${s.name}/`))) entries[file] = readFileSync(join(root, file))
  writeFileSync(join(out, 'downloads', `${s.name}.zip`), zipSync(entries, { level: 9 }))
}

for (const s of skills) {
  const extra = s.files.length
    ? `<aside class="files">${tr('doc.files', 'h2')}<ul>${s.files
        .map((f) => `<li><a href="${REPO_URL}/blob/main/${s.name}/${f}">${escape(f)}</a></li>`)
        .join('')}</ul></aside>`
    : ''
  // The SKILL.md title becomes the page heading, so the article doesn't repeat it.
  const titleMatch = s.body.match(/^\s*# (.+)\n/)
  const heading = titleMatch ? titleMatch[1].trim() : s.name
  const body = titleMatch ? s.body.slice(titleMatch[0].length) : s.body
  const html = page({
    title: `${s.name} · mri-fivem-skills`,
    description: summary(s.description),
    depth: 1,
    main: `<main class="wrap doc">
  <a class="back" href="../#skills" data-i18n="doc.back">${t('doc.back')}</a>
  <p class="eyebrow doc-name">${escape(s.name)}</p>
  <h1 class="doc-title" lang="en">${escape(heading)}</h1>
  <p class="lead">${escape(summary(s.description))}</p>
  <div class="links">
    <a class="btn primary" href="../downloads/${s.name}.zip" download data-i18n="doc.zip">${t('doc.zip')}</a>
    <a class="btn" href="${REPO_URL}/tree/main/${s.name}" data-i18n="doc.source">${t('doc.source')}</a>
  </div>
  <p class="note" data-lang-only hidden data-i18n="doc.note">${t('doc.note')}</p>
  <article class="md" lang="en">${absolutize(marked.parse(body), s.name)}</article>
  ${extra}
</main>`,
  })
  mkdirSync(join(out, s.name), { recursive: true })
  writeFileSync(join(out, s.name, 'index.html'), noTranslate(html))
}

console.log(`site: ${skills.length} skills, ${LANGS.length} languages -> ${out}`)
