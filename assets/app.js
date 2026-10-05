(function () {
  'use strict';

  var CORE = window.HCORE;
  var UNITS = window.HDATA.units.slice().sort(function (a, b) { return a.no - b.no; });
  var THEMES = CORE.themes;
  var app = document.getElementById('app');

  var LS_CARD = 'hx.cards.v1';
  var LS_QUIZ = 'hx.quiz.v1';

  var BUCKET_NAME = ['새 카드', '학습 중', '복습', '완료'];
  var RIGHT_GAP = [1, 3, 7, 21];

  // ---------- 테마 ----------
  // head 안 인라인 스크립트가 같은 값을 문자열 그대로 읽으므로 JSON 으로 감싸지 않는다.
  var LS_THEME = 'hx.theme.v1';
  var themeBtn = document.getElementById('themeBtn');

  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    if (!themeBtn) return;
    var label = mode === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(LS_THEME, next); } catch (e) { /* 파일로 열면 무시 */ }
    });
  }
  applyTheme(currentTheme());

  // ---------- 저장 ----------
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 파일로 열면 무시 */ }
  }

  var cards = load(LS_CARD, {});
  var quizLog = load(LS_QUIZ, {});

  function cardKey(unitId, idx) { return unitId + '::' + idx; }

  function getCard(unitId, idx) {
    var k = cardKey(unitId, idx);
    if (!cards[k]) cards[k] = { b: 0, due: 0, wrong: 0, seen: 0 };
    return cards[k];
  }

  function allCards() {
    var list = [];
    UNITS.forEach(function (u) {
      (u.cards || []).forEach(function (c, i) {
        list.push({ unit: u, card: c, idx: i, key: cardKey(u.id, i) });
      });
    });
    return list;
  }

  // ---------- 유틸 ----------
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function themeOf(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return { id: id, name: '', color: '#64748b', desc: '' };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateStr(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function unitProgress(u) {
    var total = (u.cards || []).length;
    var mastered = 0, due = 0, now = Date.now();
    (u.cards || []).forEach(function (c, i) {
      var st = getCard(u.id, i);
      if (st.b >= 3) mastered++;
      if (st.due <= now) due++;
    });
    return { total: total, mastered: mastered, due: due, pct: total ? Math.round(mastered / total * 100) : 0 };
  }

  // ---------- 마인드맵 ----------
  function renderMap(node, depth) {
    var kids = node.c || [];
    var box = el('div', 'mm-node mm-d' + depth);
    var head = el('button', 'mm-label');
    head.type = 'button';
    head.innerHTML = '<span class="mm-dot"></span>' + esc(node.t);
    box.appendChild(head);
    if (kids.length) {
      var list = el('ul', 'mm-children');
      kids.forEach(function (k) { list.appendChild(renderMap(k, depth + 1)); });
      box.appendChild(list);
      head.addEventListener('click', function () {
        box.classList.toggle('collapsed');
      });
    }
    return wrapItem(box);
  }
  function wrapItem(box) {
    var li = el('li', 'mm-item');
    li.appendChild(box);
    return li;
  }
  function mindmapHtml(map, color) {
    var root = el('div', 'mm-root');
    root.style.setProperty('--mm-color', color);
    root.appendChild(el('div', 'mm-center', esc(map.t)));
    var ul = el('ul', 'mm-branches');
    (map.c || []).forEach(function (c) { ul.appendChild(renderMap(c, 1)); });
    root.appendChild(ul);
    return root;
  }

  // ---------- 화면: 홈 ----------
  function viewHome() {
    var frag = document.createDocumentFragment();

    var head = el('section', 'hero');
    head.innerHTML =
      '<h1>' + esc(CORE.meta.subtitle) + '</h1>' +
      '<p class="hero-sub">' + esc(CORE.meta.grade) + '</p>' +
      '<div class="hero-cta">' +
      '<a class="btn btn-primary" href="#drill">지금 드rill 시작</a>' +
      '<a class="btn" href="#stats">내 진행 상황</a>' +
      '</div>' +
      '<p class="hero-tip">단원을 열면 <b>정리 · 마인드맵 · 플래시카드 · 퀴즈</b> 네 가지로 나눠서 볼 수 있어요.</p>';
    frag.appendChild(head);

    THEMES.forEach(function (th) {
      var us = UNITS.filter(function (u) { return u.theme === th.id; });
      if (!us.length) return;
      var sec = el('section', 'theme-block');
      sec.style.setProperty('--th-color', th.color);
      sec.appendChild(el('div', 'theme-head',
        '<h2>' + esc(th.name) + '</h2><p>' + esc(th.desc) + '</p>'));
      var grid = el('div', 'unit-grid');
      us.forEach(function (u) { grid.appendChild(unitCard(u)); });
      sec.appendChild(grid);
      frag.appendChild(sec);
    });

    app.innerHTML = '';
    app.appendChild(frag);
  }

  function unitCard(u) {
    var p = unitProgress(u);
    var th = themeOf(u.theme);
    var a = el('a', 'unit-card');
    a.href = '#unit/' + u.id;
    a.style.setProperty('--th-color', th.color);
    var q = quizLog[u.id];
    a.innerHTML =
      '<div class="unit-no">' + u.no + '</div>' +
      '<div class="unit-main">' +
      '<h3>' + esc(u.title) + '</h3>' +
      '<p class="unit-sub">' + esc(u.subtitle) + '</p>' +
      '<div class="unit-meta">' +
      '<span>카드 ' + p.total + '</span>' +
      '<span>퀴즈 ' + (u.quiz || []).length + '</span>' +
      (q ? '<span>최근 점수 ' + q.best + '/' + (u.quiz || []).length + '</span>' : '') +
      '</div></div>' +
      '<div class="unit-ring" style="--p:' + p.pct + '"><span>' + p.pct + '%</span></div>';
    return a;
  }

  // ---------- 화면: 단원 ----------
  var currentUnit = null;
  var currentTab = 'summary';

  function viewUnit(id, tab) {
    var u = null;
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) u = UNITS[i];
    if (!u) { location.hash = '#home'; return; }
    currentUnit = u;
    currentTab = tab || currentTab || 'summary';

    var th = themeOf(u.theme);
    var frag = document.createDocumentFragment();

    var head = el('section', 'unit-head');
    head.style.setProperty('--th-color', th.color);
    head.innerHTML =
      '<a class="back" href="#home">← 단원 목록</a>' +
      '<div class="unit-title-row"><div class="unit-no big">' + u.no + '</div>' +
      '<div><h1>' + esc(u.title) + '</h1><p class="unit-sub">' + esc(u.subtitle) + '</p></div></div>' +
      '<p class="goal"><b>이 단원의 핵심 질문</b><br>' + esc(u.goal) + '</p>';

    var tabs = el('nav', 'tabs');
    [['summary', '정리'], ['map', '마인드맵'], ['cards', '플래시카드'], ['quiz', '퀴즈']]
      .forEach(function (t) {
        var b = el('a', 'tab' + (currentTab === t[0] ? ' on' : ''), t[1]);
        b.href = '#unit/' + u.id + '/' + t[0];
        tabs.appendChild(b);
      });
    head.appendChild(tabs);
    frag.appendChild(head);

    var body = el('section', 'unit-body');
    if (currentTab === 'summary') body.appendChild(summaryPane(u));
    else if (currentTab === 'map') body.appendChild(mapPane(u, th));
    else if (currentTab === 'cards') body.appendChild(cardsPane(u));
    else body.appendChild(quizPane(u));
    frag.appendChild(body);

    app.innerHTML = '';
    app.appendChild(frag);
    window.scrollTo(0, 0);
  }

  function summaryPane(u) {
    var box = el('div');
    (u.sections || []).forEach(function (sec) {
      var s = el('article', 'sec');
      var h = el('h2', null, '<span class="sec-id">' + esc(sec.id) + '</span>' + esc(sec.title));
      var ul = el('ul', 'points');
      (sec.points || []).forEach(function (p) { ul.appendChild(el('li', null, esc(p))); });
      s.appendChild(h);
      s.appendChild(ul);
      var acts = el('div', 'sec-acts');
      var b1 = el('button', 'btn btn-sm', '이 절 카드만 드릴');
      b1.addEventListener('click', function () { startDrill(u.id, sec.id); });
      acts.appendChild(b1);
      s.appendChild(acts);
      box.appendChild(s);
    });
    return box;
  }

  function mapPane(u, th) {
    var box = el('div');
    var tip = el('p', 'tip', '노드를 눌러 접고 펼 수 있어요. 전체 흐름을 먼저 큰 그림으로 잡아 보세요.');
    box.appendChild(tip);
    box.appendChild(mindmapHtml(u.map || { t: u.title, c: [] }, th.color));
    return box;
  }

  // ---------- 플래시카드 ----------
  var drill = null;

  function cardsPane(u) {
    var box = el('div');
    var bar = el('div', 'drill-bar');

    var start = el('button', 'btn btn-primary', '이 단원 드릴 시작');
    start.addEventListener('click', function () { startDrill(u.id, null); });
    bar.appendChild(start);

    var wrong = el('button', 'btn', '오답 카드만');
    wrong.addEventListener('click', function () { startDrill(u.id, null, true); });
    bar.appendChild(wrong);

    var reset = el('button', 'btn btn-ghost', '진행 초기화');
    reset.addEventListener('click', function () {
      if (!confirm('이 단원의 카드 학습 기록을 지울까요?')) return;
      (u.cards || []).forEach(function (c, i) { delete cards[cardKey(u.id, i)]; });
      save(LS_CARD, cards);
      viewUnit(u.id, 'cards');
    });
    bar.appendChild(reset);
    box.appendChild(bar);

    var counts = [0, 0, 0, 0];
    (u.cards || []).forEach(function (c, i) { counts[getCard(u.id, i).b]++; });
    box.appendChild(el('p', 'counts',
      counts.map(function (n, i) { return '<b>' + n + '</b> ' + BUCKET_NAME[i]; }).join(' · ')));

    var list = el('div', 'card-list');
    (u.cards || []).forEach(function (c, i) {
      var st = getCard(u.id, i);
      var d = el('details', 'card-item b' + st.b);
      d.innerHTML =
        '<summary><span class="b-tag">' + BUCKET_NAME[st.b] + '</span>' +
        '<span class="q">' + esc(c.q) + '</span></summary>' +
        '<div class="a">' + esc(c.a) + '</div>' +
        '<div class="card-foot">' + esc(c.s || '') +
        (st.seen ? ' · 다음 복습 ' + dateStr(st.due) : '') + '</div>';
      list.appendChild(d);
    });
    box.appendChild(list);
    return box;
  }

  function startDrill(unitId, secId, onlyWrong) {
    var u = null;
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === unitId) u = UNITS[i];
    if (!u) return false;

    var pool = [];
    (u.cards || []).forEach(function (c, i) {
      if (secId && c.s !== secId) return;
      var st = getCard(u.id, i);
      if (onlyWrong && st.wrong === 0) return;
      pool.push({ c: c, idx: i, st: st, uid: u.id });
    });
    if (!pool.length) {
      alert(onlyWrong ? '오답으로 기록된 카드가 아직 없어요.'
        : secId ? '이 절에 카드가 없어요.' : '드릴할 카드가 없어요.');
      return false;
    }
    var now = Date.now();
    pool.sort(function (a, b) {
      var ad = a.st.due <= now ? 0 : 1, bd = b.st.due <= now ? 0 : 1;
      if (ad !== bd) return ad - bd;
      if (a.st.b !== b.st.b) return a.st.b - b.st.b;
      return b.st.wrong - a.st.wrong;
    });

    drill = {
      unit: u, secId: secId, queue: pool, pos: 0, flipped: false,
      right: 0, partial: 0, wrong: 0, mode: onlyWrong ? 'wrong' : 'normal'
    };
    var target = '#drill/' + u.id + (secId ? '/' + secId : '');
    if (location.hash !== target) location.hash = target;
    else renderDrill();
    return true;
  }

  function renderDrill() {
    if (!drill) { viewHome(); return; }
    var d = drill;
    var total = d.queue.length;

    if (d.pos >= total) {
      var box = el('section', 'result');
      var rightPct = Math.round(d.right / total * 100);
      box.innerHTML =
        '<h1>드릴 끝!</h1>' +
        '<p class="result-score">' + d.right + ' / ' + total + ' (' + rightPct + '%)</p>' +
        '<p class="result-sub">부분 맞음 ' + d.partial + ' · 틀림 ' + d.wrong + '</p>';
      var again = el('button', 'btn btn-primary', '한 번 더');
      again.addEventListener('click', function () {
        if (d.mode === 'all') { startAllDrill(); return; }
        startDrill(d.unit.id, d.secId, d.mode === 'wrong');
      });
      box.appendChild(again);
      var back = el('a', 'btn', '단원으로 돌아가기');
      back.href = d.mode === 'all' ? '#drill' : '#unit/' + d.unit.id + '/cards';
      box.appendChild(back);
      var home = el('a', 'btn btn-ghost', '단원 목록');
      home.href = '#home';
      box.appendChild(home);
      app.innerHTML = '';
      app.appendChild(box);
      return;
    }

    var item = d.queue[d.pos];
    var wrap = el('section', 'drill');
    wrap.style.setProperty('--th-color', d.mode === 'all' ? '#1d4ed8' : themeOf(d.unit.theme).color);

    var head = el('div', 'drill-head');
    head.innerHTML =
      '<a class="back" href="' + (d.mode === 'all' ? '#drill' : '#unit/' + d.unit.id + '/cards') + '">← 나가기</a>' +
      '<div class="bar"><i style="width:' + Math.round(d.pos / total * 100) + '%"></i></div>' +
      '<span class="drill-count">' + (d.pos + 1) + ' / ' + total + '</span>';
    wrap.appendChild(head);

    var fc = el('div', 'flashcard' + (d.flipped ? ' flipped' : ''));
    var inner = el('div', 'fc-inner');
    var front = el('div', 'fc-face fc-front');
    front.innerHTML = '<span class="fc-label">질문</span><p>' + esc(item.c.q) + '</p>' +
      '<span class="fc-hint">카드를 눌러 정답 보기</span>';
    var back = el('div', 'fc-face fc-back');
    back.innerHTML = '<span class="fc-label">정답</span><p>' + esc(item.c.a) + '</p>' +
      '<span class="fc-src">' + esc(item.c.s || '') + '</span>';
    inner.appendChild(front);
    inner.appendChild(back);
    fc.appendChild(inner);
    wrap.appendChild(fc);

    var judge = judgePane(d, item);
    wrap.appendChild(judge);

    function paintJudge() {
      var fresh = judgePane(d, item);
      judge.parentNode.replaceChild(fresh, judge);
      judge = fresh;
    }
    fc.addEventListener('click', function () {
      d.flipped = !d.flipped;
      fc.classList.toggle('flipped', d.flipped);
      paintJudge();
    });

    app.innerHTML = '';
    app.appendChild(wrap);
  }

  function judgePane(d, item) {
    var judge = el('div', 'judge');
    if (!d.flipped) {
      judge.appendChild(el('p', 'judge-tip', '답을 먼저 소리 내어 말해 보세요. 그 다음 카드를 뒤집으세요.'));
      return judge;
    }
    [['right', '맞았어요', 'up'], ['partial', '부분 맞음', 'same'], ['wrong', '틀렸어요', 'down']]
      .forEach(function (j) {
        var b = el('button', 'btn j-' + j[2], j[1]);
        b.addEventListener('click', function () { grade(item, j[0]); });
        judge.appendChild(b);
      });
    return judge;
  }

  function grade(item, result) {
    var st = getCard(item.uid || drill.unit.id, item.idx);
    var now = Date.now();
    st.seen++;
    if (result === 'right') {
      st.b = Math.min(3, st.b + 1);
      st.due = now + RIGHT_GAP[st.b] * 864e5;
      drill.right++;
    } else if (result === 'partial') {
      st.due = now + 864e5;
      drill.partial++;
    } else {
      st.b = Math.max(0, st.b - 1);
      st.due = now + 4 * 36e5;
      st.wrong++;
      drill.wrong++;
    }
    save(LS_CARD, cards);
    drill.pos++;
    drill.flipped = false;
    renderDrill();
  }

  // ---------- 퀴즈 ----------
  var quizState = null;

  function quizPane(u) {
    var box = el('div');
    var start = el('button', 'btn btn-primary', '퀴즈 시작');
    start.addEventListener('click', function () { location.hash = '#quiz/' + u.id; });
    box.appendChild(start);

    var log = quizLog[u.id];
    if (log) {
      box.appendChild(el('p', 'counts',
        '최근 점수 ' + log.best + ' / ' + (u.quiz || []).length + ' · 시도 ' + log.attempts + '회'));
    }
    box.appendChild(el('p', 'tip', '문제를 읽고 4개 보기 중 하나를 고르세요. 틀린 문제에는 바로 이유가 나옵니다.'));
    box.appendChild(renderQuiz(u));
    return box;
  }

  function renderQuiz(u) {
    var box = el('div', 'quiz-list');
    (u.quiz || []).forEach(function (q, i) {
      var d = el('details', 'quiz-item');
      var opts = q.options.map(function (o, oi) {
        return '<li class="' + (oi === q.answer ? 'right' : '') + '">' +
          (oi + 1) + '. ' + esc(o) + (oi === q.answer ? ' <b>정답</b>' : '') + '</li>';
      }).join('');
      d.innerHTML = '<summary><span class="q">' + esc(q.q) + '</span></summary>' +
        '<ol class="opts">' + opts + '</ol>' +
        '<p class="why">' + esc(q.explain || '') + '</p>';
      box.appendChild(d);
    });
    return box;
  }

  function startQuiz(u) {
    var qs = shuffle(u.quiz || []);
    quizState = { unit: u, queue: qs, pos: 0, correct: 0, wrongIdx: [] };
    renderQuizRun();
  }

  function renderQuizRun() {
    var st = quizState;
    var total = st.queue.length;
    var u = st.unit;

    if (st.pos >= total) {
      var log = quizLog[u.id] || { best: 0, attempts: 0 };
      log.attempts++;
      if (st.correct > log.best) log.best = st.correct;
      quizLog[u.id] = log;
      save(LS_QUIZ, quizLog);

      var box = el('section', 'result');
      box.innerHTML = '<h1>퀴즈 끝!</h1><p class="result-score">' + st.correct + ' / ' + total + '</p>';
      if (st.wrongIdx.length) {
        box.appendChild(el('p', 'result-sub', '아래에서 틀린 문제를 다시 확인하세요.'));
        var rev = el('div', 'quiz-list');
        st.wrongIdx.forEach(function (i) {
          var q = st.queue[i];
          var d = el('details', 'quiz-item');
          d.innerHTML = '<summary><span class="q">' + esc(q.q) + '</span></summary>' +
            '<ol class="opts">' + q.options.map(function (o, oi) {
              return '<li class="' + (oi === q.answer ? 'right' : '') + '">' + (oi + 1) + '. ' + esc(o) + '</li>';
            }).join('') + '</ol><p class="why">' + esc(q.explain || '') + '</p>';
          rev.appendChild(d);
        });
        box.appendChild(rev);
      }
      var again = el('button', 'btn btn-primary', '다시 풀기');
      again.addEventListener('click', function () { startQuiz(u); });
      box.appendChild(again);
      var back = el('a', 'btn', '단원으로 돌아가기');
      back.href = '#unit/' + u.id + '/quiz';
      box.appendChild(back);
      app.innerHTML = '';
      app.appendChild(box);
      return;
    }

    var q = st.queue[st.pos];
    var wrap = el('section', 'quiz-run');
    var th = themeOf(u.theme);
    wrap.style.setProperty('--th-color', th.color);
    wrap.appendChild(el('div', 'drill-head',
      '<a class="back" href="#unit/' + u.id + '/quiz">← 나가기</a>' +
      '<div class="bar"><i style="width:' + Math.round(st.pos / total * 100) + '%"></i></div>' +
      '<span class="drill-count">' + (st.pos + 1) + ' / ' + total + '</span>'));

    var card = el('div', 'q-card');
    card.appendChild(el('span', 'fc-label', '문제'));
    card.appendChild(el('p', 'q-text', esc(q.q)));
    wrap.appendChild(card);

    var opts = el('div', 'q-opts');
    q.options.forEach(function (o, oi) {
      var b = el('button', 'q-opt', '<span class="num">' + (oi + 1) + '</span>' + esc(o));
      b.addEventListener('click', function () {
        var ok = oi === q.answer;
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok) {
          st.wrongIdx.push(st.pos);
          var right = opts.children[q.answer];
          if (right) right.classList.add('ok');
        } else {
          st.correct++;
        }
        var why = el('p', 'why show', (ok ? '정답! ' : '') + (q.explain || ''));
        wrap.appendChild(why);
        Array.prototype.forEach.call(opts.children, function (c) { c.disabled = true; });
        var next = el('button', 'btn btn-primary next', st.pos + 1 >= total ? '결과 보기' : '다음 문제');
        next.addEventListener('click', function () { st.pos++; renderQuizRun(); });
        wrap.appendChild(next);
        next.focus();
      });
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    app.innerHTML = '';
    app.appendChild(wrap);
  }

  // ---------- 통계 ----------
  function viewStats() {
    var list = allCards();
    var buckets = [0, 0, 0, 0];
    var due = 0, now = Date.now(), wrongCards = [];
    list.forEach(function (x) {
      var st = cards[x.key] || { b: 0, due: 0, wrong: 0 };
      buckets[st.b]++;
      if (st.due <= now && st.b < 3) due++;
      if (st.wrong > 0) wrongCards.push({ x: x, st: st });
    });

    var totalQ = 0, totalR = 0;
    UNITS.forEach(function (u) {
      var l = quizLog[u.id];
      if (l) { totalQ += (u.quiz || []).length; totalR += l.best; }
    });

    var frag = document.createDocumentFragment();
    var head = el('section', 'hero small');
    head.innerHTML = '<h1>진행 통계</h1><p class="hero-sub">기록은 이 브라우저의 로컬 저장소에만 남습니다.</p>';
    frag.appendChild(head);

    var grid = el('div', 'stat-grid');
    grid.appendChild(statBox('전체 카드', list.length + '장'));
    grid.appendChild(statBox('완료', buckets[3] + '장'));
    grid.appendChild(statBox('복습 예정', due + '장'));
    grid.appendChild(statBox('퀴즈 최고', totalR + ' / ' + totalQ));
    frag.appendChild(grid);

    var bar = el('div', 'stack');
    buckets.forEach(function (n, i) {
      var pct = list.length ? Math.round(n / list.length * 100) : 0;
      bar.appendChild(el('div', 'stack-row',
        '<span class="stack-label">' + BUCKET_NAME[i] + '</span>' +
        '<span class="stack-bar"><i class="sb' + i + '" style="width:' + pct + '%"></i></span>' +
        '<span class="stack-num">' + n + '</span>'));
    });
    frag.appendChild(bar);

    var t = el('div', 'unit-grid');
    UNITS.forEach(function (u) {
      var p = unitProgress(u);
      var l = quizLog[u.id];
      var a = el('a', 'unit-card mini');
      a.href = '#unit/' + u.id + '/cards';
      a.style.setProperty('--th-color', themeOf(u.theme).color);
      a.innerHTML = '<div class="unit-no">' + u.no + '</div><div class="unit-main"><h3>' + esc(u.title) + '</h3>' +
        '<div class="unit-meta"><span>완료 ' + p.mastered + '/' + p.total + '</span>' +
        (l ? '<span>퀴즈 ' + l.best + '/' + (u.quiz || []).length + '</span>' : '') + '</div></div>' +
        '<div class="unit-ring" style="--p:' + p.pct + '"><span>' + p.pct + '%</span></div>';
      t.appendChild(a);
    });
    frag.appendChild(el('h2', 'sec-title', '단원별 진행률'));
    frag.appendChild(t);

    if (wrongCards.length) {
      frag.appendChild(el('h2', 'sec-title', '틀었던 카드 (' + wrongCards.length + '장)'));
      var wl = el('div', 'card-list');
      wrongCards.sort(function (a, b) { return b.st.wrong - a.st.wrong; }).slice(0, 20).forEach(function (w) {
        var d = el('details', 'card-item b' + w.st.b);
        d.innerHTML = '<summary><span class="b-tag">틀림 ' + w.st.wrong + '</span>' +
          '<span class="q">' + esc(w.x.card.q) + '</span></summary>' +
          '<div class="a">' + esc(w.x.card.a) + '</div>' +
          '<div class="card-foot">' + esc(w.x.unit.no) + '. ' + esc(w.x.unit.title) + '</div>';
        wl.appendChild(d);
      });
      frag.appendChild(wl);
    }

    var reset = el('button', 'btn btn-ghost', '전체 기록 초기화');
    reset.addEventListener('click', function () {
      if (!confirm('모든 학습 기록을 지울까요?')) return;
      cards = {}; quizLog = {};
      save(LS_CARD, cards); save(LS_QUIZ, quizLog);
      viewStats();
    });
    frag.appendChild(reset);

    app.innerHTML = '';
    app.appendChild(frag);
  }

  function statBox(label, value) {
    return el('div', 'stat', '<span class="stat-v">' + esc(value) + '</span><span class="stat-l">' + esc(label) + '</span>');
  }

  // ---------- 전체 드릴 ----------
  function allDrillPool() {
    var now = Date.now();
    return allCards().filter(function (x) {
      var st = cards[x.key];
      return !st || st.b < 3 || st.due <= now;
    }).map(function (x) {
      return { c: x.card, idx: x.idx, st: getCard(x.unit.id, x.idx), uid: x.unit.id, no: x.unit.no };
    });
  }

  function startAllDrill() {
    var pool = allDrillPool();
    if (!pool.length) { viewAllDrill(); return; }
    drill = {
      unit: { id: 'all', title: '전체 드릴', no: 0, theme: '', cards: [] },
      secId: null, queue: shuffle(pool), pos: 0, flipped: false,
      right: 0, partial: 0, wrong: 0, mode: 'all'
    };
    if (location.hash !== '#drill/all') location.hash = '#drill/all';
    else renderDrill();
  }

  function viewAllDrill() {
    var pool = allDrillPool();
    var wrap = el('section', 'drill');
    wrap.appendChild(el('div', 'drill-head', '<a class="back" href="#home">← 단원 목록</a>'));

    if (!pool.length) {
      wrap.appendChild(el('div', 'result',
        '<h1>오늘 할 카드가 없어요</h1><p class="result-sub">모든 카드를 한 바퀴 다 돌았어요. 내일 다시 보세요.</p>'));
      app.innerHTML = '';
      app.appendChild(wrap);
      return;
    }

    var units = {};
    pool.forEach(function (x) { units[x.no] = (units[x.no] || 0) + 1; });
    var box = el('div', 'result');
    box.appendChild(el('h1', null, '오늘 볼 카드 ' + pool.length + '장'));
    box.appendChild(el('p', 'result-sub', '복습할 때가 된 카드와 아직 다 돌지 못한 카드를 섞어서 보여 줍니다.'));
    var list = el('div', 'unit-grid');
    UNITS.forEach(function (u) {
      if (!units[u.no]) return;
      list.appendChild(unitCard(u));
    });
    box.appendChild(list);
    var btn = el('button', 'btn btn-primary big', '이어서 드릴 시작');
    btn.addEventListener('click', startAllDrill);
    box.appendChild(btn);
    wrap.appendChild(box);
    app.innerHTML = '';
    app.appendChild(wrap);
  }

  // ---------- 라우팅 ----------
  function route() {
    var h = location.hash.replace(/^#/, '');
    var p = h.split('/');
    if (p[0] === 'unit') { viewUnit(p[1], p[2]); return; }
    if (p[0] === 'drill') {
      if (!p[1]) { viewAllDrill(); return; }
      if (!drill || drill.unit.id !== p[1]) {
        if (p[1] === 'all') { startAllDrill(); return; }
        if (startDrill(p[1], p[2] || null)) return;
        location.hash = '#home';
        viewHome();
        return;
      }
      renderDrill();
      return;
    }
    if (p[0] === 'quiz') {
      var u = null;
      for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === p[1]) u = UNITS[i];
      if (u) { quizState = null; startQuiz(u); return; }
      viewHome();
      return;
    }
    if (p[0] === 'stats') { viewStats(); return; }
    drill = null;
    viewHome();
  }

  function markNav(name) {
    var links = document.querySelectorAll('#topnav a');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('on', links[i].getAttribute('data-nav') === name);
    }
  }

  document.getElementById('siteTitle').textContent = CORE.meta.title;
  document.getElementById('siteSub').textContent = CORE.meta.subtitle;
  window.addEventListener('hashchange', function () {
    var p = location.hash.replace(/^#/, '').split('/');
    if (p[0] === 'unit') markNav('');
    else if (p[0] === 'stats') markNav('stats');
    else if (p[0] === 'drill' || p[0] === 'quiz') markNav('drill');
    else markNav('home');
    route();
  });

  markNav('home');
  route();
})();