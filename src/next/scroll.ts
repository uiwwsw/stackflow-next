import { ClickScrollPlugin, OverlayScrollbars } from 'overlayscrollbars';
import { attachEdgeBounce, bounceScrollAttribute } from './edge-bounce.js';

const targetAttribute = 'data-stackflow-scroll-target';
const delegatedAttribute = 'data-stackflow-scroll-delegated';
const nativeScrollbarAttribute = 'data-stackflow-native-scrollbar-hidden';
const sourceAttribute = 'data-stackflow-scroll-source';

type ScrollBounds = { top: number; right: number; bottom: number; left: number };
type ScrollbarOrigin = { top: number; right: number } | { viewportRight: number };

/** One drawn scrollbar for one native scroller. */
export type OverlayScrollbar = { setActive(active: boolean): void; dispose(): void };
/**
 * Creates the drawn scrollbar for a scroller inside `slot`. `root` means the
 * document scroller. Returns `undefined` when no scrollbar can be drawn.
 */
export type OverlayScrollbarFactory = (scroller: HTMLElement, root: boolean, slot: HTMLElement) => OverlayScrollbar | undefined;

// Shown while the pointer moves or the page scrolls, so a mouse can grab it.
// Nothing shows before the first scroll (OverlayScrollbars' accessible default).
const overlayOptions = {
  scrollbars: {
    theme: 'os-theme-stackflow', autoHide: 'move', autoHideDelay: 800, autoHideSuspend: true,
    dragScroll: true, clickScroll: true,
  },
} as const;
let clickScrollRegistered = false;

/**
 * OverlayScrollbars keeps native scrolling (window.scrollTo, keyboard, touch
 * momentum) and draws a draggable, clickable scrollbar whose handle follows a
 * ScrollTimeline where supported. The scroller's DOM is not wrapped: the
 * document uses <html> as its viewport, and an element is its own viewport.
 */
export const createOverlayScrollbar: OverlayScrollbarFactory = (scroller, root, slot) => {
  try {
    if (!clickScrollRegistered) {
      OverlayScrollbars.plugin(ClickScrollPlugin);
      clickScrollRegistered = true;
    }
    const instance = OverlayScrollbars(root
      ? { target: scroller.ownerDocument.body, scrollbars: { slot }, cancel: { body: null } }
      : { target: scroller, elements: { viewport: scroller }, scrollbars: { slot } }, overlayOptions);
    if (!OverlayScrollbars.valid(instance)) return;
    return {
      setActive(active) { instance.options({ scrollbars: { visibility: active ? 'auto' : 'hidden' } }); },
      dispose() { instance.destroy(); },
    };
  } catch {
    return;
  }
};

function overlays(slot: HTMLElement, factory: OverlayScrollbarFactory) {
  const created = new Map<HTMLElement, OverlayScrollbar | undefined>();
  let active: HTMLElement | undefined;
  return {
    show(scroller: HTMLElement, root: boolean) {
      if (!created.has(scroller)) created.set(scroller, factory(scroller, root, slot));
      slot.setAttribute(sourceAttribute, root ? 'document' : 'element');
      if (active === scroller) return;
      active = scroller;
      for (const [element, overlay] of created) overlay?.setActive(element === scroller);
    },
    release(scroller: HTMLElement) {
      created.get(scroller)?.dispose();
      created.delete(scroller);
      if (active === scroller) active = undefined;
    },
    dispose() {
      for (const overlay of created.values()) overlay?.dispose();
      created.clear();
      active = undefined;
      slot.removeAttribute(sourceAttribute);
    },
  };
}

/** Mutations made by the scrollbar itself must not schedule another layout pass. */
function ownMutation(record: MutationRecord, slot: HTMLElement | undefined) {
  return !!slot && (record.target === slot || slot.contains(record.target))
    || !!record.attributeName?.startsWith('data-overlayscrollbars');
}

function resolveTarget(content: HTMLElement, selector?: string) {
  if (selector === undefined) return { element: content };
  const win = content.ownerDocument.defaultView!;
  try {
    const matches = Array.from(content.querySelectorAll(selector)).filter((element): element is HTMLElement => {
      if (!(element instanceof win.HTMLElement) || element.closest('.stackflow-next-content') !== content
        || !element.getClientRects().length) return false;
      if (element.checkVisibility) return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      const { visibility, opacity } = win.getComputedStyle(element);
      return visibility !== 'hidden' && visibility !== 'collapse' && opacity !== '0';
    });
    if (matches.length === 1) return { element: matches[0] };
    return { element: content, problem: matches.length ? 'matches multiple visible elements' : 'matches no visible element' };
  } catch {
    return { element: content, problem: 'is not a valid CSS selector' };
  }
}

function watchTargetVisibility(content: HTMLElement, selector: string | undefined, invalidate: () => void) {
  if (selector === undefined) return () => {};
  const finishTransition = (event: TransitionEvent) => {
    if (event.propertyName === 'opacity' || event.propertyName === 'visibility') invalidate();
  };
  content.addEventListener('transitionend', finishTransition);
  content.addEventListener('animationend', invalidate);
  return () => {
    content.removeEventListener('transitionend', finishTransition);
    content.removeEventListener('animationend', invalidate);
  };
}

export function previewScrollElement(content: HTMLElement) {
  return content.querySelector<HTMLElement>(`[${targetAttribute}]`) ?? content;
}

/**
 * Positions the slot over the track. The drawn scrollbar fills the slot and
 * moves its own handle, so the track only changes when the layout does.
 * Returns true when the slot's containing block moves with the document,
 * which means the track must be placed again after each document scroll.
 */
function placeTrack(slot: HTMLElement, track: ScrollBounds, scrollRange: number, origin: ScrollbarOrigin) {
  const trackHeight = track.bottom - track.top;
  slot.hidden = trackHeight <= 0 || track.right <= track.left || scrollRange <= 0;
  if (slot.hidden) return false;

  const fixed = 'viewportRight' in origin;
  const parent = fixed ? slot.offsetParent as HTMLElement | null : null;
  let originTop = fixed ? 0 : origin.top;
  let originRight = fixed ? origin.viewportRight : origin.right;
  if (parent) {
    const rect = parent.getBoundingClientRect();
    const zoom = parent.currentCSSZoom || 1;
    originTop = rect.top + (parent.clientTop - parent.scrollTop) * zoom;
    originRight = rect.left + (parent.clientLeft + parent.clientWidth - parent.scrollLeft) * zoom;
  }
  // Track geometry is in viewport pixels. CSS lengths are scaled again by
  // the slot's effective zoom, including when inherited from an ancestor.
  const zoom = slot.currentCSSZoom || 1;
  slot.style.height = `${trackHeight / zoom}px`;
  slot.style.right = `${(originRight - track.right) / zoom}px`;
  slot.style.transform = `translateY(${(track.top - originTop) / zoom}px)`;
  return !!parent;
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

function placeElementTrack(slot: HTMLElement, element: HTMLElement,
  bounds: ScrollBounds, origin: ScrollbarOrigin = bounds,
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
  return placeTrack(slot, track, range, origin);
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
    isInside(surface: HTMLElement) {
      return [...chrome].some(element => surface.contains(element) && element.getClientRects().length > 0);
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
  onScroll: (element: HTMLElement) => void, slot: HTMLElement, fixedSelectors: readonly string[] = [], edgeBounce = false,
  createScrollbar: OverlayScrollbarFactory = createOverlayScrollbar) {
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
  // True while the slot's containing block moves with the document.
  let followsDocument = false;
  const scrollbars = overlays(slot, createScrollbar);
  const chrome = observeFixedChrome(content, fixedSelectors, schedule);
  const bounce = edgeBounce ? attachEdgeBounce(content, slot, hit => {
    const scroller = nestedScroller?.contains(hit) ? nestedScroller : root;
    if (scroller !== root && root.scrollHeight > root.clientHeight &&
      /^(auto|chain)$/.test(win.getComputedStyle(scroller).overscrollBehaviorY)) return;
    const surface = scroller === root ? target : scroller;
    if (surface.contains(hit) && !chrome.isInside(surface)) return { scroller, surface };
  }) : undefined;

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
          scrollbars.release(nestedScroller);
          nestedScroller.removeAttribute(nativeScrollbarAttribute);
        }
        if (activeScroller === nestedScroller) activeScroller = root;
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
    const viewportRight = doc.documentElement.clientWidth;
    scrollbars.show(scroller, scroller === root);
    if (scroller !== root) {
      followsDocument = placeElementTrack(slot, scroller, viewportBounds, { viewportRight }, chrome.exclude, target);
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
    followsDocument = placeTrack(slot, viewportBounds, range, { viewportRight });
  }

  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function scrolled(event: Event) {
    const documentEvent = event.target === doc || event.target === win;
    const previous = activeScroller;
    if (documentEvent) {
      onScroll(root);
      if (win.scrollY !== rootOffset) {
        bounce?.clearEffect();
        rootOffset = win.scrollY;
        activeScroller = root;
      }
    } else if (nestedScroller && event.target === nestedScroller && nestedScroller.scrollTop !== nestedOffset) {
      bounce?.clearEffect();
      nestedOffset = nestedScroller.scrollTop;
      activeScroller = nestedScroller;
    }
    // The track is fixed to the layout. It only moves when the scroll source
    // changes or the slot's containing block scrolls with the document.
    if (activeScroller !== previous || (documentEvent && followsDocument)) schedule();
  }
  function invalidate() { bounce?.clearEffect(); dirty = true; schedule(); }
  const unwatchVisibility = watchTargetVisibility(content, selector, invalidate);
  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => !ownMutation(record, slot) && record.attributeName !== nativeScrollbarAttribute &&
      record.attributeName !== bounceScrollAttribute)) invalidate();
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
      bounce?.dispose();
      unwatchVisibility();
      resize.disconnect();
      chrome.dispose();
      mutation.disconnect();
      win.removeEventListener('scroll', scrolled, true);
      win.removeEventListener('resize', invalidate);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      win.cancelAnimationFrame(frame);
      scrollbars.dispose();
      nestedScroller?.removeAttribute(nativeScrollbarAttribute);
      slot.hidden = true;
    },
  };
}

export function attachScrollViewport(
  content: HTMLElement,
  selector: string | undefined,
  onScroll: (element: HTMLElement) => void,
  onTargetReady: (element: HTMLElement) => void,
  slot?: HTMLElement,
  fixedSelectors: readonly string[] = [],
  edgeBounce = false,
  createScrollbar: OverlayScrollbarFactory = createOverlayScrollbar,
) {
  let element = content;
  element.addEventListener('scroll', scrolled, { passive: true });
  const win = content.ownerDocument.defaultView!;
  const scrollbars = slot && overlays(slot, createScrollbar);
  const chrome = slot && observeFixedChrome(content, fixedSelectors, schedule);
  const bounce = edgeBounce ? attachEdgeBounce(content, slot, hit => {
    const scroller = getElement();
    if (scroller.contains(hit) && !chrome?.isInside(scroller)) return { scroller, surface: scroller };
  }) : undefined;
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
    if (slot?.parentElement) {
      scrollbars?.show(current, false);
      const bounds = slot.parentElement.getBoundingClientRect();
      placeElementTrack(slot, current, bounds, bounds, chrome?.exclude, current === content ? undefined : current);
    }
  }

  function schedule() {
    if (!frame) frame = win.requestAnimationFrame(refreshTarget);
  }

  // The drawn scrollbar follows the scroller itself; the track only changes
  // with the layout, which the observers below report.
  function scrolled() {
    onScroll(element);
    if (element.scrollTop !== previousOffset) {
      bounce?.clearEffect();
      previousOffset = element.scrollTop;
    }
  }

  function invalidate() {
    bounce?.clearEffect();
    dirty = true;
    chromeDirty = true;
    schedule();
  }

  const unwatchVisibility = watchTargetVisibility(content, selector, invalidate);
  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => !ownMutation(record, slot) &&
      record.attributeName !== targetAttribute && record.attributeName !== delegatedAttribute &&
      record.attributeName !== bounceScrollAttribute)) invalidate();
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
      scrollbars?.release(element);
      if (element !== content) {
        resize.unobserve(element);
        element.removeAttribute(targetAttribute);
      }
      element = next;
      previousOffset = element.scrollTop;
      content.toggleAttribute(delegatedAttribute, element !== content);
      if (element !== content) {
        element.setAttribute(targetAttribute, '');
        resize.observe(element);
      }
      element.addEventListener('scroll', scrolled, { passive: true });
      if (slot) schedule();
    }
    return element;
  }

  resize.observe(content);
  mutation.observe(content.closest('.stackflow-next') ?? content, { subtree: true, childList: true, characterData: true, attributes: true });
  content.addEventListener('load', invalidate, true);
  win.addEventListener('resize', invalidate);
  getElement();
  if (slot) schedule();
  return {
    getElement,
    dispose() {
      bounce?.dispose();
      unwatchVisibility();
      mutation.disconnect();
      resize.disconnect();
      chrome?.dispose();
      scrollbars?.dispose();
      element.removeEventListener('scroll', scrolled);
      if (element !== content) element.removeAttribute(targetAttribute);
      content.removeAttribute(delegatedAttribute);
      content.removeEventListener('load', invalidate, true);
      win.removeEventListener('resize', invalidate);
      win.cancelAnimationFrame(frame);
      if (slot) slot.hidden = true;
    },
  };
}
