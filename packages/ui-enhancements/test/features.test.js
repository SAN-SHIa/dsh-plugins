import assert from 'node:assert/strict';
import test from 'node:test';
import {createFeature as closeFeature} from '../src/features/close-priority.js';
import {createFeature as sidechatFeature} from '../src/features/sidechat.js';
import {Config} from '../src/host.js';

test('host publishes five volatile settings with enabled defaults', () => {
  const fields = Object.values(Config.dict);
  assert.equal(fields.length, 5);
  for (const field of fields) {
    assert.equal(field.meta.volatile, true);
    assert.equal(field.meta.default, true);
  }
});

test('close priority restores original resolver on disposal', () => {
  const original = () => ({status: 'handled', run: () => {}});
  const command = {resolve: original};
  let cleanup, closed = 0;
  const target = {};
  closeFeature().apply({
    shortcuts: {registry: {commands: new Map([['page.close', command]])}},
    sidebarRight: {
      focusedTarget: () => target, isExpanded: () => true,
      canCloseTarget: () => true, isTargetCurrent: () => true,
      closeTarget: () => closed++,
    },
    effect: install => {cleanup = install();},
  });
  command.resolve({modal: null}).run();
  assert.equal(closed, 1);
  assert.equal(command.resolve({modal: 'dialog'}).status, 'handled');
  cleanup();
  assert.equal(command.resolve, original);
});

test('Side Chat command handles missing tab, opens when available, blocks dialogs', () => {
  let command, available = false, opened = 0;
  const target = {};
  sidechatFeature().apply({
    locale: {bind: () => key => key, register: () => () => {}},
    effect: install => install(),
    shortcuts: {register: value => {command = value; return () => {}; }},
    sidebarRightTabs: {get: () => available},
    sidebarRight: {commandTarget: () => target, isTargetCurrent: () => true, openTab: () => opened++},
  });
  assert.equal(command.resolve({modal: null}).status, 'blocked');
  available = true;
  command.resolve({modal: null}).run();
  assert.equal(opened, 1);
  assert.equal(command.resolve({modal: 'dialog'}).status, 'blocked');
  assert.match(command.id, /^[a-z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)+$/u);
});
