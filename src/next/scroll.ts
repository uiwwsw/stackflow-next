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
  scrollRange: number, offset: number, rootTimeline = false) {
  thumb.hidden = track.height <= 0 || scrollRange <= 0;
  if (thumb.hidden) return;

  const clamped = Math.min(scrollRange, Math.max(0, offset));
  const normalHeight = Math.min(track.height, Math.max(12, track.height ** 2 / (track.height + scrollRange)));
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

function scrollbarActivity(win: Window, thumb: HTMLElement) {
  let timer: number | undefined;
  return {
    show() {
      thumb.setAttribute('data-stackflow-scrolling', '');
      win.clearTimeout(timer);
      timer = win.setTimeout(() => thumb.removeAttribute('data-stackflow-scrolling'), 450);
    },
    reset() {
      win.clearTimeout(timer);
      thumb.removeAttribute('data-stackflow-scrolling');
    },
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
    scrollHeight - clientHeight, scrollTop);
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
  let nestedScroller: HTMLElement | undefined;
  let activeScroller = root;
  let rootOffset = win.scrollY;
  let nestedOffset = 0;
  let target = content;
  let dirty = true;
  let frame = 0;
  const activity = scrollbarActivity(win, thumb);

  function selectedScroller() {
    for (let node: HTMLElement | null = target; node && node !== content; node = node.parentElement) {
      if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight &&
          /^(auto|scroll|overlay)$/.test(win.getComputedStyle(node).overflowY)) return node;
    }
  }

  function paint() {
    frame = 0;
    if (dirty) {
      dirty = false;
      const next = resolveTarget(content, selector).element;
      if (next !== target) {
        if (target !== content && target !== nestedScroller) resize.unobserve(target);
        target = next;
        if (target !== content) resize.observe(target);
      }
      const nextScroller = selectedScroller();
      if (nextScroller !== nestedScroller) {
        if (nestedScroller) {
          if (nestedScroller !== target) resize.unobserve(nestedScroller);
          nestedScroller.removeAttribute(nativeScrollbarAttribute);
        }
        if (activeScroller === nestedScroller) {
          activeScroller = root;
          activity.reset();
        }
        nestedScroller = nextScroller;
        if (nestedScroller) {
          nestedScroller.setAttribute(nativeScrollbarAttribute, '');
          if (nestedScroller !== target) resize.observe(nestedScroller);
          nestedOffset = nestedScroller.scrollTop;
        }
      }
    }
    const viewportBounds = windowViewportBounds(content);
    const rect = target.getBoundingClientRect();
    const left = Math.max(viewportBounds.left, rect.left);
    const right = Math.min(viewportBounds.right, rect.right);
    // A wheel or touch gesture can continue in the document after an inner
    // scroller reaches its edge. Use the source that actually moved.
    const scroller = root.scrollHeight > root.clientHeight ? activeScroller : nestedScroller ?? root;
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
      root.scrollHeight - root.clientHeight, win.scrollY, true);
  }

  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function scrolled(event: Event) {
    const documentEvent = event.target === doc || event.target === win;
    if (documentEvent) {
      onScroll(root);
      if (win.scrollY !== rootOffset) {
        rootOffset = win.scrollY;
        activeScroller = root;
        activity.show();
      }
    } else if (nestedScroller && event.target === nestedScroller && nestedScroller.scrollTop !== nestedOffset) {
      nestedOffset = nestedScroller.scrollTop;
      activeScroller = nestedScroller;
      activity.show();
    }
    if (documentEvent || event.target === nestedScroller) schedule();
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
      nestedScroller?.removeAttribute(nativeScrollbarAttribute);
      activity.reset();
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
  const activity = thumb && scrollbarActivity(win, thumb);
  let previousOffset = content.scrollTop;
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
    if (element.scrollTop !== previousOffset) {
      previousOffset = element.scrollTop;
      activity?.show();
    }
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
      previousOffset = element.scrollTop;
      activity?.reset();
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
      activity?.reset();
      if (thumb) thumb.hidden = true;
    },
  };
}
