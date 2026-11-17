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
  const trackHeight = bottom - top;
  const scrollRange = scrollHeight - clientHeight;
  thumb.hidden = clientHeight <= 0 || trackHeight <= 0 || right <= left || scrollRange <= 0;
  if (thumb.hidden) return;

  const height = Math.min(trackHeight, Math.max(24, trackHeight * clientHeight / scrollHeight));
  const progress = Math.min(1, Math.max(0, scrollTop / scrollRange));
  thumb.style.height = `${height}px`;
  thumb.style.right = `${bounds.right - right + 3}px`;
  thumb.style.transform = `translateY(${top - bounds.top + progress * (trackHeight - height)}px)`;
}

export function windowScrollBounds(content: HTMLElement, target = content) {
  const doc = content.ownerDocument;
  const win = doc.defaultView!;
  const viewport = win.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? doc.documentElement.clientHeight);
  const viewportRight = viewportLeft + (viewport?.width ?? doc.documentElement.clientWidth);
  const provider = content.parentElement?.parentElement;
  const header = provider?.querySelector(':scope > .stackflow-next-header');
  const footer = provider?.querySelector(':scope > .stackflow-next-bottom');
  const rect = target.getBoundingClientRect();
  const left = Math.max(viewportLeft, rect.left);
  const top = Math.max(viewportTop, rect.top, header?.getBoundingClientRect().bottom ?? viewportTop);
  const right = Math.min(viewportRight, rect.right);
  const bottom = Math.min(viewportBottom, rect.bottom, footer?.getBoundingClientRect().top ?? viewportBottom);
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
    const bounds = windowScrollBounds(content, target);
    const range = root.scrollHeight - root.clientHeight;
    thumb.hidden = range <= 0 || bounds.height <= 0 || bounds.width <= 0;
    if (thumb.hidden) return;

    const offset = win.scrollY;
    const clamped = Math.min(range, Math.max(0, offset));
    const normalHeight = Math.min(bounds.height, Math.max(24, bounds.height ** 2 / (bounds.height + range)));
    const height = Math.max(Math.min(8, normalHeight), normalHeight - Math.abs(offset - clamped) / 2);
    const top = bounds.top + clamped / range * (bounds.height - height);
    thumb.style.height = `${height}px`;
    thumb.style.right = `${doc.documentElement.clientWidth - bounds.right + 3}px`;
    thumb.style.transform = `translateY(${top}px)`;
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
