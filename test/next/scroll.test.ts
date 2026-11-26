import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { attachScrollViewport, attachWindowScroll, overlayScrollbarOptions, type OverlayScrollbarFactory } from '../../src/next/scroll.ts';

// Records how the provider drives the drawn scrollbars without loading OverlayScrollbars.
function recordScrollbars() {
  const log: string[] = [];
  const created: { scroller: HTMLElement; root: boolean; active: boolean; disposed: boolean }[] = [];
  const factory: OverlayScrollbarFactory = (scroller, root, slot) => {
    const entry = { scroller, root, active: false, disposed: false };
    created.push(entry);
    log.push(`create:${root ? 'document' : scroller.tagName.toLowerCase()}:${slot.className || 'slot'}`);
    return {
      setActive(active) { entry.active = active; },
      dispose() { entry.disposed = true; },
    };
  };
  return { factory, created, log };
}

const translateY = (element: HTMLElement) => parseFloat(element.style.transform.slice('translateY('.length));

test('only the visible target scrolls and a second visible match restores the default', t => {
  const win = new Window();
  const track = win.document.createElement('div');
  track.innerHTML = `
    <div class="stackflow-next-content">
      <main data-app-scroll></main><main data-app-scroll style="visibility:hidden"></main>
    </div>`;
  win.document.body.append(track);
  const [body] = Array.from(track.children);
  const [target, retained] = Array.from(body.children);
  Object.defineProperty(target, 'getClientRects', { value: () => ({ length: 1 }) });
  Object.defineProperty(retained, 'getClientRects', { value: () => ({ length: 1 }) });
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

    retained.removeAttribute('style');
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

test('the window track spans the target content box between both native scroll endpoints', t => {
  const win = new Window();
  const root = win.document.documentElement;
  Object.defineProperties(root, {
    clientHeight: { value: 700 }, clientWidth: { value: 400 }, scrollHeight: { value: 1900 },
  });
  Object.defineProperty(win, 'visualViewport', { value: undefined });
  let offset = 0;
  Object.defineProperty(win, 'scrollY', { get: () => offset });
  let paint: FrameRequestCallback;
  let scheduled = 0;
  t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; scheduled++; return 1; });
  win.document.body.innerHTML = `
    <div class="stackflow-next"><div><div class="stackflow-next-content">
      <main style="margin:70px 20px; padding:16px 8px 24px 6px; border:2px solid"></main>
    </div><div hidden></div></div></div>`;
  const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
  const slot = content.nextElementSibling as HTMLElement;
  const main = content.querySelector('main')!;
  t.mock.method(main, 'getClientRects', () => ({ length: 1 }));
  // The target's rect already leaves out its margins.
  t.mock.method(main, 'getBoundingClientRect', () => new win.DOMRect(20, 90 - offset, 360, 1540));
  const start = 90 + 16 + 2;
  const end = 90 + 1540 - 1200 - 24 - 2;
  const railHeight = end - start;
  const { factory, created } = recordScrollbars();

  const scrolled: HTMLElement[] = [];
  const controller = attachWindowScroll(content, 'main', element => scrolled.push(element), slot, [], false, factory);
  try {
    const scroll = (next: number) => {
      offset = next;
      win.dispatchEvent(new win.Event('scroll'));
    };
    paint!(0);
    assert.equal(controller.getElement(), root);
    assert.equal(slot.hidden, false);
    assert.equal(slot.getAttribute('data-stackflow-scroll-source'), 'document');
    assert.equal(created.length, 1);
    assert.equal(created[0].root, true);
    assert.equal(created[0].active, true);
    assert.equal(slot.style.right, '30px');
    assert.equal(translateY(slot), start);
    assert.equal(parseFloat(slot.style.height), railHeight);

    // The drawn scrollbar moves its own handle. Document scrolling does not
    // schedule another layout pass while the track stays where it is.
    const before = scheduled;
    for (const next of [0.5, 600, 1200, -60, 1260]) scroll(next);
    assert.equal(scheduled, before);
    paint!(0);
    assert.equal(translateY(slot), start);
    assert.equal(parseFloat(slot.style.height), railHeight);
    assert.deepEqual(scrolled, [root, root, root, root, root]);

    const zoom = 1.17;
    Object.defineProperty(slot, 'currentCSSZoom', { value: zoom });
    paint!(0);
    assert.ok(Math.abs(parseFloat(slot.style.height) * zoom - railHeight) < 0.001);
    assert.ok(Math.abs(translateY(slot) * zoom - start) < 0.001);

    // A fixed containing block that scrolls with the document moves the
    // track, so document scrolling schedules a new placement.
    const shell = content.parentElement!;
    Object.defineProperties(shell, { clientWidth: { value: 376 }, clientLeft: { value: 0 }, clientTop: { value: 0 } });
    Object.defineProperty(slot, 'offsetParent', { value: shell });
    t.mock.method(shell, 'getBoundingClientRect', () => new win.DOMRect(12, 21 - offset, 376, 1900));
    paint!(0);
    const placed = scheduled;
    scroll(600);
    assert.equal(scheduled, placed + 1);
    paint!(0);
    assert.ok(Math.abs(translateY(slot) * zoom + 21 - offset - start) < 0.001);
    assert.ok(Math.abs(parseFloat(slot.style.right) * zoom - (388 - 370)) < 0.001);
  } finally {
    controller.dispose();
  }
  assert.equal(slot.hidden, true);
  assert.equal(slot.hasAttribute('data-stackflow-scroll-source'), false);
  assert.equal(created[0].disposed, true);
});

test('the active scrollbar follows the document after the inner scroller reaches its edge', t => {
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
  const slot = content.nextElementSibling as HTMLElement;
  const inner = win.document.querySelector('main')!;
  Object.defineProperties(inner, {
    clientHeight: { value: 400 }, clientWidth: { value: 400 }, scrollHeight: { value: 1600 },
  });
  t.mock.method(inner, 'getClientRects', () => ({ length: 1 }));
  t.mock.method(inner, 'getBoundingClientRect', () => new win.DOMRect(0, 270 - offset, 400, 400));
  t.mock.method(win.document.querySelector('header')!, 'getBoundingClientRect', () => new win.DOMRect(0, 0, 400, 50));
  t.mock.method(win.document.querySelector('footer')!, 'getBoundingClientRect', () => new win.DOMRect(0, 550, 400, 50));
  const { factory, created } = recordScrollbars();
  const source = () => slot.getAttribute('data-stackflow-scroll-source');
  const active = () => created.filter(entry => entry.active).map(entry => entry.root ? 'document' : 'main');

  const controller = attachWindowScroll(content, 'main', () => {}, slot, [], false, factory);
  try {
    paint!(0);
    assert.equal(source(), 'document');
    assert.deepEqual(active(), ['document']);
    assert.equal(inner.hasAttribute('data-stackflow-native-scrollbar-hidden'), true);
    assert.equal(translateY(slot), 50);
    assert.equal(parseFloat(slot.style.height), 500);

    inner.scrollTop = 1200;
    inner.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(source(), 'element');
    assert.deepEqual(active(), ['main']);
    assert.equal(translateY(slot), 270);
    assert.equal(parseFloat(slot.style.height), 280);

    offset = 1200;
    win.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(source(), 'document');
    assert.deepEqual(active(), ['document']);
    assert.equal(translateY(slot), 50);

    inner.scrollTop = 1199;
    inner.dispatchEvent(new win.Event('scroll'));
    paint!(0);
    assert.equal(source(), 'element');
    assert.equal(created.length, 2);
  } finally {
    controller.dispose();
  }
  assert.ok(created.every(entry => entry.disposed));
  assert.equal(inner.hasAttribute('data-stackflow-native-scrollbar-hidden'), false);
});

for (const mode of ['window', 'container']) {
  test(`the ${mode} track stays between fixed bars`, t => {
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
    const slot = content.nextElementSibling as HTMLElement;
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
    const { factory, created } = recordScrollbars();

    const controller = mode === 'window'
      ? attachWindowScroll(content, 'main', () => {}, slot, ['#bottom'], false, factory)
      : attachScrollViewport(content, 'main', () => {}, () => {}, slot, ['#bottom'], false, factory);
    try {
      for (const next of [0, 1, 2499, 2539, 2499, 0]) {
        offset = next;
        target.scrollTop = next;
        if (mode === 'window') win.dispatchEvent(new win.Event('scroll'));
        else target.dispatchEvent(new win.Event('scroll') as unknown as Event);
        paint!(0);
        assert.equal(slot.hidden, false);
        assert.equal(slot.style.right, '22px');
        assert.equal(translateY(slot), 79);
        assert.equal(parseFloat(slot.style.height), 482);
      }
      assert.equal(created.length, 1);
      assert.equal(created[0].root, mode === 'window');
      assert.equal(created[0].active, true);
    } finally {
      controller.dispose();
    }
    assert.equal(created[0].disposed, true);
  });
}

test('scrollbar options default to move, 800 ms and hidden until the first scroll', () => {
  assert.deepEqual(overlayScrollbarOptions().scrollbars, {
    theme: 'os-theme-stackflow', autoHide: 'move', autoHideDelay: 800, autoHideSuspend: true,
    dragScroll: true, clickScroll: true,
  });
  const custom = overlayScrollbarOptions({ autoHide: 'never', autoHideDelay: 0, autoHideSuspend: false }).scrollbars;
  assert.equal(custom.autoHide, 'never');
  assert.equal(custom.autoHideDelay, 0);
  assert.equal(custom.autoHideSuspend, false);
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(overlayScrollbarOptions({ autoHideDelay: invalid }).scrollbars.autoHideDelay, 800);
  }
});

test('the track stays available for a horizontal-only overflow and exposes its width', t => {
  const win = new Window();
  const root = win.document.documentElement;
  // No vertical overflow: the drawn bars decide per axis whether to show.
  Object.defineProperties(root, {
    clientHeight: { value: 700 }, clientWidth: { value: 400 }, scrollHeight: { value: 700 },
  });
  Object.defineProperty(win, 'visualViewport', { value: undefined });
  Object.defineProperty(win, 'scrollY', { get: () => 0 });
  let paint: FrameRequestCallback;
  t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; return 1; });
  win.document.body.innerHTML = `
    <div class="stackflow-next"><div><div class="stackflow-next-content"></div><div hidden></div></div></div>`;
  const content = win.document.querySelector('.stackflow-next-content')! as unknown as HTMLElement;
  const slot = content.nextElementSibling as HTMLElement;
  t.mock.method(content, 'getBoundingClientRect', () => new win.DOMRect(10, 0, 380, 700));
  const { factory } = recordScrollbars();
  const controller = attachWindowScroll(content, undefined, () => {}, slot, [], false, factory);
  try {
    paint!(0);
    assert.equal(slot.hidden, false);
    assert.equal(slot.style.getPropertyValue('--stackflow-track-width'), '380px');
    assert.equal(slot.style.right, '10px');
  } finally {
    controller.dispose();
  }
});
