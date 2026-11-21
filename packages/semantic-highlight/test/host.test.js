import assert from 'node:assert/strict';
import test from 'node:test';
import {HIGHLIGHT_PROMPT, SECTION_NAME} from '../src/prompt.js';

function promptRegistry() {
  const sections = [];
  return {sections, ctx: {systemPrompt: {section: section => { sections.push(section); return () => {}; }}}};
}

test('config exposes one volatile enabled switch that defaults to on', async () => {
  const {Config} = await import('../src/host.js');
  assert.deepEqual(Object.keys(Config.dict), ['enabled']);
  assert.equal(Config.dict.enabled.meta.default, true);
  // Only volatile fields are served to the browser, where the switch lives.
  assert.equal(Config.dict.enabled.meta.volatile, true);
  assert.equal(Config({}).enabled.get(), true);
  assert.equal(Config({enabled: false}).enabled.get(), false);
});

test('host registers one section whose text follows the parsed config', async () => {
  const host = await import('../src/host.js');
  assert.deepEqual(host.inject, ['systemPrompt']);

  const on = promptRegistry();
  host.apply(on.ctx, host.Config({}));
  assert.deepEqual(on.sections.map(section => section.name), [SECTION_NAME]);
  assert.equal(on.sections[0].text(), HIGHLIGHT_PROMPT);

  const off = promptRegistry();
  host.apply(off.ctx, host.Config({enabled: false}));
  assert.equal(off.sections.length, 1);
  assert.equal(off.sections[0].text(), '');

  // A row without config still highlights.
  const omitted = promptRegistry();
  host.apply(omitted.ctx, undefined);
  assert.equal(omitted.sections[0].text(), HIGHLIGHT_PROMPT);
});
