'use client';
import { createContext, Suspense, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import Link, { type LinkProps } from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NavigationEngine, safeHref, type RouteTransition } from './engine.js';
import { attachSwipeBack } from './swipe.js';
import { attachScrollViewport } from './scroll.js';
import type { FixedTarget } from './fixed-targets.js';
import { createSkeletonRouteMatcher, type SkeletonRoute } from './skeleton-routes.js';
export type { FixedTarget } from './fixed-targets.js';
export type { RouteTransition } from './engine.js';
export type { SkeletonRoute } from './skeleton-routes.js';
export { StackMotion, type StackMotionPreset, type StackMotionProps } from './motion.js';

const Context = createContext<NavigationEngine | null | undefined>(undefined);
function useEngine() { const engine=useContext(Context); if(engine===undefined) throw new Error('Wrap your layout in StackflowProvider'); return engine; }
const noopSubscribe = () => () => {};
const emptyStack = () => null;
const defaultLoading = <span>Loading…</span>;
const loadingMessages = new Map([
  ['ko', '불러오는 중…'], ['ja', '読み込み中…'], ['zh', '正在加载…'],
  ['es', 'Cargando…'], ['fr', 'Chargement…'], ['de', 'Wird geladen…'],
  ['pt', 'Carregando…'], ['ar', 'جارٍ التحميل…'],
]);

const LoadingContext = createContext<ReactNode>(defaultLoading);

/** Use in loading.tsx or a Suspense fallback for content that must be ready before the slide. */
export function StackLoading({children}: {children?: ReactNode}) {
  const loading = useContext(LoadingContext);
  return <div data-stackflow-loading="" role="status">{children === undefined ? loading : children}</div>;
}

function RouteObserver({engine}: {engine: NavigationEngine | null}) {
  const path=usePathname(), search=useSearchParams();
  const query=search.toString();
  const route=query ? `${path}?${query}` : path;
  useLayoutEffect(()=>{ engine?.commit(route); },[engine,route]);
  return null;
}
export interface StackflowProviderProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  /** Shared UI rendered below the scrolling viewport and above the footer. */
  persistent?: ReactNode;
  animation?: 'ios' | 'none';
  preserveScroll?: boolean;
  /** CSS selector for a single visible scroll region inside the provider body. */
  scrollTarget?: string;
  /** CSS selectors for shared elements inside the page that should not slide. */
  fixedTargets?: FixedTarget | readonly FixedTarget[];
  /** Pathnames presented as full-height modal pages. */
  modalRoutes?: readonly string[];
  /** First matching animation override for an app pathname. */
  transitionRoutes?: readonly RouteTransition[];
  /** @deprecated Remove this prop. The full page is always the transition surface. */
  transitionTarget?: string;
  swipeBack?: boolean;
  maxEntries?: number;
  navigationTimeout?: number;
  /** Wait for visible StackLoading boundaries to finish before animating. Defaults to true. */
  waitForPage?: boolean;
  /** Exact pathnames or regular expressions that can slide in with their loading fallback visible. */
  skeletonRoutes?: readonly SkeletonRoute[];
  /** Default content for StackLoading. Pass null for an invisible readiness marker. */
  loading?: ReactNode;
  /** BCP 47 locale for the default loading message. */
  locale?: string;
  className?: string;
  style?: CSSProperties;
}
export function StackflowProvider({children,header,footer,persistent,animation='ios',preserveScroll=true,scrollTarget,fixedTargets,modalRoutes,transitionRoutes,transitionTarget,swipeBack=false,maxEntries=32,navigationTimeout=4000,waitForPage=true,skeletonRoutes,loading,locale,className='',style}: StackflowProviderProps) {
  const viewport=useRef<HTMLDivElement>(null);
  const fixed = useRef<readonly FixedTarget[]>([]);
  const modals = useRef<readonly string[]>([]);
  const transitions = useRef<readonly RouteTransition[]>([]);
  const matchesSkeletonRoute = useRef<(href: string) => boolean>(() => false);
  const indicator=useRef<HTMLDivElement>(null);
  const scroll=useRef<ReturnType<typeof attachScrollViewport> | null>(null);
  const engineRef=useRef<NavigationEngine | null>(null);
  const [engine,setEngine]=useState<NavigationEngine|null>(null);
  const router=useRouter();
  useLayoutEffect(() => { modals.current = modalRoutes ?? []; }, [modalRoutes]);
  useLayoutEffect(() => { transitions.current = transitionRoutes ?? []; }, [transitionRoutes]);
  useLayoutEffect(() => {
    matchesSkeletonRoute.current = createSkeletonRouteMatcher(skeletonRoutes ?? []);
  }, [skeletonRoutes]);
  useLayoutEffect(() => {
    if (fixedTargets == null) fixed.current = [];
    else if (typeof fixedTargets === 'string' || 'selector' in fixedTargets) fixed.current = [fixedTargets];
    else fixed.current = fixedTargets;
  }, [fixedTargets]);
  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== 'production' && transitionTarget !== undefined) {
      console.warn('[StackflowProvider] Remove transitionTarget to use the full-page transition. Use fixedTargets to keep selected elements still.');
    }
  }, [transitionTarget]);
  useLayoutEffect(()=>{
    if (!viewport.current || !indicator.current) return;
    const controller = attachScrollViewport(viewport.current, indicator.current, scrollTarget,
      element => engineRef.current?.capture(element), element => engineRef.current?.restoreScroll(element));
    scroll.current = controller;
    return () => { controller.dispose(); scroll.current = null; };
  },[scrollTarget]);
  useLayoutEffect(()=>{
    if(!Number.isInteger(maxEntries)||maxEntries<1) throw new RangeError('maxEntries must be positive');
    if(!Number.isFinite(navigationTimeout)||navigationTimeout<=0) throw new RangeError('navigationTimeout must be positive');
    const value=new NavigationEngine(window,()=>viewport.current,{animation,preserveScroll,timeout:navigationTimeout,maxEntries,waitForPage},
      () => scroll.current?.getElement(true) ?? viewport.current, () => fixed.current, () => modals.current, href => matchesSkeletonRoute.current(href), () => transitions.current);
    const disconnect=value.connect(); engineRef.current=value; setEngine(value);
    return ()=>{ engineRef.current=null; disconnect(); value.dispose(); };
  },[animation,preserveScroll,maxEntries,navigationTimeout,waitForPage]);
  useLayoutEffect(()=>{
    if(!engine)return;
    engine.setSwipeBackEnabled(swipeBack);
    if(!swipeBack||!viewport.current)return;
    return attachSwipeBack(engine,viewport.current,()=>router.back());
  },[swipeBack,engine,router]);
  const message = locale && loadingMessages.get(locale.toLowerCase().split('-', 1)[0]);
  const fallback = message ? <span lang={locale} dir="auto">{message}</span> : defaultLoading;
  return <Context.Provider value={engine}><LoadingContext.Provider value={loading === undefined ? fallback : loading}>
    <div className={`stackflow-next ${className}`} style={style}>
      {header && <div className="stackflow-next-header">{header}</div>}
      <div className="stackflow-next-viewport">
        <div ref={viewport} className="stackflow-next-content">{children}</div>
        <div ref={indicator} className="stackflow-next-indicator" aria-hidden="true"/>
      </div>
      {persistent != null && typeof persistent !== 'boolean' && <div className="stackflow-next-persistent">{persistent}</div>}
      {footer && <div className="stackflow-next-footer">{footer}</div>}
    </div>
    <Suspense fallback={null}><RouteObserver engine={engine}/></Suspense>
  </LoadingContext.Provider></Context.Provider>;
}
export function useStackRouter() {
  const engine=useEngine(),router=useRouter();
  return useMemo(()=>({
    push(href:string){const destination=engine?.resolveHref(href) ?? safeHref(href,window.location.href);if(engine)engine.navigate('push',href,()=>router.push(destination,{scroll:false}));else router.push(destination,{scroll:false});},
    replace(href:string){const destination=engine?.resolveHref(href) ?? safeHref(href,window.location.href);if(engine)engine.navigate('replace',href,()=>router.replace(destination,{scroll:false}));else router.replace(destination,{scroll:false});},
    back(){if(engine)engine.navigate('pop',null,()=>router.back());else router.back();},
    forward(){if(engine)engine.navigate('push',null,()=>router.forward());else router.forward();},
    prefetch:router.prefetch, refresh:router.refresh,
  }),[engine,router]);
}
export function useStack() {
  const engine=useEngine();
  return useSyncExternalStore(engine?.subscribe??noopSubscribe,()=>engine?.stack??null,emptyStack);
}
/** Explicit per-history-entry state. Ordinary useState is still owned by Next/React. */
export function useStackState<T>(key:string,initial:T|(()=>T)): [T,Dispatch<SetStateAction<T>>] {
  const engine=useEngine();
  const fallback=useRef<{value:T}|null>(null);
  if(!fallback.current)fallback.current={value:typeof initial==='function'?(initial as ()=>T)():initial};
  const value=useSyncExternalStore(engine?.subscribe??noopSubscribe,()=>engine ? engine.read(key,fallback.current!.value) : fallback.current!.value,()=>fallback.current!.value);
  const set=useCallback<Dispatch<SetStateAction<T>>>((update)=>{
    const previous=engine ? engine.read(key,fallback.current!.value) : fallback.current!.value;
    const next=typeof update==='function'?(update as (previous:T)=>T)(previous):update;
    if(engine) engine.write(key,next); else fallback.current!.value=next;
  },[engine,key]);
  return [value,set];
}
export type StackLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>,'href'> & Omit<LinkProps,'href'> & {href:string};
export function StackLink({href,onNavigate,replace,...props}:StackLinkProps) {
  const router=useStackRouter();
  const engine=useEngine();
  return <Link {...props} href={href} replace={replace} onNavigate={event=>{
    let cancelled=false;
    onNavigate?.({preventDefault(){cancelled=true;event.preventDefault();}});
    if(cancelled)return;
    const url=new URL(href,window.location.href);
    if(url.origin!==window.location.origin||!['http:','https:'].includes(url.protocol))return;
    // Let Next handle same-document anchors and unchanged routes.
    if(engine ? engine.isCurrentRoute(href) : url.pathname===window.location.pathname&&url.search===window.location.search)return;
    event.preventDefault(); (replace?router.replace:router.push)(href);
  }}/>;
}
