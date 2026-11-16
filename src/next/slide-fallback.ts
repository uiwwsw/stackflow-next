import type { Direction } from './engine.js';
import { findFixedTargets, pinForTransition } from './fixed-targets.js';

export function captureSlide(
  content: HTMLElement,
  scroll: HTMLElement | null,
  direction: Direction,
  modal: 'enter' | 'exit' | undefined,
  selectors: readonly string[] = [],
) {
  const parent = content.parentElement;
  if (!parent) return;
  const visual = content.cloneNode(true) as HTMLElement;
  const bounds = content.getBoundingClientRect();
  const offset = scroll?.scrollTop ?? 0;
  const fixedTargets = findFixedTargets(content, selectors);
  const originals = new Map<HTMLElement, {original: HTMLElement; rect: DOMRect}>();
  let visualScroll = visual;
  if (fixedTargets.size || (scroll && scroll !== content)) {
    const cloned = visual.querySelectorAll<HTMLElement>('*');
    content.querySelectorAll<HTMLElement>('*').forEach((element, index) => {
      if (element === scroll) visualScroll = cloned[index];
      if (fixedTargets.has(element)) originals.set(cloned[index], { original: element, rect: element.getBoundingClientRect() });
    });
  }
  visual.inert = true;
  visual.style.viewTransitionName = 'none';
  visual.setAttribute('aria-hidden', 'true');
  delete visual.dataset.stackflowSlideStaged;
  delete visual.dataset.stackflowSlideIncoming;
  visual.dataset.stackflowSlideSnapshot = '';
  visual.removeAttribute('id');
  for (const element of visual.querySelectorAll('[id]')) element.removeAttribute('id');

  let disposed = false;
  let transition: ViewTransition | undefined;
  let stopNative: (() => void) | undefined;
  let onDispose: (() => void) | undefined;
  let stopWatching: (() => void) | undefined;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(cleanupTimer);
    stopWatching?.();
    transition?.skipTransition();
    stopNative?.();
    visual.remove();
    delete content.dataset.stackflowSlideStaged;
    delete content.dataset.stackflowSlideIncoming;
    onDispose?.();
  }
  function hold() {
    if (disposed || visual.parentElement || !content.isConnected) return;
    parent?.append(visual);
    visualScroll.scrollTop = offset;
    content.dataset.stackflowSlideStaged = '';
  }
  function playFallback() {
    hold();
    delete content.dataset.stackflowSlideStaged;
    if (modal === 'exit' || (direction === 'pop' && modal !== 'enter')) {
      visual.dataset.stackflowSlideSnapshot = modal === 'exit' ? 'modal-exit' : 'pop';
    } else {
      visual.dataset.stackflowSlideSnapshot = 'under';
      content.dataset.stackflowSlideIncoming = modal === 'enter' ? 'modal' : 'push';
    }
    const animated = content.hasAttribute('data-stackflow-slide-incoming') ? content : visual;
    animated.addEventListener('animationend', finish);
    stopWatching = () => animated.removeEventListener('animationend', finish);
    const duration = content.ownerDocument.defaultView?.getComputedStyle(content)
      .getPropertyValue('--stackflow-duration').trim() || '280ms';
    const milliseconds = parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000);
    cleanupTimer = setTimeout(finish, (Number.isFinite(milliseconds) ? milliseconds : 280) + 100);
    function finish(event?: AnimationEvent) {
      if (event && event.target !== animated) return;
      dispose();
    }
  }
  function play(finished: () => void, forceFallback = false) {
    if (disposed) return;
    onDispose = finished;
    if (!content.isConnected) { dispose(); return; }
    const after = content.getBoundingClientRect();
    const stableBounds = (['top', 'right', 'bottom', 'left'] as const).every(edge => Math.abs(bounds[edge] - after[edge]) <= .5);
    const doc = content.ownerDocument;
    if (forceFallback || !stableBounds || !doc.startViewTransition) { playFallback(); return; }

    hold();
    // The old visual is staged only once React has a destination to show.
    // The browser's snapshot callback can now finish without waiting on React or the server.
    const { dataset } = doc.documentElement;
    visual.style.viewTransitionName = 'stackflow-next-content';
    const supportsPins = doc.defaultView?.CSS?.supports('selector(::view-transition-group(.stackflow-fixed))');
    const pins = supportsPins && originals.size
      ? pinForTransition(visual, new Set(originals.keys()), { bounds, elements: originals }) : null;
    dataset.stackflowAnimating = 'true';
    if (modal) dataset.stackflowModal = modal;
    stopNative = () => {
      pins?.dispose();
      visual.style.viewTransitionName = 'none';
      delete dataset.stackflowAnimating;
      delete dataset.stackflowModal;
      stopNative = undefined;
    };
    const reveal = () => {
      if (disposed || !stopNative) return;
      visual.remove();
      delete content.dataset.stackflowSlideStaged;
      if (pins && !pins.captureDestination(findFixedTargets(content, selectors))) transition?.skipTransition();
    };
    const fallback = () => {
      if (disposed || !stopNative) return;
      stopNative();
      playFallback();
    };
    try {
      transition = doc.startViewTransition(reveal);
      transition.ready.then(() => {}, fallback);
      transition.finished.then(() => {
        // A skipped native transition may already be playing the CSS slide.
        if (stopNative) { transition = undefined; dispose(); }
      }, fallback);
    } catch { fallback(); }
  }
  return {
    hold,
    play,
    dispose,
  };
}
