/**
 * Sub-plugin `sidebar-pinned` — the first UI sub-plugin of my-dsh-ui.
 *
 * The sidebar nav entry opens a floating list of **pinned and unread** sessions
 * inside the left column, so switching stays one click and the conversation column
 * is never covered. The shell owns the nav row's click (it selects `PANEL_ID`), so
 * the page that click mounts immediately hands the main column back to the panel the
 * user came from and toggles the list instead; the full page is kept only when it is
 * requested from the list footer.
 *
 * Everything here runs inside the container's mount scope: `ui.slot`, `ui.locale`
 * and `ui.styles` register on the plugin Context, so disabling the sub-plugin in
 * Settings → Plugins → UI sub-plugins removes all surfaces live.
 *
 * State comes from the Harness' own projections (Workspace pinned set, Session
 * status, Session list); this sub-plugin owns no storage of its own.
 */
export function apply(ui) {
  const ctx = ui.ctx;
  const h = ui.h;
  const React = ui.React;

  const NS = 'myDshUiPinned';
  /** Panel id shared by the sidebar entry and the page the shell selects. */
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
      title: '置顶/未读',
      heading: '置顶 / 未读',
      summary: '置顶的会话排在最前，后面是后台跑完、还没看的会话。点一下直接切过去。',
      empty: '暂无置顶或未读会话。',
      untitled: '未命名会话',
      workspaceFallback: '未分组',
      open: '打开会话',
      unpin: '取消置顶',
      pinnedTag: '置顶',
      unreadTag: '未读',
      openPage: '在页面中查看',
      backToChat: '回到会话',
      listLabel: '置顶与未读会话列表',
      pinnedCountLabel: '置顶',
      unreadCountLabel: '未读',
    },
    en: {
      title: 'Pinned/Unread',
      heading: 'Pinned / Unread',
      summary: 'Pinned sessions first, then sessions that finished in the background and have not been read yet. One click switches.',
      empty: 'No pinned or unread sessions.',
      untitled: 'Untitled session',
      workspaceFallback: 'Ungrouped',
      open: 'Open session',
      unpin: 'Unpin',
      pinnedTag: 'Pinned',
      unreadTag: 'Unread',
      openPage: 'Open as page',
      backToChat: 'Back to conversation',
      listLabel: 'Pinned and unread sessions',
      pinnedCountLabel: 'Pinned',
      unreadCountLabel: 'Unread',
    },
  });
  const t = ctx.locale.bind(NS);

  ui.styles(
    'pinned.css',
    `
.myui-pinned{box-sizing:border-box;height:100%;overflow-y:auto;padding:24px 32px 32px;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5}
.myui-pinned__head{margin-bottom:16px}
.myui-pinned__headrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.myui-pinned__title{font-size:18px;font-weight:600;margin:0;display:flex;align-items:center;gap:8px}
.myui-pinned__summary{margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px}
.myui-pinned__list{display:flex;flex-direction:column;gap:2px;max-width:720px}
.myui-pinned__empty{max-width:720px;padding:28px 16px;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.myui-pinned__row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:8px 10px;border:none;border-radius:var(--dsw-radius-md,10px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.myui-pinned__row:hover{background:var(--dsw-alias-bg-layer-2)}
.myui-pinned__row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__glyph{flex:none;display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-primary)}
.myui-pinned__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.myui-pinned__name{min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.myui-pinned__line{display:flex;align-items:center;gap:6px;min-width:0}
.myui-pinned__unread{flex:none;display:block;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}
.myui-pinned__action{flex:none;display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0}
.myui-pinned__row:hover .myui-pinned__action,.myui-pinned__action:focus-visible{opacity:1}
.myui-pinned__action:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.myui-pinned__action:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
.myui-pinned__iconwrap{position:relative;display:inline-flex;align-items:center;justify-content:center}
.myui-pop{position:fixed;z-index:20;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;width:236px;padding:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 32px rgba(0,0,0,.18);pointer-events:auto}
.myui-pop__head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 4px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600}
.myui-pop__counts{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600}
.myui-pop__count--pinned{color:var(--dsw-alias-label-primary)}
.myui-pop__count--unread{color:var(--dsw-alias-state-success-primary)}
.myui-pop__sep{color:var(--dsw-alias-label-secondary);opacity:.55;font-weight:400}
.myui-pinned__counts{display:inline-flex;align-items:center;gap:6px;margin-left:4px;font-size:13px;font-weight:600}
.myui-pinned__count--pinned{color:var(--dsw-alias-label-primary)}
.myui-pinned__count--unread{color:var(--dsw-alias-state-success-primary)}
.myui-pinned__sep{color:var(--dsw-alias-label-secondary);opacity:.55;font-weight:400}
.myui-pop__list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;min-height:0}
.myui-pop__empty{padding:18px 10px;color:var(--dsw-alias-label-secondary);font-size:12px;text-align:center;line-height:1.6}
.myui-pop__foot{border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px;padding:4px 2px 2px}
.myui-pop__more{width:100%;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:26px;text-align:center;cursor:pointer}
.myui-pop__more:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.myui-pop__more:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}
`,
  );

  // -- projection stores ------------------------------------------------------
  // `workspaces.list` carries the pinned id set (most recently pinned first) and the
  // archived set; a Host "pinned"/"archived" increment replaces them.
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
  const archivedIds = {
    getSnapshot: () => workspaceSnapshot()?.archivedSessionIds ?? EMPTY,
    subscribe: subscribeWorkspaces,
  };
  const workspaceItems = {
    getSnapshot: () => workspaceSnapshot()?.items ?? EMPTY,
    subscribe: subscribeWorkspaces,
  };
  // Session titles/order ride the `sessions` projection; every access is defensive
  // so an absent or re-shaped model degrades instead of crashing the slot.
  const sessionList =
    sessions && sessions.list
      ? {
          getSnapshot() {
            try {
              return sessions.list.getSnapshot() ?? { byId: {}, ids: [] };
            } catch {
              return { byId: {}, ids: [] };
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
      : { getSnapshot: () => ({ byId: {}, ids: [] }), subscribe: () => () => {} };

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

  // The sidebar owns the nav row's click, so the row doubles as the trigger: the
  // page it mounts restores the previous panel and toggles the list. The page is
  // only kept when requested from the list footer.
  let anchorElement = null;
  let pageRequested = false;
  let previousPanelId = null;

  const layoutPanelInfo = layout && layout.panelInfo;
  if (layoutPanelInfo && typeof layoutPanelInfo.getSnapshot === 'function') {
    const activeNow = layoutPanelInfo.getSnapshot()?.activePanelId;
    if (typeof activeNow === 'string' && activeNow !== PANEL_ID) previousPanelId = activeNow;
    if (typeof layoutPanelInfo.subscribe === 'function') {
      ctx.effect(
        () =>
          layoutPanelInfo.subscribe(() => {
            const active = layoutPanelInfo.getSnapshot()?.activePanelId;
            if (typeof active === 'string' && active !== PANEL_ID) previousPanelId = active;
          }),
        'my-dsh-ui:pinned panel memory',
      );
    }
  }

  function closePopover() {
    const current = popover.getSnapshot();
    if (!current.open) return;
    popover.set({ open: false, anchor: current.anchor });
  }

  function anchorRect() {
    const element = anchorElement;
    if (element === null || element === undefined || element.isConnected !== true) return null;
    const rect = element.getBoundingClientRect();
    return { right: rect.right, top: rect.top, bottom: rect.bottom, left: rect.left, height: rect.height };
  }

  function openPopover() {
    popover.set({ open: true, anchor: anchorRect() });
  }

  function toggleFromNavRow() {
    if (popover.getSnapshot().open) closePopover();
    else openPopover();
  }

  function restorePreviousPanel() {
    const target = typeof previousPanelId === 'string' && previousPanelId !== PANEL_ID ? previousPanelId : 'conversation';
    try {
      if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(target);
    } catch (error) {
      ui.log('panel restore failed', error);
    }
  }

  function openPage() {
    pageRequested = true;
    closePopover();
    try {
      if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID);
    } catch (error) {
      pageRequested = false;
      ui.log('page navigation failed', error);
    }
  }

  function activateSession(id) {
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

  // -- unread projection ------------------------------------------------------
  // `uiSession.sessionStatus` is a public store: Map<SessionId, {running,
  // pendingInteraction, completionUnread}>. `completionUnread` is the sidebar's
  // "finished while you were not looking" flag (page-local, mirrors the shipped dot).
  const statusStore = ctx.get('uiSession')?.sessionStatus;
  if (!statusStore) ui.log('uiSession.sessionStatus unavailable; the list will only show pinned sessions');
  const subscribeStatus = (listener) => {
    if (!statusStore || typeof statusStore.subscribe !== 'function') return () => {};
    try {
      const off = statusStore.subscribe(listener);
      return typeof off === 'function' ? off : () => {};
    } catch {
      return () => {};
    }
  };
  const statusSnapshot = () => {
    if (!statusStore || typeof statusStore.getSnapshot !== 'function') return undefined;
    try {
      return statusStore.getSnapshot();
    } catch {
      return undefined;
    }
  };
  let unreadCacheKey;
  let unreadCache = EMPTY;
  const unreadIds = {
    getSnapshot() {
      const snapshot = statusSnapshot();
      if (snapshot === unreadCacheKey) return unreadCache;
      unreadCacheKey = snapshot;
      const ids = [];
      if (snapshot !== undefined && snapshot !== null && typeof snapshot.forEach === 'function') {
        snapshot.forEach((status, id) => {
          if (status?.completionUnread === true) ids.push(String(id));
        });
      }
      unreadCache = ids.length === 0 ? EMPTY : ids;
      return unreadCache;
    },
    subscribe: subscribeStatus,
  };

  function sessionTitle(summary, id) {
    const display = summary?.displayTitle ?? summary?.title ?? '';
    return typeof display === 'string' && display.trim() !== '' ? display : t('untitled') + ' · ' + String(id).slice(0, 8);
  }

  function workspaceTitleOf(items, id) {
    for (const entry of items ?? EMPTY) {
      if (Array.isArray(entry.sessionIds) && entry.sessionIds.includes(id)) {
        return typeof entry.title === 'string' && entry.title !== '' ? entry.title : null;
      }
    }
    return null;
  }

  /** Subagent descendants are not switching targets: only top-level sessions belong here. */
  function isSubagentSession(summary) {
    if (summary === undefined || summary === null) return false;
    return summary.origin === 'subagent' || summary.parentSessionId !== undefined;
  }

  /** Rows = pinned (pin order) then unread-only (newest activity first). */
  function buildRows({ pinned, unread, archived, sessionSnapshot }) {
    const archivedSet = new Set(archived ?? EMPTY);
    const pinnedSet = new Set(pinned ?? EMPTY);
    const unreadSet = new Set(unread ?? EMPTY);
    const byId = sessionSnapshot?.byId ?? {};
    const rows = [];
    for (const id of pinned ?? EMPTY) {
      const summary = byId[id];
      if (archivedSet.has(id) || isSubagentSession(summary)) continue;
      rows.push({ id, pinned: true, unread: unreadSet.has(id) });
    }
    const rest = [];
    for (const id of unreadSet) {
      if (archivedSet.has(id) || pinnedSet.has(id)) continue;
      const summary = byId[id];
      if (summary === undefined || summary?.blank === true || isSubagentSession(summary)) continue;
      rest.push(id);
    }
    rest.sort((left, right) => (byId[right]?.updatedAt ?? 0) - (byId[left]?.updatedAt ?? 0));
    for (const id of rest) rows.push({ id, pinned: false, unread: true });
    return rows;
  }

  function useRows(props) {
    const pinned = props.usePinned((value) => value);
    const archived = props.useArchived((value) => value);
    const sessionSnapshot = props.useSessionList((value) => value);
    const unread = props.useUnread((value) => value);
    return buildRows({ pinned, unread, archived, sessionSnapshot });
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
  function PinnedRow({ row, compact, useSessionList, useWorkspaceItems, onActivate }) {
    const title = useSessionList((snapshot) => sessionTitle(snapshot?.byId?.[row.id], row.id) || null);
    const workspace = useWorkspaceItems((items) => workspaceTitleOf(items, row.id));
    return h(
      'div',
      {
        className: 'myui-pinned__row',
        role: 'button',
        tabIndex: 0,
        title: t('open'),
        onClick: () => onActivate(row.id),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(row.id);
          }
        },
      },
      // Leading marker only for pinned rows; unread is the small green dot beside the
      // title, mirroring the shipped session-row unread indicator.
      row.pinned
        ? h('span', { className: 'myui-pinned__glyph' }, h(PinGlyph, { size: compact ? 13 : 15 }))
        : null,
      h(
        'span',
        { className: 'myui-pinned__body' },
        h(
          'span',
          { className: 'myui-pinned__line' },
          h('span', { className: 'myui-pinned__name' }, title),
          row.unread
            ? h('span', {
                className: 'myui-pinned__unread',
                title: t('unreadTag'),
                'aria-label': t('unreadTag'),
                role: 'img',
              })
            : null,
        ),
        h('span', { className: 'myui-pinned__meta' }, workspace ?? t('workspaceFallback')),
      ),
      row.pinned
        ? h(
            'button',
            {
              type: 'button',
              className: 'myui-pinned__action',
              title: t('unpin'),
              'aria-label': t('unpin'),
              onClick: (event) => {
                event.stopPropagation();
                unpinSession(row.id);
              },
            },
            h(UnpinGlyph, { size: compact ? 13 : 15 }),
          )
        : null,
    );
  }

  /** Split counts for the headers: pinned (gray) and unread (green). */
  function countRows(rows) {
    let pinned = 0;
    let unread = 0;
    for (const row of rows) {
      if (row.pinned) pinned += 1;
      if (row.unread) unread += 1;
    }
    return { pinned, unread, total: pinned + unread };
  }

  function SplitCounts({ counts, classNamePrefix }) {
    return h(
      'span',
      { className: classNamePrefix + '__counts', 'aria-label': counts.pinned + ' ' + t('pinnedTag') + ' / ' + counts.unread + ' ' + t('unreadTag') },
      h('span', { className: classNamePrefix + '__count--pinned' }, String(counts.pinned)),
      h('span', { className: classNamePrefix + '__sep' }, '/'),
      h('span', { className: classNamePrefix + '__count--unread' }, String(counts.unread)),
    );
  }

  // -- sidebar trigger --------------------------------------------------------
  // Inside the sidebar's own nav button, so this is a presentational span that only
  // records its position; the row's own click drives the list (see PinnedPage). It
  // also keeps the nav label's counts in sync with the projections.
  function PinnedIcon(props) {
    const { size } = props;
    const rows = useRows(props);
    const counts = countRows(rows);
    const pinnedCount = counts.pinned;
    const unreadCount = counts.unread;
    React.useEffect(() => {
      ensureNavEntry({ pinned: pinnedCount, unread: unreadCount, total: pinnedCount + unreadCount });
    }, [pinnedCount, unreadCount]);
    return h(
      'span',
      {
        ref: (element) => {
          anchorElement = element;
        },
        className: 'myui-pinned__iconwrap',
        [ANCHOR_ATTR]: '1',
        title: t('heading'),
      },
      h(PinGlyph, { size: size ?? 16 }),
    );
  }

  // -- floating list ----------------------------------------------------------
  function PinnedPopover(props) {
    const { usePopover, useSessionList, useWorkspaceItems, onClose, onOpenPage } = props;
    const state = usePopover((value) => value);
    const rows = useRows(props);
    const rootRef = React.useRef(null);

    React.useEffect(() => {
      if (!state.open) return undefined;
      const navRow = anchorElement !== null && typeof anchorElement.closest === 'function' ? anchorElement.closest('button') : null;
      const onPointerDown = (event) => {
        const root = rootRef.current;
        if (root !== null && root.contains(event.target)) return;
        if (navRow !== null && navRow.contains(event.target)) return;
        onClose();
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      };
      const onResize = () => onClose();
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      // Only an outside click or Escape dismisses the list: switching sessions or
      // scrolling the session list leaves it open for the next switch.
      window.addEventListener('resize', onResize);
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('resize', onResize);
      };
    }, [state.open, onClose]);

    if (!state.open) return null;
    const anchor = state.anchor;
    // Left column only: expand downward from the trigger, inside the sidebar, so the
    // conversation column stays usable while the list is open.
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
    const top = anchor === null ? 96 : Math.max(8, anchor.bottom + 6);
    return h(
      'div',
      {
        ref: rootRef,
        className: 'myui-pop',
        style: {
          left: '12px',
          top: top + 'px',
          maxHeight: Math.max(160, viewportHeight - top - 16) + 'px',
          pointerEvents: 'auto',
        },
        role: 'dialog',
        'aria-label': t('listLabel'),
      },
      h(
        'div',
        { className: 'myui-pop__head' },
        h('span', null, t('heading')),
        h(SplitCounts, { counts: countRows(rows), classNamePrefix: 'myui-pop' }),
      ),
      rows.length === 0
        ? h('div', { className: 'myui-pop__empty' }, t('empty'))
        : h(
            'div',
            { className: 'myui-pop__list' },
            rows.map((row) =>
              h(PinnedRow, {
                key: row.id,
                row,
                compact: true,
                useSessionList,
                useWorkspaceItems,
                onActivate: activateSession,
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

  // -- full page (explicitly requested from the floating list) ----------------
  function PinnedPage(props) {
    const { useSessionList, useWorkspaceItems } = props;
    const rows = useRows(props);
    const [showPage] = React.useState(pageRequested);
    React.useLayoutEffect(() => {
      if (pageRequested) {
        pageRequested = false;
        return;
      }
      toggleFromNavRow();
      restorePreviousPanel();
    }, []);
    if (!showPage) return null;
    return h(
      'section',
      { className: 'myui-pinned', 'aria-label': t('heading') },
      h(
        'header',
        { className: 'myui-pinned__head' },
        h(
          'div',
          { className: 'myui-pinned__headrow' },
          h(
            'h2',
            { className: 'myui-pinned__title' },
            h(PinGlyph, { size: 18 }),
            t('heading'),
            h(SplitCounts, { counts: countRows(rows), classNamePrefix: 'myui-pinned' }),
          ),
          h('button', { type: 'button', className: 'myui-button', onClick: restorePreviousPanel }, t('backToChat')),
        ),
        h('p', { className: 'myui-pinned__summary' }, t('summary')),
      ),
      rows.length === 0
        ? h('div', { className: 'myui-pinned__empty' }, t('empty'))
        : h(
            'div',
            { className: 'myui-pinned__list' },
            rows.map((row) =>
              h(PinnedRow, {
                key: row.id,
                row,
                useSessionList,
                useWorkspaceItems,
                onActivate: activateSession,
              }),
            ),
          ),
    );
  }

  function face() {
    return {
      hooks: {
        pinned: pinnedIds,
        unread: unreadIds,
        archived: archivedIds,
        sessionList,
        workspaceItems,
        popover,
      },
      onClose: closePopover,
      onOpenPage: openPage,
    };
  }

  // The sidebar draws the nav row as `[icon][label]`, so the only surface that can
  // carry the counts right after "置顶/未读" is the label string itself. The label is
  // projected from the registration, so the entry is re-registered when a count
  // changes; the shell then re-reads it (ctx.slots.subscribe).
  let navEntryDispose = null;
  let navLabelKey = null;

  function navLabelText(counts) {
    const t2 = ctx.locale.bind(NS);
    return t2('pinnedTag') + counts.pinned + '/' + t2('unreadTag') + counts.unread;
  }

  function ensureNavEntry(counts) {
    const key = counts.pinned + '/' + counts.unread;
    if (key === navLabelKey) return;
    navLabelKey = key;
    if (typeof navEntryDispose === 'function') navEntryDispose();
    navEntryDispose = ui.slot(
      'sidebar.panellist',
      {
        id: PANEL_ID,
        order: 15,
        locale: NS,
        label: () => navLabelText(counts),
        inject: face,
      },
      PinnedIcon,
    );
  }

  // 1. the floating list, in the frame-wide overlay layer (outside every scroll
  //    container, so it is never clipped by the sidebar);
  ui.slot('shell.overlay', { id: 'my-dsh-ui-pinned-popover', order: 60, locale: NS, inject: face }, PinnedPopover);
  // 2. the sidebar trigger, whose label carries the pinned/unread counts;
  ensureNavEntry(
    countRows(
      buildRows({
        pinned: pinnedIds.getSnapshot(),
        unread: unreadIds.getSnapshot(),
        archived: archivedIds.getSnapshot(),
        sessionSnapshot: sessionList.getSnapshot(),
      }),
    ),
  );
  // 3. the page the shell mounts on a nav-row click: it bounces back to the previous
  //    panel and toggles the list; it stays only when the footer asked for it.
  ui.slot('main', { key: PANEL_ID, locale: NS, inject: face }, PinnedPage);
}
