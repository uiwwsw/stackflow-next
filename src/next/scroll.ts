const targetAttribute = 'data-stackflow-scroll-target';
const delegatedAttribute = 'data-stackflow-scroll-delegated';

function resolveTarget(content: HTMLElement, selector?: string) {
  if (selector === undefined) return { element: content };
  try {
    const matches = Array.from(content.querySelectorAll(selector)).filter(
      (element): element is HTMLElement => element instanceof content.ownerDocument.defaultView!.HTMLElement
        && element.closest('.stackflow-next-content') === content && element.getClientRects().length > 0,
    );
    if (matches.length === 1) return { element: matches[0] };
    return { element: content, problem: matches.length ? 'matches multiple visible elements' : 'matches no visible element' };
  } catch {
    return { element: content, problem: 'is not a valid CSS selector' };
  }
}

export function previewScrollElement(content: HTMLElement) {
  return content.querySelector<HTMLElement>(`[${targetAttribute}]`) ?? content;
}

function paintThumb(thumb: HTMLElement, track: {top: number; right: number; height: number},
  visibleHeight: number, scrollRange: number, offset: number, elastic = false) {
  thumb.hidden = track.height <= 0 || visibleHeight <= 0 || scrollRange <= 0;
  if (thumb.hidden) return;

  const clamped = Math.min(scrollRange, Math.max(0, offset));
  // The document dimensions are rounded, while Safari and zoomed layouts can
  // report fractional offsets even at a real scroll boundary.
  const edge = Math.min(1, scrollRange / 4);
  const progress = clamped <= edge ? 0 : clamped >= scrollRange - edge ? 1 : clamped / scrollRange;
  const normalHeight = Math.min(track.height, Math.max(12, track.height * visibleHeight / (visibleHeight + scrollRange)));
  const height = elastic ? Math.max(Math.min(8, normalHeight), normalHeight - Math.abs(offset - clamped) / 2) : normalHeight;
  thumb.style.height = `${height}px`;
  thumb.style.right = `${track.right + 3}px`;
  thumb.style.transform = `translateY(${track.top + progress * (track.height - height)}px)`;
}

function paintScrollbar(thumb: HTMLElement, element: HTMLElement) {
  const viewport = thumb.parentElement;
  if (!viewport) return;
  const bounds = viewport.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const { clientHeight, clientLeft, clientTop, clientWidth, scrollHeight, scrollTop } = element;
  const top = Math.max(bounds.top, rect.top + clientTop);
  const bottom = Math.min(bounds.bottom, rect.top + clientTop + clientHeight);
  const left = Math.max(bounds.left, rect.left + clientLeft);
  const right = Math.min(bounds.right, rect.left + clientLeft + clientWidth);
  paintThumb(thumb, { top: top - bounds.top, right: bounds.right - right, height: right > left ? bottom - top : 0 },
    clientHeight, scrollHeight - clientHeight, scrollTop);
}

function windowViewportBounds(content: HTMLElement) {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  const viewport = win.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  const bottom = top + (viewport?.height ?? doc.documentElement.clientHeight);
  const right = left + (viewport?.width ?? doc.documentElement.clientWidth);
  const provider = content.parentElement?.parentElement;
  const header = provider?.querySelector(':scope > .stackflow-next-header');
  const footer = provider?.querySelector(':scope > .stackflow-next-bottom');
  return {
    left, right,
    top: Math.max(top, header?.getBoundingClientRect().bottom ?? top),
    bottom: Math.min(bottom, footer?.getBoundingClientRect().top ?? bottom),
  };
}

export function windowScrollBounds(content: HTMLElement) {
  const viewport = windowViewportBounds(content);
  const rect = content.getBoundingClientRect();
  const left = Math.max(viewport.left, rect.left);
  const top = Math.max(viewport.top, rect.top);
  const right = Math.min(viewport.right, rect.right);
  const bottom = Math.min(viewport.bottom, rect.bottom);
  const win = content.ownerDocument.defaultView!;
  return new win.DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

export function sizeWindowScrollSnapshot(snapshot: HTMLElement, bounds: DOMRect) {
  snapshot.dataset.stackflowWindowSnapshot = '';
  Object.assign(snapshot.style, {
    position: 'fixed', inset: 'auto', top: `${bounds.top}px`, left: `${bounds.left}px`,
    height: `${bounds.height}px`, width: `${bounds.width}px`, overflow: 'hidden',
  });
}

export function attachWindowScroll(content: HTMLElement, selector: string | undefined,
  onScroll: (element: HTMLElement) => void, thumb: HTMLElement) {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  const viewport = win.visualViewport;
  const getElement = () => (doc.scrollingElement ?? doc.documentElement) as HTMLElement;
  let target = content;
  let dirty = true;
  let frame = 0;

  function paint() {
    frame = 0;
    if (dirty) {
      dirty = false;
      const next = resolveTarget(content, selector).element;
      if (next !== target) {
        if (target !== content) resize.unobserve(target);
        target = next;
        if (target !== content) resize.observe(target);
      }
    }
    const root = getElement();
    const viewportBounds = windowViewportBounds(content);
    const rect = target.getBoundingClientRect();
    const left = Math.max(viewportBounds.left, rect.left);
    const right = Math.min(viewportBounds.right, rect.right);
    // The target scrolls with the document. Its horizontal bounds position
    // the rail, and the viewport and sticky slots determine its height.
    const height = right > left ? viewportBounds.bottom - viewportBounds.top : 0;
    paintThumb(thumb, { top: viewportBounds.top, right: doc.documentElement.clientWidth - right, height },
      height, root.scrollHeight - root.clientHeight, win.scrollY, true);
  }

  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function scrolled() { onScroll(getElement()); schedule(); }
  function invalidate() { dirty = true; schedule(); }
  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(invalidate);
  resize.observe(content);
  resize.observe(doc.body);
  const provider = content.parentElement?.parentElement;
  if (provider) for (const slot of provider.children) resize.observe(slot);
  mutation.observe(content, { subtree: true, childList: true, attributes: selector !== undefined });
  win.addEventListener('scroll', scrolled, { passive: true });
  win.addEventListener('resize', invalidate);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  schedule();
  return {
    getElement,
    dispose() {
      resize.disconnect();
      mutation.disconnect();
      win.removeEventListener('scroll', scrolled);
      win.removeEventListener('resize', invalidate);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      win.cancelAnimationFrame(frame);
      thumb.hidden = true;
    },
  };
}

export function attachScrollViewport(
  content: HTMLElement,
  selector: string | undefined,
  onScroll: (element: HTMLElement) => void,
  onTargetReady: (element: HTMLElement) => void,
  thumb?: HTMLElement,
) {
  let element = content;
  element.addEventListener('scroll', scrolled, { passive: true });
  const win = content.ownerDocument.defaultView!;
  let frame = 0;
  let dirty = true;
  const warned = new Set<string>();

  function refreshTarget() {
    frame = 0;
    const previous = element;
    const current = getElement();
    if (current !== previous && current !== content) onTargetReady(current);
    if (thumb) paintScrollbar(thumb, current);
  }

  function schedule() {
    if (!frame) frame = win.requestAnimationFrame(refreshTarget);
  }

  function scrolled() {
    onScroll(element);
    if (thumb) schedule();
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => record.attributeName !== targetAttribute && record.attributeName !== delegatedAttribute)) invalidate();
  });

  function getElement(refresh = false) {
    if (selector === undefined || (!dirty && !refresh)) return element;
    dirty = false;
    const { element: next, problem } = resolveTarget(content, selector);
    if (process.env.NODE_ENV !== 'production' && problem && !warned.has(problem)) {
      warned.add(problem);
      console.warn(`[StackflowProvider] scrollTarget ${JSON.stringify(selector)} ${problem}; using the provider body.`);
    }
    if (next !== element) {
      element.removeEventListener('scroll', scrolled);
      if (element !== content) {
        resize.unobserve(element);
        element.removeAttribute(targetAttribute);
      }
      element = next;
      content.toggleAttribute(delegatedAttribute, element !== content);
      if (element !== content) {
        element.setAttribute(targetAttribute, '');
        resize.observe(element);
      }
      element.addEventListener('scroll', scrolled, { passive: true });
      if (thumb) schedule();
    }
    return element;
  }

  resize.observe(content);
  mutation.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
  content.addEventListener('load', invalidate, true);
  win.addEventListener('resize', invalidate);
  getElement();
  if (thumb) schedule();
  return {
    getElement,
    dispose() {
      mutation.disconnect();
      resize.disconnect();
      element.removeEventListener('scroll', scrolled);
      if (element !== content) element.removeAttribute(targetAttribute);
      content.removeAttribute(delegatedAttribute);
      content.removeEventListener('load', invalidate, true);
      win.removeEventListener('resize', invalidate);
      win.cancelAnimationFrame(frame);
      if (thumb) thumb.hidden = true;
    },
  };
}
