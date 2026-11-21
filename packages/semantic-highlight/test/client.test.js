import assert from 'node:assert/strict';
import test from 'node:test';
import {MARKERS, SCHEME} from '../src/prompt.js';

// Load the browser artifact against a fake module loader and document.
const listeners = new Map();
globalThis.document = {
  addEventListener: (type, handler) => listeners.set(type, handler),
  removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); },
};
let spec;
globalThis.window = {__ModuleLoader__: {load: value => { spec = value; }}};
await import('../src/client.js');

/** Minimal hook runtime: per-component state, effects run once like `[]` deps. */
function createReact() {
  const stores = new Map();
  let store, cursor = 0;
  return {
    createElement: (type, props, ...children) => ({type, props: props ?? {}, children}),
    useState(initial) {
      const index = cursor++;
      if (!(index in store.state)) store.state[index] = typeof initial === 'function' ? initial() : initial;
      return [store.state[index], value => { store.state[index] = value; }];
    },
    useEffect(effect) {
      const index = cursor++;
      if (index in store.state) return;
      store.state[index] = true;
      store.cleanups.push(effect());
    },
    render(component) {
      if (!stores.has(component)) stores.set(component, {state: [], cleanups: []});
      store = stores.get(component);
      cursor = 0;
      return component();
    },
  };
}

function find(node, test) {
  if (!node || typeof node !== 'object') return undefined;
  if (test(node)) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, test);
    if (hit) return hit;
  }
  return undefined;
}

function createForm(value, {status = 'ready', writable = true, accept = true} = {}) {
  let listener;
  const writes = [];
  return {
    writes,
    getSnapshot: () => ({value, status, writable}),
    subscribe: next => { listener = next; return () => { listener = undefined; }; },
    publish: next => { value = next; listener?.(); },
    subscribed: () => listener !== undefined,
    set: (field, next) => { writes.push([field, next]); return Promise.resolve(accept); },
  };
}

function mount({form} = {}) {
  const React = createReact();
  const plugin = spec.factory(name => {
    assert.equal(name, 'react');
    return React;
  });
  const disposers = [], registrations = [], dicts = {};
  const effect = install => { disposers.push(install()); };
  const slots = {
    inject: (key, callback) => { registrations.push({key}); callback(); },
    register: (options, component) => { Object.assign(registrations.at(-1), {options, component}); return () => {}; },
  };
  const locale = {
    register: (ns, id, dict) => { dicts[id] = {ns, dict}; return () => { delete dicts[id]; }; },
    bind: ns => key => dicts.en?.ns === ns ? dicts.en.dict[key] : key,
    getSnapshot: () => 'en',
    subscribe: () => () => {},
  };
  plugin.apply({
    effect, slots,
    inject: (deps, callback) => {
      assert.deepEqual(deps, ['slots', 'configForms', 'locale']);
      if (form) callback({effect, slots, locale, configForms: {get: id => { form.id = id; return form; }}});
    },
  });
  const entry = key => registrations.find(registration => registration.key === key);
  return {
    plugin, registrations, dicts, entry,
    style: () => React.render(entry('shell.overlay').component),
    settings: () => React.render(entry('plugins.bundle.config').component),
    dispose: () => { for (const dispose of disposers.reverse()) dispose?.(); },
  };
}

const mark = href => ({closest: () => (/^hl:/i.test(href) ? {} : null)});

test('registers under the package id and one additive overlay entry', () => {
  assert.equal(spec.id, 'dsh-semantic-highlight');
  const {plugin, registrations, dispose} = mount();
  assert.deepEqual(plugin.inject, ['slots']);
  // Without the settings mirror the stylesheet is the only contribution.
  assert.deepEqual(registrations.map(registration => registration.key), ['shell.overlay']);
  assert.equal(registrations[0].options.name, 'shell.overlay');
  assert.equal(registrations[0].options.id, 'semantic-highlight');
  dispose();
});

test('styles every marker the prompt teaches, case-insensitively, with balanced rules', () => {
  const {style, dispose} = mount();
  const element = style();
  assert.equal(element.type, 'style');
  assert.equal(element.props['data-semantic-highlight'], 'on');
  const text = element.children[0];
  for (const marker of MARKERS) assert.ok(text.includes(`a[href="${SCHEME}${marker}" i]`), marker);
  assert.ok(text.includes('a[href^="hl:" i]:empty'));
  assert.equal(text.split('{').length, text.split('}').length);
  assert.equal(text.split('(').length, text.split(')').length);
  // Emphasis must not move text: no size or line-height changes, weight only inherited.
  assert.doesNotMatch(text, /font-size|line-height/);
  for (const [, weight] of text.matchAll(/font-weight:\s*([^;!]+)/g)) assert.equal(weight.trim(), 'inherit');
  // Risk carries a cue besides hue.
  assert.match(text, /a\[href="hl:risk" i\] \{[^}]*box-shadow: inset/);
  dispose();
});

test('host switch off keeps markers inert but drops the colors, and follows later changes', () => {
  const form = createForm({enabled: false});
  const {style, dispose} = mount({form});
  assert.equal(form.id, 'semantic-highlight');
  let element = style();
  assert.equal(element.props['data-semantic-highlight'], 'off');
  assert.ok(element.children[0].includes('a[href^="hl:" i]'));
  assert.ok(!element.children[0].includes('a[href="hl:key" i]'));

  form.publish({enabled: true});
  element = style();
  assert.equal(element.props['data-semantic-highlight'], 'on');
  assert.ok(element.children[0].includes('a[href="hl:key" i]'));

  // A missing section (still loading or not served) counts as on.
  form.publish(undefined);
  assert.equal(style().props['data-semantic-highlight'], 'on');
  dispose();
  assert.equal(form.subscribed(), false);
});

test('settings entry shows a labelled switch and a legend, and writes the choice', async () => {
  const form = createForm({enabled: true});
  const {entry, settings, dicts, dispose} = mount({form});
  assert.equal(entry('plugins.bundle.config').options.key, 'dsh-semantic-highlight');
  assert.deepEqual(Object.keys(dicts).sort(), ['en', 'zh']);
  assert.deepEqual(Object.keys(dicts.en.dict).sort(), Object.keys(dicts.zh.dict).sort());
  assert.equal(dicts.en.dict.head, 'Recommended action / key step');
  assert.equal(dicts.zh.dict.head, '建议行动 / 关键步骤');

  const tree = settings();
  const control = find(tree, node => node.props.role === 'switch');
  assert.equal(control.type, 'button');
  assert.equal(control.props['aria-checked'], true);
  assert.equal(control.props['aria-label'], 'Highlight replies');
  assert.equal(control.props.disabled, false);
  const legend = find(tree, node => node.type === 'ul');
  assert.deepEqual(legend.children.map(item => item.children[0].props.href), MARKERS.map(marker => SCHEME + marker));
  // Legend samples are not tab stops.
  for (const item of legend.children) assert.equal(item.children[0].props.tabIndex, -1);
  assert.equal(find(tree, node => node.props.role === 'status'), undefined);

  control.props.onClick();
  await Promise.resolve();
  assert.deepEqual(form.writes, [['enabled', false]]);
  dispose();
  assert.deepEqual(dicts, {});
});

test('settings entry disables the switch and says so when the setting is not writable', () => {
  const form = createForm(undefined, {status: 'unavailable', writable: false});
  const {settings, dispose} = mount({form});
  const tree = settings();
  assert.equal(find(tree, node => node.props.role === 'switch').props.disabled, true);
  assert.equal(find(tree, node => node.props.role === 'status').children[0], 'This setting cannot be changed here.');
  dispose();
});

test('marker activation and drags are swallowed; ordinary links are left alone', () => {
  const {dispose} = mount();
  assert.deepEqual([...listeners.keys()].sort(), ['auxclick', 'click', 'dragstart']);
  for (const type of listeners.keys()) {
    let prevented = 0;
    const event = target => ({target, preventDefault: () => { prevented++; }});
    listeners.get(type)(event(mark('hl:risk')));
    assert.equal(prevented, 1, type);
    listeners.get(type)(event(mark('https://example.com')));
    // A text node target resolves through its parent element.
    listeners.get(type)(event({parentElement: mark('HL:key')}));
    assert.equal(prevented, 2, type);
    listeners.get(type)(event({}));
    assert.equal(prevented, 2, type);
  }
  dispose();
  assert.equal(listeners.size, 0);
});
