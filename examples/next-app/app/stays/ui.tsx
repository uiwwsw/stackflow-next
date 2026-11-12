'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { StackLink, useStackRouter } from '@uiwwsw/stackflow-next';

export type Mode = 'with' | 'without';
const ModeContext = createContext<Mode>('without');

export function ModeProvider({mode, children}: {mode: Mode; children: ReactNode}) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useMode() { return useContext(ModeContext); }

/** Paths inside the stay app are written without the /with or /without prefix. */
export function AppLink({href, ...props}: Omit<ComponentProps<typeof Link>, 'href'> & {href: string}) {
  const mode = useMode();
  const target = `/${mode}${href === '/' ? '' : href}`;
  return mode === 'with' ? <StackLink {...props} href={target} /> : <Link {...props} href={target} />;
}

function StackBack() {
  const router = useStackRouter();
  return <button type="button" className="app-back" onClick={() => router.back()} aria-label="뒤로">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  </button>;
}

function PlainBack() {
  const router = useRouter();
  return <button type="button" className="app-back" onClick={() => router.back()} aria-label="뒤로">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  </button>;
}

const noSubscribe = () => () => {};
/** True when the app runs inside the comparison phones on the landing page. */
function useEmbedded() {
  return useSyncExternalStore(noSubscribe, () => window.self !== window.top, () => false);
}

/**
 * The booking screen waits on a slow server. Stackflow Next keeps the current
 * screen until it is ready, so the button says it is working meanwhile.
 */
export function BookLink({href, children}: {href: string; children: ReactNode}) {
  const [pending, setPending] = useState(false);
  // Runs when this screen is hidden or left, so the button is idle again on Back.
  useEffect(() => () => setPending(false), []);
  return <AppLink className="app-button" href={href} prefetch={false} aria-disabled={pending || undefined}
    data-pending={pending || undefined}
    onNavigate={() => flushSync(() => setPending(true))}>
    {pending ? <><span className="app-spinner" aria-hidden="true" />불러오는 중</> : children}
  </AppLink>;
}

export function AppHeader() {
  const mode = useMode();
  const path = usePathname();
  const local = path.slice(mode.length + 1) || '/';
  const root = local === '/' || local === '/saved';
  const other = mode === 'with' ? 'without' : 'with';
  const label = mode === 'with' ? 'Stackflow Next 연동' : 'Next.js Link만 사용';
  // Inside the comparison phones, switching versions would leave both phones on the same one.
  const embedded = useEmbedded();
  return <header className="app-header">
    {root ? <span className="app-logo">머물곳</span> : mode === 'with' ? <StackBack /> : <PlainBack />}
    {embedded
      ? <span className={`app-mode app-mode-${mode}`}>{label}</span>
      : <a className={`app-mode app-mode-${mode}`} href={`/${other}${local === '/' ? '' : local}`}>{label}</a>}
  </header>;
}

export function TabBar() {
  const mode = useMode();
  const path = usePathname();
  const saved = path.endsWith('/saved');
  return <nav className="app-tabs" aria-label="머물곳">
    <AppLink href="/" aria-current={!saved && path === `/${mode}` ? 'page' : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>
      둘러보기
    </AppLink>
    <AppLink href="/saved" aria-current={saved ? 'page' : undefined}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
      저장
    </AppLink>
  </nav>;
}

export function SearchBox() {
  const [query, setQuery] = useState('');
  return <label className="app-search">
    <span className="visually-hidden">숙소 검색</span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="지역이나 숙소 이름" />
  </label>;
}

export function SaveButton({initial = false}: {initial?: boolean}) {
  const [saved, setSaved] = useState(initial);
  return <button type="button" className="app-save" aria-pressed={saved} onClick={() => setSaved(value => !value)}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
    {saved ? '저장됨' : '저장'}
  </button>;
}

export function GuestPicker() {
  const [guests, setGuests] = useState(2);
  return <div className="book-row">
    <span>인원</span>
    <div className="book-stepper">
      <button type="button" aria-label="인원 줄이기" disabled={guests <= 1} onClick={() => setGuests(value => value - 1)}>−</button>
      <output aria-live="polite">{guests}명</output>
      <button type="button" aria-label="인원 늘리기" disabled={guests >= 6} onClick={() => setGuests(value => value + 1)}>+</button>
    </div>
  </div>;
}
