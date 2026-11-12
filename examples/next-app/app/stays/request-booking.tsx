'use client';
import { useState } from 'react';

export function RequestBooking() {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="book-sent" role="status">예약 요청을 보냈어요. 숙소가 확인하면 알림을 드릴게요.</p>;
  return <button type="button" className="app-button app-button-wide" onClick={() => setSent(true)}>예약 요청 보내기</button>;
}
