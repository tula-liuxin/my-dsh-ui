# my-dsh-ui

A **UI sub-plugin container** for DSH (DeepSeek Harness). It does one thing: lets you manage a set of
UI sub-plugins the way you manage DSH plugins — toggle them, compose them, uninstall them, with changes
taking effect immediately.

The first bundled sub-plugin is **Pinned sessions**: it adds a “Pinned” entry to the sidebar navigation and
collects every pinned session — otherwise scattered across workspace groups — into a single page. Open a
session with one click, or unpin it right there; unpinned sessions return to their workspace and leave the page.

> Why a page instead of a sidebar section? The DSH sidebar exposes only an icon nav list and one whole
> session-browsing region to plugins; the workspace header and session list are owned as a single block by
> the built-in UI, with no additive seat above it. Inserting a real section there requires owning the whole
> session browser (search, grouping, drag and drop, menus) — which breaks on DSH upgrades. This bundle is
> therefore strictly additive: **it never touches built-in UI, it only adds an entry and a page.**

## Install

```
plugin_manager install_bundle target="<local directory or git url>"
```

Then manage sub-plugins in **Settings → Plugins → UI sub-plugins**; the “Pinned” entry appears in the sidebar.

## Sub-plugin contract

```
subplugins/<id>/
  subplugin.json   # id / version / title / description / defaultEnabled / author / homepage
  client.js        # UI half: export function apply(ui)
  index.js         # optional Host half: export function apply(api, config)
```

Toggle/compose: every `ui.slot(...)`, `ui.locale(...)`, `ui.styles(...)` call is registered inside the
container's scope and disposed when the sub-plugin is disabled — exactly like unloading a plugin, without a
restart. Enablement is persisted in `$DSH_HOME/my-dsh-ui/state.json` (browser storage is the fallback when the
Host bridge is unavailable).

Install: drop a directory into `$DSH_HOME/my-dsh-ui/subplugins/` (its Host half applies immediately). Bundled
sub-plugins live in `subplugins/`; their UI code is compiled into `client.js` by `node scripts/build.mjs`, so a
locally added sub-plugin’s UI needs a DSH restart.

Uninstall: the manager removes and stops local sub-plugins; bundled ones can only be disabled.

## Dev

```
node scripts/build.mjs          # compile subplugins/*/client.js into client.js
node scripts/build.mjs --check  # fail when client.js is stale
```

## Data & privacy

- The only plugin-owned state is `$DSH_HOME/my-dsh-ui/state.json` (sub-plugin enablement).
- Pinned sessions are not stored: the page reads DSH's existing Workspace projection and unpins through
  DSH's own `unpinSession`.
- The Host half registers one authenticated same-origin JSON route, `/my-dsh-ui/api`.

MIT licensed.
