/**
 * my-dsh-ui — Host half of the UI sub-plugin container.
 *
 * Responsibilities (all effects owned by the plugin's Context):
 *   1. discover sub-plugins in `<package>/subplugins` (bundled) and
 *      `$DSH_HOME/my-dsh-ui/subplugins` (user-installed, wins on id collision);
 *   2. persist enable/disable state in `$DSH_HOME/my-dsh-ui/state.json`;
 *   3. mount the *Host* half of every enabled sub-plugin in a disposable scope,
 *      unmount it again when the sub-plugin is disabled or removed;
 *   4. expose a small authenticated same-origin JSON bridge that the Client half
 *      uses to read and mutate that state (GET/POST `<API_PATH>`).
 *
 * A sub-plugin is a directory:
 *   subplugin.json   { "id", "title": {"zh","en"}, "description": {...},
 *                      "version", "defaultEnabled", "author", "homepage" }
 *   client.js        UI half, mounted by the Client half (bundled builds only)
 *   index.js         optional Host half: `export function apply(api, config)`
 */
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const name = 'my-dsh-ui';
/** Both services are optional: the container still works (Client-only state) without them. */
export const inject = [];

const VERSION = '0.1.0';
const API_PATH = '/my-dsh-ui/api';
const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Harness home; mirrors the environment the desktop app launches plugins with. */
function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

function dataDir() {
  return join(dshHome(), 'my-dsh-ui');
}

function statePath() {
  return join(dataDir(), 'state.json');
}

function bundledPluginsDir() {
  return join(PACKAGE_DIR, 'subplugins');
}

function userPluginsDir() {
  return join(dataDir(), 'subplugins');
}

/** Read a JSON file, tolerating absence and malformed content. */
async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Directory names only; a missing directory is an empty list, not an error. */
async function listDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

function normalizeTitle(value, fallback) {
  if (typeof value === 'string' && value.trim() !== '') return { zh: value, en: value };
  if (value && typeof value === 'object') {
    const zh = typeof value.zh === 'string' && value.zh.trim() !== '' ? value.zh : fallback;
    const en = typeof value.en === 'string' && value.en.trim() !== '' ? value.en : zh;
    return { zh, en };
  }
  return { zh: fallback, en: fallback };
}

/**
 * Build a minimal Context-like scope for one sub-plugin Host half.
 * Every registration it makes is collected so disabling the sub-plugin removes it
 * without unloading the container.
 */
function createSubScope(ctx, plugin, log) {
  const disposers = [];
  const track = (disposer) => {
    if (typeof disposer === 'function') disposers.push(disposer);
    return disposer;
  };
  const scope = {
    plugin: { id: plugin.id, version: plugin.version, dir: plugin.dir, source: plugin.source },
    dataDir: join(dataDir(), 'subplugins', plugin.id),
    get: (serviceName) => ctx.get(serviceName),
    on: (eventName, listener) => track(ctx.on(eventName, listener)),
    effect: (callback, label) => track(ctx.effect(callback, label ?? `my-dsh-ui/${plugin.id}`)),
    logger: (scopeName) => (typeof ctx.logger === 'function' ? ctx.logger(`my-dsh-ui/${scopeName ?? plugin.id}`) : console),
  };
  return {
    scope,
    dispose() {
      for (const disposer of disposers.reverse()) {
        try {
          disposer();
        } catch (error) {
          log(`sub-plugin ${plugin.id} cleanup failed:`, error?.message ?? error);
        }
      }
      disposers.length = 0;
    },
  };
}

export function apply(ctx) {
  const log = (...args) => console.log('[my-dsh-ui]', ...args);
  const mounted = new Map();
  let state = { enabled: {} };
  let queue = Promise.resolve();

  async function loadState() {
    const stored = await readJson(statePath());
    if (stored && typeof stored === 'object' && stored.enabled && typeof stored.enabled === 'object') {
      state = { enabled: { ...stored.enabled } };
    }
  }

  async function persist() {
    await mkdir(dataDir(), { recursive: true });
    await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`);
  }

  function isEnabled(plugin) {
    const stored = state.enabled[plugin.id];
    if (typeof stored === 'boolean') return stored;
    return plugin.defaultEnabled !== false;
  }

  async function discover() {
    const found = [];
    for (const [source, root] of [
      ['bundled', bundledPluginsDir()],
      ['user', userPluginsDir()],
    ]) {
      for (const entry of await listDirs(root)) {
        const dir = join(root, entry);
        const manifest = await readJson(join(dir, 'subplugin.json'));
        if (!manifest || typeof manifest !== 'object') continue;
        const id = typeof manifest.id === 'string' && manifest.id !== '' ? manifest.id : entry;
        found.push({
          id,
          source,
          dir,
          version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
          defaultEnabled: manifest.defaultEnabled !== false,
          title: normalizeTitle(manifest.title, id),
          description: normalizeTitle(manifest.description, ''),
          author: typeof manifest.author === 'string' ? manifest.author : undefined,
          homepage: typeof manifest.homepage === 'string' ? manifest.homepage : undefined,
          dirName: entry,
        });
      }
    }
    const byId = new Map();
    for (const plugin of found) {
      const previous = byId.get(plugin.id);
      if (!previous || plugin.source === 'user') byId.set(plugin.id, plugin);
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  function describe(plugins) {
    return plugins.map((plugin) => ({
      id: plugin.id,
      title: plugin.title,
      description: plugin.description,
      version: plugin.version,
      source: plugin.source,
      author: plugin.author,
      homepage: plugin.homepage,
      enabled: isEnabled(plugin),
      hasHostHalf: existsSync(join(plugin.dir, 'index.js')),
    }));
  }

  async function mountHostHalf(plugin) {
    resetHostHalf(plugin.id);
    const entry = join(plugin.dir, 'index.js');
    if (!existsSync(entry)) return;
    try {
      const module = await import(pathToFileURL(entry).href);
      const applyHost = typeof module.apply === 'function' ? module.apply : module.default?.apply;
      if (typeof applyHost !== 'function') {
        log(`sub-plugin ${plugin.id} has index.js but no apply export; skipped`);
        return;
      }
      const sub = createSubScope(ctx, plugin, log);
      const config = (await readJson(join(plugin.dir, 'config.json'))) ?? {};
      mounted.set(plugin.id, sub);
      await applyHost(sub.scope, config);
    } catch (error) {
      mounted.get(plugin.id)?.dispose();
      mounted.delete(plugin.id);
      log(`sub-plugin ${plugin.id} host half failed:`, error?.message ?? error);
    }
  }

  function resetHostHalf(id) {
    const existing = mounted.get(id);
    if (!existing) return;
    existing.dispose();
    mounted.delete(id);
  }

  async function syncHostHalves(plugins) {
    for (const plugin of plugins) {
      if (isEnabled(plugin)) {
        if (!mounted.has(plugin.id)) await mountHostHalf(plugin);
      } else if (mounted.has(plugin.id)) {
        resetHostHalf(plugin.id);
      }
    }
    // Drop host halves whose directory disappeared (removed sub-plugin).
    const ids = new Set(plugins.map((plugin) => plugin.id));
    for (const id of [...mounted.keys()]) if (!ids.has(id)) resetHostHalf(id);
  }

  /** Serialize discovery/mutation so overlapping toggles cannot interleave mounts. */
  function enqueue(operation) {
    const run = queue.then(operation, operation);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function bootstrap() {
    return enqueue(async () => {
      await loadState();
      await syncHostHalves(await discover());
    });
  }

  ctx.effect(() => {
    let disposed = false;
    bootstrap().catch((error) => log('startup failed:', error?.message ?? error));
    return () => {
      disposed = true;
      for (const id of [...mounted.keys()]) resetHostHalf(id);
      void disposed;
    };
  }, 'my-dsh-ui: sub-plugin host halves');

  ctx.inject(['webServer', 'connection'], (http) => {
    const server = http.webServer;
    const connection = http.connection;

    const handler = async (req, res) => {
      if (typeof connection?.authorizeIndex === 'function' && !connection.authorizeIndex(req, res)) return;
      const reply = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      try {
        if (req.method === 'GET') {
          const plugins = await discover();
          reply(200, {
            version: VERSION,
            dataDir: dataDir(),
            state: state.enabled,
            subplugins: describe(plugins),
          });
          return;
        }
        if (req.method !== 'POST') {
          reply(405, { error: 'method not allowed' });
          return;
        }
        const origin = req.headers.origin;
        if (origin && origin !== server.getOrigin()) {
          reply(403, { error: 'origin rejected' });
          return;
        }
        let text = '';
        for await (const chunk of req) {
          text += chunk;
          if (Buffer.byteLength(text) > 8192) throw new Error('payload too large');
        }
        const body = JSON.parse(text || '{}');
        const plugins = await discover();
        const target = plugins.find((plugin) => plugin.id === body.id);
        if (!target) {
          reply(404, { error: 'unknown sub-plugin' });
          return;
        }
        if (body.action === 'setEnabled') {
          state.enabled[target.id] = body.enabled !== false;
          await persist();
          await enqueue(() => syncHostHalves(plugins));
        } else if (body.action === 'remove') {
          if (target.source !== 'user') {
            reply(400, { error: 'bundled sub-plugin cannot be removed; disable it instead' });
            return;
          }
          resetHostHalf(target.id);
          await rm(target.dir, { recursive: true, force: true });
          delete state.enabled[target.id];
          await persist();
        } else {
          reply(400, { error: 'unknown action' });
          return;
        }
        reply(200, { state: state.enabled, subplugins: describe(await discover()) });
      } catch (error) {
        reply(400, { error: error?.message ?? String(error) });
      }
    };

    http.effect(() => server.register({ kind: 'exact', path: API_PATH, handler }), 'my-dsh-ui: api');
  });
}
