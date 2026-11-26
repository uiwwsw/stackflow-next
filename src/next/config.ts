import type { NextConfig } from 'next';
/**
 * Turns on Next.js Cache Components and Partial Prefetching unless the config
 * already sets them. Cache Components keeps hidden routes mounted with React
 * <Activity>, which is what preserves screen state on Back. Transitions,
 * swipe Back and scroll restoration work without it; pass
 * `cacheComponents: false` for an app that has not migrated to Cache
 * Components (for example one that uses the `runtime` segment config).
 */
export function withStackflow(config: NextConfig = {}): NextConfig {
  return {
    ...config,
    cacheComponents: config.cacheComponents ?? true,
    partialPrefetching: config.partialPrefetching ?? true,
  };
}
