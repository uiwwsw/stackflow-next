import { matchesRoute, routePathname } from './fixed-targets.js';

export type SkeletonRoute = string | RegExp | {
  pattern: string;
  flags?: string;
};

export function createSkeletonRouteMatcher(routes: readonly SkeletonRoute[]) {
  const matchers = routes.map(route => {
    if (typeof route === 'string') return (pathname: string) => matchesRoute(route, pathname);

    const expression = new RegExp('pattern' in route ? route.pattern : route.source, route.flags);
    return (pathname: string) => {
      expression.lastIndex = 0;
      return expression.test(pathname);
    };
  });

  return (href: string) => {
    const pathname = routePathname(href);
    return matchers.some(matches => matches(pathname));
  };
}
