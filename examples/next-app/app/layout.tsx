import type { ReactNode } from 'react';
import '@uiwwsw/stackflow-next/style.css';
import { DemoFrame } from './demo-controls';
import './style.css';

export const metadata = {
  title: 'Stackflow Next — Next.js 경로 그대로, 앱처럼 이동.',
  description: 'Next.js App Router를 유지하는 스택 전환, 스크롤과 입력 상태 복원 데모.',
};

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="ko"><body>
    <main className="demo-layout">
      <DemoFrame skeletonRoutes={[{ pattern: '^/skeleton$' }]}>{children}</DemoFrame>
    </main>
  </body></html>;
}
