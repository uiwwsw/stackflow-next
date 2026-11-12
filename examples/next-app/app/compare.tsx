'use client';
import { useState } from 'react';

const versions = [
  { mode: 'without', label: 'Next.js Link만 사용', note: '화면이 그 자리에서 바뀝니다.' },
  { mode: 'with', label: 'Stackflow Next 연동', note: '화면이 밀려 들어오고 되돌아갑니다.' },
] as const;

export function CompareStage() {
  const [active, setActive] = useState<'with' | 'without'>('with');
  return <div className="stage">
    <div className="stage-switch" role="tablist" aria-label="비교할 버전">
      {versions.map(version => <button key={version.mode} type="button" role="tab"
        aria-selected={active === version.mode} onClick={() => setActive(version.mode)}>{version.label}</button>)}
    </div>
    <div className="stage-phones">
      {versions.map(version => <figure key={version.mode} className={`phone-col phone-${version.mode}`}
        data-active={active === version.mode ? '' : undefined}>
        <div className="phone">
          <iframe src={`/${version.mode}`} title={`머물곳 데모, ${version.label}`} />
        </div>
        <figcaption>
          <b>{version.label}</b>
          <span>{version.note}</span>
          <a href={`/${version.mode}`}>전체 화면으로 열기</a>
        </figcaption>
      </figure>)}
    </div>
  </div>;
}

export function CopyInstall({command}: {command: string}) {
  const [copied, setCopied] = useState(false);
  return <div className="install-line">
    <code>{command}</code>
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* Selection stays available. */ }
    }}>{copied ? '복사됨' : '복사'}</button>
  </div>;
}
