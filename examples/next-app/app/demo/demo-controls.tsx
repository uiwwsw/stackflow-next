'use client';
import {StackflowProvider,StackLink,StackMotion,useStackRouter,useStackState,useStack,type SkeletonRoute} from '@uiwwsw/stackflow-next';
import {useEffect,useId,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
export function DraftForm(){const [draft,setDraft]=useStackState('travel-memo','');return <label className="draft-label">여행 메모<input aria-label="여행 메모" value={draft} placeholder="돌아와도 메모가 유지돼요" onChange={e=>setDraft(e.target.value)}/></label>;}
export function DemoHeader() {
  const path = usePathname();
  return <div className="demo-header">
    <StackLink className="demo-brand" href="/">Stackflow Next</StackLink>
    <nav aria-label="데모 페이지">
      <StackLink href="/demo" aria-current={path === '/demo' ? 'page' : undefined}>목록</StackLink>
      <StackLink href="/demo/detail?city=seoul" aria-current={path === '/demo/detail' ? 'page' : undefined}>상세</StackLink>
      <StackLink href="/demo/slow" prefetch={false} aria-current={path === '/demo/slow' ? 'page' : undefined}>5.5초 대기</StackLink>
      <StackLink href="/demo/skeleton" aria-current={path === '/demo/skeleton' ? 'page' : undefined}>스켈레톤</StackLink>
    </nav>
  </div>;
}
export function DemoFooter() {
  const router = useStackRouter();
  const stack = useStack();
  return <div className="demo-footer">
    <div className="demo-history">
      <button onClick={() => router.back()}>앱 뒤로</button>
      <button onClick={() => router.forward()}>앱 앞으로</button>
    </div>
    <div className="demo-status">
      <span>브라우저의 뒤로·앞으로 버튼으로도 확인하세요.</span>
      <MotionStatus />
      <span data-testid="stack-depth">스택 {stack?.activities.length ?? 0}</span>
    </div>
    <a href="https://github.com/uiwwsw/stackflow-next">GitHub</a>
  </div>;
}
const modalRoutes = ['/demo/slow', '/demo/skeleton'];
const subscribeToHydration = () => () => {};
const hydrated = () => true;
const notHydrated = () => false;
const motions = new Map([
  ['stackflow-enter', '앞으로'], ['stackflow-leave', '뒤로'],
  ['stackflow-modal-enter', '팝업 열기'], ['stackflow-modal-exit', '팝업 닫기'],
]);

function MotionStatus() {
  const [motion, setMotion] = useState({count: 0, label: ''});
  useEffect(() => {
    function onAnimationStart(event: AnimationEvent) {
      if (event.target !== document.documentElement && !(event.target instanceof HTMLElement &&
        (event.target.hasAttribute('data-stackflow-slide-snapshot') || event.target.hasAttribute('data-stackflow-slide-incoming')))) return;
      const label = motions.get(event.animationName);
      if (label) setMotion(previous => ({count: previous.count + 1, label}));
    }
    document.addEventListener('animationstart', onAnimationStart);
    return () => document.removeEventListener('animationstart', onAnimationStart);
  }, []);
  return <output className="demo-motion" data-testid="last-motion" data-count={motion.count}>
    {motion.count ? `최근 전환 · ${motion.label} (${motion.count}회)` : '최근 전환 없음'}
  </output>;
}

export function DemoFrame({children, skeletonRoutes}: {children: ReactNode; skeletonRoutes: readonly SkeletonRoute[]}) {
  const ready = useSyncExternalStore(subscribeToHydration, hydrated, notHydrated);
  return <div className="demo-frame" inert={!ready} data-demo-ready={ready ? '' : undefined}>
      <StackflowProvider swipeBack modalRoutes={modalRoutes} skeletonRoutes={skeletonRoutes}
        header={<DemoHeader />} footer={<DemoFooter />} fixedTargets="[data-demo-fixed]" scrollTarget="[data-demo-scroll]">
        <div className="demo-page-shell">
          <div data-demo-scroll className="demo-scroll-body">{children}</div>
          <div data-demo-fixed><SharedTimer /></div>
        </div>
      </StackflowProvider>
  </div>;
}
export function ReplaceHome(){const router=useStackRouter();return <button className="secondary" onClick={()=>router.replace('/demo')}>목록으로 교체 · replace</button>;}

export function MapPanel({title}: {title: string}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} className="secondary" type="button" aria-expanded={open}
      aria-controls={id} onClick={() => setOpen(value => !value)}>{open ? '지도 패널 접기' : '지도 패널 열기'}</button>
    <StackMotion id={id} open={open} enter="modal" exit="ios" className="demo-map-panel" role="region" aria-label={`${title} 지도`}>
      <h3>{title} 지도</h3>
      <button className="secondary" type="button" onClick={() => {
        trigger.current?.focus();
        setOpen(false);
      }}>지도 닫기</button>
    </StackMotion>
  </>;
}

export function RetainedCounter(){const [count,setCount]=useState(0);return <button className="secondary" onClick={()=>setCount(n=>n+1)}>일반 useState 카운터: {count}</button>;}

export function SharedTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return <div className="demo-timer" role="group" aria-label="공유 타이머">
    <span>공유 타이머 <output aria-live="off">{seconds}초</output></span>
    <button type="button" onClick={() => setRunning(value => !value)}>{running ? '일시정지' : '시작'}</button>
  </div>;
}
