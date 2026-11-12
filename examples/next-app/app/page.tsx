import { CompareStage, CopyInstall } from './compare';

const repository = 'https://github.com/uiwwsw/stackflow-next';
const npm = 'https://www.npmjs.com/package/@uiwwsw/stackflow-next';

const differences = [
  { topic: '화면 이동', plain: '다음 화면으로 즉시 바뀝니다.', stack: '다음 화면이 오른쪽에서 밀려 들어오고, 이전 화면은 뒤로 물러납니다.' },
  { topic: '브라우저 뒤로·앞으로', plain: '방향과 상관없이 즉시 바뀝니다.', stack: '뒤로가기는 반대 방향으로, 앞으로가기는 같은 방향으로 재생합니다. 주소와 방문 기록은 Next.js 그대로입니다.' },
  { topic: '목록 스크롤', plain: '목록을 내려 보다가 상세에서 돌아오면 목록이 맨 위로 돌아가 있습니다.', stack: '화면마다 스크롤 위치를 기억해, 돌아오면 목록이 보던 자리에 있습니다.' },
  { topic: '느린 서버 응답', plain: '로딩 화면으로 먼저 바뀌고, 응답이 오면 다시 바뀝니다.', stack: '예약 화면이 준비될 때까지 지금 화면을 유지한 뒤, 한 번에 올라옵니다.' },
  { topic: '팝업형 화면', plain: '다른 화면과 같은 방식으로 바뀝니다.', stack: '지정한 경로는 아래에서 올라오고, 뒤로가기로 내려갑니다.' },
  { topic: '가장자리 스와이프', plain: '동작하지 않습니다.', stack: '왼쪽 가장자리를 끌면 이전 화면이 따라 나오고, 놓으면 뒤로 갑니다.' },
  { topic: '입력값과 상태', plain: '같음. Next.js가 화면을 캐시에 두는 동안 유지됩니다.', stack: '같음. withStackflow가 이 기능(cacheComponents)을 켭니다.' },
] as const;

const config = `import { withStackflow } from '@uiwwsw/stackflow-next/config';

export default withStackflow({});`;

const layout = `import { StackflowProvider } from '@uiwwsw/stackflow-next';
import '@uiwwsw/stackflow-next/style.css';

export default function Layout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, height: '100dvh' }}>
        <StackflowProvider swipeBack>{children}</StackflowProvider>
      </body>
    </html>
  );
}`;

const link = `import { StackLink } from '@uiwwsw/stackflow-next';

<StackLink href="/stay/sorang">소랑 한옥</StackLink>`;

export default function Home() {
  return <div className="site">
    <header className="site-header">
      <a className="site-wordmark" href="/">Stackflow Next</a>
      <nav aria-label="사이트">
        <a href="#differences">차이점</a>
        <a href="#install">설치</a>
        <a href={repository}>GitHub</a>
        <a href={npm}>npm</a>
      </nav>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Next.js 웹이 앱처럼 넘어갑니다</h1>
          <p>App Router의 주소와 브라우저 방문 기록은 그대로 두고, 화면 전환과 스와이프 뒤로가기, 화면별 스크롤 복원을 더합니다.</p>
          <p>여기 있는 두 화면은 같은 숙소 앱입니다. 숙소를 하나 열고, 예약하기를 누른 뒤 뒤로 돌아와 보세요.</p>
          <CopyInstall command="npm install @uiwwsw/stackflow-next" />
        </div>
        <CompareStage />
      </section>

      <section className="differences" id="differences" aria-labelledby="differences-title">
        <h2 id="differences-title">무엇이 달라지나요</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th scope="col">상황</th><th scope="col">Next.js Link만 사용</th><th scope="col">Stackflow Next 연동</th></tr>
            </thead>
            <tbody>
              {differences.map(row => <tr key={row.topic}>
                <th scope="row">{row.topic}</th>
                <td>{row.plain}</td>
                <td>{row.stack}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="differences-note">두 버전은 같은 Next.js 앱, 같은 설정으로 빌드했습니다. 다른 점은 레이아웃에서 StackflowProvider와 StackLink를 쓰는지 여부뿐입니다. 모션 줄이기 설정이 켜져 있으면 전환 없이 바로 바뀝니다.</p>
      </section>

      <section className="install" id="install" aria-labelledby="install-title">
        <h2 id="install-title">세 단계면 붙습니다</h2>
        <ol>
          <li>
            <h3>패키지를 설치합니다</h3>
            <pre><code>npm install @uiwwsw/stackflow-next</code></pre>
          </li>
          <li>
            <h3>Next.js 설정을 감쌉니다</h3>
            <p className="install-file">next.config.mjs</p>
            <pre><code>{config}</code></pre>
          </li>
          <li>
            <h3>레이아웃에 Provider를 두고, 링크를 StackLink로 바꿉니다</h3>
            <p className="install-file">app/layout.tsx</p>
            <pre><code>{layout}</code></pre>
            <pre><code>{link}</code></pre>
          </li>
        </ol>
        <p className="install-more">경로별 팝업 전환, 고정 영역, 스켈레톤 경로 같은 옵션은 <a href={`${repository}#readme`}>README</a>에 정리돼 있습니다. Next.js 16.4.6 이상, React 19.3.1 이상에서 동작합니다.</p>
      </section>
    </main>

    <footer className="site-footer">
      <span>MIT 라이선스</span>
      <nav aria-label="프로젝트">
        <a href={npm}>npm</a>
        <a href={repository}>GitHub</a>
      </nav>
    </footer>
  </div>;
}
