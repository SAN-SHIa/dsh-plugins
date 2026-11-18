import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeature} from '../src/features/file-tooltips.js';

// Drive the registered overlay through its real handlers; count requested work,
// not elapsed CPU time or renders that React might bail out of.
function mount(t) {
  const counts = {lookups:0, reads:0, timers:0, updates:0, viewportReads:0};
  class Element {
    constructor(attrs = {}, parent = null, tag = 'span') {
      Object.assign(this, {attrs, parentElement:parent, tag, isConnected:true});
    }
    getAttribute(name) { counts.reads++; return this.attrs[name] ?? null; }
    closest(selector) {
      counts.lookups++;
      for (let el = this; el; el = el.parentElement) {
        if (selector.split(', ').some(part => {
          const [, tag, attr] = /^(\w*)\[([\w-]+)\]$/.exec(part);
          return (!tag || tag === el.tag) && attr in el.attrs;
        })) return el;
      }
      return null;
    }
    contains(node) {
      for (; node; node = node.parentElement) if (node === this) return true;
      return false;
    }
  }
  function events() {
    const listeners = new Map();
    const key = (name, opts) => name + Boolean(opts === true || opts?.capture);
    return {
      listeners,
      addEventListener(name, fn, opts) { listeners.set(key(name, opts), fn); },
      removeEventListener(name, fn, opts) {
        if (listeners.get(key(name, opts)) === fn) listeners.delete(key(name, opts));
      },
      emit(name, event = {}) {
        listeners.get(key(name, true))?.(event);
        listeners.get(key(name, false))?.(event);
      },
    };
  }
  const doc = events(), win = {
    ...events(),
    get innerWidth() { counts.viewportReads++; return 1280; },
    get innerHeight() { counts.viewportReads++; return 720; },
  };
  // Install per-test globals and restore their original descriptors on exit.
  const restore = [];
  for (const [name, value] of Object.entries({window:win, document:doc, Node:Element, Element})) {
    const old = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {value, configurable:true});
    restore.push(() => old ? Object.defineProperty(globalThis, name, old) : delete globalThis[name]);
  }
  t.mock.timers.enable({apis:['setTimeout']});
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (...args) => { counts.timers++; return schedule(...args); });
  let tip = null, component, cleanup;
  const react = {
    useState:() => [tip, value => { counts.updates++; tip = value; }],
    useEffect:setup => { cleanup ??= setup(); },
    createElement:(type, props, text) => ({type, ...props, text}),
  };
  createFeature(() => react).apply({slots:{inject:(_, fn) => fn(), register:(_, fn) => { component = fn; }}});
  assert.equal(component(), null);
  const dispose = () => { cleanup?.(); cleanup = null; };
  t.after(() => { try { dispose(); } finally { restore.forEach(fn => fn()); } });
  return {
    counts, Element, doc, win, render:component, dispose,
    over:(target, x = 21, y = 31) => doc.emit('pointerover', {target, clientX:x, clientY:y}),
    out:(target, relatedTarget) => doc.emit('pointerout', {target, relatedTarget}),
    tick:ms => t.mock.timers.tick(ms),
  };
}

test('uses existing file link forms, attribute priority and title filtering', t => {
  const h = mount(t);
  for (const [attrs, expected] of [
    [{href:'dsh-resource://file/session/s1/docs/a%20b.md'}, 'docs/a b.md'],
    [{href:'dsh-resource://file/session/s1//fixture/a.md#L10'}, '/fixture/a.md#L10'],
    [{'data-resource-address':'dsh-resource://file/session/s1/C:/work/a.md'}, 'C:/work/a.md'],
    [{href:'file:///fixture/a%20b.md'}, '/fixture/a b.md'],
    [{href:'docs/a.md'}, 'docs/a.md'],
    [{'data-file-path':'priority', 'data-path':'second', href:'third'}, 'priority'],
    [{'data-path':'C:\\work\\a.md'}, 'C:\\work\\a.md'],
    [{href:'https://example.com', title:'~/docs/a.md'}, '~/docs/a.md'],
    [{href:'broken%path'}, 'broken%path'],
  ]) {
    const link = new h.Element(attrs, null, 'a');
    h.over(new h.Element({}, link));
    h.tick(99);
    assert.equal(h.render(), null);
    h.tick(1);
    assert.equal(h.render().text, expected);
    h.out(link, null);
    assert.equal(h.render(), null);
  }
  const before = h.counts.timers;
  for (const href of ['https://example.com', 'mailto:a@b.com', '#anchor', 'dsh-resource://file/unknown/path', 'dsh-session:abc']) {
    h.over(new h.Element({href}, null, 'a'));
  }
  h.over(new h.Element({title:'Help'}));
  assert.equal(h.counts.timers, before);
});

test('idle pointer and scroll bursts schedule no timers or state updates', t => {
  const h = mount(t), plain = new h.Element();
  assert.ok(!h.doc.listeners.has('scrolltrue'));
  for (let i = 0; i < 100; i++) {
    h.over(plain);
    h.out(plain, null);
    h.doc.emit('scroll');
  }
  assert.deepEqual(h.counts, {lookups:100, reads:0, timers:0, updates:0, viewportReads:0});
});

test('crossing descendants retains the original hover deadline and coordinates', t => {
  const h = mount(t), link = new h.Element({'data-file-path':'a.md'});
  const a = new h.Element({}, link), b = new h.Element({}, link);
  h.over(a, 25, 45);
  h.tick(99);
  for (let i = 0; i < 100; i++) {
    h.out(a, b); h.over(b);
    h.out(b, a); h.over(a);
  }
  assert.equal(h.render(), null);
  h.tick(1);
  const tip = h.render();
  assert.equal(tip.text, 'a.md');
  assert.equal(tip.style.left, 25);
  assert.equal(tip.style.top, 65);
  h.out(a, b); h.over(b); h.tick(100);
  assert.equal(h.counts.reads, 1);
  assert.equal(h.counts.timers, 1);
  assert.equal(h.counts.updates, 1);
  for (let i = 0; i < 10; i++) h.render();
  assert.equal(h.counts.viewportReads, 2);
  h.doc.emit('scroll');
  for (let i = 0; i < 100; i++) h.doc.emit('scroll');
  assert.equal(h.render(), null);
  assert.equal(h.counts.updates, 2);
});

test('switches nested targets and dismisses pending or visible tooltips', t => {
  const h = mount(t), outer = new h.Element({'data-path':'outer'}), inner = new h.Element({'data-path':'inner'}, outer);
  h.over(outer); h.tick(80);
  h.out(outer, inner); h.over(inner); h.tick(99);
  assert.equal(h.render(), null);
  h.tick(1); assert.equal(h.render().text, 'inner');
  h.out(inner, outer); h.over(outer); h.tick(100);
  assert.equal(h.render().text, 'outer');
  h.doc.emit('keydown', {key:'Enter'});
  assert.equal(h.render().text, 'outer');
  for (const dismiss of [() => h.doc.emit('keydown', {key:'Escape'}), () => h.doc.emit('pointerdown'),
    () => h.doc.emit('scroll'), () => h.win.emit('blur'), () => h.out(outer, null)]) {
    dismiss(); assert.equal(h.render(), null);
    const before = h.counts.updates;
    h.over(outer); h.tick(99); dismiss(); h.tick(1);
    assert.equal(h.counts.updates, before);
    h.over(outer); h.tick(100); assert.equal(h.render().text, 'outer');
  }
});

test('detached pending targets and unmount cannot publish a stale tooltip', t => {
  const h = mount(t), link = new h.Element({'data-path':'a.md'});
  h.over(link); link.isConnected = false; h.tick(100);
  assert.equal(h.render(), null);
  link.isConnected = true; h.over(link); h.dispose(); h.tick(100);
  assert.equal(h.counts.updates, 0);
  assert.equal(h.doc.listeners.size + h.win.listeners.size, 0);
});
