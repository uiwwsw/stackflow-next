const marker = 'data-stackflow-fixed-target';

export type FixedTarget = string | {
  selector: string;
  /** Routes on either side of a transition where this element should slide. */
  exceptRoutes: readonly string[];
};

export function routePathname(url: string) {
  return url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
}

export function matchesRoute(rule: string, href: string) {
  if (routePathname(rule) !== routePathname(href)) return false;
  if (!rule.includes('?')) return true;
  const query = (url: string) => {
    const withoutHash = url.split('#', 1)[0];
    const start = withoutHash.indexOf('?');
    return new URLSearchParams(start < 0 ? '' : withoutHash.slice(start + 1));
  };
  const required = query(rule);
  if (required.size === 0) return true;
  const actual = query(href);
  const remaining = new Map<string, string[]>();
  for (const [key, value] of required) {
    const values = remaining.get(key) ?? actual.getAll(key);
    const index = values.indexOf(value);
    if (index < 0) return false;
    values.splice(index, 1);
    remaining.set(key, values);
  }
  return true;
}

export function resolveFixedSelectors(targets: readonly FixedTarget[], from: string, to: string) {
  return targets.flatMap(target => {
    if (typeof target === 'string') return [target];
    const excluded = target.exceptRoutes.some(route => matchesRoute(route, from) || matchesRoute(route, to));
    return excluded ? [] : [target.selector];
  });
}

export function findFixedTargets(content: HTMLElement | null, selectors: readonly string[]) {
  const targets = new Set<HTMLElement>();
  if (!content || !selectors.length) return targets;
  const win = content.ownerDocument.defaultView;
  if (!win) return targets;
  const bounds = content.getBoundingClientRect();
  for (const selector of selectors) {
    if (!selector.trim()) continue;
    try {
      for (const element of content.querySelectorAll(selector)) {
        if (!(element instanceof win.HTMLElement) || !element.getClientRects().length) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom && rect.right > bounds.left && rect.left < bounds.right) targets.add(element);
      }
    } catch { /* An invalid selector leaves the other selections usable. */ }
  }
  return new Set([...targets].filter(element => {
    for (let parent = element.parentElement; parent && parent !== content; parent = parent.parentElement) {
      if (targets.has(parent)) return false;
    }
    return true;
  }));
}

export function pinForTransition(content: HTMLElement, targets: ReadonlySet<HTMLElement>) {
  const bounds = content.getBoundingClientRect();
  const elements = [...targets].map(element => ({ element, rect: element.getBoundingClientRect(), original: element.getAttribute(marker) }));
  const fits = ({rect}: typeof elements[number]) => rect.top >= bounds.top - .5 && rect.left >= bounds.left - .5 && rect.bottom <= bounds.bottom + .5 && rect.right <= bounds.right + .5;
  if (!elements.every(fits)) return null;
  for (const {element} of elements) element.setAttribute(marker, '');
  return {
    stable(next: ReadonlySet<HTMLElement>) {
      // Targets that appear on the destination were never pinned. They can
      // enter with the destination snapshot without affecting existing pins.
      return elements.every(({element, rect}) => {
        if (!next.has(element)) return false;
        const after = element.getBoundingClientRect();
        return (['top', 'left', 'right', 'bottom'] as const).every(edge => Math.abs(rect[edge] - after[edge]) <= .5);
      });
    },
    dispose() {
      for (const {element, original} of elements) {
        if (original === null) element.removeAttribute(marker);
        else element.setAttribute(marker, original);
      }
    },
  };
}
