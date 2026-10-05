window.HCORE = {
  meta: {
    title: '3단원 역사 기말고사',
    subtitle: '몽골의 간섭과 고려의 개혁 ~ 조선 후기 사회 변화',
    grade: '중3 · 교과서 1회독 기준'
  },
  themes: [
    { id: 't1', name: '고려의 위기와 개혁', desc: '원 간섭기 ~ 신진 사대부', color: '#c2410c' },
    { id: 't2', name: '무인 세력과 조선의 탄생', desc: '홍건적·왜구 ~ 건국과 체제 정비', color: '#b45309' },
    { id: 't3', name: '유교 정치와 사림', desc: '통치 체제·사대교린 ~ 사림과 붕당', color: '#0f766e' },
    { id: 't4', name: '외란과 정치 변동', desc: '왜란·호란 ~ 세도 정치', color: '#1d4ed8' },
    { id: 't5', name: '사회와 문화의 변화', desc: '신분 질서·봉기 ~ 실학과 서민 문화', color: '#7e22ce' }
  ]
};

window.HDATA = { units: [] };
window.HU = function (id) { return window.HDATA.units.filter(function (u) { return u.id === id; })[0]; };