import { version } from 'react';

const major = Number.parseInt(version, 10);

/**
 * React 19 treats `inert` as a boolean. React 18 does not know the attribute,
 * so it only renders a string value and warns about `true`.
 */
export function inertProp(value: boolean): Record<string, unknown> {
  if (major >= 19) return {inert: value};
  return value ? {inert: ''} : {};
}

export interface LinkClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  currentTarget: {getAttribute(name: string): string | null; hasAttribute(name: string): boolean};
}

/** True when a link click is one Next.js would turn into a client-side navigation. */
export function isPlainNavigationClick(event: LinkClick): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.currentTarget.getAttribute('target');
  if (target && target !== '_self') return false;
  return !event.currentTarget.hasAttribute('download');
}
