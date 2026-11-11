import type { ReactNode } from 'react';
import '@uiwwsw/stackflow-next/style.css';
import { DemoFrame } from './demo-controls';
import './style.css';

export const metadata = {
  title: 'Stackflow Next — Next.js 경로 그대로, 앱처럼 이동.',
  description: 'Next.js App Router를 유지하는 스택 전환, 스크롤과 입력 상태 복원 데모.',
};

const example = `import { StackflowProvider, StackMotion } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

<StackflowProvider
  fixedTargets="[data-demo-fixed]"
  scrollTarget="[data-demo-scroll]"
  skeletonRoutes={['/skeleton']}
>
  {children}
</StackflowProvider>

<StackMotion open={open} enter="modal" exit="ios">
  <MapContent />
</StackMotion>`;

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="ko"><body>
    <header className="site-header">
      <a href="/" className="brand"><span className="brand-mark" aria-hidden="true" />Stackflow Next</a>
      <a href="https://github.com/uiwwsw/stackflow-next" target="_blank" rel="noreferrer">GitHub</a>
    </header>
    <main className="demo-layout">
      <section className="intro">
        <h1>Next.js 경로 그대로, 앱처럼 이동.</h1>
        <p className="lead">브라우저 뒤로·앞으로로 전환 방향을 확인하세요. 목록의 메모와 스크롤 위치도 돌아옵니다.</p>
        <code className="install">npm install @uiwwsw/stackflow-next</code>
        <a className="download-link" href="https://www.npmjs.com/package/@uiwwsw/stackflow-next">npm 패키지 보기</a>
      </section>
      <section className="demo-area" aria-label="라이브 내비게이션 데모"><DemoFrame>{children}</DemoFrame></section>
    </main>
    <section className="api-section">
      <div><h2>설정 예시</h2><pre><code>{example}</code></pre></div>
      <aside>
        <h3>지원 범위</h3>
        <p>App Router의 URL과 서버 렌더링을 유지합니다. 화면 전환은 브라우저의 View Transition API를 사용합니다.</p>
        <p>Next.js의 Cache Components가 화면 상태를 보존합니다. 화면이 캐시에서 제거되거나 새로고침하면 초기화됩니다.</p>
      </aside>
    </section>
  </body></html>;
}
