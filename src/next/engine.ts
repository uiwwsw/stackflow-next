import { captureSlide } from './slide-fallback.js';
import { aggregate, makeEvent, type DomainEvent, type Stack } from '@stackflow/core';
import { matchesRoute, resolveFixedSelectors, routePathname, type FixedTarget } from './fixed-targets.js';

export const HISTORY_KEY = '__stackflow_next_v1';
/** Previous screens kept as swipe-back previews. */
const SWIPE_PREVIEW_DEPTH = 4;
export type Entry = { id: string; position: number; url: string; scroll: number; values: Map<string, unknown>; visual?: HTMLElement };
export type Direction = 'push' | 'pop' | 'replace';
export type SlideDirection = Exclude<Direction, 'replace'>;
export type RouteTransition = { href: string; animation: 'ios' | 'modal' | 'none' };
type NavigationWindow = Window & { navigation?: EventTarget & { currentEntry?: { index: number } | null } };
type TraverseEvent = Event & {
  navigationType: string;
  destination: { sameDocument: boolean; url: string; index: number };
  signal?: AbortSignal;
  hasUAVisualTransition?: boolean;
};
type Slide = ReturnType<typeof captureSlide>;
export function safeHref(href: string, base: string) {
  const url = new URL(href, base), origin = new URL(base).origin;
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.pathname.startsWith('//')) {
    throw new TypeError('Only same-origin HTTP(S) navigation is supported');
  }
  return url.pathname + url.search + url.hash;
}
function routeKey(url: URL | Location) {
  const pathname = routePathname(url.pathname);
  const query = new URLSearchParams(url.search).toString();
  return query ? `${pathname}?${query}` : pathname;
}

function metadata(value: unknown): { id: string; position: number } | null {
  const item = (value as Record<string, any> | null)?.[HISTORY_KEY];
  return item && typeof item.id === 'string' && Number.isSafeInteger(item.position) ? item : null;
}
export class NavigationEngine {
  entries = new Map<string, Entry>();
  current: Entry | null = null;
  stack: Stack | null = null;
  private listeners = new Set<() => void>();
  private loadingObserver: MutationObserver | null = null;
  private historyIndex: number | undefined;
  private basePath: string | undefined;
  private renderedRoute: string | null = null;
  private navigation: { href: string | null; expected: string | null; source: string; waitForDestination: boolean; forceFallback: boolean } | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private slide: Slide;
  private disconnected = false;
  private cleanup: (() => void) | null = null;
  private swipeBackEnabled = false;
  direction: Direction = 'replace';
  skipNextPopAnimation = false;
  hasFixedTargets() {
    return this.fixedTargets().some(target => (typeof target === 'string' ? target : target.selector).trim().length > 0);
  }
  setSwipeBackEnabled(enabled: boolean) {
    this.swipeBackEnabled = enabled;
    if (!enabled) for (const entry of this.entries.values()) delete entry.visual;
  }
  private previousEntry() {
    const position = (this.current?.position ?? 0) - 1;
    for (const entry of this.entries.values()) if (entry.position === position) return entry;
  }
  hasPreviousEntry() { return this.previousEntry() !== undefined; }
  previousVisual() { return this.previousEntry()?.visual; }
  private routeAnimation(href: string) {
    const rule = this.transitionRoutes().find(rule => matchesRoute(rule.href, href));
    return rule?.animation ?? (this.modalRoutes().some(route => matchesRoute(route, href)) ? 'modal' : undefined);
  }
  private motion(from: string, to: string) {
    const source = this.routeAnimation(this.appHref(from));
    const destination = this.routeAnimation(this.appHref(to));
    const disabled = source === 'none' || destination === 'none';
    const modal: 'enter' | 'exit' | undefined = source === 'modal' && destination !== 'modal' ? 'exit'
      : destination === 'modal' && source !== 'modal' ? 'enter' : undefined;
    return { disabled, modal, animateReplace: !!modal || source === 'ios' || destination === 'ios' };
  }
  usesNonInteractiveBack() {
    const previous = this.previousEntry();
    if (!previous) return false;
    const { disabled, modal } = this.motion(this.current?.url ?? this.url(), previous.url);
    return disabled || !!modal;
  }
  private saveVisual() {
    if (!this.swipeBackEnabled || this.hasFixedTargets()) return;
    const el=this.viewport(), current=this.current;if(!current||!el)return;
    const offset = this.scrollElement()?.scrollTop ?? 0;
    current.visual=el.cloneNode(true) as HTMLElement;current.visual.dataset.stackflowScroll=String(offset);
    delete current.visual.dataset.stackflowSlideStaged;
    delete current.visual.dataset.stackflowSlideIncoming;
  }
  // Swipe back only reveals screens below the current one. Keep the nearest
  // few so it still works after Back; a forward screen is recaptured on leave.
  // Runs after the current entry changes, so the screen being left on Back
  // does not displace an older preview.
  private prunePreviews() {
    const position = this.current?.position;
    if (position === undefined) return;
    const retained = new Set([...this.entries.values()]
      .filter(e => e.visual && e.position <= position)
      .sort((a, b) => b.position - a.position)
      .slice(0, SWIPE_PREVIEW_DEPTH));
    for (const entry of this.entries.values()) if (!retained.has(entry)) delete entry.visual;
  }
  constructor(readonly win: Window, readonly viewport: () => HTMLElement | null,
    readonly options: { animation: 'ios' | 'none'; preserveScroll: boolean; timeout: number; maxEntries: number; waitForPage?: boolean },
    private readonly scrollElement = viewport,
    private readonly fixedTargets: () => readonly FixedTarget[] = () => [],
    private readonly modalRoutes: () => readonly string[] = () => [],
    private readonly matchesSkeletonRoute: (href: string) => boolean = () => false,
    private readonly transitionRoutes: () => readonly RouteTransition[] = () => []) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isPending = () => this.navigation !== null;
  private emit() { this.listeners.forEach(fn => fn()); }
  private remember(meta: {id: string; position: number}, url: string) {
    let entry = this.entries.get(meta.id);
    if (!entry) {
      entry = {...meta, url, scroll: 0, values: new Map()}; this.entries.set(meta.id, entry);
    }
    entry.url = url;
    while (this.entries.size > this.options.maxEntries) {
      const oldest = [...this.entries.keys()].find(key => key !== meta.id);
      if (!oldest) break; this.entries.delete(oldest);
    }
    return entry;
  }
  private fresh(position: number) { return {id: this.win.crypto.randomUUID(), position}; }
  private url() { return this.win.location.pathname + this.win.location.search + this.win.location.hash; }
  private appHref(href: string) {
    if (!this.basePath) return href;
    const url = new URL(href, this.win.location.origin);
    const path = url.pathname;
    if (path !== this.basePath && !path.startsWith(this.basePath + '/')) return href;
    return (path.slice(this.basePath.length) || '/') + url.search + url.hash;
  }
  resolveHref(href: string) {
    const origin = this.win.location.origin;
    const resolved = safeHref(href, origin + this.appHref(this.url()));
    const destination = href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href) ? this.appHref(resolved) : resolved;
    if (destination.startsWith('//')) throw new TypeError('Only same-origin HTTP(S) navigation is supported');
    return destination;
  }
  isCurrentRoute(href: string) {
    const origin = this.win.location.origin;
    return routeKey(new URL(this.resolveHref(href), origin)) === routeKey(new URL(this.appHref(this.url()), origin));
  }
  private readHistoryIndex() {
    const index = (this.win as NavigationWindow).navigation?.currentEntry?.index;
    return index !== undefined && index >= 0 ? index : undefined;
  }
  private recoverHistoryEntry(url: string, position: number, delta: number) {
    let match: Entry | undefined;
    for (const entry of this.entries.values()) {
      if (entry.url !== url || (delta !== 0 && entry.position !== position + delta)) continue;
      if (match) return this.fresh(position + delta);
      match = entry;
    }
    return match ? { id: match.id, position: match.position } : this.fresh(position + delta);
  }
  connect() {
    if (this.cleanup) return this.cleanup;
    this.disconnected = false;
    const history = this.win.history, push = history.pushState, replace = history.replaceState;
    const initial = metadata(history.state) ?? this.fresh(0);
    replace.call(history, {...history.state, [HISTORY_KEY]: initial}, '', this.win.location.href);
    this.current = this.remember(initial, this.url());
    this.renderedRoute = routeKey(this.win.location);
    this.historyIndex = this.readHistoryIndex();
    const oldRestoration = history.scrollRestoration;
    if (this.options.preserveScroll) history.scrollRestoration = 'manual';
    const engine = this;
    const wrappedPush: History['pushState'] = function(data, unused, url) {
      if (engine.disconnected) return push.call(history,data,unused,url);
      engine.capture();
      const position = (metadata(history.state)?.position ?? 0) + 1;
      const meta = engine.fresh(position);
      push.call(history, {...data, [HISTORY_KEY]: meta}, unused, url);
      // A fresh push discards the forward branch.
      for (const [key, entry] of engine.entries) if (entry.position >= position) engine.entries.delete(key);
      engine.current = engine.remember(meta, engine.url());
      engine.historyIndex = engine.readHistoryIndex();
    };
    const wrappedReplace: History['replaceState'] = function(data, unused, url) {
      if (engine.disconnected) return replace.call(history,data,unused,url);
      const meta = metadata(history.state) ?? engine.fresh(0);
      replace.call(history, {...data, [HISTORY_KEY]: meta}, unused, url);
      engine.current = engine.remember(meta, engine.url());
      engine.historyIndex = engine.readHistoryIndex();
      const navigation = engine.navigation;
      // The route observer only tracks pathname and search parameters.
      if (navigation && navigation.expected === navigation.source && navigation.href === engine.url()) {
        engine.commit(engine.appHref(navigation.href));
      }
    };
    history.pushState = wrappedPush; history.replaceState = wrappedReplace;
    const browserNavigation = (this.win as NavigationWindow).navigation;
    let earlyTraversal: { destination: string; source: string; slide: Slide; signal?: AbortSignal } | undefined;
    const prepareTraversal = (event: Event) => {
      const traversal = event as TraverseEvent;
      if (traversal.navigationType !== 'traverse') return;
      earlyTraversal?.slide?.dispose();
      earlyTraversal = undefined;
      if (!traversal.destination.sameDocument || traversal.hasUAVisualTransition ||
          engine.skipNextPopAnimation || !engine.canAnimate()) return;
      const url = new URL(traversal.destination.url);
      if (url.origin !== engine.win.location.origin) return;
      const destination = url.pathname + url.search + url.hash;
      const source = engine.renderedRoute ?? engine.url();
      const { disabled, modal } = engine.motion(source, destination);
      const viewport = engine.viewport();
      if (!viewport || disabled) return;
      const direction = traversal.destination.index < (engine.readHistoryIndex() ?? -1) ? 'pop' : 'push';
      const slide = engine.captureOutgoing(viewport, direction, modal, source, destination);
      if (!slide) return;
      const prepared = { destination, source, slide, signal: traversal.signal };
      earlyTraversal = prepared;
      traversal.signal?.addEventListener('abort', () => {
        if (earlyTraversal !== prepared) return;
        slide.dispose();
        earlyTraversal = undefined;
      }, { once: true });
    };
    browserNavigation?.addEventListener?.('navigate', prepareTraversal);
    const pop = (event: PopStateEvent) => {
      const destination = engine.url();
      const from = engine.current?.url ?? destination;
      const destinationRoute = routeKey(engine.win.location);
      const sourceRoute = routeKey(new URL(from, engine.win.location.origin));
      // The history cursor can advance twice before the first destination paints.
      const prepared = earlyTraversal;
      earlyTraversal = undefined;
      const usePrepared = prepared?.destination === destination && !prepared.signal?.aborted;
      if (!usePrepared) prepared?.slide?.dispose();
      const visualSource = (usePrepared ? prepared.source : engine.renderedRoute) ?? from;
      const sameRoute = sourceRoute === destinationRoute;
      const alreadyRendered = engine.renderedRoute === destinationRoute;
      if (engine.renderedRoute === sourceRoute) {
        engine.capture();
        if (!sameRoute) engine.saveVisual();
      }
      const state = event.state;
      const known = metadata(state);
      const index = engine.readHistoryIndex();
      const position = engine.current?.position ?? 0;
      const delta = index !== undefined && engine.historyIndex !== undefined ? index - engine.historyIndex : 0;
      const meta = known ?? engine.recoverHistoryEntry(destination, position, delta);
      engine.direction = (delta || meta.position - position) < 0 ? 'pop' : 'push';
      engine.historyIndex = index;
      if (!known && state?.__NA === true) replace.call(history, {...state,[HISTORY_KEY]:meta},'',engine.win.location.href);
      engine.current = engine.remember(meta, destination);
      const skipAnimation = engine.skipNextPopAnimation || event.hasUAVisualTransition;
      engine.skipNextPopAnimation = false;
      const syncRenderedEntry = () => {
        if (!sameRoute || from === destination) engine.restoreScroll();
        engine.rebuild();
      };
      if (!skipAnimation && state?.__NA === true && engine.canAnimate() && !engine.motion(visualSource, destination).disabled) {
        // Capture the outgoing DOM before Next's listener handles this same event.
        engine.begin(engine.direction, destination, () => {
          // Next's route observer does not run when the rendered URL is unchanged.
          if (alreadyRendered && engine.url() === destination && engine.isPending()) {
            syncRenderedEntry();
            engine.finishWhenPageIsReady();
          }
        }, visualSource, usePrepared ? prepared.slide : undefined, usePrepared && alreadyRendered && visualSource !== destinationRoute);
      } else {
        prepared?.slide?.dispose();
        engine.cancelTransition();
        if (alreadyRendered || sameRoute) syncRenderedEntry();
      }
    };
    this.win.addEventListener('popstate', pop, true);
    this.rebuild();
    this.cleanup = () => {
      this.disconnected = true; this.cancelTransition();
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace) history.replaceState = replace;
      history.scrollRestoration = oldRestoration;
      this.win.removeEventListener('popstate', pop, true);
      browserNavigation?.removeEventListener?.('navigate', prepareTraversal);
      earlyTraversal?.slide?.dispose();
      earlyTraversal = undefined;
      delete this.win.document.documentElement.dataset.stackflowDirection;
      delete this.win.document.documentElement.dataset.stackflowAnimating;
      delete this.win.document.documentElement.dataset.stackflowModal;
      this.cleanup = null;
    };
    return this.cleanup;
  }
  capture(element = this.scrollElement()) { if (this.current && element) this.current.scroll = element.scrollTop; }
  restoreScroll(element = this.scrollElement()) {
    if (this.options.preserveScroll && element) element.scrollTop = this.current?.scroll ?? 0;
  }
  private rebuild() {
    if (!this.current) return;
    const entries = [...this.entries.values()].filter(e=>e.position <= this.current!.position).sort((a,b)=>a.position-b.position);
    const date = Date.now() - entries.length - 100;
    const events: DomainEvent[] = [
      makeEvent('Initialized',{id:'initialize',transitionDuration:0,eventDate:date-2}),
      makeEvent('ActivityRegistered',{id:'register',activityName:'NextRoute',eventDate:date-1}),
      ...entries.map((e,i)=>makeEvent('Pushed',{id:`push-${e.id}`,activityId:e.id,activityName:'NextRoute',activityParams:{url:e.url},eventDate:date+i})),
    ];
    this.prunePreviews();
    this.stack = aggregate(events, Date.now()); this.emit();
  }
  private release() {
    clearTimeout(this.timeout);
    this.loadingObserver?.disconnect();
    this.loadingObserver = null;
    const navigation = this.navigation;
    this.navigation = null;
    delete this.win.document.documentElement.dataset.stackflowPending;
    if (navigation) this.emit();
  }
  private completeNavigation() {
    const navigation = this.navigation;
    if (!navigation) return;
    const slide = this.slide;
    this.release();
    if (slide && this.slide === slide) {
      slide.play(() => {
        if (this.slide === slide) this.slide = undefined;
      }, navigation.forceFallback);
    }
  }
  private finishWhenPageIsReady() {
    const viewport = this.viewport();
    const Observer = this.win.document.defaultView?.MutationObserver;
    if (!this.navigation?.waitForDestination || !this.slide || !viewport || !Observer) {
      this.completeNavigation();
      return;
    }
    const ready = () => {
      for (const element of viewport.querySelectorAll('[data-stackflow-loading]')) {
        if (element.getClientRects().length > 0) return false;
      }
      return true;
    };
    if (ready()) {
      this.completeNavigation();
      return;
    }
    this.slide.hold();
    this.loadingObserver?.disconnect();
    this.loadingObserver = new Observer(() => {
      if (ready()) this.completeNavigation();
    });
    this.loadingObserver.observe(viewport, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }
  private canAnimate() {
    return this.options.animation !== 'none' && typeof this.win.document.startViewTransition === 'function' &&
      !this.win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  private captureOutgoing(viewport: HTMLElement, direction: Direction, modal: 'enter' | 'exit' | undefined, from: string, destination: string) {
    const selectors = modal ? [] : resolveFixedSelectors(this.fixedTargets(), this.appHref(from), this.appHref(destination));
    return captureSlide(viewport, this.scrollElement(), direction, modal, selectors);
  }
  private cancelTransition() {
    this.slide?.dispose();
    this.slide = undefined;
    this.release();
  }
  begin(direction: Direction, href: string | null, action: () => void, from = this.current?.url ?? this.url(),
    preparedSlide?: Slide, forceFallback = false) {
    this.cancelTransition();
    const { dataset } = this.win.document.documentElement;
    const destination = href ?? this.url();
    const { disabled, modal, animateReplace } = this.motion(from, destination);
    const slideDirection = direction === 'replace' && animateReplace && routePathname(from) !== routePathname(destination)
      ? 'push' : direction;
    this.direction = direction;
    const origin = this.win.location.origin;
    const animate = !disabled && slideDirection !== 'replace' && this.canAnimate();
    const viewport = this.viewport();
    if (animate) {
      this.slide = preparedSlide ?? (viewport ? this.captureOutgoing(viewport, slideDirection, modal, from, destination) : undefined);
    } else {
      preparedSlide?.dispose();
    }
    const navigation = {
      href,
      expected: href ? routeKey(new URL(href, origin)) : null,
      source: routeKey(new URL(from, origin)),
      waitForDestination: !!this.options.waitForPage && !this.matchesSkeletonRoute(this.appHref(destination)),
      forceFallback,
    };
    this.navigation = navigation;
    dataset.stackflowPending = 'true';
    dataset.stackflowDirection = slideDirection;
    this.timeout = setTimeout(() => {
      // Once a loading screen has committed, the deadline reveals it rather
      // than keeping a stale image on screen. Before commit, release the clone.
      if (this.loadingObserver) this.completeNavigation();
      else this.cancelTransition();
    }, this.options.timeout);
    this.emit();
    if (this.navigation !== navigation || this.disconnected) return;
    try { action(); }
    catch { if (this.navigation === navigation) this.cancelTransition(); }
  }
  navigate(direction: Direction, href: string | null, action: () => void, replaceDirection?: SlideDirection) {
    // Traversals are animated once, by the popstate observer.
    if (href === null) { action(); return; }
    const destination = (this.basePath ?? '') + this.resolveHref(href);
    const sameRoute = routeKey(new URL(destination, this.win.location.origin)) === routeKey(this.win.location);
    if (sameRoute && (!replaceDirection || destination === this.url())) { action(); return; }
    this.capture(); this.saveVisual(); this.begin(replaceDirection ?? direction, destination, action);
  }
  commit(route: string) {
    if (this.disconnected) return;
    const origin = this.win.location.origin;
    const observed = new URL(route, origin);
    if (this.basePath === undefined && !this.navigation) {
      const path = routePathname(this.win.location.pathname);
      const appPath = routePathname(observed.pathname);
      if (appPath === '/') this.basePath = path === '/' ? '' : path;
      else if (path.endsWith(appPath)) this.basePath = path.slice(0, -appPath.length);
    }
    const actual = routeKey(this.win.location);
    // Ignore layout effects belonging to the outgoing route.
    if (routeKey(observed) !== routeKey(new URL(this.appHref(this.url()), origin))) return;
    this.renderedRoute = actual;
    const navigation = this.navigation;
    const redirected = navigation?.expected != null && navigation.expected !== actual;
    if (redirected && navigation.source === actual) return;
    const meta = metadata(this.win.history.state);
    if (meta) this.current = this.remember(meta,this.url());
    this.restoreScroll();
    if (redirected) {
      // Modal and fixed-target rules were selected for a different destination.
      this.cancelTransition();
      this.rebuild();
      return;
    }
    this.rebuild(); this.finishWhenPageIsReady();
  }
  read<T>(key: string, fallback: T): T { return this.current?.values.has(key) ? this.current.values.get(key) as T : fallback; }
  write<T>(key: string, value: T) { this.current?.values.set(key,value); this.emit(); }
  dispose() { this.cleanup?.(); this.listeners.clear(); this.entries.clear(); }
}
