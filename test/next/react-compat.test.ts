import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlainNavigationClick, inertProp } from '../../src/next/react-compat.ts';

const link = (attrs: Record<string, string> = {}) => ({
  getAttribute: (name: string) => attrs[name] ?? null,
  hasAttribute: (name: string) => name in attrs,
});
const click = (overrides: Record<string, unknown> = {}) => ({
  button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
  currentTarget: link(), ...overrides,
});

test('a plain left click is a client-side navigation', () => {
  assert.equal(isPlainNavigationClick(click()), true);
  assert.equal(isPlainNavigationClick(click({ currentTarget: link({ target: '_self' }) })), true);
});

test('modified, non-primary, prevented, new-tab and download clicks are left to the browser', () => {
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.equal(isPlainNavigationClick(click({ [key]: true })), false);
  assert.equal(isPlainNavigationClick(click({ button: 1 })), false);
  assert.equal(isPlainNavigationClick(click({ defaultPrevented: true })), false);
  assert.equal(isPlainNavigationClick(click({ currentTarget: link({ target: '_blank' }) })), false);
  assert.equal(isPlainNavigationClick(click({ currentTarget: link({ download: '' }) })), false);
});

test('inert uses the form the installed React renders', () => {
  assert.deepEqual(inertProp(true), { inert: true });
  assert.deepEqual(inertProp(false), { inert: false });
});
