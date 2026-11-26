import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { attachEdgeBounce, bounceScrollAttribute } from '../../src/next/edge-bounce.ts';

test('touch bounce is limited to the two edges and releases its animation and scroll marker', t => {
  const win = new Window();
  Object.defineProperties(win.navigator, {
    maxTouchPoints: { value: 1 }, platform: { value: 'Linux' }, userAgent: { value: 'Android' },
  });
  t.mock.method(win.CSS, 'supports', () => true);
  const content = win.document.createElement('main');
  content.className = 'stackflow-next-content';
  win.document.body.append(content);
  Object.defineProperties(content, {
    clientHeight: { value: 500 }, scrollHeight: { value: 1500 },
  });

  const animations: {
    frames: Keyframe[]; currentTime: number; onfinish?: () => void; canceled: boolean;
  }[] = [];
  Object.defineProperty(content, 'animate', {
    value(frames: Keyframe[]) {
      const animation = {
        frames, currentTime: 0, canceled: false,
        pause() {},
        cancel() { animation.canceled = true; },
      };
      animations.push(animation);
      return animation;
    },
  });
  let paint: FrameRequestCallback | undefined;
  t.mock.method(win, 'requestAnimationFrame', (callback: FrameRequestCallback) => { paint = callback; return 1; });

  const surface = content as unknown as HTMLElement;
  const bounce = attachEdgeBounce(surface, undefined, () => ({ scroller: surface, surface }))!;
  function touch(type: string, y?: number) {
    const event = new win.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', {
      value: y === undefined ? [] : [{ clientX: 160, clientY: y, identifier: 1 }],
    });
    content.dispatchEvent(event);
    const next = paint;
    paint = undefined;
    next?.(0);
    assert.equal(event.defaultPrevented, false);
  }

  try {
    content.scrollTop = 300;
    touch('touchstart', 240);
    touch('touchmove', 340);
    assert.equal(animations.length, 0);
    touch('touchend');

    content.scrollTop = 0;
    touch('touchstart', 240);
    touch('touchmove', 440);
    assert.equal(content.hasAttribute(bounceScrollAttribute), true);
    const top = animations.at(-1)!;
    assert.equal(top.frames[1].translate, '0 44px');
    assert.ok(top.currentTime > 0 && top.currentTime < 44);
    assert.equal(content.scrollTop, 0);
    touch('touchend');
    assert.equal(top.canceled, true);
    const release = animations.at(-1)!;
    assert.equal(release.frames[1].translate, '0 0px');
    assert.equal(content.hasAttribute(bounceScrollAttribute), false);
    release.onfinish?.();
    assert.equal(release.canceled, true);

    content.scrollTop = 1000;
    touch('touchstart', 440);
    touch('touchmove', 240);
    const bottom = animations.at(-1)!;
    assert.equal(bottom.frames[1].translate, '0 -44px');
    assert.ok(bottom.currentTime > 0 && bottom.currentTime < 44);
    assert.equal(content.scrollTop, 1000);
    bounce.dispose();
    assert.equal(bottom.canceled, true);
    assert.equal(content.hasAttribute(bounceScrollAttribute), false);
  } finally {
    bounce.dispose();
  }
});
