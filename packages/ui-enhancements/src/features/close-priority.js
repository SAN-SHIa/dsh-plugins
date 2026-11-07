export function createFeature(require) {
    return {
      inject: ['shortcuts', 'sidebarRight'],
      apply(ctx) {
        // Compatibility adapter for the installed 0.2.2-rc.1 registry.
        // Preserve the shipped command, binding, modal handling and cleanup path.
        ctx.effect(() => {
          const command = ctx.shortcuts.registry?.commands?.get('page.close');
          const sidebar = ctx.sidebarRight;
          if (!command || typeof command.resolve !== 'function') throw new Error('Unsupported page.close registry');
          const original = command.resolve;
          const resolve = input => {
            if (input.modal !== null) return original(input);
            const focused = sidebar.focusedTarget(input.target);
            const target = focused ?? (sidebar.isExpanded() ? sidebar.commandTarget(null) : undefined);
            if (target && sidebar.canCloseTarget(target)) return {
              status: 'handled', run: () => {
                if (sidebar.isTargetCurrent(target)) sidebar.closeTarget(target);
              },
            };
            if (sidebar.isExpanded()) return {
              status: 'handled', run: () => {
                if (sidebar.isExpanded()) sidebar.toggleExpanded();
              },
            };
            return original(input);
          };
          command.resolve = resolve;
          return () => { if (command.resolve === resolve) command.resolve = original; };
        }, 'Prefer sidebar page before closing the desktop window');
      },
    };
}
