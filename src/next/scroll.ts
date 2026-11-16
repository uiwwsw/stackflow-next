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
  selector: string | undefined,
  onScroll: (element: HTMLElement) => void,
  onTargetReady: (element: HTMLElement) => void,
) {
  function scrolled() { onScroll(element); }

  let element = content;
  element.addEventListener('scroll', scrolled, { passive: true });
  if (selector === undefined) return {
    getElement: () => content,
    dispose: () => content.removeEventListener('scroll', scrolled),
  };

  const win = content.ownerDocument.defaultView!;
  let frame = 0;
  let dirty = true;
  const warned = new Set<string>();

  function refreshTarget() {
    frame = 0;
    const previous = element;
    const current = getElement();
    if (current !== previous && current !== content) onTargetReady(current);
  }

  function invalidate() {
    dirty = true;
    if (!frame) frame = win.requestAnimationFrame(refreshTarget);
  }

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
    }
    return element;
  }

  resize.observe(content);
  mutation.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
  content.addEventListener('load', invalidate, true);
  win.addEventListener('resize', invalidate);
  getElement();
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
    },
  };
}
