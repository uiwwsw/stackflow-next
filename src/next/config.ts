import type { NextConfig } from 'next';
/** Enable Next's supported Activity route retention; no private router contexts. */
export function withStackflow(config: NextConfig = {}): NextConfig {
  return {...config, cacheComponents: true, partialPrefetching: true};
}
