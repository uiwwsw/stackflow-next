const targetAttribute = 'data-stackflow-scroll-target';

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

export function attachScrollViewport(
  content: HTMLElement,
  indicator: HTMLElement,
  selector: string | undefined,
  onScroll: (element: HTMLElement) => void,
  onTargetReady: (element: HTMLElement) => void,
) {
  const win = content.ownerDocument.defaultView!;
  const track = indicator.parentElement!;
  let element = content;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = true;
  const warned = new Set<string>();

  function paint() {
    frame = 0;
    const previous = element;
    const current = getElement();
    if (current !== previous && current !== content) onTargetReady(current);
    const { clientHeight, scrollHeight, scrollTop } = current;
    const rect = current.getBoundingClientRect();
    const bounds = track.getBoundingClientRect();
    const top = Math.max(0, rect.top + current.clientTop - bounds.top);
    const bottom = Math.min(track.clientHeight, rect.top + current.clientTop + clientHeight - bounds.top);
    const height = Math.max(0, bottom - top);
    const right = Math.max(0, bounds.right - rect.left - current.clientLeft - current.clientWidth) + 3;
    const maxScroll = scrollHeight - clientHeight;
    clearTimeout(timer);
    if (height <= 0 || maxScroll <= 0) {
      indicator.style.opacity = '0';
      return;
    }
    const thumbHeight = Math.min(height, Math.max(24, height * clientHeight / scrollHeight));
    const fraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
    indicator.style.height = `${thumbHeight}px`;
    indicator.style.right = `${right}px`;
    indicator.style.transform = `translateY(${top + fraction * (height - thumbHeight)}px)`;
    indicator.style.opacity = '1';
    timer = setTimeout(() => { indicator.style.opacity = '0'; }, 700);
  }

  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function scrolled() { onScroll(element); schedule(); }
  function invalidate() { dirty = true; schedule(); }

  const resize = new win.ResizeObserver(invalidate);
  const mutation = new win.MutationObserver(records => {
    if (records.some(record => record.attributeName !== targetAttribute && record.attributeName !== 'data-stackflow-scroll-delegated')) invalidate();
  });

  function getElement(refresh = false) {
    if (!dirty && !refresh) return element;
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
      content.toggleAttribute('data-stackflow-scroll-delegated', element !== content);
      if (element !== content) {
        element.setAttribute(targetAttribute, '');
        resize.observe(element);
      }
      element.addEventListener('scroll', scrolled, { passive: true });
      schedule();
    }
    return element;
  }

  resize.observe(content);
  mutation.observe(content, { subtree: true, childList: true, characterData: true, attributes: selector !== undefined });
  element.addEventListener('scroll', scrolled, { passive: true });
  content.addEventListener('load', invalidate, true);
  win.addEventListener('resize', invalidate);
  getElement();
  schedule();
  return {
    getElement,
    dispose() {
      mutation.disconnect();
      resize.disconnect();
      element.removeEventListener('scroll', scrolled);
      if (element !== content) element.removeAttribute(targetAttribute);
      content.removeAttribute('data-stackflow-scroll-delegated');
      content.removeEventListener('load', invalidate, true);
      win.removeEventListener('resize', invalidate);
      win.cancelAnimationFrame(frame);
      clearTimeout(timer);
      indicator.style.opacity = '0';
    },
  };
}
