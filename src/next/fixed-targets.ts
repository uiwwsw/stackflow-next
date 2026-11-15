const marker = 'data-stackflow-fixed-target';
const keyAttribute = 'data-stackflow-fixed-key';
const nameProperty = 'view-transition-name';
let nextPinId = 0;

export type FixedTarget = string | {
  selector: string;
  /** Exact app pathnames or regular expressions tested against either pathname. */
  exceptRoutes?: readonly (string | RegExp)[];
  /** Return true to let this element slide. The arguments are app-relative URLs. */
  exceptTransition?: (from: string, to: string) => boolean;
};

export function routePathname(url: string) {
  return url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
}

export function matchesRoute(rule: string | RegExp, href: string) {
  if (typeof rule !== 'string') {
    const pattern = rule.global || rule.sticky ? new RegExp(rule) : rule;
    return pattern.test(routePathname(href));
  }
  return !rule.split('#', 1)[0].includes('?') && routePathname(rule) === routePathname(href);
}

export function resolveFixedSelectors(targets: readonly FixedTarget[], from: string, to: string) {
  return targets.flatMap(target => {
    if (typeof target === 'string') return [target];
    const excluded = target.exceptRoutes?.some(route => matchesRoute(route, from) || matchesRoute(route, to)) ||
      target.exceptTransition?.(from, to);
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

function uniqueFixedKeys(elements: ReadonlySet<HTMLElement>) {
  const keys = new Map<string, HTMLElement | null>();
  for (const element of elements) {
    const key = element.getAttribute(keyAttribute);
    if (key) keys.set(key, keys.has(key) ? null : element);
  }
  return keys;
}

export function pinForTransition(content: HTMLElement, targets: ReadonlySet<HTMLElement>) {
  const bounds = content.getBoundingClientRect();
  const elements = [...targets].map(element => ({
    element,
    key: element.getAttribute(keyAttribute),
    rect: element.getBoundingClientRect(),
    name: `stackflow-next-fixed-${nextPinId++}`,
  }));
  const fits = ({rect}: typeof elements[number]) => rect.top >= bounds.top - .5 && rect.left >= bounds.left - .5 && rect.bottom <= bounds.bottom + .5 && rect.right <= bounds.right + .5;
  if (!elements.every(fits)) return null;
  const sourceKeys = uniqueFixedKeys(targets);
  const restore = new Map<HTMLElement, () => void>();
  function mark(element: HTMLElement, name: string) {
    const originalMarker = element.getAttribute(marker);
    const originalName = element.style.getPropertyValue(nameProperty);
    const priority = element.style.getPropertyPriority(nameProperty);
    restore.set(element, () => {
      if (originalMarker === null) element.removeAttribute(marker);
      else element.setAttribute(marker, originalMarker);
      if (originalName) element.style.setProperty(nameProperty, originalName, priority);
      else element.style.removeProperty(nameProperty);
    });
    element.setAttribute(marker, '');
    element.style.setProperty(nameProperty, name, 'important');
  }
  for (const {element, name} of elements) mark(element, name);
  return {
    captureDestination(next: ReadonlySet<HTMLElement>) {
      const destinationKeys = uniqueFixedKeys(next);
      const matches = elements.map(pin => {
        const {element, key} = pin;
        if (next.has(element) && element.getAttribute(keyAttribute) === key) return { pin, match: element };
        const match = key && sourceKeys.get(key) === element ? destinationKeys.get(key) : null;
        return { pin, match };
      });
      const stable = matches.every(({pin: {rect}, match}) => {
        if (!match) return true;
        const after = match.getBoundingClientRect();
        return (['top', 'left', 'right', 'bottom'] as const).every(edge => Math.abs(rect[edge] - after[edge]) <= .5);
      });
      if (!stable) return false;
      // Release outgoing nodes before assigning names that the new DOM reuses.
      for (const {pin: {element}, match} of matches) {
        if (element === match) continue;
        restore.get(element)?.();
        restore.delete(element);
      }
      for (const {pin: {element, name}, match} of matches) {
        if (match && match !== element) mark(match, name);
      }
      return true;
    },
    dispose() {
      for (const reset of restore.values()) reset();
      restore.clear();
    },
  };
}
