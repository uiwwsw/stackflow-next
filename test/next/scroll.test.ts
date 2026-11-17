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

test('the window scrollbar uses the target content box up to both native scroll endpoints', t => {
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
    <div class="stackflow-next"><div><div class="stackflow-next-content">
      <main style="margin:70px 20px; padding:16px 8px 24px 6px; border:2px solid"></main>
    </div><div hidden></div></div></div>`;
  const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
  const thumb = content.nextElementSibling as HTMLElement;
  const main = content.querySelector('main')!;
  t.mock.method(main, 'getClientRects', () => ({ length: 1 }));
  // The target's rect already leaves out its margins.
  t.mock.method(main, 'getBoundingClientRect', () => new win.DOMRect(20, 90 - offset, 360, 1540));
  const start = 90 + 16 + 2;
  const end = 90 + 1540 - 1200 - 24 - 2;
  const railHeight = end - start;

  const scrolled: HTMLElement[] = [];
  const controller = attachWindowScroll(content, 'main', element => scrolled.push(element), thumb);
  try {
    const thumbTop = () => parseFloat(thumb.style.transform.slice('translateY('.length));
    const updateOffset = (next: number) => {
      offset = next;
      win.dispatchEvent(new win.Event('scroll'));
      paint!(0);
    };
    paint!(0);
    const size = parseFloat(thumb.style.height);
    assert.equal(controller.getElement(), root);
    assert.equal(thumb.hidden, false);
    assert.equal(thumb.style.right, '33px');
    assert.equal(thumbTop(), start);
    assert.equal(thumb.hasAttribute('data-stackflow-scrolling'), false);
    assert.ok(Math.abs(size - railHeight ** 2 / (railHeight + 1200)) < 0.001);

    updateOffset(0.5);
    assert.ok(thumbTop() > start);
    assert.equal(thumb.hasAttribute('data-stackflow-scrolling'), true);

    updateOffset(600);
    assert.equal(parseFloat(thumb.style.height), size);
    assert.ok(Math.abs(thumbTop() - (start + (railHeight - size) / 2)) < 0.001);

    updateOffset(1199.5);
    assert.equal(parseFloat(thumb.style.height), size);
    assert.ok(thumbTop() + size < end);

    updateOffset(1200);
    assert.ok(Math.abs(thumbTop() + size - end) < 0.001);

    for (const edge of [-60, 1260]) {
      updateOffset(edge);
      const height = parseFloat(thumb.style.height);
      assert.ok(height < size);
      assert.ok(Math.abs(thumbTop() - (edge < 0 ? start : end - height)) < 0.001);
    }
    assert.deepEqual(scrolled, [root, root, root, root, root, root]);
  } finally {
    controller.dispose();
  }
  assert.equal(thumb.hidden, true);
  assert.equal(thumb.hasAttribute('data-stackflow-scrolling'), false);
});

test('the scrollbar follows the document after the inner scroller reaches its edge', t => {
  const win = new Window();
  const root = win.document.documentElement;
  Object.defineProperties(root, {
    clientHeight: { value: 600 }, clientWidth: { value: 400 }, scrollHeight: { value: 1800 },
  });
  Object.defineProperty(win, 'visualViewport', { value: undefined });
  let offset = 0;
  Object.defineProperty(win, 'scrollY', { get: () => offset });
  let paint: FrameRequestCallback;
  t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; return 1; });
  win.document.body.innerHTML = `
    <div class="stackflow-next"><header class="stackflow-next-header"></header>
      <div><div class="stackflow-next-content"><main style="overflow-y:auto"></main></div><div hidden></div></div>
      <footer class="stackflow-next-bottom"></footer></div>`;
  const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
  const thumb = content.nextElementSibling as HTMLElement;
  const inner = win.document.querySelector('main')!;
  Object.defineProperties(inner, {
    clientHeight: { value: 400 }, clientWidth: { value: 400 }, scrollHeight: { value: 1600 },
  });
  t.mock.method(inner, 'getClientRects', () => ({ length: 1 }));
  t.mock.method(inner, 'getBoundingClientRect', () => new win.DOMRect(0, 270 - offset, 400, 400));
  t.mock.method(win.document.querySelector('header')!, 'getBoundingClientRect', () => new win.DOMRect(0, 0, 400, 50));
  t.mock.method(win.document.querySelector('footer')!, 'getBoundingClientRect', () => new win.DOMRect(0, 550, 400, 50));

  const controller = attachWindowScroll(content, 'main', () => {}, thumb);
  try {
    paint!(0);
    const usesDocument = () => thumb.hasAttribute('data-stackflow-scrollbar-root');
    const thumbTop = () => parseFloat(thumb.style.transform.slice('translateY('.length));
    const thumbHeight = () => parseFloat(thumb.style.height);
    assert.equal(usesDocument(), true);
    assert.equal(thumb.hasAttribute('data-stackflow-scrolling'), false);

    inner.scrollTop = 1200;
    inner.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(usesDocument(), false);
    assert.ok(Math.abs(thumbHeight() - 280 ** 2 / 1480) < 0.001);
    assert.ok(Math.abs(thumbTop() + thumbHeight() - 550) < 0.001);

    offset = 1200;
    win.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(usesDocument(), true);
    assert.ok(Math.abs(thumbTop() + thumbHeight() - 550) < 0.001);

    offset = 1199;
    win.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.ok(thumbTop() + thumbHeight() < 550);

    offset = 100;
    win.dispatchEvent(new win.Event('scroll'));
    inner.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(usesDocument(), true);

    inner.scrollTop = 1199;
    inner.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(usesDocument(), false);
    assert.ok(thumbTop() + thumbHeight() < 550);
  } finally {
    controller.dispose();
  }
});

for (const mode of ['window', 'container']) {
  test(`the ${mode} scrollbar stays between fixed bars for its entire travel`, t => {
    const win = new Window();
    const root = win.document.documentElement;
    Object.defineProperties(root, {
      clientHeight: { value: 664 }, clientWidth: { value: 390 }, scrollHeight: { value: 3203 },
    });
    Object.defineProperty(win, 'visualViewport', { value: undefined });
    let offset = 0;
    Object.defineProperty(win, 'scrollY', { get: () => offset });
    let paint: FrameRequestCallback;
    t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; return 1; });
    win.document.body.innerHTML = `
      <div class="stackflow-next">
        <div class="stackflow-next-header"><div id="top" style="position:fixed;visibility:visible"></div></div>
        <div><div class="stackflow-next-content">
          <main style="overflow-y:visible"></main>
          <div id="bottom" style="position:fixed;visibility:visible"></div>
        </div><div hidden></div></div>
      </div>`;
    const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
    const thumb = content.nextElementSibling as HTMLElement;
    const target = content.querySelector('main')!;
    Object.defineProperties(target, {
      clientHeight: { value: 664 }, clientWidth: { value: 346 }, scrollHeight: { value: 3203 },
    });
    t.mock.method(target, 'getClientRects', () => ({ length: 1 }));
    t.mock.method(target, 'getBoundingClientRect', () => mode === 'window'
      ? new win.DOMRect(22, -offset, 346, 3203)
      : new win.DOMRect(22, 0, 346, 664));
    t.mock.method(win.document.querySelector('#top')!, 'getBoundingClientRect', () => new win.DOMRect(0, 0, 390, 79));
    t.mock.method(win.document.querySelector('#bottom')!, 'getBoundingClientRect', () => new win.DOMRect(0, 561, 390, 103));
    t.mock.method(content.parentElement!, 'getBoundingClientRect', () => new win.DOMRect(0, 0, 390, 664));

    const controller = mode === 'window'
      ? attachWindowScroll(content, 'main', () => {}, thumb, ['#bottom'])
      : attachScrollViewport(content, 'main', () => {}, () => {}, thumb, ['#bottom']);
    try {
      for (const next of [0, 1, 2499, 2539, 2499, 0]) {
        offset = next;
        target.scrollTop = next;
        if (mode === 'window') win.dispatchEvent(new win.Event('scroll'));
        else target.dispatchEvent(new win.Event('scroll') as unknown as Event);
        paint!(0);
        const expectedHeight = 482 ** 2 / (482 + 2539);
        const height = parseFloat(thumb.style.height);
        const top = parseFloat(thumb.style.transform.slice('translateY('.length));
        assert.equal(thumb.hidden, false);
        assert.equal(thumb.style.right, '25px');
        assert.ok(Math.abs(height - expectedHeight) < 0.001);
        assert.ok(Math.abs(top - (79 + (482 - height) * next / 2539)) < 0.001);
      }
    } finally {
      controller.dispose();
    }
  });
}
