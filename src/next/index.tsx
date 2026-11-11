'use client';
import { createContext, Suspense, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import Link, { type LinkProps } from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NavigationEngine, safeHref } from './engine.js';
import { attachSwipeBack } from './swipe.js';
import { attachScrollViewport } from './scroll.js';

const Context = createContext<NavigationEngine | null | undefined>(undefined);
function useEngine() { const engine=useContext(Context); if(engine===undefined) throw new Error('Wrap your layout in StackflowProvider'); return engine; }
const noopSubscribe = () => () => {};
const emptyStack = () => null;
function RouteObserver({engine}: {engine: NavigationEngine | null}) {
  const path=usePathname(), search=useSearchParams();
  const route=path + (search.toString() ? `?${search}` : '');
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
  swipeBack?: boolean;
  maxEntries?: number;
  navigationTimeout?: number;
  className?: string;
  style?: CSSProperties;
}
export function StackflowProvider({children,header,footer,persistent,animation='ios',preserveScroll=true,scrollTarget,swipeBack=false,maxEntries=32,navigationTimeout=4000,className='',style}: StackflowProviderProps) {
  const viewport=useRef<HTMLDivElement>(null);
  const indicator=useRef<HTMLDivElement>(null);
  const scroll=useRef<ReturnType<typeof attachScrollViewport> | null>(null);
  const engineRef=useRef<NavigationEngine | null>(null);
  const [engine,setEngine]=useState<NavigationEngine|null>(null);
  const router=useRouter();
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
    const value=new NavigationEngine(window,()=>viewport.current,{animation,preserveScroll,timeout:navigationTimeout,maxEntries},
      () => scroll.current?.getElement(true) ?? viewport.current);
    const disconnect=value.connect(); engineRef.current=value; setEngine(value);
    return ()=>{ engineRef.current=null; disconnect(); value.dispose(); };
  },[animation,preserveScroll,maxEntries,navigationTimeout]);
  useLayoutEffect(()=>{
    if(!engine)return;
    engine.setSwipeBackEnabled(swipeBack);
    if(!swipeBack||!viewport.current)return;
    return attachSwipeBack(engine,viewport.current,()=>router.back());
  },[swipeBack,engine,router]);
  return <Context.Provider value={engine}>
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
  </Context.Provider>;
}
export function useStackRouter() {
  const engine=useEngine(),router=useRouter();
  return useMemo(()=>({
    push(href:string){href=safeHref(href,window.location.href);if(engine)engine.navigate('push',href,()=>router.push(href,{scroll:false}));else router.push(href,{scroll:false});},
    replace(href:string){href=safeHref(href,window.location.href);if(engine)engine.navigate('replace',href,()=>router.replace(href,{scroll:false}));else router.replace(href,{scroll:false});},
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
  return <Link {...props} href={href} replace={replace} onNavigate={event=>{
    let cancelled=false;
    onNavigate?.({preventDefault(){cancelled=true;event.preventDefault();}});
    if(cancelled)return;
    const url=new URL(href,window.location.href);
    if(url.origin!==window.location.origin||!['http:','https:'].includes(url.protocol))return;
    // Let Next handle same-document anchors and unchanged routes.
    if(url.pathname===window.location.pathname&&url.search===window.location.search)return;
    event.preventDefault(); (replace?router.replace:router.push)(href);
  }}/>;
}
