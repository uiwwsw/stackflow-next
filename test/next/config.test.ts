import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withStackflow } from '../../src/next/config.ts';

test('withStackflow turns on Cache Components and Partial Prefetching by default', () => {
  const config = withStackflow({ basePath: '/app' });
  assert.equal(config.cacheComponents, true);
  assert.equal(config.partialPrefetching, true);
  assert.equal(config.basePath, '/app');
});

test('withStackflow keeps values the app sets', () => {
  const config = withStackflow({ cacheComponents: false, partialPrefetching: false });
  assert.equal(config.cacheComponents, false);
  assert.equal(config.partialPrefetching, false);
});
