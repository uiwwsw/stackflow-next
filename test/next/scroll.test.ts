import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { attachScrollViewport } from '../../src/next/scroll.ts';

test('only the visible target gets the scrollbar and a second visible match restores the default', t => {
  const win = new Window();
  const track = win.document.createElement('div');
  track.innerHTML = `
    <div class="stackflow-next-content">
      <main data-app-scroll></main><main data-app-scroll hidden></main>
    </div><div></div>`;
  win.document.body.append(track);
  const [body, indicator] = Array.from(track.children);
  const [target, retained] = Array.from(body.children);
  Object.defineProperty(target, 'getClientRects', { value: () => ({ length: 1 }) });
  Object.defineProperty(retained, 'getClientRects', { value: () => ({ length: retained.hasAttribute('hidden') ? 0 : 1 }) });
  const warning = t.mock.method(console, 'warn', () => {});

  const captured: HTMLElement[] = [];
  const controller = attachScrollViewport(body as unknown as HTMLElement, indicator as unknown as HTMLElement,
    '[data-app-scroll]', element => captured.push(element), () => {});
  try {
    assert.equal(controller.getElement(), target);
    assert.equal(body.hasAttribute('data-stackflow-scroll-delegated'), true);
    assert.equal(retained.hasAttribute('data-stackflow-scroll-target'), false);
    body.dispatchEvent(new win.Event('scroll'));
    target.dispatchEvent(new win.Event('scroll'));
    assert.deepEqual(captured, [target]);

    retained.removeAttribute('hidden');
    assert.equal(controller.getElement(true), body);
    assert.equal(target.hasAttribute('data-stackflow-scroll-target'), false);
    target.dispatchEvent(new win.Event('scroll'));
    body.dispatchEvent(new win.Event('scroll'));
    assert.deepEqual(captured, [target, body]);
    assert.equal(warning.mock.callCount(), 1);
  } finally {
    controller.dispose();
  }
  assert.equal(body.hasAttribute('data-stackflow-scroll-delegated'), false);
  assert.equal(target.hasAttribute('data-stackflow-scroll-target'), false);
});
