const targetAttribute = 'data-stackflow-scroll-target';
const delegatedAttribute = 'data-stackflow-scroll-delegated';
const nativeScrollbarAttribute = 'data-stackflow-native-scrollbar-hidden';

type ScrollBounds = { top: number; right: number; bottom: number; left: number };

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
  // Track geometry is in viewport pixels. CSS lengths are scaled again by
  // the thumb's effective zoom, including when inherited from an ancestor.
  const zoom = thumb.currentCSSZoom || 1;
  thumb.style.height = `${height / zoom}px`;
  thumb.style.right = `${track.right / zoom + 3}px`;
  thumb.style.transform = `translateY(${(track.top + clamped / scrollRange * travel) / zoom}px)`;
  if (rootTimeline) {
    thumb.style.setProperty('--stackflow-scrollbar-start', `${track.top / zoom}px`);
    thumb.style.setProperty('--stackflow-scrollbar-end', `${(track.top + travel) / zoom}px`);
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

function contentBox(element: HTMLElement, bounds: ScrollBounds, borderBox: boolean): ScrollBounds {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  const zoom = element.currentCSSZoom || 1;
  const px = (value: string) => (parseFloat(value) || 0) * zoom;
  return {
    top: bounds.top + px(style.paddingTop) + (borderBox ? px(style.borderTopWidth) : 0),
    right: bounds.right - px(style.paddingRight) - (borderBox ? px(style.borderRightWidth) : 0),
    bottom: bounds.bottom - px(style.paddingBottom) - (borderBox ? px(style.borderBottomWidth) : 0),
    left: bounds.left + px(style.paddingLeft) + (borderBox ? px(style.borderLeftWidth) : 0),
  };
}

function fitTrack(track: ScrollBounds, region: ScrollBounds, offset: number, range: number) {
  track.left = Math.max(track.left, region.left);
  track.right = Math.min(track.right, region.right);
  // Evaluate each content edge at its native scroll endpoint. Using the
  // current viewport-relative edges would resize the rail during scrolling.
  const top = Math.max(track.top, region.top + offset);
  const bottom = Math.min(track.bottom, region.bottom + offset - range);
  if (bottom > top) {
    track.top = top;
    track.bottom = bottom;
  }
}

function paintElementScrollbar(thumb: HTMLElement, element: HTMLElement,
  bounds: ScrollBounds, origin: {top: number; right: number} = bounds,
  excludeChrome?: (track: ScrollBounds) => void, target?: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const { clientHeight, clientLeft, clientTop, clientWidth, scrollHeight, scrollTop } = element;
  const zoom = element.currentCSSZoom || 1;
  const range = (scrollHeight - clientHeight) * zoom;
  const offset = scrollTop * zoom;
  const top = rect.top + clientTop * zoom;
  const left = rect.left + clientLeft * zoom;
  const scrollport = {
    top,
    bottom: top + clientHeight * zoom,
    left,
    right: left + clientWidth * zoom,
  };
  const track = {
    top: Math.max(bounds.top, scrollport.top),
    bottom: Math.min(bounds.bottom, scrollport.bottom),
    left: Math.max(bounds.left, scrollport.left),
    right: Math.min(bounds.right, scrollport.right),
  };
  if (target === element) fitTrack(track, contentBox(element, scrollport, false), 0, 0);
  else if (target) fitTrack(track, contentBox(target, target.getBoundingClientRect(), true), offset, range);
  excludeChrome?.(track);
  paintThumb(thumb, {
    top: track.top - origin.top, right: origin.right - track.right,
    height: track.right > track.left ? track.bottom - track.top : 0,
  },
    range, offset);
}

function visualBounds(content: HTMLElement): ScrollBounds {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  const viewport = win.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  return {
    top, left,
    bottom: top + (viewport?.height ?? doc.documentElement.clientHeight),
    right: left + (viewport?.width ?? doc.documentElement.clientWidth),
  };
}

function windowViewportBounds(content: HTMLElement, viewport = visualBounds(content)) {
  const provider = content.parentElement?.parentElement;
  const header = provider?.querySelector(':scope > .stackflow-next-header');
  const footer = provider?.querySelector(':scope > .stackflow-next-bottom');
  return {
    ...viewport,
    top: Math.max(viewport.top, header?.getBoundingClientRect().bottom ?? viewport.top),
    bottom: Math.min(viewport.bottom, footer?.getBoundingClientRect().top ?? viewport.bottom),
  };
}

function fixedChrome(provider: HTMLElement, selectors: readonly string[]) {
  const win = provider.ownerDocument.defaultView!;
  const elements = new Set(provider.querySelectorAll(
    'header,footer,[role=banner],[role=contentinfo],[data-stackflow-fixed-key],'
    + ':scope > .stackflow-next-header *, :scope > .stackflow-next-bottom *',
  ));
  for (const selector of selectors) {
    try {
      for (const element of provider.querySelectorAll(selector)) elements.add(element);
    } catch { /* Ignore invalid selectors just as the transition logic does. */ }
  }
  const chrome = new Set<Element>();
  for (const element of elements) {
    if (element.closest('.stackflow-next') !== provider || element.closest('[data-stackflow-slide-snapshot]')) continue;
    const style = win.getComputedStyle(element);
    if (style.position === 'fixed' && style.visibility === 'visible') chrome.add(element);
  }
  return chrome;
}

function excludeFixedChrome(bounds: ScrollBounds, viewport: ScrollBounds, chrome: ReturnType<typeof fixedChrome>) {
  const railX = bounds.right - 4.5;
  const centerX = (bounds.left + bounds.right) / 2;
  for (const element of chrome) {
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0 || rect.left > centerX || rect.right < railX ||
        rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue;
    const gapAbove = rect.top - viewport.top;
    const gapBelow = viewport.bottom - rect.bottom;
    if (gapAbove <= 0 && gapBelow <= 0) continue;
    if (gapAbove <= gapBelow) bounds.top = Math.max(bounds.top, rect.bottom);
    else bounds.bottom = Math.min(bounds.bottom, rect.top);
  }
}

function observeFixedChrome(content: HTMLElement, selectors: readonly string[], schedule: () => void) {
  const provider = content.closest<HTMLElement>('.stackflow-next');
  const win = content.ownerDocument.defaultView!;
  const resize = new win.ResizeObserver(schedule);
  let chrome = new Set<Element>();
  return {
    refresh() {
      if (!provider) return;
      const next = fixedChrome(provider, selectors);
      for (const element of chrome) if (!next.has(element)) resize.unobserve(element);
      for (const element of next) if (!chrome.has(element)) resize.observe(element);
      chrome = next;
    },
    exclude(track: ScrollBounds) {
      if (chrome.size > 0) excludeFixedChrome(track, visualBounds(content), chrome);
    },
    dispose() { resize.disconnect(); },
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
  onScroll: (element: HTMLElement) => void, thumb: HTMLElement, fixedSelectors: readonly string[] = []) {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  const viewport = win.visualViewport;
  const provider = content.parentElement?.parentElement;
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
  const chrome = observeFixedChrome(content, fixedSelectors, schedule);

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
      chrome.refresh();
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
    const range = root.scrollHeight - root.clientHeight;
    // A wheel or touch gesture can continue in the document after an inner
    // scroller reaches its edge. Use the source that actually moved.
    const scroller = range > 0 ? activeScroller : nestedScroller ?? root;
    const documentScroll = scroller === root;
    thumb.toggleAttribute('data-stackflow-scrollbar-root', documentScroll);
    if (!documentScroll) {
      paintElementScrollbar(thumb, scroller, viewportBounds, { top: 0, right: doc.documentElement.clientWidth }, chrome.exclude, target);
      return;
    }
    const rect = target.getBoundingClientRect();
    const region = target === content ? rect : contentBox(target, rect, true);
    if (target !== content && !nestedScroller) fitTrack(viewportBounds, region, win.scrollY, range);
    else {
      viewportBounds.left = Math.max(viewportBounds.left, region.left);
      viewportBounds.right = Math.min(viewportBounds.right, region.right);
    }
    chrome.exclude(viewportBounds);
    const height = viewportBounds.right > viewportBounds.left ? viewportBounds.bottom - viewportBounds.top : 0;
    paintThumb(thumb, { top: viewportBounds.top, right: doc.documentElement.clientWidth - viewportBounds.right, height },
      range, win.scrollY, true);
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
    if (records.some(record => record.target !== thumb && record.attributeName !== nativeScrollbarAttribute)) invalidate();
  });
  resize.observe(content);
  resize.observe(doc.body);
  if (provider) for (const slot of provider.children) resize.observe(slot);
  mutation.observe(provider ?? content, { subtree: true, childList: true, attributes: true });
  win.addEventListener('scroll', scrolled, { capture: true, passive: true });
  win.addEventListener('resize', invalidate);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  schedule();
  return {
    getElement,
    dispose() {
      resize.disconnect();
      chrome.dispose();
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
  fixedSelectors: readonly string[] = [],
) {
  let element = content;
  element.addEventListener('scroll', scrolled, { passive: true });
  const win = content.ownerDocument.defaultView!;
  const activity = thumb && scrollbarActivity(win, thumb);
  const chrome = thumb && observeFixedChrome(content, fixedSelectors, schedule);
  let previousOffset = content.scrollTop;
  let frame = 0;
  let dirty = true;
  let chromeDirty = true;
  const warned = new Set<string>();

  function refreshTarget() {
    frame = 0;
    if (chromeDirty) {
      chromeDirty = false;
      chrome?.refresh();
    }
    const previous = element;
    const current = getElement();
    if (current !== previous && current !== content) onTargetReady(current);
    if (thumb?.parentElement) {
      const bounds = thumb.parentElement.getBoundingClientRect();
      paintElementScrollbar(thumb, current, bounds, bounds, chrome?.exclude, current === content ? undefined : current);
    }
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
    chromeDirty = true;
    schedule();
  }

  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => record.target !== thumb &&
      record.attributeName !== targetAttribute && record.attributeName !== delegatedAttribute)) invalidate();
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
  mutation.observe(content.closest('.stackflow-next') ?? content, { subtree: true, childList: true, characterData: true, attributes: true });
  content.addEventListener('load', invalidate, true);
  win.addEventListener('resize', invalidate);
  getElement();
  if (thumb) schedule();
  return {
    getElement,
    dispose() {
      mutation.disconnect();
      resize.disconnect();
      chrome?.dispose();
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
