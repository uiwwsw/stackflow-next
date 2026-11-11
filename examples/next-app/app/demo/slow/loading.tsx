import { StackLoading } from '@uiwwsw/stackflow-next';

export default function Loading() {
  return <StackLoading>
    <div className="screen screen-skeleton" aria-label="본문 로딩 중">
      <div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" />
    </div>
  </StackLoading>;
}
