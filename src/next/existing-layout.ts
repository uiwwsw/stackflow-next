export function findExistingTarget(doc: Document, selector?: string) {
  if (selector === undefined || !doc.defaultView) return null;
  try {
    const { HTMLElement } = doc.defaultView;
    const matches = Array.from(doc.querySelectorAll(selector)).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element.getClientRects().length > 0,
    );
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

export function findExistingScroller(doc: Document, selector?: string) {
  const target = findExistingTarget(doc, selector);
  if (!target || target === doc.documentElement || target === doc.body) return null;
  const overflow = doc.defaultView!.getComputedStyle(target).overflowY;
  return ['auto', 'scroll', 'overlay'].includes(overflow) ? target : null;
}

/** A decorative overlay; never writes styles or attributes to the scroll element. */
export function attachExistingIndicator(doc: Document, selector: string, onScroll: (element: HTMLElement) => void) {
  const win = doc.defaultView!;
  const indicator = doc.createElement('div');
  indicator.className = 'stackflow-next-indicator stackflow-next-indicator-existing';
  indicator.setAttribute('aria-hidden', 'true');
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let target: HTMLElement | null = null;

  function hide() { indicator.style.opacity = '0'; }
  function paint() {
    frame = 0;
    if (!target || findExistingScroller(doc, selector) !== target) { hide(); return; }
    const { clientHeight, scrollHeight, scrollTop } = target;
    if (!clientHeight || scrollHeight <= clientHeight) { hide(); return; }
    const bounds = target.getBoundingClientRect();
    const top = Math.max(0, bounds.top + target.clientTop);
    const height = Math.min(win.innerHeight, bounds.top + target.clientTop + clientHeight) - top;
    const right = bounds.left + target.clientLeft + target.clientWidth;
    if (height <= 0 || right <= 0 || right > win.innerWidth) { hide(); return; }
    const thumb = Math.min(height, Math.max(24, height * clientHeight / scrollHeight));
    const progress = Math.min(1, Math.max(0, scrollTop / (scrollHeight - clientHeight)));
    if (!indicator.isConnected) doc.body.append(indicator);
    indicator.style.height = `${thumb}px`;
    indicator.style.right = `${win.innerWidth - right + 3}px`;
    indicator.style.transform = `translateY(${top + progress * (height - thumb)}px)`;
    indicator.style.opacity = '1';
    clearTimeout(timer);
    timer = setTimeout(hide, 700);
  }
  function scrolled(event: Event) {
    try {
      if (!(event.target instanceof win.HTMLElement) || !event.target.matches(selector)) { hide(); return; }
    } catch { return; }
    target = event.target;
    if (findExistingScroller(doc, selector) !== target) return;
    onScroll(target);
    if (!frame) frame = win.requestAnimationFrame(paint);
  }
  doc.addEventListener('scroll', scrolled, { capture: true, passive: true });
  win.addEventListener('resize', hide);
  return () => {
    doc.removeEventListener('scroll', scrolled, true);
    win.removeEventListener('resize', hide);
    win.cancelAnimationFrame(frame);
    clearTimeout(timer);
    indicator.remove();
  };
}
