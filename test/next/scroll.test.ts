import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { attachScrollViewport, attachWindowScroll } from '../../src/next/scroll.ts';

test('only the visible target scrolls and a second visible match restores the default', t => {
  const win = new Window();
  const track = win.document.createElement('div');
  track.innerHTML = `
    <div class="stackflow-next-content">
      <main data-app-scroll></main><main data-app-scroll hidden></main>
    </div>`;
  win.document.body.append(track);
  const [body] = Array.from(track.children);
  const [target, retained] = Array.from(body.children);
  Object.defineProperty(target, 'getClientRects', { value: () => ({ length: 1 }) });
  Object.defineProperty(retained, 'getClientRects', { value: () => ({ length: retained.hasAttribute('hidden') ? 0 : 1 }) });
  const warning = t.mock.method(console, 'warn', () => {});

  const captured: HTMLElement[] = [];
  const controller = attachScrollViewport(body as unknown as HTMLElement,
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

test('the window scrollbar follows document offsets and compresses at both elastic edges', t => {
  const win = new Window();
  const root = win.document.documentElement;
  Object.defineProperties(root, {
    clientHeight: { value: 700 }, clientWidth: { value: 400 }, scrollHeight: { value: 1900 },
  });
  Object.defineProperty(win, 'visualViewport', { value: undefined });
  let offset = 0;
  Object.defineProperty(win, 'scrollY', { get: () => offset });
  let paint: FrameRequestCallback;
  t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; return 1; });
  win.document.body.innerHTML = `
    <div class="stackflow-next"><header class="stackflow-next-header"></header>
      <div><div class="stackflow-next-content"><main></main></div><div hidden></div></div>
      <footer class="stackflow-next-bottom"></footer></div>`;
  const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
  const thumb = content.nextElementSibling as HTMLElement;
  const main = content.querySelector('main')!;
  t.mock.method(main, 'getClientRects', () => ({ length: 1 }));
  t.mock.method(main, 'getBoundingClientRect', () => new win.DOMRect(20, 90, 360, 1500));
  t.mock.method(win.document.querySelector('header')!, 'getBoundingClientRect', () => new win.DOMRect(0, 0, 400, 50));
  t.mock.method(win.document.querySelector('footer')!, 'getBoundingClientRect', () => new win.DOMRect(0, 630, 400, 70));

  const scrolled: HTMLElement[] = [];
  const controller = attachWindowScroll(content, 'main', element => scrolled.push(element), thumb);
  try {
    paint!(0);
    const size = parseFloat(thumb.style.height);
    assert.equal(controller.getElement(), root);
    assert.equal(thumb.hidden, false);
    assert.equal(thumb.style.right, '23px');
    assert.equal(thumb.style.transform, 'translateY(90px)');

    for (const edge of [-60, 1260]) {
      offset = edge;
      win.dispatchEvent(new win.Event('scroll'));
      paint!(0);
      const height = parseFloat(thumb.style.height);
      assert.ok(height < size);
      const top = parseFloat(thumb.style.transform.slice('translateY('.length));
      assert.ok(Math.abs(top - (edge < 0 ? 90 : 630 - height)) < 0.001);
    }
    assert.deepEqual(scrolled, [root, root]);
  } finally {
    controller.dispose();
  }
  assert.equal(thumb.hidden, true);
});
