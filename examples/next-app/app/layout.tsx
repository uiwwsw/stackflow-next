import type { ReactNode } from 'react';
import '@uiwwsw/stackflow-next/style.css';
import './style.css';

export const metadata = {
  title: 'Stackflow Next',
  description: 'Next.js App Router용 화면 전환 라이브러리.',
};

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}
