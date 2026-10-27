/**
 * Sub-plugin `sidebar-pinned` — the first UI sub-plugin of my-dsh-ui.
 *
 * Everything here runs inside the container's mount scope: `ui.slot`, `ui.locale`
 * and `ui.styles` register on the plugin Context, so disabling the sub-plugin in
 * Settings → Plugins → UI sub-plugins removes the nav entry and the page live.
 *
 * All state comes from the Harness' own Workspace projection; this sub-plugin owns
 * no storage of its own.
 */
export function apply(ui) {
  const ctx = ui.ctx;
  const h = ui.h;

  const NS = 'myDshUiPinned';
  /** Panel id shared by the sidebar entry and the main-area page. */
  const PANEL_ID = 'my-dsh-ui.pinned';
  const EMPTY = Object.freeze([]);

  const workspaces = ctx.get('workspaces');
  const sessions = ctx.get('sessions');
  const uiWorkspace = ctx.get('uiWorkspace');
  if (!workspaces || !uiWorkspace) {
    ui.log('workspaces service unavailable; pinned sub-plugin stays inert');
    return;
  }

  ui.locale(NS, {
    zh: {
      title: '置顶',
      heading: '置顶会话',
      summary: '取消置顶后，会话会回到它所属的工作区。',
      empty: '暂无置顶会话。在侧栏的会话行上点「置顶」后就会出现在这里。',
      untitled: '未命名会话',
      workspaceFallback: '未分组',
      open: '打开会话',
      unpin: '取消置顶',
    },
    en: {
      title: 'Pinned',
      heading: 'Pinned sessions',
      summary: 'Unpinning a session sends it back to its workspace.',
      empty: 'No pinned sessions yet. Pin one from a session row in the sidebar and it shows up here.',
      untitled: 'Untitled session',
      workspaceFallback: 'Ungrouped',
      open: 'Open session',
      unpin: 'Unpin',
    },
  });
  const t = ctx.locale.bind(NS);

  ui.styles(
    'pinned.css',
    `
.myui-pinned{box-sizing:border-box;height:100%;overflow-y:auto;padding:24px 32px 32px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}
.myui-pinned__head{margin-bottom:16px}
.myui-pinned__title{font-size:18px;font-weight:600;margin:0 0 6px;display:flex;align-items:center;gap:8px}
.myui-pinned__summary{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px}
.myui-pinned__list{display:flex;flex-direction:column;gap:2px;max-width:720px}
.myui-pinned__row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:9px 10px;border:none;border-radius:var(--dsw-radius-md,10px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.myui-pinned__row:hover{background:var(--dsw-alias-bg-layer-2)}
.myui-pinned__row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__glyph{flex:none;display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-state-warn-primary)}
.myui-pinned__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.myui-pinned__name{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__meta{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__action{flex:none;display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0}
.myui-pinned__row:hover .myui-pinned__action,.myui-pinned__action:focus-visible{opacity:1}
.myui-pinned__action:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.myui-pinned__action:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__empty{max-width:720px;padding:28px 16px;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.myui-pinned__badge{position:absolute;top:-2px;right:-4px;min-width:13px;height:13px;padding:0 3px;border-radius:999px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:9px;font-weight:600;line-height:13px;text-align:center}
.myui-pinned__iconwrap{position:relative;display:inline-flex;align-items:center;justify-content:center}
`,
  );

  // -- projection stores ------------------------------------------------------
  // `workspaces.list` is the observable Workspace projection: the pinned id list
  // arrives most-recently-pinned-first, and a Host "pinned" increment replaces it,
  // so an unpinned id disappears from this page without extra state.
  const workspaceSnapshot = () => {
    try {
      return workspaces.list.getSnapshot();
    } catch {
      return undefined;
    }
  };
  const subscribeWorkspaces = (listener) => {
    try {
      const off = workspaces.list.subscribe(listener);
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  };
  const pinnedIds = {
    getSnapshot: () => workspaceSnapshot()?.pinnedSessionIds ?? EMPTY,
    subscribe: subscribeWorkspaces,
  };
  const pinnedCount = {
    getSnapshot: () => pinnedIds.getSnapshot().length,
    subscribe: subscribeWorkspaces,
  };
  const workspaceItems = {
    getSnapshot: () => workspaceSnapshot()?.items ?? EMPTY,
    subscribe: subscribeWorkspaces,
  };
  // Session titles ride the `sessions` projection; every access is defensive so an
  // absent or re-shaped model degrades to "untitled" instead of crashing the slot.
  const sessionList =
    sessions && sessions.list
      ? {
          getSnapshot() {
            try {
              return sessions.list.getSnapshot() ?? { byId: {} };
            } catch {
              return { byId: {} };
            }
          },
          subscribe(listener) {
            try {
              const off = sessions.list.subscribe(listener);
              return typeof off === 'function' ? off : () => {};
            } catch {
              return () => {};
            }
          },
        }
      : { getSnapshot: () => ({ byId: {} }), subscribe: () => () => {} };

  function openSession(id) {
    try {
      uiWorkspace.openSession(id);
    } catch (error) {
      ui.log('open failed', error);
    }
  }

  function unpinSession(id) {
    const result = workspaces.unpinSession(id);
    if (result && typeof result.catch === 'function') {
      result.catch((error) => ui.log('unpin failed', error));
    }
  }

  // -- icons ------------------------------------------------------------------
  function PinGlyph({ size }) {
    return h(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.9,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { display: 'block' },
      },
      h('path', {
        d: 'M9 4h6v4.76a2 2 0 0 0 .34 1.12l1.16 1.72a1 1 0 0 1-.83 1.56H6.33a1 1 0 0 1-.83-1.56l1.16-1.72A2 2 0 0 0 9 8.76Z',
      }),
      h('path', { d: 'M12 13.2V20' }),
    );
  }

  function UnpinGlyph({ size }) {
    return h(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.9,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        style: { display: 'block' },
      },
      h('path', { d: 'M4 4 20 20' }),
      h('path', {
        d: 'M9 4h6v4.76a2 2 0 0 0 .34 1.12l1.16 1.72a1 1 0 0 1-.83 1.56H6.33a1 1 0 0 1-.83-1.56l1.16-1.72A2 2 0 0 0 9 8.76Z',
        opacity: 0.55,
      }),
    );
  }

  function PinnedIcon({ size, usePinnedCount }) {
    const count = typeof usePinnedCount === 'function' ? usePinnedCount((value) => value) : 0;
    return h(
      'span',
      { className: 'myui-pinned__iconwrap' },
      h(PinGlyph, { size: size ?? 16 }),
      count > 0
        ? h('span', { className: 'myui-pinned__badge', 'aria-hidden': 'true' }, count > 9 ? '9+' : String(count))
        : null,
    );
  }

  function PinnedRow({ id, useSessionList, useWorkspaceItems }) {
    const title = useSessionList((snapshot) => {
      const summary = snapshot?.byId?.[id];
      const display = summary?.displayTitle ?? summary?.title ?? '';
      return typeof display === 'string' && display.trim() !== '' ? display : null;
    });
    const workspace = useWorkspaceItems((items) => {
      for (const entry of items ?? EMPTY) {
        if (Array.isArray(entry.sessionIds) && entry.sessionIds.includes(id)) {
          return typeof entry.title === 'string' && entry.title !== '' ? entry.title : null;
        }
      }
      return null;
    });
    const label = title ?? t('untitled') + ' · ' + String(id).slice(0, 8);
    return h(
      'div',
      {
        className: 'myui-pinned__row',
        role: 'button',
        tabIndex: 0,
        title: t('open'),
        onClick: () => openSession(id),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openSession(id);
          }
        },
      },
      h('span', { className: 'myui-pinned__glyph' }, h(PinGlyph, { size: 15 })),
      h(
        'span',
        { className: 'myui-pinned__body' },
        h('span', { className: 'myui-pinned__name' }, label),
        h('span', { className: 'myui-pinned__meta' }, workspace ?? t('workspaceFallback')),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'myui-pinned__action',
          title: t('unpin'),
          'aria-label': t('unpin'),
          onClick: (event) => {
            event.stopPropagation();
            unpinSession(id);
          },
        },
        h(UnpinGlyph, { size: 15 }),
      ),
    );
  }

  function PinnedPage({ usePinned, useSessionList, useWorkspaceItems }) {
    // The selector returns the same array reference until the Host pushes a new pin set.
    const ids = usePinned((value) => value);
    return h(
      'section',
      { className: 'myui-pinned', 'aria-label': t('heading') },
      h(
        'header',
        { className: 'myui-pinned__head' },
        h('h2', { className: 'myui-pinned__title' }, h(PinGlyph, { size: 18 }), t('heading')),
        h(
          'p',
          { className: 'myui-pinned__summary' },
          ids.length > 0 ? ids.length + ' · ' + t('summary') : t('summary'),
        ),
      ),
      ids.length === 0
        ? h('div', { className: 'myui-pinned__empty' }, t('empty'))
        : h(
            'div',
            { className: 'myui-pinned__list' },
            ids.map((id) =>
              h(PinnedRow, {
                key: id,
                id,
                useSessionList: useSessionList ?? (() => null),
                useWorkspaceItems: useWorkspaceItems ?? (() => null),
              }),
            ),
          ),
    );
  }

  const face = () => ({
    hooks: { pinned: pinnedIds, pinnedCount, sessionList, workspaceItems },
    openSession,
    unpinSession,
  });

  // Sidebar entry (nav icon) and its main-area page share PANEL_ID, so the row's
  // click resolves through ctx.layout.selectPanel(PANEL_ID).
  ui.slot('main', { key: PANEL_ID, locale: NS, inject: face }, PinnedPage);
  ui.slot(
    'sidebar.panellist',
    {
      id: PANEL_ID,
      order: 15,
      locale: NS,
      label: () => ctx.locale.bind(NS)('title'),
      inject: face,
    },
    PinnedIcon,
  );
}
