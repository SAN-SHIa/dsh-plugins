import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const keys = ['typographySessions', 'sidebarGlass', 'fileTooltips', 'closePriority', 'sidechatShortcut'];
function setup(value) {
  let plugin, subscriber;
  let snapshot = arguments.length === 0 ? {} : value;
  const forks = [], cleanups = [];
  vm.runInNewContext(source, {window: {__ModuleLoader__: {load(definition) {
    assert.equal(definition.id, 'dsh-sanshi-ui-enhancements');
    plugin = definition.factory(() => ({}));
  }}}});
  plugin.apply({
    configForms: {get(id) {
      assert.equal(id, 'local-ui-enhancements');
      return {getSnapshot: () => ({value: snapshot}), subscribe(callback) {
        subscriber = callback; return () => {subscriber = null;};
      }};
    }},
    plugin(feature) {
      const fork = {feature, disposed: false, dispose() { this.disposed = true; }};
      forks.push(fork); return fork;
    },
    effect(install) {cleanups.push(install());},
  });
  return {forks, update(value) {snapshot = value; subscriber();}, dispose() {for (const fn of cleanups.reverse()) fn();}};
}

test('one module entry installs five independently scoped features', () => {
  const state = setup();
  assert.equal(state.forks.length, 5);
  assert.ok(state.forks.every(fork => typeof fork.feature.apply === 'function'));
});
test('all independent configuration switches suppress their feature', () => {
  for (const key of keys) assert.equal(setup({[key]: false}).forks.length, 4);
  assert.equal(setup(Object.fromEntries(keys.map(key => [key, false]))).forks.length, 0);
});
test('waits for accepted host config without eagerly applying defaults', () => {
  const state = setup(undefined);
  assert.equal(state.forks.length, 0);
  state.update({});
  assert.equal(state.forks.length, 5);
});
test('live toggle disposes and re-enables only the changed feature', () => {
  const state = setup();
  state.update({sidebarGlass: false});
  assert.equal(state.forks[1].disposed, true);
  assert.equal(state.forks.filter(f => f.disposed).length, 1);
  state.update({sidebarGlass: false});
  assert.equal(state.forks.length, 5);
  state.update({sidebarGlass: true});
  assert.equal(state.forks.length, 6);
  state.dispose();
  assert.ok(state.forks.every(fork => fork.disposed));
});
