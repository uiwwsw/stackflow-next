import { Suspense } from 'react';
import { StackLink, StackLoading } from '@uiwwsw/stackflow-next';
import { CloseMap, DraftForm, ReplaceHome } from '../demo-controls';

type DetailProps = { searchParams: Promise<{ city?: string; panel?: string }> };
const cities = { seoul: 'Seoul', jeju: 'Jeju', busan: 'Busan' };

async function Detail({searchParams}: DetailProps) {
  const {city, panel} = await searchParams;
  const cityKey = city === 'jeju' || city === 'busan' ? city : 'seoul';
  const title = cities[cityKey];
  const detailHref = `/detail?city=${cityKey}`;

  if (panel === 'map') {
    return <article className="screen detail-screen">
      <h2>{title} 지도</h2>
      <div className={`detail-art ${cityKey}`}><span>{title}</span></div>
      <CloseMap href={detailHref} />
    </article>;
  }

  return <article className="screen detail-screen">
    <div className={`detail-art ${cityKey}`}><span>{title}</span></div>
    <h2>{title}에서의 하루</h2>
    <DraftForm />
    <StackLink className="stream-link" href={`${detailHref}&panel=map`}>지도 팝업 열기</StackLink>
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
