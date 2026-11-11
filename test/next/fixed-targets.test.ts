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
  assert.equal(pin.stable(targets), true);
  target.getBoundingClientRect = () => new win.DOMRect(0, 10, 100, 24);
  assert.equal(pin.stable(targets), false);
  pin.dispose();
  assert.equal(target.hasAttribute('data-stackflow-fixed-target'), false);
});
