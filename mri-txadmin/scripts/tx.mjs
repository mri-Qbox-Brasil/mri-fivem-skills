#!/usr/bin/env node
import { readFile, writeFile, stat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACTIONS = ['ensure', 'restart', 'start', 'stop', 'refresh', 'say', 'console', 'server-restart'];
const LOG_WAIT_MS = 4000;

function parseArgs(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`missing value for ${key}`);
      return value;
    };
    switch (key) {
      case '--config': opts.config = next(); break;
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
  if (!res.ok || !body.csrfToken) throw new Error(`login failed (${res.status}): ${JSON.stringify(body)}`);
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

async function command(cfg, session, route, payload) {
  const res = await fetch(`${cfg.url}/fxserver/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: session.cookie,
      'x-txadmin-csrftoken': session.csrf,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403 || body.logout) {
    const err = new Error('session expired');
    err.expired = true;
    throw err;
  }
  if (!res.ok || body.type === 'danger' || body.type === 'error') {
    throw new Error(`command failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

// The Live Console has no REST route: it is a socket.io room. Polling transport takes the session cookie with fetch.
async function consoleCommand(cfg, session, text) {
  const base = `${cfg.url}/socket.io/?EIO=4&transport=polling&rooms=liveconsole`;
  const headers = { Cookie: session.cookie, 'x-txadmin-csrftoken': session.csrf };
  const post = (url, body) => fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain;charset=UTF-8' }, body });

  const open = await (await fetch(base, { headers })).text();
  if (!open.startsWith('0')) {
    const err = new Error('session expired');
    err.expired = true;
    throw err;
  }
  const url = `${base}&sid=${JSON.parse(open.slice(1)).sid}`;
  await post(url, '40');
  const joined = await (await fetch(url, { headers })).text();
  if (!joined.includes('40{')) throw new Error(`live console refused the session: ${joined.slice(0, 120)}`);
  const sent = await post(url, '42' + JSON.stringify(['consoleCommand', text]));
  if (!sent.ok) throw new Error(`console command failed (${sent.status})`);
  await post(url, '41').catch(() => {});
  return { msg: `console: ${text}` };
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
  const configPath = opts.config ?? join(root, 'config.json');
  const raw = await readFile(configPath, 'utf8').catch(() => null);
  if (!raw) throw new Error(`missing ${configPath}: copy config.example.json and fill it in`);
  const cfg = JSON.parse(raw);
  if (opts.url) cfg.url = opts.url;
  if (opts.base) cfg.base = opts.base;
  if (opts.profile) cfg.profile = opts.profile;

  const [action, ...rest] = opts.positional;
  if (!ACTIONS.includes(action)) {
    throw new Error(`usage: node scripts/tx.mjs <${ACTIONS.join('|')}> [resource | message] [--config file]`);
  }
  // say and console take one text; resource actions take one or more resources, all on the same login.
  const single = action === 'say' || action === 'console';
  const bare = action === 'refresh' || action === 'server-restart';
  const parameters = single ? [rest.join(' ')] : bare ? [''] : rest;
  if (!bare && !parameters.filter(Boolean).length) throw new Error(`${action} needs a ${single ? 'text' : 'resource'}`);

  const txAction = action === 'say' ? 'admin_broadcast' : `${action}_res`;
  const send = (session, parameter) => {
    if (action === 'console') return consoleCommand(cfg, session, parameter);
    if (action === 'server-restart') return command(cfg, session, 'controls', { action: 'restart' });
    return command(cfg, session, 'commands', { action: txAction, parameter });
  };
  const logPath = join(cfg.base, 'txData', cfg.profile, 'logs', 'fxserver.log');
  const offset = await stat(logPath).then((s) => s.size).catch(() => null);

  let session = await cachedSession(cfg);
  for (const parameter of parameters) {
    let result;
    try {
      result = await send(session, parameter);
    } catch (err) {
      if (!err.expired) throw err;
      session = await login(cfg);
      await writeFile(sessionFile(cfg), JSON.stringify(session)).catch(() => {});
      result = await send(session, parameter);
    }
    console.log(`txAdmin: ${result.msg ?? JSON.stringify(result)}`);
    if (parameters.length > 1) await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (opts.noLog || offset === null) return;
  await new Promise((resolve) => setTimeout(resolve, LOG_WAIT_MS));
  const lines = (await readFrom(logPath, offset)).split(/\r?\n/).filter(Boolean);
  console.log(`--- fxserver.log (${lines.length} new lines) ---`);
  for (const line of lines.slice(-60)) console.log(line);
  // dependents stopped with the resource do not come back by themselves
  const started = new Set(lines.map((l) => l.match(/Started resource (\S+)/)?.[1]).filter(Boolean));
  const left = [...new Set(lines.map((l) => l.match(/Stopping resource (\S+)/)?.[1]).filter(Boolean))].filter((r) => !started.has(r));
  if (left.length) console.log(`!!! stopped and not started again: ${left.join(', ')}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
