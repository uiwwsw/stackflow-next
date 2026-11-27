import { createRequire } from 'node:module';
import type { NextConfig } from 'next';

function installedNextVersion(): string | undefined {
  try {
    return (createRequire(import.meta.url)('next/package.json') as {version?: string}).version;
  } catch {
    return undefined;
  }
}

function atLeast(version: string, major: number, minor: number): boolean {
  const [a = 0, b = 0] = version.split('.').map(part => Number.parseInt(part, 10));
  return a > major || (a === major && b >= minor);
}

/**
 * Turns on Next.js Cache Components (Next.js 16+) and Partial Prefetching
 * (Next.js 16.3+) unless the config already sets them. Cache Components keeps
 * hidden routes mounted with React <Activity>, which is what preserves screen
 * state on Back. Transitions, swipe Back and scroll restoration work without
 * it, so older Next.js versions get the config back unchanged. Pass
 * `cacheComponents: false` for an app that has not migrated to Cache
 * Components (for example one that uses the `runtime` segment config).
 */
export function withStackflow(config: NextConfig = {}, nextVersion = installedNextVersion()): NextConfig {
  const version = nextVersion ?? '999.0.0';
  const result: NextConfig & {cacheComponents?: boolean; partialPrefetching?: boolean} = {...config};
  const current = config as {cacheComponents?: boolean; partialPrefetching?: boolean};
  if (atLeast(version, 16, 0)) result.cacheComponents = current.cacheComponents ?? true;
  if (atLeast(version, 16, 3)) result.partialPrefetching = current.partialPrefetching ?? true;
  return result;
}
