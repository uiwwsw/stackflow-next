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
          <a href="https://www.npmjs.com/package/@uiwwsw/stackflow-next">npm</a>
          <Link href="/demo">데모</Link>
          <a href={repository}>GitHub</a>
        </nav>
      </div>
    </header>
    <main className="site-width site-main">
      <section className="site-intro">
        <h1>Stackflow Next</h1>
        <p>Next.js App Router용 페이지 전환 라이브러리입니다. 기존 URL을 유지하며 브라우저 뒤로가기와 앞으로가기에도 슬라이드를 적용합니다.</p>
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
      <section className="site-behavior">
        <h2>데모에서 확인하기</h2>
        <p><Link href="/demo">데모</Link>에서 상세 페이지를 연 뒤 브라우저 뒤로가기를 누르면 슬라이드와 스크롤 복원을 확인할 수 있습니다. Next.js 캐시에 목록이 남아 있으면 입력값도 복원됩니다.</p>
        <p>데모의 ‘5.5초 대기’는 응답을 기다린 뒤 전환합니다. ‘스켈레톤’는 로딩 화면으로 먼저 전환합니다.</p>
      </section>
    </main>
  </>;
}
