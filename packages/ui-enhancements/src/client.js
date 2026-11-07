// The entry only orchestrates independently disposable feature scopes.
export function createPlugin(require) {
  const features = {typographySessions, sidebarGlass, fileTooltips, closePriority, sidechatShortcut};
  return {
    inject: ['configForms'],
    apply(ctx) {
      const scope = ctx.configForms.get('local-ui-enhancements');
      const active = new Map();
      const sync = () => {
        const config = scope.getSnapshot().value;
        if (config === undefined) return;
        for (const [key, create] of Object.entries(features)) {
          if (config[key] !== false && !active.has(key)) {
            // Missing optional services only suspend their own feature scope.
            active.set(key, ctx.plugin(create(require)));
          } else if (config[key] === false && active.has(key)) {
            active.get(key).dispose();
            active.delete(key);
          }
        }
      };
      ctx.effect(() => scope.subscribe(sync));
      ctx.effect(() => () => {
        for (const fork of active.values()) fork.dispose();
        active.clear();
      });
      sync();
    },
  };
}
