'use client';
import {StackLink,useStackRouter,useStackState,useStack} from '@uiwwsw/stackflow-next';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export function DraftForm(){const [draft,setDraft]=useStackState('travel-memo','');return <label className="draft-label">여행 메모<input aria-label="여행 메모" value={draft} placeholder="돌아와도 메모가 유지돼요" onChange={e=>setDraft(e.target.value)}/></label>;}
export function DemoHeader(){const path=usePathname();return <div className="demo-header"><strong>Explore</strong><nav aria-label="데모 페이지"><StackLink href="/" aria-current={path==='/'?'page':undefined}>목록</StackLink><span>/</span><StackLink href="/detail?city=seoul" aria-current={path==='/detail'?'page':undefined}>상세</StackLink></nav></div>;}
export function DemoFooter(){const router=useStackRouter();const stack=useStack();return <div className="demo-footer"><button onClick={()=>router.back()}>Back</button><span data-testid="stack-depth">스택 {stack?.activities.length??0}</span><button className="primary" onClick={()=>router.forward()}>Forward</button></div>;}
export function RuntimeInfo(){return <p className="runtime">Next.js 16.4.6 · React 19.3.1 · alpha</p>;}
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
