/**
 * Sub-plugin `sidebar-pinned` — the first UI sub-plugin of my-dsh-ui.
 *
 * Interaction: the sidebar nav icon opens a floating list of pinned sessions right
 * beside it (no main-area navigation), so switching between pinned sessions is one
 * click. A secondary full page is reachable from the list footer.
 *
 * Everything here runs inside the container's mount scope: `ui.slot`, `ui.locale`
 * and `ui.styles` register on the plugin Context, so disabling the sub-plugin in
 * Settings → Plugins → UI sub-plugins removes all three surfaces live.
 *
 * All state comes from the Harness' own Workspace projection; this sub-plugin owns
 * no storage of its own.
 */
export function apply(ui) {
  const ctx = ui.ctx;
  const h = ui.h;
  const React = ui.React;

  const NS = 'myDshUiPinned';
  /** Panel id shared by the sidebar entry and the main-area page. */
  const PANEL_ID = 'my-dsh-ui.pinned';
  const ANCHOR_ATTR = 'data-myui-pinned-anchor';
  const EMPTY = Object.freeze([]);

  const workspaces = ctx.get('workspaces');
  const sessions = ctx.get('sessions');
  const uiWorkspace = ctx.get('uiWorkspace');
  const layout = ctx.get('layout');
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
      openPage: '在页面中查看',
      listLabel: '置顶会话列表',
      close: '关闭',
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
      openPage: 'Open as page',
      listLabel: 'Pinned session list',
      close: 'Close',
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
.myui-pinned__empty{max-width:720px;padding:28px 16px;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.myui-pinned__row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:8px 10px;border:none;border-radius:var(--dsw-radius-md,10px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.myui-pinned__row:hover{background:var(--dsw-alias-bg-layer-2)}
.myui-pinned__row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__glyph{flex:none;display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-state-warn-primary)}
.myui-pinned__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.myui-pinned__name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__meta{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__action{flex:none;display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0}
.myui-pinned__row:hover .myui-pinned__action,.myui-pinned__action:focus-visible{opacity:1}
.myui-pinned__action:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.myui-pinned__action:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__badge{position:absolute;top:-2px;right:-4px;min-width:13px;height:13px;padding:0 3px;border-radius:999px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:9px;font-weight:600;line-height:13px;text-align:center}
.myui-pinned__iconwrap{position:relative;display:inline-flex;align-items:center;justify-content:center}
.myui-pinned__trigger{border:none;background:transparent;padding:0;margin:0;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.myui-pop{position:fixed;z-index:20;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;width:296px;max-height:min(56vh,520px);padding:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 32px rgba(0,0,0,.18);pointer-events:auto}
.myui-pop__head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 4px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.myui-pop__count{font-weight:600;color:var(--dsw-alias-label-secondary)}
.myui-pop__list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;min-height:0}
.myui-pop__empty{padding:18px 10px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center;line-height:1.6}
.myui-pop__foot{border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px;padding:4px 2px 2px}
.myui-pop__more{width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:26px;text-align:center;cursor:pointer}
.myui-pop__more:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.myui-pop__more:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
`,
  );

  // -- projection stores ------------------------------------------------------
  // `workspaces.list` is the observable Workspace projection: the pinned id list
  // arrives most-recently-pinned-first, and a Host "pinned" increment replaces it,
  // so an unpinned id disappears from every surface without extra state.
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

  // -- popover state ----------------------------------------------------------
  function createStore(initial) {
    let snapshot = initial;
    const listeners = new Set();
    return {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      set(next) {
        if (Object.is(next, snapshot)) return;
        snapshot = next;
        for (const listener of [...listeners]) listener();
      },
    };
  }
  const popover = createStore({ open: false, anchor: null });

  function closePopover() {
    const current = popover.getSnapshot();
    if (!current.open) return;
    popover.set({ open: false, anchor: current.anchor });
  }

  function togglePopover(anchorElement) {
    const current = popover.getSnapshot();
    if (current.open) {
      closePopover();
      return;
    }
    const rect = anchorElement === undefined || anchorElement === null ? null : anchorElement.getBoundingClientRect();
    popover.set({
      open: true,
      anchor:
        rect === null
          ? null
          : { right: rect.right, top: rect.top, bottom: rect.bottom, left: rect.left, height: rect.height },
    });
  }

  function openPage() {
    closePopover();
    try {
      if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID);
    } catch (error) {
      ui.log('page navigation failed', error);
    }
  }

  function openSession(id) {
    closePopover();
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

  // -- shared row -------------------------------------------------------------
  function PinnedRow({ id, useSessionList, useWorkspaceItems, onActivate, compact }) {
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
        onClick: () => onActivate(id),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(id);
          }
        },
      },
      h('span', { className: 'myui-pinned__glyph' }, h(PinGlyph, { size: compact ? 13 : 15 })),
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
        h(UnpinGlyph, { size: compact ? 13 : 15 }),
      ),
    );
  }

  // -- sidebar trigger --------------------------------------------------------
  // Rendered inside the sidebar's own nav button, so this is a non-focusable span:
  // a nested <button> would be invalid, and the shipped row already owns the
  // accessible name and keyboard activation (which falls back to the page view).
  function PinnedIcon({ size, usePinnedCount }) {
    const count = typeof usePinnedCount === 'function' ? usePinnedCount((value) => value) : 0;
    const anchorRef = React.useRef(null);
    return h(
      'span',
      {
        ref: anchorRef,
        className: 'myui-pinned__iconwrap',
        [ANCHOR_ATTR]: '1',
        title: t('heading'),
        onClick: (event) => {
          // Own the click: the row's shipped behavior selects a panel, while this
          // entry expands the floating list in place.
          event.preventDefault();
          event.stopPropagation();
          togglePopover(anchorRef.current);
        },
      },
      h(PinGlyph, { size: size ?? 16 }),
      count > 0
        ? h('span', { className: 'myui-pinned__badge', 'aria-hidden': 'true' }, count > 9 ? '9+' : String(count))
        : null,
    );
  }

  // -- floating list ----------------------------------------------------------
  function PinnedPopover({ usePopover, usePinned, useSessionList, useWorkspaceItems, onClose, onOpenPage }) {
    const state = usePopover((value) => value);
    const ids = usePinned((value) => value);
    const rootRef = React.useRef(null);

    React.useEffect(() => {
      if (!state.open) return undefined;
      const onPointerDown = (event) => {
        const root = rootRef.current;
        if (root !== null && root.contains(event.target)) return;
        if (event.target instanceof Element && event.target.closest('[' + ANCHOR_ATTR + ']') !== null) return;
        onClose();
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      };
      const onViewportChange = (event) => {
        const root = rootRef.current;
        if (event !== undefined && root !== null && root.contains(event.target)) return;
        onClose();
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('resize', onViewportChange);
      window.addEventListener('wheel', onViewportChange, { passive: true });
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('resize', onViewportChange);
        window.removeEventListener('wheel', onViewportChange);
      };
    }, [state.open, onClose]);

    if (!state.open) return null;
    const anchor = state.anchor;
    const width = 296;
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const left = anchor === null ? 240 : Math.min(anchor.right + 8, Math.max(8, viewportWidth - width - 12));
    const top = anchor === null ? 96 : Math.max(8, Math.min(anchor.top, (typeof window === 'undefined' ? 800 : window.innerHeight) - 120));
    const style = {
      left: left + 'px',
      top: top + 'px',
      pointerEvents: 'auto',
    };
    return h(
      'div',
      {
        ref: rootRef,
        className: 'myui-pop',
        style,
        role: 'dialog',
        'aria-label': t('listLabel'),
      },
      h(
        'div',
        { className: 'myui-pop__head' },
        h('span', null, t('heading')),
        h('span', { className: 'myui-pop__count' }, String(ids.length)),
      ),
      ids.length === 0
        ? h('div', { className: 'myui-pop__empty' }, t('empty'))
        : h(
            'div',
            { className: 'myui-pop__list' },
            ids.map((id) =>
              h(PinnedRow, {
                key: id,
                id,
                compact: true,
                useSessionList,
                useWorkspaceItems,
                onActivate: openSession,
              }),
            ),
          ),
      h(
        'div',
        { className: 'myui-pop__foot' },
        h('button', { type: 'button', className: 'myui-pop__more', onClick: onOpenPage }, t('openPage')),
      ),
    );
  }

  // -- full page (reachable from the floating list) ---------------------------
  function PinnedPage({ usePinned, useSessionList, useWorkspaceItems }) {
    const ids = usePinned((value) => value);
    return h(
      'section',
      { className: 'myui-pinned', 'aria-label': t('heading') },
      h(
        'header',
        { className: 'myui-pinned__head' },
        h('h2', { className: 'myui-pinned__title' }, h(PinGlyph, { size: 18 }), t('heading')),
        h('p', { className: 'myui-pinned__summary' }, ids.length > 0 ? ids.length + ' · ' + t('summary') : t('summary')),
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
                useSessionList,
                useWorkspaceItems,
                onActivate: openSession,
              }),
            ),
          ),
    );
  }

  const face = () => ({
    hooks: { pinned: pinnedIds, pinnedCount, sessionList, workspaceItems, popover },
    openSession,
    unpinSession,
    onClose: closePopover,
    onOpenPage: openPage,
  });

  // 1. the floating list, in the frame-wide overlay layer (outside every scroll
  //    container, so it is never clipped by the sidebar);
  ui.slot('shell.overlay', { id: 'my-dsh-ui-pinned-popover', order: 60, locale: NS, inject: face }, PinnedPopover);
  // 2. the sidebar trigger;
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
  // 3. the full page, opened from the floating list footer.
  ui.slot('main', { key: PANEL_ID, locale: NS, inject: face }, PinnedPage);
}
