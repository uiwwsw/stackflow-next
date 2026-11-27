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

test('withStackflow leaves options older Next.js versions do not know', () => {
  const v15 = withStackflow({ basePath: '/app' }, '15.5.0');
  assert.equal('cacheComponents' in v15, false);
  assert.equal('partialPrefetching' in v15, false);
  const v16 = withStackflow({}, '16.2.1');
  assert.equal(v16.cacheComponents, true);
  assert.equal('partialPrefetching' in v16, false);
  assert.equal(withStackflow({}, '16.3.0').partialPrefetching, true);
});
