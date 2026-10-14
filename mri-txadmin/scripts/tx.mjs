#!/usr/bin/env node
import { readFile, writeFile, stat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTIONS = ['ensure', 'restart', 'start', 'stop', 'refresh', 'say'];
const LOG_WAIT_MS = 4000;

function parseArgs(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`faltou valor para ${key}`);
      return value;
    };
    switch (key) {
      case '--url': opts.url = next(); break;
      case '--base': opts.base = next(); break;
      case '--profile': opts.profile = next(); break;
      case '--no-log': opts.noLog = true; break;
      default: opts.positional.push(key);
    }
  }
  return opts;
}

async function login(cfg) {
  const res = await fetch(`${cfg.url}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.csrfToken) throw new Error(`login falhou (${res.status}): ${JSON.stringify(body)}`);
  const cookie = (res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')])
    .filter(Boolean)
    .map((c) => c.split(';')[0])
    .join('; ');
  return { cookie, csrf: body.csrfToken };
}

// txAdmin blocks the login for 15 min after ~10 attempts, so the session is reused between runs.
function sessionFile(cfg) {
  return join(tmpdir(), `mri-txadmin-${cfg.url.replace(/\W+/g, '_')}.json`);
}

async function cachedSession(cfg) {
  const saved = await readFile(sessionFile(cfg), 'utf8').then(JSON.parse).catch(() => null);
  if (saved?.cookie && saved?.csrf) return saved;
  const fresh = await login(cfg);
  await writeFile(sessionFile(cfg), JSON.stringify(fresh)).catch(() => {});
  return fresh;
}

async function command(cfg, session, action, parameter) {
  const res = await fetch(`${cfg.url}/fxserver/commands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: session.cookie,
      'x-txadmin-csrftoken': session.csrf,
    },
    body: JSON.stringify({ action, parameter }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403 || body.logout) {
    const err = new Error('sessão expirada');
    err.expired = true;
    throw err;
  }
  if (!res.ok || body.type === 'danger' || body.type === 'error') {
    throw new Error(`comando falhou (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function readFrom(path, offset) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const length = Math.max(0, size - offset);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, offset);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = await readFile(join(root, 'config.json'), 'utf8').catch(() => null);
  if (!raw) throw new Error('falta o config.json: copie o config.example.json e preencha');
  const cfg = JSON.parse(raw);
  if (opts.url) cfg.url = opts.url;
  if (opts.base) cfg.base = opts.base;
  if (opts.profile) cfg.profile = opts.profile;

  const [action, ...rest] = opts.positional;
  if (!ACTIONS.includes(action)) {
    throw new Error(`uso: node scripts/tx.mjs <${ACTIONS.join('|')}> [resource | mensagem]`);
  }
  // say takes one message; resource actions take one or more resources, all on the same login.
  const parameters = action === 'say' ? [rest.join(' ')] : action === 'refresh' ? [''] : rest;
  if (action !== 'refresh' && !parameters.filter(Boolean).length) throw new Error(`${action} precisa de ${action === 'say' ? 'mensagem' : 'resource'}`);

  const txAction = action === 'say' ? 'admin_broadcast' : `${action}_res`;
  const logPath = join(cfg.base, 'txData', cfg.profile, 'logs', 'fxserver.log');
  const offset = await stat(logPath).then((s) => s.size).catch(() => null);

  let session = await cachedSession(cfg);
  for (const parameter of parameters) {
    let result;
    try {
      result = await command(cfg, session, txAction, parameter);
    } catch (err) {
      if (!err.expired) throw err;
      session = await login(cfg);
      await writeFile(sessionFile(cfg), JSON.stringify(session)).catch(() => {});
      result = await command(cfg, session, txAction, parameter);
    }
    console.log(`txAdmin: ${result.msg ?? JSON.stringify(result)}`);
    if (parameters.length > 1) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (opts.noLog || offset === null) return;
  await new Promise((resolve) => setTimeout(resolve, LOG_WAIT_MS));
  const lines = (await readFrom(logPath, offset)).split(/\r?\n/).filter(Boolean);
  console.log(`--- fxserver.log (${lines.length} linhas novas) ---`);
  for (const line of lines.slice(-60)) console.log(line);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
