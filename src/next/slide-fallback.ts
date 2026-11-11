import type { Direction } from './engine.js';

export function captureSlide(
  content: HTMLElement,
  scroll: HTMLElement | null,
  direction: Direction,
  modal: 'enter' | 'exit' | undefined,
) {
  const parent = content.parentElement;
  if (!parent) return;
  const visual = content.cloneNode(true) as HTMLElement;
  const offset = scroll?.scrollTop ?? 0;
  const scrollIndex = scroll && scroll !== content
    ? Array.from(content.querySelectorAll('*')).indexOf(scroll)
    : -1;
  visual.inert = true;
  visual.style.viewTransitionName = 'none';
  visual.setAttribute('aria-hidden', 'true');
  delete visual.dataset.stackflowSlideIncoming;
  visual.dataset.stackflowSlideSnapshot = '';
  visual.removeAttribute('id');
  for (const element of visual.querySelectorAll('[id]')) element.removeAttribute('id');

  let disposed = false;
  let committed = false;
  let playing = false;
  let stopWatching: (() => void) | undefined;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  function dispose() {
    disposed = true;
    clearTimeout(cleanupTimer);
    stopWatching?.();
    visual.remove();
    if (playing) delete content.dataset.stackflowSlideIncoming;
  }
  function hold() {
    if (disposed || visual.parentElement || !content.isConnected) return;
    parent?.append(visual);
    const target = scrollIndex < 0 ? visual : visual.querySelectorAll<HTMLElement>('*')[scrollIndex];
    if (target) target.scrollTop = offset;
  }
  function play() {
    if (disposed || playing || !content.isConnected) return;
    hold();
    playing = true;
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
  return {
    hold,
    play,
    dispose,
    commit() {
      if (committed) return;
      committed = true;
      if (visual.parentElement) play();
    },
  };
}
