// Client half: turns `hl:` marker links into highlighter strokes and keeps them inert.
// The host Markdown renderer already emits <a href="hl:..."> for these links while a
// reply streams, so this file only styles them; it renders and rewrites no message DOM.
window.__ModuleLoader__.load({
  id: 'dsh-semantic-highlight',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PACKAGE = 'dsh-semantic-highlight';
    const ENTRY_ID = 'semantic-highlight';
    const NS = 'localSemanticHighlight';
    // Case-insensitive: the host passes a destination through as the model wrote it.
    const MARK = 'a[href^="hl:" i]';
    const mark = name => `a[href="hl:${name}" i]`;
    const FILLS = `${mark('key')}, ${mark('risk')}, ${mark('head')}`;
    const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

    // Always on while the plugin is loaded: a marker never looks or acts like a link,
    // including unknown marker names and the "highlights off" state.
    const BASE_CSS = `
      ${MARK} {
        color: inherit !important;
        font-weight: inherit !important;
        text-decoration: none !important;
        border: 0 !important;
        margin: 0 !important;
        cursor: text !important;
        -webkit-user-drag: none;
      }
      ${MARK} > svg { display: none !important; }
      ${MARK}:empty { display: none !important; }
      @media (forced-colors: active) {
        ${MARK} { forced-color-adjust: none; color: CanvasText !important; }
      }
    `;

    // Tints follow the theme's state tokens; the yellow leans on a literal because the
    // theme has no yellow. Inline padding and background leave font size and line height alone.
    const COLOR_CSS = `
      ${FILLS} {
        padding: 1px 3px;
        margin: 0 1px !important;
        border-radius: 3px;
        background-color: var(--local-hl-tint);
        -webkit-box-decoration-break: clone;
        box-decoration-break: clone;
      }
      ${mark('key')} {
        --local-hl-tint: ${tint('color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, yellow)', 34)};
      }
      ${mark('risk')} {
        --local-hl-tint: ${tint('var(--dsw-alias-state-error-primary)', 24)};
        /* A second cue besides hue, for readers who cannot tell red from green. */
        box-shadow: inset 0 -2px 0 var(--dsw-alias-state-error-primary);
      }
      ${mark('head')} { --local-hl-tint: ${tint('var(--dsw-alias-state-success-primary)', 26)}; }
      ${mark('note')} {
        text-decoration: underline 2px var(--dsw-alias-brand-primary) !important;
        text-underline-offset: 3px !important;
      }
      @media (forced-colors: active) {
        ${FILLS} { background-color: Mark; color: MarkText !important; box-shadow: none; }
        ${mark('risk')} { text-decoration: underline wavy !important; }
        ${mark('note')} { text-decoration: underline 2px CanvasText !important; }
      }
    `;

    // The settings row on this plugin's page; classes are this plugin's own.
    const SETTINGS_CSS = `
      .local-hl-settings { display: flex; flex-direction: column; gap: 12px; padding: 12px 0; }
      .local-hl-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
      .local-hl-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .local-hl-title { font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--dsw-alias-label-primary); }
      .local-hl-desc { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .local-hl-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none;
        font-size: 13px; line-height: 24px; color: var(--dsw-alias-label-primary); }
      .local-hl-switch { box-sizing: border-box; position: relative; flex: 0 0 auto; width: 36px; height: 20px;
        padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3); cursor: pointer; }
      .local-hl-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
      .local-hl-switch:disabled { cursor: default; opacity: .5; }
      .local-hl-switch:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
        outline-offset: 2px;
      }
      .local-hl-thumb { display: block; width: 16px; height: 16px; border-radius: 50%;
        background: var(--dsw-alias-label-primary-foreground, #fff); transition: transform .12s ease; }
      .local-hl-switch[aria-checked="false"] .local-hl-thumb { background: var(--dsw-alias-switch-thumb, #fff); }
      .local-hl-switch[aria-checked="true"] .local-hl-thumb { transform: translate(16px); }
      @media (prefers-reduced-motion: reduce) { .local-hl-thumb { transition: none; } }
    `;

    const DICTS = {
      en: {
        title: 'Highlight replies',
        description: 'The model marks what matters and the marks show in color. Off: no new marks, and existing ones show as plain text.',
        unavailable: 'This setting cannot be changed here.',
        failed: 'The change was not saved.',
        key: 'Key point', risk: 'Risk', head: 'Recommended action / key step', note: 'Qualifier',
      },
      zh: {
        title: '高亮回复',
        description: '模型标记重点，标记按颜色显示。关闭后不再产生新标记，已有标记显示为普通文本。',
        unavailable: '此处无法修改该设置。',
        failed: '修改未保存。',
        key: '重点', risk: '风险', head: '建议行动 / 关键步骤', note: '限定词',
      },
    };

    /** Tiny observable for the Host switch; defaults to on until a value arrives. */
    function createSwitch() {
      let enabled = true;
      const listeners = new Set();
      return {
        get: () => enabled,
        set(next) {
          if (next === enabled) return;
          enabled = next;
          for (const listener of listeners) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    }

    /** Re-render a component whenever `source` publishes; returns its current snapshot. */
    function useSource(source, read) {
      const [value, setValue] = React.useState(read);
      React.useEffect(() => {
        const sync = () => setValue(read());
        sync();
        return source.subscribe(sync);
      }, []);
      return value;
    }

    function markOf(target) {
      const element = typeof target?.closest === 'function' ? target : target?.parentElement;
      return element?.closest?.(MARK) ?? null;
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const highlights = createSwitch();

        function HighlightStyle() {
          const enabled = useSource(highlights, highlights.get);
          return h(
            'style',
            {'data-semantic-highlight': enabled ? 'on' : 'off'},
            enabled ? BASE_CSS + COLOR_CSS : BASE_CSS,
          );
        }

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'semantic-highlight', order: 1002,
        }, HighlightStyle));

        // `hl:` is not a navigable scheme: swallow activation by mouse, keyboard, or
        // middle click, and keep a drag from carrying the marker away as a link.
        ctx.effect(() => {
          const guard = event => {
            if (markOf(event.target)) event.preventDefault();
          };
          const types = ['click', 'auxclick', 'dragstart'];
          for (const type of types) document.addEventListener(type, guard, true);
          return () => {
            for (const type of types) document.removeEventListener(type, guard, true);
          };
        });

        // The settings mirror is optional: without it highlights simply stay on.
        ctx.inject(['slots', 'configForms', 'locale'], inner => {
          const form = inner.configForms.get(ENTRY_ID);
          const sync = () => highlights.set(form.getSnapshot().value?.enabled !== false);
          inner.effect(() => form.subscribe(sync));
          inner.effect(() => () => highlights.set(true));
          sync();

          for (const [locale, dict] of Object.entries(DICTS)) {
            inner.effect(() => inner.locale.register(NS, locale, dict));
          }
          const t = inner.locale.bind(NS);

          function HighlightSettings() {
            const snapshot = useSource(form, () => form.getSnapshot());
            useSource(inner.locale, () => inner.locale.getSnapshot());
            const [pending, setPending] = React.useState(false);
            const [failed, setFailed] = React.useState(false);
            const checked = snapshot.value?.enabled !== false;
            const usable = snapshot.status === 'ready' && snapshot.writable;
            const toggle = () => {
              setPending(true);
              setFailed(false);
              form.set('enabled', !checked)
                .then(accepted => { if (!accepted) setFailed(true); }, () => setFailed(true))
                .finally(() => setPending(false));
            };
            return h('div', {className: 'local-hl-settings'},
              h('style', null, SETTINGS_CSS),
              h('div', {className: 'local-hl-row'},
                h('div', {className: 'local-hl-text'},
                  h('div', {className: 'local-hl-title'}, t('title')),
                  h('p', {className: 'local-hl-desc'}, t('description'))),
                h('button', {
                  type: 'button', role: 'switch', className: 'local-hl-switch',
                  'aria-checked': checked, 'aria-label': t('title'),
                  disabled: !usable || pending, onClick: toggle,
                }, h('span', {className: 'local-hl-thumb'}))),
              // The legend uses the live marker styles, so it previews both states.
              h('ul', {className: 'local-hl-legend'},
                ...['key', 'risk', 'head', 'note'].map(name =>
                  h('li', {key: name}, h('a', {href: `hl:${name}`, tabIndex: -1}, t(name))))),
              snapshot.status !== 'loading' && !usable
                && h('p', {className: 'local-hl-desc', role: 'status'}, t('unavailable')),
              failed && h('p', {className: 'local-hl-desc', role: 'alert'}, t('failed')));
          }

          inner.slots.inject('plugins.bundle.config', () => inner.slots.register({
            name: 'plugins.bundle.config', key: PACKAGE,
          }, HighlightSettings));
        });
      },
    };
  },
});
