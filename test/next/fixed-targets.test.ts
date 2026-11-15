import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { findFixedTargets, pinForTransition, resolveFixedSelectors } from '../../src/next/fixed-targets.ts';

test('a route exception releases only its target in both directions', () => {
  const targets = [{ selector: '#header', exceptRoutes: ['/checkout'] }, '#player'];
  assert.deepEqual(resolveFixedSelectors(targets, '/', '/catalog'), ['#header', '#player']);
  assert.deepEqual(resolveFixedSelectors(targets, '/catalog', '/checkout/?step=2'), ['#player']);
  assert.deepEqual(resolveFixedSelectors(targets, '/checkout#payment', '/catalog'), ['#player']);
  assert.deepEqual(resolveFixedSelectors(targets, '/', '/checkout/history'), ['#header', '#player']);
});

test('legacy query exceptions do not release fixed targets', () => {
  const targets = [{ selector: '#header', exceptRoutes: ['/feed?panel=details&tag=day+trip'] }, '#player'];
  const details = '/feed?tag=day%20trip&city=seoul&panel=details#top';
  assert.deepEqual(resolveFixedSelectors(targets, '/feed', details), ['#header', '#player']);
  assert.deepEqual(resolveFixedSelectors(targets, details, '/feed'), ['#header', '#player']);
  assert.deepEqual(resolveFixedSelectors(targets, '/feed', '/feed?panel=details&tag=city'), ['#header', '#player']);
});

test('regexp exceptions match either pathname and callbacks match ordered app URLs', () => {
  const pattern = /^\/orders(?:\/|$)/g;
  pattern.lastIndex = 3;
  const targets = [
    { selector: '#header', exceptRoutes: [pattern] },
    { selector: '#bar', exceptTransition: (from: string, to: string) => from === '/' && to === '/half?size=m#menu' },
  ];
  assert.deepEqual(resolveFixedSelectors(targets, '/orders/123/?status=open', '/'), ['#bar']);
  assert.deepEqual(resolveFixedSelectors(targets, '/', '/orders/#latest'), ['#bar']);
  assert.equal(pattern.lastIndex, 3);
  assert.deepEqual(resolveFixedSelectors(targets, '/', '/half?size=m#menu'), ['#header']);
  assert.deepEqual(resolveFixedSelectors(targets, '/half?size=m#menu', '/'), ['#header', '#bar']);
});

test('fixed targets stay in the DOM, ignore nested duplicates and release their transition markers', () => {
  const win = new Window();
  win.document.body.innerHTML = '<main><div class="fixed"><span class="fixed"></span></div><div class="fixed" hidden></div></main><div class="fixed"></div>';
  const root = win.document.querySelector('main')!;
  const [target, nested, hidden] = root.querySelectorAll('.fixed');
  root.getBoundingClientRect = () => new win.DOMRect(0, 0, 400, 400);
  for (const element of [target, nested, hidden]) {
    element.getBoundingClientRect = () => new win.DOMRect(0, 0, 100, 24);
    Object.defineProperty(element, 'getClientRects', { value: () => ({ length: element === hidden ? 0 : 1 }) });
  }
  const content = root as unknown as HTMLElement;
  const targets = findFixedTargets(content, ['[', '.fixed', '.fixed']);
  assert.deepEqual([...targets], [target]);
  const pin = pinForTransition(content, targets)!;
  assert.equal(target.parentElement, root);
  assert.equal(target.hasAttribute('data-stackflow-fixed-target'), true);
  assert.equal(pin.captureDestination(targets), true);
  target.getBoundingClientRect = () => new win.DOMRect(0, 10, 100, 24);
  assert.equal(pin.captureDestination(targets), false);
  pin.dispose();
  assert.equal(target.hasAttribute('data-stackflow-fixed-target'), false);
});
