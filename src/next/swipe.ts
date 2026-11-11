import type { NavigationEngine } from './engine.js';
import { previewScrollElement } from './scroll.js';
/** A visual preview only; actual React state is retained by Next Activity. */
export function attachSwipeBack(engine: NavigationEngine, content: HTMLElement, back: () => void) {
  const win = content.ownerDocument.defaultView!;
  let gesture: {
    id: number;
    x: number;
    y: number;
    time: number;
    dx: number;
    previous: HTMLElement;
    background: HTMLElement | null;
  } | null = null;
  let unsubscribe: (()=>void)|undefined;
  let timer: ReturnType<typeof setTimeout>|undefined;
  let settling=false;
  const reset=()=>{
    gesture?.background?.remove();gesture=null;settling=false;unsubscribe?.();unsubscribe=undefined;clearTimeout(timer);
    content.style.transform='';content.style.willChange='';content.style.position='';content.style.zIndex='';
  };
  const down=(event:PointerEvent)=>{
    if(settling||gesture||!event.isPrimary||event.button!==0)return;
    const bounds=content.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX-bounds.left>24)return;
    if((event.target as Element).closest('input,textarea,select,[contenteditable],[data-stackflow-no-swipe]'))return;
    const previous=engine.previousVisual();if(!previous)return;
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      dx: 0,
      previous,
      background: null,
    };
  };

  function mountPreview(previous: HTMLElement, parent: HTMLElement) {
    const background = previous.cloneNode(true) as HTMLElement;
    background.inert = true;
    background.setAttribute('aria-hidden', 'true');
    Object.assign(background.style, {
      position: 'absolute',
      inset: '0',
      viewTransitionName: 'none',
      pointerEvents: 'none',
      transform: 'translateX(-25%)',
      zIndex: '0',
    });
    background.removeAttribute('id');
    background.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    content.style.willChange = 'transform';
    content.style.position = 'relative';
    content.style.zIndex = '1';
    parent.append(background);
    previewScrollElement(background).scrollTop = Number(previous.dataset.stackflowScroll ?? 0);
    return background;
  }

  const move=(event:PointerEvent)=>{
    const saved=gesture;if(!saved||saved.id!==event.pointerId||settling)return;
    const dx=Math.max(0,event.clientX-saved.x),dy=Math.abs(event.clientY-saved.y);
    if (!saved.background) {
      if (dy > 12 && dy > dx) {
        reset();
        return;
      }
      if (dx < 8) return;
      const parent = content.parentElement;
      if (!parent || engine.previousVisual() !== saved.previous) {
        reset();
        return;
      }
      content.setPointerCapture?.(event.pointerId);
      saved.background = mountPreview(saved.previous, parent);
    }
    saved.dx = Math.min(content.clientWidth, dx);
    if (event.cancelable) event.preventDefault();
    content.style.transform=`translateX(${saved.dx}px)`;
    saved.background.style.transform=`translateX(${-25+25*saved.dx/Math.max(content.clientWidth,1)}%)`;
  };
  const finish=async(cancelled:boolean)=>{
    const saved=gesture;if(!saved||settling)return;
    if(!saved.background){reset();return;}settling=true;
    const width=content.clientWidth,velocity=saved.dx/Math.max(1,performance.now()-saved.time);
    const commit=!cancelled&&(saved.dx>width*.35||(saved.dx>30&&velocity>.5));
    const target=commit?width:0;
    const reduced=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(content.animate&&!reduced){
      await Promise.all([
        content.animate([{transform:`translateX(${saved.dx}px)`},{transform:`translateX(${target}px)`}],{duration:160,fill:'forwards',easing:'ease-out'}),
        saved.background.animate([{transform:saved.background.style.transform},{transform:commit?'translateX(0)':'translateX(-25%)'}],{duration:160,fill:'forwards',easing:'ease-out'})
      ].map(async animation=>{try{await animation.finished;}catch{}animation.cancel();}));
    }
    if(gesture!==saved)return;
    if(!commit){reset();return;}
    content.style.transform=`translateX(${width}px)`;
    unsubscribe=engine.subscribe(reset);
    timer=setTimeout(reset,engine.options.timeout);
    engine.skipNextPopAnimation=true;
    back();
  };
  const up=(event:PointerEvent)=>{if(gesture?.id===event.pointerId)void finish(false);};
  const cancel=()=>{void finish(true);};
  const previousTouchAction=content.style.touchAction;content.style.touchAction='pan-y';
  content.addEventListener('pointerdown',down);content.addEventListener('pointermove',move,{passive:false});
  content.addEventListener('pointerup',up);content.addEventListener('pointercancel',cancel);
  return ()=>{reset();content.style.touchAction=previousTouchAction;content.removeEventListener('pointerdown',down);content.removeEventListener('pointermove',move);content.removeEventListener('pointerup',up);content.removeEventListener('pointercancel',cancel);};
}
