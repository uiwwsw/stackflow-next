import type { ReactNode } from 'react';
import '@uiwwsw/stackflow-next/style.css';
import './style.css';

export const metadata = {
  title: 'Stackflow Next',
  description: 'Next.js App Router에 앱 같은 화면 전환, 스와이프 뒤로가기, 화면별 스크롤 복원을 더하는 라이브러리입니다.',
};

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}
