export function createFeature(require) {
    return {
      inject: ['shortcuts', 'sidebarRight', 'sidebarRightTabs', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind('localSidechatShortcut');
        ctx.effect(() => ctx.locale.register('localSidechatShortcut', {
          en: {open: 'Open new Side Chat', unavailable: 'Select a conversation with Side Chat available first'},
          zh: {open: '打开新的侧边对话', unavailable: '请先选择支持侧边对话的会话'},
        }));
        ctx.effect(() => ctx.shortcuts.register({
          id: 'local.sidechat.open',
          label: () => t('open'),
          aliases: ['Side Chat', 'side conversation'],
          defaults: {'desktop:macos': {code: 'KeyS', modifiers: ['primary', 'alt']}},
          regions: ['page', 'editable', 'terminal'],
          modals: [],
          resolve: ({modal}) => {
            if (modal !== null) return {status: 'blocked', reason: t('unavailable')};
            const target = ctx.sidebarRight.commandTarget(null);
            if (!target || !ctx.sidebarRightTabs.get('sidechat')) return {status: 'blocked', reason: t('unavailable')};
            return {status: 'handled', run: () => {
              if (ctx.sidebarRight.isTargetCurrent(target)) ctx.sidebarRight.openTab('sidechat');
            }};
          },
        }));
      },
    };
}
