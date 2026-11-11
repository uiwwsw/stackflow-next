import { aggregate, makeEvent, type DomainEvent, type Stack } from '@stackflow/core';
import { findFixedTargets, pinForTransition, resolveFixedSelectors, routePathname, type FixedTarget } from './fixed-targets.js';

export const HISTORY_KEY = '__stackflow_next_v1';
export type Entry = { id: string; position: number; url: string; scroll: number; values: Map<string, unknown>; visual?: HTMLElement };
export type Direction = 'push' | 'pop' | 'replace';
type Transition = { finished: Promise<void>; ready: Promise<void>; skipTransition(): void };
type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => Transition };
type NavigationWindow = Window & { navigation?: { currentEntry?: { index: number } | null } };
export function safeHref(href: string, base: string) {
  const url = new URL(href, base), origin = new URL(base).origin;
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new TypeError('Only same-origin HTTP(S) navigation is supported');
  return url.pathname + url.search + url.hash;
}
function routeKey(url: URL | Location) {
  const query = new URLSearchParams(url.search).toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
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
  private generation = 0;
  private finish: (() => void) | null = null;
  private loadingObserver: MutationObserver | null = null;
  private waitForDestination = false;
  private historyIndex: number | undefined;
  private expected: string | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private transition: Transition | null = null;
  private transitionBounds: DOMRect | undefined;
  private stopWatchingBounds: (() => void) | undefined;
  private pins: (NonNullable<ReturnType<typeof pinForTransition>> & { selectors: readonly string[] }) | null = null;
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
  private modalMotion(from: string, to: string) {
    const source = routePathname(from);
    const destination = routePathname(to);
    const routes = this.modalRoutes().map(routePathname);
    const wasModal = routes.includes(source);
    const isModal = routes.includes(destination);
    if (wasModal === isModal) return undefined;
    return isModal ? 'enter' : 'exit';
  }
  hasModalBackTransition() {
    const previous = this.previousEntry();
    return previous !== undefined && this.modalMotion(this.current?.url ?? this.url(), previous.url) !== undefined;
  }
  private saveVisual() {
    if (!this.swipeBackEnabled || this.hasFixedTargets()) return;
    const el=this.viewport();if(!this.current||!el)return;
    const offset = this.scrollElement()?.scrollTop ?? 0;
    this.current.visual=el.cloneNode(true) as HTMLElement;this.current.visual.dataset.stackflowScroll=String(offset);
    const others=[...this.entries.values()].filter(e=>e!==this.current&&e.visual);
    others.slice(0,Math.max(0,others.length-1)).forEach(e=>{delete e.visual;});
  }
  constructor(readonly win: Window, readonly viewport: () => HTMLElement | null,
    readonly options: { animation: 'ios' | 'none'; preserveScroll: boolean; timeout: number; maxEntries: number; waitForPage?: boolean },
    private readonly scrollElement = viewport,
    private readonly fixedTargets: () => readonly FixedTarget[] = () => [],
    private readonly modalRoutes: () => readonly string[] = () => [],
    private readonly skeletonRoutes: () => readonly string[] = () => []) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isPending = () => this.finish !== null;
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
    };
    history.pushState = wrappedPush; history.replaceState = wrappedReplace;
    let replayedPop: PopStateEvent | undefined;
    const pop = (event: PopStateEvent) => {
      if (event === replayedPop) return;
      const destination = engine.url();
      const from = engine.current?.url ?? destination;
      const sameRoute = routeKey(new URL(from, engine.win.location.origin)) === routeKey(engine.win.location);
      engine.capture();
      if (!sameRoute) engine.saveVisual();
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
      if (sameRoute || skipAnimation) {
        engine.cancelTransition();
        if (sameRoute) {
          if (from === destination) engine.restoreScroll();
          engine.rebuild();
        }
        return;
      }
      if (state?.__NA === true && engine.canAnimate()) {
        // Next can commit before the browser captures the outgoing screen. Deliver
        // its history event inside the snapshot callback so capture comes first.
        event.stopImmediatePropagation();
        engine.begin(engine.direction, destination, () => {
          const PopEvent = engine.win.document.defaultView!.PopStateEvent;
          replayedPop = new PopEvent('popstate', { state });
          try { engine.win.dispatchEvent(replayedPop); }
          finally { replayedPop = undefined; }
        }, from);
      } else {
        engine.begin(engine.direction, destination, () => {}, from);
      }
    };
    this.win.addEventListener('popstate', pop, true);
    this.rebuild();
    this.cleanup = () => {
      this.disconnected = true; this.release(); this.transition?.skipTransition(); this.clearTransitionBounds(); this.clearPins();
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace) history.replaceState = replace;
      history.scrollRestoration = oldRestoration;
      this.win.removeEventListener('popstate', pop, true);
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
    this.stack = aggregate(events, Date.now()); this.emit();
  }
  private release() {
    clearTimeout(this.timeout);
    this.loadingObserver?.disconnect();
    this.loadingObserver = null;
    const finish = this.finish;
    this.finish = null;
    this.expected = null;
    delete this.win.document.documentElement.dataset.stackflowPending;
    finish?.();
    if (finish) this.emit();
  }
  private finishWhenPageIsReady() {
    const viewport = this.viewport();
    const Observer = this.win.document.defaultView?.MutationObserver;
    if (!this.waitForDestination || !this.transition || !viewport || !Observer) {
      this.release();
      return;
    }
    const ready = () => {
      for (const element of viewport.querySelectorAll('[data-stackflow-loading]')) {
        if (element.getClientRects().length > 0) return false;
      }
      return true;
    };
    if (ready()) {
      this.release();
      return;
    }
    this.loadingObserver?.disconnect();
    this.loadingObserver = new Observer(() => {
      if (ready()) this.release();
    });
    this.loadingObserver.observe(viewport, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }
  private clearTransitionBounds() {
    this.stopWatchingBounds?.();
    this.stopWatchingBounds = undefined;
    this.transitionBounds = undefined;
  }
  private clearPins() {
    this.pins?.dispose();
    this.pins = null;
  }
  private checkTransitionBounds = () => {
    const before = this.transitionBounds;
    if (!before || !this.transition) return;
    const after = this.viewport()?.getBoundingClientRect();
    // Skip the slide if the slots reflow or the page scrolls while it is running.
    if (!after || Math.abs(before.top - after.top) > .5 || Math.abs(before.bottom - after.bottom) > .5 ||
      (this.pins && !this.pins.stable(findFixedTargets(this.viewport(), this.pins.selectors)))) {
      this.clearTransitionBounds();
      this.transition.skipTransition();
    }
  };
  private canAnimate() {
    const doc = this.win.document as TransitionDocument;
    return this.options.animation !== 'none' && typeof doc.startViewTransition === 'function' &&
      !this.win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  private cancelTransition() {
    this.generation++;
    this.release(); this.transition?.skipTransition(); this.transition = null;
    this.clearTransitionBounds();
    this.clearPins();
    const { dataset } = this.win.document.documentElement;
    delete dataset.stackflowAnimating;
    delete dataset.stackflowModal;
  }
  begin(direction: Direction, href: string | null, action: () => void, from = this.current?.url ?? this.url()) {
    this.cancelTransition();
    const { dataset } = this.win.document.documentElement;
    const modal = this.modalMotion(from, href ?? this.url());
    this.direction = direction; this.expected = href;
    const destination = routePathname(href ?? this.url());
    this.waitForDestination = !!this.options.waitForPage && !this.skeletonRoutes().some(route => routePathname(route) === destination);
    dataset.stackflowPending = 'true';
    dataset.stackflowDirection = direction;
    const doc = this.win.document as TransitionDocument;
    const generation = this.generation;
    let rejectPending: (error: unknown) => void = () => {};
    // Register the completion gate before the browser captures a snapshot.
    // On popstate Next may commit before the asynchronous update callback runs.
    const pending = new Promise<void>((resolve, reject) => {
      this.finish = resolve;
      rejectPending = reject;
    });
    pending.catch(() => {});
    let called = false;
    const run = () => {
      if (called || this.disconnected || generation !== this.generation) return Promise.resolve();
      called = true;
      try { action(); } catch (error) { rejectPending(error); this.release(); }
      return pending;
    };
    this.timeout = setTimeout(() => {
      // A delayed snapshot must never prevent the navigation action from running.
      void run().catch(() => {});
      this.release();
      this.transition?.skipTransition();
    }, this.options.timeout);
    this.emit();
    if ((direction !== 'replace' || modal) && this.canAnimate()) {
      const viewport = this.viewport();
      const selectors = modal ? [] : resolveFixedSelectors(this.fixedTargets(), from, href ?? this.url());
      if (viewport && selectors.length) {
        const targets = findFixedTargets(viewport, selectors);
        const css = doc.defaultView?.CSS;
        if (targets.size && (!css?.supports('view-transition-name', 'match-element') || !css.supports('selector(::view-transition-group(.stackflow-fixed))'))) {
          void run().catch(()=>{});
          return;
        }
        const pins = pinForTransition(viewport, targets);
        if (!pins) { void run().catch(()=>{}); return; }
        this.pins = { ...pins, selectors };
      }
      this.transitionBounds = viewport?.getBoundingClientRect();
      if (modal) dataset.stackflowModal = modal;
      dataset.stackflowAnimating = 'true';
      try {
        const transition = doc.startViewTransition!(run); this.transition = transition;
        if (viewport) {
          const Observer = doc.defaultView?.ResizeObserver;
          const observer = Observer ? new Observer(this.checkTransitionBounds) : undefined;
          observer?.observe(viewport);
          if (this.pins) for (const element of findFixedTargets(viewport, selectors)) observer?.observe(element);
          const frame = viewport.parentElement?.parentElement;
          if (frame) for (const slot of frame.children) observer?.observe(slot);
          this.win.addEventListener('scroll', this.checkTransitionBounds, { passive: true });
          this.stopWatchingBounds = () => {
            observer?.disconnect();
            this.win.removeEventListener('scroll', this.checkTransitionBounds);
          };
        }
        transition.ready.catch(()=>{});
        transition.finished.catch(()=>{}).finally(()=>{ if(this.transition===transition) { this.transition=null; this.clearTransitionBounds(); this.clearPins(); delete dataset.stackflowAnimating; delete dataset.stackflowModal; } });
      } catch { this.clearTransitionBounds(); this.clearPins(); delete dataset.stackflowAnimating; delete dataset.stackflowModal; void run().catch(()=>{}); }
    } else { void run().catch(()=>{}); }
  }
  navigate(direction: Direction, href: string | null, action: () => void) {
    // Traversals are animated once, by the popstate observer.
    if (href === null) { action(); return; }
    const destination = safeHref(href, this.win.location.href);
    if (routeKey(new URL(destination, this.win.location.origin)) === routeKey(this.win.location)) { action(); return; }
    this.capture(); this.saveVisual(); this.begin(direction, destination, action);
  }
  commit(route: string) {
    if (this.disconnected) return;
    const actual = routeKey(this.win.location);
    // Ignore layout effects belonging to the outgoing route.
    if (route !== actual) return;
    if (this.expected && routeKey(new URL(this.expected, this.win.location.href)) !== route) return;
    const meta = metadata(this.win.history.state);
    if (meta) this.current = this.remember(meta,this.url());
    this.restoreScroll();
    this.checkTransitionBounds();
    this.rebuild(); this.finishWhenPageIsReady();
  }
  read<T>(key: string, fallback: T): T { return this.current?.values.has(key) ? this.current.values.get(key) as T : fallback; }
  write<T>(key: string, value: T) { this.current?.values.set(key,value); this.emit(); }
  dispose() { this.cleanup?.(); this.listeners.clear(); this.entries.clear(); }
}
