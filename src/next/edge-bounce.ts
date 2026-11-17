export const bounceScrollAttribute = 'data-stackflow-bounce-scroll';

type BounceTarget = { scroller: HTMLElement; surface: HTMLElement };
type Gesture = BounceTarget & {
  hit: Element; id: number; x: number; y: number; previousY: number; edge: number; edgeY: number;
};

const maxPull = 44;
const returnTiming = { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' };
const passive = { passive: true } as const;
const added = { fill: 'both', composite: 'add' } as const;

export function attachEdgeBounce(content: HTMLElement, thumb: HTMLElement | undefined,
  resolve: (hit: Element) => BounceTarget | undefined) {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  // Apple touch scrolling already rubber-bands, including on iPadOS when
  // its desktop user agent identifies the device as a Mac.
  if (!win.navigator.maxTouchPoints || /Mac|iPhone|iPad|iPod/.test(win.navigator.platform + win.navigator.userAgent)
      || !win.CSS?.supports('translate', '0 1px') || !win.CSS.supports('overscroll-behavior-y', 'none')
      || !content.animate) return;

  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const indicator = thumb?.firstElementChild;
  let gesture: Gesture | undefined;
  let frame = 0;
  let latest: Touch | undefined;
  let distance = 0;
  let direction = 0;
  let bodyAnimation: Animation | undefined;
  let thumbAnimation: Animation | undefined;

  function cancelAnimations() {
    if (!bodyAnimation && !thumbAnimation) return;
    bodyAnimation?.cancel();
    thumbAnimation?.cancel();
    bodyAnimation = thumbAnimation = undefined;
    distance = 0;
    thumb?.removeAttribute('data-stackflow-bouncing');
  }

  function stop() {
    if (gesture) gesture.scroller.removeAttribute(bounceScrollAttribute);
    gesture = latest = undefined;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    distance = direction = 0;
    cancelAnimations();
  }

  function start(event: TouchEvent) {
    stop();
    const hit = event.target;
    if (event.touches.length !== 1 || event.defaultPrevented || reducedMotion.matches ||
        !(hit instanceof win.Element) || hit.closest('.stackflow-next-content') !== content ||
        hit.closest('textarea,input,select,[contenteditable]') || doc.documentElement.hasAttribute('data-stackflow-animating')) return;

    const target = resolve(hit);
    if (!target || target.scroller.scrollHeight <= target.scroller.clientHeight) return;
    for (let node: Element | null = hit; node && node !== target.scroller && node !== content; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight && /^(auto|scroll|overlay)$/.test(win.getComputedStyle(node).overflowY)) return;
    }

    const touch = event.touches[0];
    gesture = {
      ...target, hit, id: touch.identifier, x: touch.clientX, y: touch.clientY,
      previousY: touch.clientY, edge: 0, edgeY: touch.clientY,
    };
    target.scroller.setAttribute(bounceScrollAttribute, '');
  }

  function move(event: TouchEvent) {
    if (!gesture) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== gesture.id || event.defaultPrevented) {
      stop();
      return;
    }
    latest = touch;
    if (!frame) frame = win.requestAnimationFrame(pull);
  }

  function pull() {
    frame = 0;
    if (!gesture || !latest) return;
    if (reducedMotion.matches || !gesture.hit.isConnected || doc.documentElement.hasAttribute('data-stackflow-animating')) {
      stop();
      return;
    }
    const {clientX: x, clientY: y} = latest;
    const dy = y - gesture.y;
    const dx = x - gesture.x;
    if (!gesture.edge && Math.abs(dx) > Math.max(7, Math.abs(dy))) {
      stop();
      return;
    }
    const {scroller, surface} = gesture;
    const offset = scroller === doc.scrollingElement ? win.scrollY : scroller.scrollTop;
    const end = scroller.scrollHeight - scroller.clientHeight;
    if (end <= 0 || offset < -0.5 || offset > end + 0.5) {
      stop();
      return;
    }
    const edge = offset <= 0.5 ? 1 : offset >= end - 0.5 ? -1 : 0;
    if (edge !== gesture.edge) {
      gesture.edge = edge;
      gesture.edgeY = gesture.previousY;
    }
    gesture.previousY = y;
    const pullDistance = edge * (y - gesture.edgeY);
    if (pullDistance <= 0 || (!distance && Math.abs(dy) < Math.max(6, Math.abs(dx)))) {
      distance = 0;
      cancelAnimations();
      return;
    }
    if (!bodyAnimation || direction !== edge) {
      cancelAnimations();
      direction = edge;
      bodyAnimation = surface.animate([{translate: '0 0px'}, {translate: `0 ${edge * maxPull}px`}],
        { ...added, duration: maxPull });
      bodyAnimation.pause();
      if (indicator && thumb && !thumb.hidden) {
        const transformOrigin = edge > 0 ? 'center top' : 'center bottom';
        thumbAnimation = indicator.animate([{scale: '1 1', transformOrigin}, {scale: '1 .55', transformOrigin}],
          { duration: maxPull, fill: 'both' });
        thumbAnimation.pause();
      }
    }
    distance = maxPull * pullDistance / (pullDistance + 72);
    bodyAnimation.currentTime = distance;
    if (thumbAnimation && thumb) {
      thumbAnimation.currentTime = distance;
      thumb.setAttribute('data-stackflow-bouncing', '');
    }
  }

  function release() {
    if (!gesture || !distance || !bodyAnimation) {
      stop();
      return;
    }
    const {surface} = gesture;
    const pull = direction * distance;
    const scale = 1 - .45 * distance / maxPull;
    const transformOrigin = direction > 0 ? 'center top' : 'center bottom';
    stop();
    const settling = surface.animate([{translate: `0 ${pull}px`}, {translate: '0 0px'}], { ...returnTiming, composite: 'add' });
    bodyAnimation = settling;
    if (indicator && thumb && !thumb.hidden) {
      thumbAnimation = indicator.animate([{scale: `1 ${scale}`, transformOrigin}, {scale: '1 1', transformOrigin}], returnTiming);
      thumb.setAttribute('data-stackflow-bouncing', '');
    }
    settling.onfinish = () => {
      if (settling === bodyAnimation) cancelAnimations();
    };
  }

  content.addEventListener('touchstart', start, passive);
  content.addEventListener('touchmove', move, passive);
  content.addEventListener('touchend', release, passive);
  content.addEventListener('touchcancel', release, passive);
  win.addEventListener('popstate', stop);
  reducedMotion.addEventListener('change', stop);
  return {
    clearEffect() {
      if (gesture && !gesture.hit.isConnected) stop();
      else cancelAnimations();
    },
    dispose() {
      stop();
      content.removeEventListener('touchstart', start);
      content.removeEventListener('touchmove', move);
      content.removeEventListener('touchend', release);
      content.removeEventListener('touchcancel', release);
      win.removeEventListener('popstate', stop);
      reducedMotion.removeEventListener('change', stop);
    },
  };
}
