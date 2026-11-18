export function createFeature(require) {
    const React = require('react');
    // Desktop 0.2.2-rc.3 supplies native vibrancy and paints the content columns.
    // Keep the material on one surface, not on every row (or the whole window).
    const frame = '.PIRFFq_frame:not([data-sidebar-drawer]):not([data-sidebar-collapsed])';
    const desktop = 'html[data-platform="darwin"]';
    const column = `${desktop} ${frame} > .PIRFFq_sidebarCol`;
    const session = '[role="treeitem"]:is([data-row-key^="session:"], .JoiKIa_searchResultRow)';
    const css = `
      @media (min-width: 768px) and (prefers-reduced-transparency: no-preference)
        and (prefers-contrast: no-preference) and (forced-colors: none) {
        /* Only the backdrop needs an ancestor guard for third-party skins.
           Hover and selection match the column directly, not the document state. */
        ${desktop}:has(${frame}) :is(body, #root), ${desktop}:has(${frame}), ${desktop} ${frame} {
          background: transparent !important;
        }
        ${column} {
          background: linear-gradient(155deg,
              var(--dsw-specific-sidebar-wash-top, transparent), transparent 44%,
              transparent 72%, var(--dsw-specific-sidebar-wash-bottom, transparent)),
            color-mix(in srgb, var(--dsw-specific-sidebar-fill) 40%, transparent) !important;
        }
        ${column} .kB3qhq_root { background: transparent !important; }
        @media (hover: hover) {
          ${column} ${session}:not([aria-selected="true"]):hover {
            background-color: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent) !important;
          }
        }
        ${column} ${session}[aria-selected="true"] {
          background-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent) !important;
        }
      }
    `;
    function GlassStyle() {
      return React.createElement('style', { 'data-local-sidebar-glass': true }, css);
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action', id: 'local-sidebar-glass', order: 1001,
        }, GlassStyle));
      },
    };
}
