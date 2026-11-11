import Link from 'next/link';

const repository = 'https://github.com/uiwwsw/stackflow-next';
const config = `import { withStackflow } from '@uiwwsw/stackflow-next/config';

export default withStackflow({});`;
const layout = `import type { ReactNode } from 'react';
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, height: '100dvh' }}>
        <StackflowProvider>{children}</StackflowProvider>
      </body>
    </html>
  );
}`;

export default function Home() {
  return <>
    <header className="site-header">
      <div className="site-width site-nav">
        <Link className="site-wordmark" href="/">Stackflow Next</Link>
        <nav aria-label="사이트">
          <a href="#install">설치</a>
          <Link href="/demo">데모</Link>
          <a href={repository}>GitHub</a>
        </nav>
      </div>
    </header>
    <main className="site-width site-main">
      <section className="site-intro">
        <h1>Stackflow Next</h1>
        <p>Next.js App Router에서 화면을 밀어 열고, 브라우저 뒤로가기로 되돌립니다.</p>
        <div className="site-actions">
          <Link className="site-button site-button-primary" href="/demo">데모 열기</Link>
          <a className="site-button" href="#install">설치 방법</a>
        </div>
      </section>
      <section className="site-behavior" aria-labelledby="behavior">
        <h2 id="behavior">화면 이동</h2>
        <dl>
          <div>
            <dt>브라우저 뒤로·앞으로</dt>
            <dd>Next.js 경로와 브라우저 방문 기록을 그대로 사용합니다. 뒤로가기는 역방향, 앞으로가기는 정방향으로 재생됩니다.</dd>
          </div>
          <div>
            <dt>목록 상태 복원</dt>
            <dd>상세에서 돌아오면 목록의 스크롤 위치가 복원됩니다. Next.js가 화면을 캐시에 유지하는 동안 입력값과 컴포넌트 상태도 남습니다.</dd>
          </div>
          <div>
            <dt>느린 응답</dt>
            <dd>다음 화면이 준비될 때까지 현재 화면을 유지합니다. 경로별로 스켈레톤을 먼저 보여주도록 설정할 수도 있습니다.</dd>
          </div>
        </dl>
      </section>
      <section className="site-install" id="install">
        <h2>설치</h2>
        <pre><code>npm install @uiwwsw/stackflow-next</code></pre>
      </section>
      <section className="site-config">
        <h2>설정</h2>
        <p>Next.js 설정에 <code>withStackflow</code>를 적용하고, 루트 레이아웃에 <code>StackflowProvider</code>를 추가합니다. 전환할 링크에는 <code>StackLink</code>를 사용합니다.</p>
        <div className="site-examples">
          <div><h3>next.config.mjs</h3><pre><code>{config}</code></pre></div>
          <div><h3>app/layout.tsx</h3><pre><code>{layout}</code></pre></div>
        </div>
      </section>
    </main>
    <footer className="site-width site-footer">
      <span>Stackflow Next</span>
      <nav aria-label="프로젝트">
        <a href="https://www.npmjs.com/package/@uiwwsw/stackflow-next">npm</a>
        <a href={repository}>GitHub</a>
      </nav>
    </footer>
  </>;
}
