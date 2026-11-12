import type { ReactNode } from 'react';
import { AppHeader, ModeProvider, TabBar } from '../stays/ui';
import '../stays/stays.css';

export const metadata = { title: '머물곳, Next.js Link만 사용 | Stackflow Next' };

export default function WithoutLayout({children}: {children: ReactNode}) {
  return <ModeProvider mode="without">
    <div className="stays-app">
      <div className="plain-shell">
        <AppHeader />
        <main className="plain-body">{children}</main>
        <TabBar />
      </div>
    </div>
  </ModeProvider>;
}
