import { aggregate, makeEvent, type DomainEvent, type Stack } from '@stackflow/core';

export const HISTORY_KEY = '__stackflow_next_v1';
export type Entry = { id: string; position: number; url: string; scroll: number; values: Map<string, unknown>; visual?: HTMLElement };
export type Direction = 'push' | 'pop' | 'replace';
type Transition = { finished: Promise<void>; ready: Promise<void>; skipTransition(): void };
type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => Transition };
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
  private expected: string | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private transition: Transition | null = null;
  private transitionBounds: DOMRect | undefined;
  private stopWatchingBounds: (() => void) | undefined;
  private disconnected = false;
  private cleanup: (() => void) | null = null;
  private swipeBackEnabled = false;
  direction: Direction = 'replace';
  skipNextPopAnimation = false;
  setSwipeBackEnabled(enabled: boolean) {
    this.swipeBackEnabled = enabled;
    if (!enabled) for (const entry of this.entries.values()) delete entry.visual;
  }
  previousVisual() { return [...this.entries.values()].find(e=>e.position===(this.current?.position??0)-1)?.visual; }
  private saveVisual() {
    if (!this.swipeBackEnabled) return;
    const el=this.viewport();if(!this.current||!el)return;
    const offset = this.scrollElement()?.scrollTop ?? 0;
    this.current.visual=el.cloneNode(true) as HTMLElement;this.current.visual.dataset.stackflowScroll=String(offset);
    const others=[...this.entries.values()].filter(e=>e!==this.current&&e.visual);
    others.slice(0,Math.max(0,others.length-1)).forEach(e=>{delete e.visual;});
  }
  constructor(readonly win: Window, readonly viewport: () => HTMLElement | null,
    readonly options: { animation: 'ios' | 'none'; preserveScroll: boolean; timeout: number; maxEntries: number },
    private readonly scrollElement = viewport) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
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
  connect() {
    if (this.cleanup) return this.cleanup;
    this.disconnected = false;
    const history = this.win.history, push = history.pushState, replace = history.replaceState;
    const initial = metadata(history.state) ?? this.fresh(0);
    replace.call(history, {...history.state, [HISTORY_KEY]: initial}, '', this.win.location.href);
    this.current = this.remember(initial, this.url());
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
    };
    const wrappedReplace: History['replaceState'] = function(data, unused, url) {
      if (engine.disconnected) return replace.call(history,data,unused,url);
      const meta = metadata(history.state) ?? engine.fresh(0);
      replace.call(history, {...data, [HISTORY_KEY]: meta}, unused, url);
      engine.current = engine.remember(meta, engine.url());
    };
    history.pushState = wrappedPush; history.replaceState = wrappedReplace;
    const pop = () => {
      engine.capture();engine.saveVisual();
      const meta = metadata(history.state) ?? engine.fresh(0);
      engine.direction = meta.position < (engine.current?.position ?? 0) ? 'pop' : 'push';
      if (!metadata(history.state)) replace.call(history, {...history.state,[HISTORY_KEY]:meta},'',engine.win.location.href);
      engine.current = engine.remember(meta, engine.url());
      if(engine.skipNextPopAnimation){engine.skipNextPopAnimation=false;}
      else engine.begin(engine.direction, engine.url(), () => {});
    };
    this.win.addEventListener('popstate', pop);
    this.rebuild();
    this.cleanup = () => {
      this.disconnected = true; this.release(); this.transition?.skipTransition(); this.clearTransitionBounds();
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace) history.replaceState = replace;
      history.scrollRestoration = oldRestoration;
      this.win.removeEventListener('popstate', pop);
      delete this.win.document.documentElement.dataset.stackflowDirection;
      delete this.win.document.documentElement.dataset.stackflowAnimating;
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
  private release() { clearTimeout(this.timeout); this.finish?.(); this.finish = null; this.expected = null; delete this.win.document.documentElement.dataset.stackflowPending; }
  private clearTransitionBounds() {
    this.stopWatchingBounds?.();
    this.stopWatchingBounds = undefined;
    this.transitionBounds = undefined;
  }
  private checkTransitionBounds = () => {
    const before = this.transitionBounds;
    if (!before || !this.transition) return;
    const after = this.viewport()?.getBoundingClientRect();
    // Skip the slide if the slots reflow or the page scrolls while it is running.
    if (!after || Math.abs(before.top - after.top) > .5 || Math.abs(before.bottom - after.bottom) > .5) {
      this.clearTransitionBounds();
      this.transition.skipTransition();
    }
  };
  begin(direction: Direction, href: string | null, action: () => void) {
    this.release(); this.transition?.skipTransition(); this.transition = null;
    this.clearTransitionBounds();
    const { dataset } = this.win.document.documentElement;
    delete dataset.stackflowAnimating;
    this.direction = direction; this.expected = href;
    this.win.document.documentElement.dataset.stackflowPending = 'true';
    this.win.document.documentElement.dataset.stackflowDirection = direction;
    const doc = this.win.document as TransitionDocument;
    const reduced = this.win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const generation = ++this.generation;
    let rejectPending: (error: unknown) => void = () => {};
    // Register the completion gate before the browser captures a snapshot.
    // On popstate Next may commit before the asynchronous update callback runs.
    const pending = new Promise<void>((resolve, reject) => {
      this.finish = resolve;
      rejectPending = reject;
    });
    pending.catch(() => {});
    this.timeout = setTimeout(() => { this.release(); this.transition?.skipTransition(); }, this.options.timeout);
    let called = false;
    const run = () => {
      if (called || this.disconnected || generation !== this.generation) return Promise.resolve();
      called = true;
      try { action(); } catch (error) { rejectPending(error); this.release(); }
      return pending;
    };
    if (direction !== 'replace' && doc.startViewTransition && !reduced && this.options.animation !== 'none') {
      const viewport = this.viewport();
      this.transitionBounds = viewport?.getBoundingClientRect();
      dataset.stackflowAnimating = 'true';
      try {
        const transition = doc.startViewTransition(run); this.transition = transition;
        if (viewport) {
          const Observer = doc.defaultView?.ResizeObserver;
          const observer = Observer ? new Observer(this.checkTransitionBounds) : undefined;
          observer?.observe(viewport);
          const frame = viewport.parentElement?.parentElement;
          if (frame) for (const slot of frame.children) observer?.observe(slot);
          this.win.addEventListener('scroll', this.checkTransitionBounds, { passive: true });
          this.stopWatchingBounds = () => {
            observer?.disconnect();
            this.win.removeEventListener('scroll', this.checkTransitionBounds);
          };
        }
        transition.ready.catch(()=>{});
        transition.finished.catch(()=>{}).finally(()=>{ if(this.transition===transition) { this.transition=null; this.clearTransitionBounds(); delete dataset.stackflowAnimating; } });
      } catch { this.clearTransitionBounds(); delete dataset.stackflowAnimating; void run().catch(()=>{}); }
    } else { void run().catch(()=>{}); }
  }
  navigate(direction: Direction, href: string | null, action: () => void) {
    // Traversals are animated once, by the popstate observer.
    if (href === null) { action(); return; }
    const destination = safeHref(href, this.win.location.href);
    if (destination === this.url()) { action(); return; }
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
    this.rebuild(); this.release();
  }
  read<T>(key: string, fallback: T): T { return this.current?.values.has(key) ? this.current.values.get(key) as T : fallback; }
  write<T>(key: string, value: T) { this.current?.values.set(key,value); this.emit(); }
  dispose() { this.cleanup?.(); this.listeners.clear(); this.entries.clear(); }
}
