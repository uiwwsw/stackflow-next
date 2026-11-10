import {Suspense} from 'react';
import {connection} from 'next/server';
import {ReplaceHome} from '../demo-controls';
async function Delayed(){await connection();await new Promise(r=>setTimeout(r,1200));return <div className="stream-result" data-testid="streamed"><h3>서버 응답 도착</h3><p>Suspense 내부의 Server Component가 렌더링됐습니다.</p></div>;}
export default function Slow(){return <article className="screen"><h2>스트리밍도 그대로.</h2><p>새 경로를 먼저 표시하고, 준비된 서버 응답이 이어서 도착합니다.</p><Suspense fallback={<div className="stream-result loading" role="status">서버 응답을 기다리고 있어요…</div>}><Delayed/></Suspense><ReplaceHome/></article>;}
