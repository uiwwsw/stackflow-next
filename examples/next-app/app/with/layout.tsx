import type { ReactNode } from 'react';
import { StackflowProvider } from '@uiwwsw/stackflow-next';
import { stays } from '../stays/data';
import { AppHeader, ModeProvider, TabBar } from '../stays/ui';
import '../stays/stays.css';

export const metadata = { title: '머물곳, Stackflow Next 연동 | Stackflow Next' };
const modalRoutes = stays.map(stay => `/with/stay/${stay.id}/book`);

export default function WithLayout({children}: {children: ReactNode}) {
  return <ModeProvider mode="with">
    <div className="stays-app">
      <StackflowProvider swipeBack locale="ko" modalRoutes={modalRoutes} header={<AppHeader />} footer={<TabBar />}>
        {children}
      </StackflowProvider>
    </div>
  </ModeProvider>;
}
