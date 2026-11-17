const targetAttribute = 'data-stackflow-scroll-target';
const delegatedAttribute = 'data-stackflow-scroll-delegated';
const nativeScrollbarAttribute = 'data-stackflow-native-scrollbar-hidden';

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
  visibleHeight: number, scrollRange: number, offset: number, rootTimeline = false) {
  thumb.hidden = track.height <= 0 || visibleHeight <= 0 || scrollRange <= 0;
  if (thumb.hidden) return;

  const clamped = Math.min(scrollRange, Math.max(0, offset));
  const normalHeight = Math.min(track.height, Math.max(12, track.height * visibleHeight / (visibleHeight + scrollRange)));
  const height = Math.max(Math.min(8, normalHeight), normalHeight - Math.abs(offset - clamped) / 2);
  const travel = track.height - height;
  thumb.style.height = `${height}px`;
  thumb.style.right = `${track.right + 3}px`;
  thumb.style.transform = `translateY(${track.top + clamped / scrollRange * travel}px)`;
  if (rootTimeline) {
    thumb.style.setProperty('--stackflow-scrollbar-start', `${track.top}px`);
    thumb.style.setProperty('--stackflow-scrollbar-end', `${track.top + travel}px`);
  }
}

function scrollbarActivity(win: Window, thumb: HTMLElement, offset: number) {
  let previousOffset = offset;
  let timer: number | undefined;
  function reset(nextOffset: number) {
    previousOffset = nextOffset;
    win.clearTimeout(timer);
    thumb.removeAttribute('data-stackflow-scrolling');
  }
  return {
    update(nextOffset: number) {
      if (nextOffset === previousOffset) return;
      previousOffset = nextOffset;
      thumb.setAttribute('data-stackflow-scrolling', '');
      win.clearTimeout(timer);
      timer = win.setTimeout(() => thumb.removeAttribute('data-stackflow-scrolling'), 450);
    },
    reset,
  };
}

function paintElementScrollbar(thumb: HTMLElement, element: HTMLElement,
  bounds: {top: number; right: number; bottom: number; left: number}, origin: {top: number; right: number} = bounds) {
  const rect = element.getBoundingClientRect();
  const { clientHeight, clientLeft, clientTop, clientWidth, scrollHeight, scrollTop } = element;
  const top = Math.max(bounds.top, rect.top + clientTop);
  const bottom = Math.min(bounds.bottom, rect.top + clientTop + clientHeight);
  const left = Math.max(bounds.left, rect.left + clientLeft);
  const right = Math.min(bounds.right, rect.left + clientLeft + clientWidth);
  paintThumb(thumb, { top: top - origin.top, right: origin.right - right, height: right > left ? bottom - top : 0 },
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
  const root = getElement();
  let scroller = root;
  let target = content;
  let dirty = true;
  let frame = 0;
  const activity = scrollbarActivity(win, thumb, win.scrollY);

  function selectedScroller() {
    for (let node: HTMLElement | null = target; node && node !== content; node = node.parentElement) {
      if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight &&
          /^(auto|scroll|overlay)$/.test(win.getComputedStyle(node).overflowY)) return node;
    }
    return root;
  }

  function paint() {
    frame = 0;
    if (dirty) {
      dirty = false;
      const next = resolveTarget(content, selector).element;
      if (next !== target) {
        if (target !== content && target !== scroller) resize.unobserve(target);
        target = next;
        if (target !== content) resize.observe(target);
      }
      const nextScroller = selectedScroller();
      if (nextScroller !== scroller) {
        if (scroller !== root) {
          if (scroller !== target) resize.unobserve(scroller);
          scroller.removeAttribute(nativeScrollbarAttribute);
        }
        scroller = nextScroller;
        if (scroller !== root) {
          scroller.setAttribute(nativeScrollbarAttribute, '');
          if (scroller !== target) resize.observe(scroller);
        }
        activity.reset(scroller === root ? win.scrollY : scroller.scrollTop);
      }
    }
    const viewportBounds = windowViewportBounds(content);
    const rect = target.getBoundingClientRect();
    const left = Math.max(viewportBounds.left, rect.left);
    const right = Math.min(viewportBounds.right, rect.right);
    const documentScroll = scroller === root;
    thumb.toggleAttribute('data-stackflow-scrollbar-root', documentScroll);
    if (!documentScroll) {
      paintElementScrollbar(thumb, scroller, { ...viewportBounds, left, right }, { top: 0, right: doc.documentElement.clientWidth });
      return;
    }
    // The target scrolls with the document. Its horizontal bounds position
    // the rail, and the viewport and sticky slots determine its height.
    const height = right > left ? viewportBounds.bottom - viewportBounds.top : 0;
    paintThumb(thumb, { top: viewportBounds.top, right: doc.documentElement.clientWidth - right, height },
      height, root.scrollHeight - root.clientHeight, win.scrollY, true);
  }

  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function scrolled(event: Event) {
    const documentEvent = event.target === doc || event.target === win;
    if (documentEvent) onScroll(root);
    if (scroller === root ? documentEvent : event.target === scroller) {
      activity.update(scroller === root ? win.scrollY : scroller.scrollTop);
    }
    if (documentEvent || event.target === scroller) schedule();
  }
  function invalidate() { dirty = true; schedule(); }
  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => record.attributeName !== nativeScrollbarAttribute)) invalidate();
  });
  resize.observe(content);
  resize.observe(doc.body);
  const provider = content.parentElement?.parentElement;
  if (provider) for (const slot of provider.children) resize.observe(slot);
  mutation.observe(content, { subtree: true, childList: true, attributes: selector !== undefined });
  win.addEventListener('scroll', scrolled, { capture: true, passive: true });
  win.addEventListener('resize', invalidate);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  schedule();
  return {
    getElement,
    dispose() {
      resize.disconnect();
      mutation.disconnect();
      win.removeEventListener('scroll', scrolled, true);
      win.removeEventListener('resize', invalidate);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      win.cancelAnimationFrame(frame);
      if (scroller !== root) scroller.removeAttribute(nativeScrollbarAttribute);
      activity.reset(0);
      thumb.removeAttribute('data-stackflow-scrollbar-root');
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
  const activity = thumb && scrollbarActivity(win, thumb, content.scrollTop);
  let frame = 0;
  let dirty = true;
  const warned = new Set<string>();

  function refreshTarget() {
    frame = 0;
    const previous = element;
    const current = getElement();
    if (current !== previous && current !== content) onTargetReady(current);
    if (thumb?.parentElement) paintElementScrollbar(thumb, current, thumb.parentElement.getBoundingClientRect());
  }

  function schedule() {
    if (!frame) frame = win.requestAnimationFrame(refreshTarget);
  }

  function scrolled() {
    onScroll(element);
    activity?.update(element.scrollTop);
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
      activity?.reset(element.scrollTop);
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
      activity?.reset(0);
      if (thumb) thumb.hidden = true;
    },
  };
}
