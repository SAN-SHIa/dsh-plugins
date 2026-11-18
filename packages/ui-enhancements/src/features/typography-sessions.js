export function createFeature(require) {
    const React = require('react');
    // Use the platform UI face for Latin; let the OS pick the matching CJK face.
    // Size primary labels only, leaving metadata, icons and row geometry alone.
    const css = `
      .kB3qhq_root {
        --local-sidebar-ui-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-family: var(--local-sidebar-ui-font) !important;
        font-weight: 400;
      }
      .kB3qhq_root :is(.JoiKIa_title, .JoiKIa_searchResultTitle, .JoiKIa_renameInput, .kB3qhq_panelTitle) {
        font-family: var(--local-sidebar-ui-font) !important;
        font-size: 14px !important;
        line-height: 20px !important;
        font-weight: 400 !important;
      }
      @media (forced-colors: none) and (prefers-contrast: no-preference) {
        body:not([data-ds-dark-theme]) .kB3qhq_root [role="treeitem"]:not([aria-disabled="true"])
          :is(.JoiKIa_title, .JoiKIa_searchResultTitle) {
          color: color-mix(in srgb, currentColor 65%, black);
        }
      }
      .kB3qhq_root .JoiKIa_projectRow :is(.JoiKIa_title, .JoiKIa_renameInput) {
        line-height: 1.5 !important;
      }
    `;
    // Read rendered order only when invoked; no polling or DOM observer.
    // Off-screen rows in the scroll container count, collapsed/hidden rows do not.
    const rowSelector = '[role="treeitem"][data-row-key^="session:"], .JoiKIa_searchResultRow[role="treeitem"]';
    function sessionAt(index) {
      const sidebar = document.querySelector('.kB3qhq_root');
      if (!sidebar) return null;
      const rows = sidebar.querySelectorAll(rowSelector);
      let position = 0;
      for (const row of rows) {
        if (!row.isConnected || row.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
        if (row.getClientRects().length === 0) continue;
        const style = getComputedStyle(row);
        if (style.visibility === 'hidden' || style.visibility === 'collapse') continue;
        if (position++ === index) return row;
      }
      return null;
    }
    function SidebarTypography() {
      return React.createElement('style', { 'data-local-sidebar-font': 'system-ui' }, css);
    }
    return {
      inject: ['slots', 'shortcuts', 'locale'],
      apply(ctx) {
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'local-sidebar-typography', order: 1000,
        }, SidebarTypography));
        const t = ctx.locale.bind('localSidebarSessions');
        ctx.effect(() => ctx.locale.register('localSidebarSessions', {
          en: {
            first: 'Open sidebar session 1', second: 'Open sidebar session 2', third: 'Open sidebar session 3',
            unavailable: 'No session at this sidebar position', modal: 'Close the dialog before switching sessions',
          },
          zh: {
            first: '打开侧栏第 1 个会话', second: '打开侧栏第 2 个会话', third: '打开侧栏第 3 个会话',
            unavailable: '侧栏此位置没有会话', modal: '请先关闭弹窗再切换会话',
          },
        }));
        for (const [index, label] of ['first', 'second', 'third'].entries()) {
          ctx.effect(() => ctx.shortcuts.register({
            // Native Desktop protocol requires every dot segment to start with a letter.
            id: `local.sidebar.session.position${index + 1}`,
            label: () => t(label),
            aliases: ['sidebar session', `session ${index + 1}`],
            defaults: {'desktop:macos': {code: `Digit${index + 1}`, modifiers: ['primary']}},
            regions: ['page', 'editable', 'terminal'],
            modals: ['sidebar'],
            resolve: ({modal}) => {
              // Desktop commands can bypass the registry's modal gate.
              if (modal !== null && modal !== 'sidebar') return {status: 'blocked', reason: t('modal')};
              const row = sessionAt(index);
              if (!row) return {status: 'blocked', reason: t('unavailable')};
              return {status: 'handled', run: () => {
                if (row.isConnected) row.click();
              }};
            },
          }));
        }
      },
    };
}
