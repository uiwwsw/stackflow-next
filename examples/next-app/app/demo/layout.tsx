import type { ReactNode } from 'react';
import { DemoFrame } from './demo-controls';
import './style.css';

export const metadata = { title: '데모 | Stackflow Next' };

export default function DemoLayout({children}: {children: ReactNode}) {
  return <main className="demo-layout">
    <DemoFrame skeletonRoutes={['/demo/skeleton']}>{children}</DemoFrame>
  </main>;
}
