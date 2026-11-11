import { Suspense } from 'react';
import { StackLink, StackLoading } from '@uiwwsw/stackflow-next';
import { DraftForm, MapPanel, ReplaceHome } from '../demo-controls';

type DetailProps = { searchParams: Promise<{ city?: string }> };
const cities = { seoul: 'Seoul', jeju: 'Jeju', busan: 'Busan' };

async function Detail({searchParams}: DetailProps) {
  const {city} = await searchParams;
  const cityKey = city === 'jeju' || city === 'busan' ? city : 'seoul';
  const title = cities[cityKey];

  return <article className="screen detail-screen">
    <div className={`detail-art ${cityKey}`}><span>{title}</span></div>
    <h2>{title}에서의 하루</h2>
    <DraftForm />
    <MapPanel title={title} />
    <p className="helper">Back으로 돌아가 목록의 메모와 스크롤을 확인하세요.</p>
    <StackLink className="stream-link" href="/slow" prefetch={false}>스트리밍 화면 열기</StackLink>
    <ReplaceHome />
  </article>;
}

export default function Page(props: DetailProps) {
  return <Suspense fallback={<StackLoading><article className="screen">상세를 준비하고 있어요…</article></StackLoading>}>
    <Detail {...props} />
  </Suspense>;
}
