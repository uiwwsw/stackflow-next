import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { amenities, findStay, reviews, savedIds, stays, won, type Stay } from './data';
import { AppLink, BookLink, GuestPicker, SaveButton, SearchBox } from './ui';
import { RequestBooking } from './request-booking';

export function StayArt({stay, large = false}: {stay: Stay; large?: boolean}) {
  return <div className={large ? 'stay-art stay-art-large' : 'stay-art'} aria-hidden="true"
    style={{ '--sky': stay.sky, '--land': stay.land, '--accent': stay.accent } as React.CSSProperties}>
    <i className="stay-art-sun" /><i className="stay-art-hill" /><i className="stay-art-house" />
  </div>;
}

function StayRow({stay}: {stay: Stay}) {
  return <AppLink className="stay-row" href={`/stay/${stay.id}`}>
    <StayArt stay={stay} />
    <span className="stay-row-text">
      <strong>{stay.name}</strong>
      <span>{stay.region}, {stay.kind}</span>
      <span className="stay-row-price"><b>{won.format(stay.price)}원</b> 1박</span>
    </span>
    <span className="stay-row-rating" aria-label={`평점 ${stay.rating}`}>★ {stay.rating}</span>
  </AppLink>;
}

export function HomeScreen() {
  return <div className="app-screen">
    <h1 className="app-title">이번 주말, 어디서 머물까요?</h1>
    <SearchBox />
    <p className="app-count">숙소 {stays.length}곳</p>
    <div className="stay-list">{stays.map(stay => <StayRow key={stay.id} stay={stay} />)}</div>
  </div>;
}

export function SavedScreen() {
  const saved = stays.filter(stay => (savedIds as readonly string[]).includes(stay.id));
  return <div className="app-screen">
    <h1 className="app-title">저장한 숙소</h1>
    <div className="stay-list">{saved.map(stay => <StayRow key={stay.id} stay={stay} />)}</div>
  </div>;
}

export async function StayScreen({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const stay = findStay(id);
  if (!stay) notFound();
  return <article className="app-screen stay-detail">
    <StayArt stay={stay} large />
    <div className="stay-head">
      <div>
        <h1>{stay.name}</h1>
        <p>{stay.region}, {stay.kind}</p>
      </div>
      <SaveButton initial={(savedIds as readonly string[]).includes(stay.id)} />
    </div>
    <p className="stay-summary">{stay.summary}</p>
    <dl className="stay-facts">
      <div><dt>평점</dt><dd>★ {stay.rating}</dd></div>
      <div><dt>후기</dt><dd>{stay.reviews}개</dd></div>
      <div><dt>체크인</dt><dd>오후 3시</dd></div>
    </dl>
    <h2>편의시설</h2>
    <ul className="stay-amenities">{amenities.map(item => <li key={item}>{item}</li>)}</ul>
    <h2>후기</h2>
    <ul className="stay-reviews">{reviews.map(review => <li key={review.name}><b>{review.name}</b><p>{review.text}</p></li>)}</ul>
    <h2>위치</h2>
    <p className="stay-note">{stay.region}. 정확한 주소는 예약 후 알려 드립니다.</p>
    <div className="stay-cta">
      <span><b>{won.format(stay.price)}원</b> 1박</span>
      <BookLink href={`/stay/${stay.id}/book`}>예약하기</BookLink>
    </div>
  </article>;
}

export async function BookScreen({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  await connection();
  // Room availability comes from a slow partner system in a real service.
  await new Promise(resolve => setTimeout(resolve, 1800));
  const stay = findStay(id);
  if (!stay) notFound();
  return <article className="app-screen book-sheet">
    <h1 className="app-title">{stay.name} 예약</h1>
    <p className="book-available">12월 20일부터 2박, 예약할 수 있어요.</p>
    <div className="book-row"><span>날짜</span><b>12.20 (토) – 12.22 (월)</b></div>
    <GuestPicker />
    <div className="book-row"><span>합계</span><b>{won.format(stay.price * 2)}원</b></div>
    <RequestBooking />
  </article>;
}

export function BookLoading() {
  return <div className="app-screen book-sheet" aria-hidden="true">
    <div className="skeleton skeleton-title" />
    <div className="skeleton" />
    <div className="skeleton" />
    <div className="skeleton" />
  </div>;
}
