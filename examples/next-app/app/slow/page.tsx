import {connection} from 'next/server';
import {ReplaceHome} from '../demo-controls';

export default async function Slow() {
  await connection();
  await new Promise(resolve => setTimeout(resolve, 5500));
  return <article className="screen">
    <h2>서버 응답 도착</h2>
    <div className="stream-result" data-testid="streamed">본문이 준비됐습니다.</div>
    <ReplaceHome />
  </article>;
}
