export type Stay = {
  id: string;
  name: string;
  region: string;
  kind: string;
  price: number;
  rating: number;
  reviews: number;
  sky: string;
  land: string;
  accent: string;
  summary: string;
};

export const stays: readonly Stay[] = [
  { id: 'sorang', name: '소랑 한옥', region: '서울 종로', kind: '한옥 독채', price: 189000, rating: 4.9, reviews: 312, sky: '#dfe8ef', land: '#3e5a4a', accent: '#b9824c', summary: '북촌 골목 끝, 마당이 있는 두 칸짜리 한옥입니다. 아침에는 처마 아래로 해가 듭니다.' },
  { id: 'mulgyeol', name: '물결 스테이', region: '제주 월정리', kind: '바다 앞 독채', price: 241000, rating: 4.8, reviews: 207, sky: '#d6ecef', land: '#2f7f86', accent: '#e7d7b4', summary: '거실 창 너머가 바로 바다입니다. 썰물 때는 현무암 사이로 걸어 나갈 수 있습니다.' },
  { id: 'deungdae', name: '등대길 게스트하우스', region: '부산 영도', kind: '게스트하우스', price: 68000, rating: 4.6, reviews: 541, sky: '#e4e5f1', land: '#45507a', accent: '#d6574b', summary: '흰여울마을 계단 위, 부산항이 내려다보이는 4인실과 2인실이 있습니다.' },
  { id: 'soop', name: '숲속 오두막', region: '강원 평창', kind: '통나무집', price: 156000, rating: 4.7, reviews: 98, sky: '#e3ecdc', land: '#2e5235', accent: '#8a5a35', summary: '자작나무 숲 안쪽의 통나무집입니다. 장작 난로와 별을 볼 수 있는 다락이 있습니다.' },
  { id: 'nolsae', name: '놀새 펜션', region: '전남 여수', kind: '오션뷰 펜션', price: 132000, rating: 4.5, reviews: 176, sky: '#f1e3d6', land: '#a2553a', accent: '#f0b45e', summary: '돌산 해안도로의 노을 방향 객실입니다. 모든 방에 작은 테라스가 붙어 있습니다.' },
  { id: 'gogaet', name: '고갯마루 민박', region: '경북 안동', kind: '고택 민박', price: 94000, rating: 4.8, reviews: 143, sky: '#ece6da', land: '#5d4a36', accent: '#c49a5a', summary: '하회마을 건너편 고택의 사랑채입니다. 아침상은 집에서 담근 장으로 차립니다.' },
  { id: 'byeolbit', name: '별빛 캠핑', region: '경기 가평', kind: '글램핑', price: 118000, rating: 4.4, reviews: 389, sky: '#dcdff0', land: '#33405e', accent: '#e8c36a', summary: '북한강이 보이는 언덕의 글램핑 텐트입니다. 바비큐 그릴과 불멍 화로를 빌려 드립니다.' },
  { id: 'ondo', name: '온도 호텔', region: '서울 성수', kind: '부티크 호텔', price: 214000, rating: 4.6, reviews: 628, sky: '#e8e4ea', land: '#4b3f54', accent: '#d48a7c', summary: '옛 인쇄소를 고친 호텔입니다. 루프탑에서 서울숲과 한강이 함께 보입니다.' },
  { id: 'baram', name: '바람언덕', region: '제주 한경', kind: '돌집 독채', price: 197000, rating: 4.9, reviews: 84, sky: '#e2ecd8', land: '#56713c', accent: '#9a9a96', summary: '풍차가 보이는 들판의 돌집입니다. 귤 창고를 고친 서재가 딸려 있습니다.' },
  { id: 'jamjari', name: '잠자리 스테이', region: '충남 공주', kind: '농가 스테이', price: 76000, rating: 4.7, reviews: 61, sky: '#efe9d5', land: '#6b7a32', accent: '#d0a23d', summary: '금강 옆 농가의 별채입니다. 계절마다 밤 줍기나 고구마 캐기를 함께합니다.' },
  { id: 'haneul', name: '하늘정원 리조트', region: '강원 속초', kind: '리조트', price: 268000, rating: 4.5, reviews: 455, sky: '#d9e6f2', land: '#2f5d7c', accent: '#f2f2ee', summary: '설악산과 동해가 함께 보이는 리조트입니다. 실내 수영장과 사우나가 있습니다.' },
  { id: 'gil', name: '골목길 하우스', region: '전북 전주', kind: '한옥 게스트하우스', price: 82000, rating: 4.6, reviews: 233, sky: '#ebe3dc', land: '#6a3f35', accent: '#c96f4a', summary: '한옥마을 안쪽 골목의 게스트하우스입니다. 경기전까지 걸어서 5분입니다.' },
];

export const savedIds = ['mulgyeol', 'soop', 'baram'] as const;

export function findStay(id: string) {
  return stays.find(stay => stay.id === id);
}

export const won = new Intl.NumberFormat('ko-KR');

export const reviews = [
  { name: '민지', text: '사진보다 실제가 더 좋았어요. 다음에 부모님이랑 다시 오려고요.' },
  { name: '준호', text: '체크인 안내가 꼼꼼했고 침구가 깨끗했습니다.' },
  { name: '서연', text: '밤에 정말 조용해서 푹 잤어요. 주변 산책길도 좋아요.' },
  { name: '도윤', text: '주차 공간이 넉넉했고 사장님이 맛집을 알려 주셨어요.' },
] as const;

export const amenities = ['무선 인터넷', '주차', '주방', '세탁기', '에어컨', '난방', '드라이어', '수건 4장'] as const;
