'use client';
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import Link, { type LinkProps } from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NavigationEngine, safeHref } from './engine.js';
import { attachSwipeBack } from './swipe.js';

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
  animation?: 'ios' | 'none';
  preserveScroll?: boolean;
  swipeBack?: boolean;
  maxEntries?: number;
  navigationTimeout?: number;
  className?: string;
  style?: CSSProperties;
}
export function StackflowProvider({children,header,footer,animation='ios',preserveScroll=true,swipeBack=false,maxEntries=32,navigationTimeout=4000,className='',style}: StackflowProviderProps) {
  const viewport=useRef<HTMLDivElement>(null);
  const [engine,setEngine]=useState<NavigationEngine|null>(null);
  const router=useRouter();
  useLayoutEffect(()=>{
    if(!Number.isInteger(maxEntries)||maxEntries<1) throw new RangeError('maxEntries must be positive');
    if(!Number.isFinite(navigationTimeout)||navigationTimeout<=0) throw new RangeError('navigationTimeout must be positive');
    const value=new NavigationEngine(window,()=>viewport.current,{animation,preserveScroll,timeout:navigationTimeout,maxEntries});
    const disconnect=value.connect(); setEngine(value);
    return ()=>{ disconnect(); value.dispose(); };
  },[animation,preserveScroll,maxEntries,navigationTimeout]);
  useEffect(()=>{
    if(!swipeBack||!viewport.current||!engine)return;
    return attachSwipeBack(engine,viewport.current,()=>router.back());
  },[swipeBack,engine,router]);
  return <Context.Provider value={engine}>
    <div className={`stackflow-next ${className}`} style={style}>
      {header && <div className="stackflow-next-header">{header}</div>}
      <div className="stackflow-next-viewport">
        <div ref={viewport} className="stackflow-next-content" onScroll={()=>engine?.capture()}>{children}</div>
        <ScrollIndicator viewport={viewport}/>
      </div>
      {footer && <div className="stackflow-next-footer">{footer}</div>}
    </div>
    <Suspense fallback={null}><RouteObserver engine={engine}/></Suspense>
  </Context.Provider>;
}
function ScrollIndicator({viewport}: {viewport: React.RefObject<HTMLDivElement|null>}) {
  const thumb=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=viewport.current; if(!el) return;
    let timer: ReturnType<typeof setTimeout>, frame=0;
    const paint=()=>{
      frame=0; const indicator=thumb.current;if(!indicator) return;
      const {clientHeight:h,scrollHeight:total,scrollTop:y}=el;
      const height=Math.min(h,Math.max(24,h*h/Math.max(total,1)));
      indicator.style.height=`${height}px`; indicator.style.transform=`translateY(${total>h?y/(total-h)*(h-height):0}px)`;
      indicator.style.opacity=total>h?'1':'0'; clearTimeout(timer);
      timer=setTimeout(()=>{indicator.style.opacity='0';},700);
    };
    const update=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    const resize=new ResizeObserver(update);resize.observe(el);
    const mutation=new MutationObserver(update);mutation.observe(el,{subtree:true,childList:true,characterData:true});
    el.addEventListener('scroll',update,{passive:true});el.addEventListener('load',update,true);window.addEventListener('resize',update);update();
    return ()=>{resize.disconnect();mutation.disconnect();el.removeEventListener('scroll',update);el.removeEventListener('load',update,true);window.removeEventListener('resize',update);cancelAnimationFrame(frame);clearTimeout(timer);};
  },[viewport]);
  return <div ref={thumb} className="stackflow-next-indicator" aria-hidden="true"/>;
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
