import {StackflowProvider} from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';
import {DemoHeader,DemoFooter,RuntimeInfo} from './demo-controls';
import './style.css';
export const metadata={title:'Stackflow Next — Next.js 경로 그대로, 앱처럼 이동.',description:'Next.js App Router를 유지하는 스택 전환, 스크롤과 입력 상태 복원 데모.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>
  <header className="site-header"><a href="/" className="brand"><span className="brand-mark" aria-hidden="true"/>Stackflow Next</a><a href="https://github.com/uiwwsw/stackflow-next" target="_blank" rel="noreferrer">GitHub</a></header>
  <main className="demo-layout"><section className="intro"><h1>Next.js 경로 그대로, 앱처럼 이동.</h1><p className="lead">화면 상태는 유지하고, 본문만 스크롤하고, 옆으로 밀어 돌아갑니다.</p><code className="install">npm install ./stackflow-next-0.2.0-alpha.2.tgz</code><a className="download-link" href="/stackflow-next-0.2.0-alpha.2.tgz" download>패키지 설치 파일 받기 (.tgz)</a><ol className="feature-list"><li><span>01</span>화면 전환</li><li><span>02</span>스크롤 복원</li><li><span>03</span>입력 상태 복원</li><li><span>04</span>스트리밍</li></ol></section>
  <section className="demo-area" aria-label="라이브 내비게이션 데모"><div className="demo-frame"><StackflowProvider swipeBack header={<DemoHeader/>} footer={<DemoFooter/>} preserveScroll>{children}</StackflowProvider></div><p className="demo-caption">화면을 이동하고 뒤로 돌아와 보세요.</p></section></main>
  <section className="api-section"><div><h2>API</h2><pre><code>{`import { StackflowProvider } from '@uiwwsw/stackflow-next';\nimport '@uiwwsw/stackflow-next/style.css';\n\n<StackflowProvider preserveScroll>\n  {children}\n</StackflowProvider>`}</code></pre></div><aside><h3>지원 범위</h3><p>App Router의 URL과 서버 렌더링을 유지합니다. 스크롤과 useStackState로 저장한 입력값을 복원합니다.</p><p>전환은 시각적 스냅샷을 사용합니다. Next.js의 Cache Components가 화면 상태를 보존합니다. 캐시에서 해제된 화면과 새로고침은 초기화됩니다. 왼쪽 가장자리를 끌어 뒤로가기를 시험하세요.</p><RuntimeInfo/></aside></section>
</body></html>;}
