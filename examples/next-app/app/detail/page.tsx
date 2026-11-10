import {Suspense} from 'react';
import {StackLink} from '@uiwwsw/stackflow-next';
import {DraftForm,ReplaceHome} from '../demo-controls';
async function Detail({searchParams}:{searchParams:Promise<{city?:string}>}){const {city}=await searchParams;const title=({seoul:'Seoul',jeju:'Jeju',busan:'Busan'} as Record<string,string>)[city??'seoul']??'Seoul';return <article className="screen detail-screen"><div className={`detail-art ${city??'seoul'}`}><span>{title}</span></div><h2>{title}에서의 하루</h2><p>이 화면은 파일 기반 경로에서 렌더링한 Server Component입니다. 직접 URL로 들어오거나 새로고침해도 정상적으로 열립니다.</p><DraftForm/><p className="helper">각 방문의 메모는 별도로 저장됩니다. Back으로 돌아가 목록의 메모와 스크롤을 확인하세요.</p><StackLink className="stream-link" href="/slow" prefetch={false}>스트리밍 화면 열기</StackLink><ReplaceHome/></article>;}

export default function Page(props: {searchParams:Promise<{city?:string}>}){return <Suspense fallback={<article className="screen">상세를 준비하고 있어요…</article>}><Detail {...props}/></Suspense>;}
