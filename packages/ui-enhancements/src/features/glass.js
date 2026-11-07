export function createFeature(require) {
    const React = require('react');
    // This Desktop release already enables BrowserWindow vibrancy: sidebar.
    // Only expose it in the ordinary macOS sidebar; keep drawers and content opaque.
    // CSS-module class names are tied to the inspected 0.2.2-rc.1 build.
    const css = `
      @media (min-width: 768px) {
        html[data-platform="darwin"], html[data-platform="darwin"] body,
        html[data-platform="darwin"] #root { background: transparent !important; }
        html[data-platform="darwin"] .PIRFFq_frame { background: transparent !important; }
        html[data-platform="darwin"] .PIRFFq_frame:not([data-sidebar-drawer]) .PIRFFq_sidebarCol {
          background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 75%, transparent) !important;
        }
        html[data-platform="darwin"] .PIRFFq_frame:not([data-sidebar-drawer]) .kB3qhq_root {
          background: transparent !important;
        }
        html[data-platform="darwin"] .PIRFFq_centerCol,
        html[data-platform="darwin"] .PIRFFq_bottomRow {
          background: var(--dsw-alias-bg-base) !important;
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
