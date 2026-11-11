'use client';
import {StackflowProvider,StackLink,useStackRouter,useStackState,useStack} from '@uiwwsw/stackflow-next';
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
export function DraftForm(){const [draft,setDraft]=useStackState('travel-memo','');return <label className="draft-label">여행 메모<input aria-label="여행 메모" value={draft} placeholder="돌아와도 메모가 유지돼요" onChange={e=>setDraft(e.target.value)}/></label>;}
export function DemoHeader() {
  const path = usePathname();
  return <div className="demo-header">
    <strong>Explore</strong>
    <nav aria-label="데모 페이지">
      <StackLink href="/" aria-current={path === '/' ? 'page' : undefined}>목록</StackLink>
      <StackLink href="/detail?city=seoul" aria-current={path === '/detail' ? 'page' : undefined}>상세</StackLink>
      <StackLink href="/slow" prefetch={false} aria-current={path === '/slow' ? 'page' : undefined}>대기</StackLink>
      <StackLink href="/skeleton" aria-current={path === '/skeleton' ? 'page' : undefined}>스켈레톤</StackLink>
    </nav>
  </div>;
}
export function DemoFooter(){const router=useStackRouter();const stack=useStack();return <div className="demo-footer"><button onClick={()=>router.back()}>Back</button><span data-testid="stack-depth">스택 {stack?.activities.length??0}</span><button className="primary" onClick={()=>router.forward()}>Forward</button></div>;}
const modalRoutes = ['/slow', '/skeleton'];
const skeletonRoutes = ['/skeleton'];
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
      if (event.target !== document.documentElement) return;
      const label = motions.get(event.animationName);
      if (label) setMotion(previous => ({count: previous.count + 1, label}));
    }
    document.addEventListener('animationstart', onAnimationStart);
    return () => document.removeEventListener('animationstart', onAnimationStart);
  }, []);
  return motion.count > 0
    ? <output className="demo-motion" data-testid="last-motion" data-count={motion.count}>최근 전환 · {motion.label}</output>
    : null;
}

export function DemoFrame({children}: {children: ReactNode}) {
  const ready = useSyncExternalStore(subscribeToHydration, hydrated, notHydrated);
  return <>
    <div className="demo-frame" inert={!ready} data-demo-ready={ready ? '' : undefined}>
      <StackflowProvider swipeBack modalRoutes={modalRoutes} skeletonRoutes={skeletonRoutes}
        header={<DemoHeader />} footer={<DemoFooter />} fixedTargets="[data-demo-fixed]" scrollTarget="[data-demo-scroll]">
        <div className="demo-page-shell">
          <div data-demo-scroll className="demo-scroll-body">{children}</div>
          <div data-demo-fixed><SharedTimer /></div>
        </div>
      </StackflowProvider>
    </div>
    <p className="demo-caption">‘대기’는 본문이 준비된 뒤, ‘스켈레톤’은 자리표시자가 준비되면 전환합니다.</p>
    <MotionStatus />
  </>;
}
export function ReplaceHome(){const router=useStackRouter();return <button className="secondary" onClick={()=>router.replace('/')}>목록으로 교체 · replace</button>;}

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
