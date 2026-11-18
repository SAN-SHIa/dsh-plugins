import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/features/typography-sessions.js', import.meta.url), 'utf8').replace('export function createFeature', 'function createFeature') + '\nwindow.__ModuleLoader__.load({factory: createFeature});';

function row(options = {}) {
  return {
    isConnected: true, clicks: 0,
    closest: () => options.hidden ? {} : null,
    getClientRects: () => options.collapsed ? [] : [{}],
    visibility: options.visibility ?? 'visible',
    click() { this.clicks++; },
    ...options,
  };
}

function setup(rows = []) {
  let plugin;
  let queryCount = 0;
  const commands = [];
  const cleanup = [];
  let Style;
  vm.runInNewContext(source, {
    window: {__ModuleLoader__: {load(definition) {
      plugin = definition.factory(() => ({createElement: (...args) => args}));
    }}},
    document: {querySelector(selector) {
      assert.equal(selector, '.kB3qhq_root');
      queryCount++;
      return rows && {querySelectorAll(rowSelector) {
        assert.match(rowSelector, /data-row-key/);
        return rows;
      }};
    }},
    getComputedStyle: element => ({visibility: element.visibility}),
  });
  plugin.apply({
    slots: {
      inject: (_name, install) => install(),
      register: (_meta, component) => { Style = component; },
    },
    locale: {bind: () => key => key, register: () => () => {}},
    shortcuts: {register: command => {
      commands.push(command);
      return () => commands.splice(commands.indexOf(command), 1);
    }},
    effect: install => cleanup.push(install()),
  });
  return {commands, cleanup, css: Style()[2], queries: () => queryCount};
}

test('uses local system faces on sidebar labels without global font overrides', () => {
  const {css} = setup();
  assert.match(css, /--local-sidebar-ui-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/);
  assert.match(css, /font-weight: 400;/);
  assert.match(css, /font-weight: 400 !important;/);
  assert.match(css, /\.JoiKIa_projectRow [^{]+\{\s*line-height: 1\.5/);
  assert.match(css, /\.kB3qhq_root :is\([^)]*\.JoiKIa_title[^)]*\.JoiKIa_searchResultTitle[^)]*\.JoiKIa_renameInput/);
  assert.match(css, /font-size: 14px/);
  assert.match(css, /line-height: 20px/);
  assert.doesNotMatch(css, /PingFang SC|@font-face|\burl\(|(?:body|html)\s*\{/);
});

test('deepens only light-theme tree titles without overriding accessibility colors', () => {
  const {css} = setup();
  assert.match(css, /@media \(forced-colors: none\) and \(prefers-contrast: no-preference\)\s*\{\s*body:not\(\[data-ds-dark-theme\]\) \.kB3qhq_root \[role="treeitem"\]:not\(\[aria-disabled="true"\]\)\s+:is\(\.JoiKIa_title, \.JoiKIa_searchResultTitle\)\s*\{\s*color: color-mix\(in srgb, currentColor 65%, black\);/);
});

test('registers three macOS commands without querying on startup', () => {
  const state = setup();
  assert.equal(state.queries(), 0);
  assert.equal(state.commands.length, 3);
  state.commands.forEach((command, i) => {
    assert.equal(command.defaults['desktop:macos'].code, `Digit${i + 1}`);
    assert.deepEqual(Array.from(command.defaults['desktop:macos'].modifiers), ['primary']);
    assert.equal(command.defaults['web:macos'], undefined);
    assert.ok(command.regions.includes('editable'));
    assert.ok(command.regions.includes('terminal'));
  });
});

test('command IDs satisfy the native Desktop protocol', () => {
  for (const command of setup().commands) {
    assert.match(command.id, /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$/u);
  }
});

test('installed Desktop protocol accepts definitions and rejects the old numeric IDs', {
  skip: !process.env.DSH_SHORTCUT_PROTOCOL_URL,
}, async () => {
  // Point this at protocol.js extracted from the installed application archive.
  const {parseShortcutDefinitions, effectiveShortcuts, initialShortcutConfig} = await import(process.env.DSH_SHORTCUT_PROTOCOL_URL);
  const definitions = JSON.parse(JSON.stringify(setup().commands.map(({id, defaults}) => ({id, defaults}))));
  const invalid = definitions.map((command, i) => ({...command, id: `local.sidebar.session.${i + 1}`}));
  assert.throws(() => parseShortcutDefinitions(invalid), /Invalid shortcut definition/);
  const parsed = parseShortcutDefinitions(definitions);
  const rows = effectiveShortcuts(parsed, initialShortcutConfig().document, 'desktop', 'macos');
  assert.equal(rows.length, 3);
  rows.forEach((item, i) => {
    assert.equal(item.issue, null);
    assert.deepEqual(item.conflicts, []);
    assert.equal(item.binding.code, `Digit${i + 1}`);
    assert.deepEqual(item.binding.modifiers, ['meta']);
  });
});

test('opens each session in rendered order, including offscreen rows', () => {
  const rows = [row(), row(), row()];
  const {commands} = setup(rows);
  commands.forEach(command => {
    const result = command.resolve({modal: null});
    assert.equal(result.status, 'handled');
    result.run();
  });
  assert.deepEqual(rows.map(item => item.clicks), [1, 1, 1]);
});

test('skips disconnected, hidden, collapsed, and invisible rows', () => {
  const target = row();
  const {commands} = setup([
    row({isConnected: false}), row({hidden: true}), row({collapsed: true}),
    row({visibility: 'hidden'}), row({visibility: 'collapse'}), target,
  ]);
  commands[0].resolve({modal: null}).run();
  assert.equal(target.clicks, 1);
  assert.equal(commands[1].resolve({modal: null}).status, 'blocked');
});

test('reads current order on each invocation', () => {
  const first = row(), second = row();
  const rows = [first, second];
  const {commands} = setup(rows);
  commands[0].resolve({modal: null}).run();
  rows.reverse();
  commands[0].resolve({modal: null}).run();
  assert.deepEqual([first.clicks, second.clicks], [1, 1]);
});

test('blocks dialogs but permits the sidebar navigation drawer', () => {
  const target = row();
  const {commands, queries} = setup([target]);
  assert.equal(commands[0].resolve({modal: 'dialog'}).status, 'blocked');
  assert.equal(queries(), 0);
  commands[0].resolve({modal: 'sidebar'}).run();
  assert.equal(target.clicks, 1);
});

test('handles empty sidebar and detached target safely', () => {
  assert.equal(setup(null).commands[0].resolve({modal: null}).status, 'blocked');
  assert.equal(setup().commands[0].resolve({modal: null}).status, 'blocked');
  const target = row();
  const result = setup([target]).commands[0].resolve({modal: null});
  target.isConnected = false;
  result.run();
  assert.equal(target.clicks, 0);
});

test('unregisters all commands when disposed', () => {
  const state = setup();
  for (const dispose of state.cleanup.reverse()) dispose();
  assert.equal(state.commands.length, 0);
});
