/* =====================================================================
 * app.js — 화면과 동작
 * 데이터는 모두 DataStore(data.js)를 통해서만 읽고 씁니다.
 * ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 기본 정보
   * ------------------------------------------------------------------ */
  var PHASES = [
    { k: 'T', title: '개인 사고 형성', en: 'Thinking Initiation',     short: '혼자 생각하기', icon: '💭' },
    { k: 'H', title: '인간 협력',     en: 'Human Collaboration',     short: '모둠과 비교하기', icon: '🤝' },
    { k: 'I', title: 'AI 협업',       en: 'Interaction with AI',     short: 'AI와 함께하기', icon: '🤖' },
    { k: 'N', title: '검증과 종합',   en: 'Navigating & Critiquing', short: '따져 보고 합치기', icon: '🔍' },
    { k: 'K', title: '재구성과 내면화', en: 'Knowledge Synthesis',   short: '완성하고 돌아보기', icon: '🌱' }
  ];
  // 영어 이름: 첫 글자(T·H·I·N·K)에 단계 색
  function enName(p) { return '<span class="en"><b>' + p.en[0] + '</b>' + esc(p.en.slice(1)) + '</span>'; }
  var PH = {};
  PHASES.forEach(function (p) { PH[p.k] = p; });
  var PK = PHASES.map(function (p) { return p.k; });
  var COMMENT_PHASES = ['H', 'I'];
  var DECISIONS = [
    { v: '수용', icon: '✅', cls: 'acc' },
    { v: '수정', icon: '✏️', cls: 'mod' },
    { v: '제외', icon: '❌', cls: 'exc' }
  ];
  var TFIELDS = [
    { f: 'claim', label: '초기 주장', ph: '유전자 조작 기술은 인간에게 ○○이다. (나의 입장)' },
    { f: 'reason', label: '근거', ph: '왜 그렇게 생각하나요? 알고 있는 사실이나 경험을 적어요.' },
    { f: 'solution', label: '해결 방안', ph: '문제를 줄이거나 더 좋게 쓰려면 어떻게 해야 할까요?' }
  ];
  var KFIELDS = [
    { f: 'keep', label: '유지된 생각', ph: '처음 생각 중에서 끝까지 그대로인 생각은 무엇인가요?' },
    { f: 'changed', label: '바뀐 생각과 그 이유', ph: '어떤 생각이 어떻게 바뀌었나요? 왜 바뀌었나요?' },
    { f: 'influence', label: '친구와 AI가 준 영향', ph: '친구의 의견과 AI의 정보는 각각 내 생각에 어떤 영향을 주었나요?' },
    { f: 'groupTalk', label: '모둠과의 토의와 의견 교환이 내 생각에 준 영향', ph: '모둠에서 의견을 나누고 해결안을 함께 만들면서 내 생각이 어떻게 달라졌나요?' },
    { f: 'aiView', label: 'AI의 사용에 대해 내가 변화한 생각', ph: 'AI 답변을 기록하고 검증해 보니, AI를 쓰는 방법에 대한 내 생각이 어떻게 바뀌었나요?' }
  ];

  /* 화면 상태 */
  var S = {
    user: null,          // {role:'student'|'teacher', id, name, group}
    tab: null,           // 'T','H','I','N','K','F'(전체 흐름),'A'(교사 관리)
    d: null,             // 불러온 데이터
    drafts: {},          // 아직 저장하지 않은 입력값 (다시 그려도 사라지지 않게)
    pending: false,      // 입력 중에 새 데이터가 와서 다시 그리기를 미룬 상태
    pointerDown: false,
    tGroup: null,        // 교사가 보고 있는 모둠
    editingQ: null,      // 수정 중인 질문 ID
    flowGroup: 'all',
    flowStudent: null,
    cfEdit: {},          // 댓글 양식 편집 중인 값
    presence: [],
    classId: null,       // 지금 반
    classes: [],         // 반 목록
    syncing: 0,          // 서버로 보내는 중인 저장 개수
    netError: '',        // 연결 문제 메시지
    base: {},            // 모둠 공동 칸: 입력을 시작할 때의 저장 시각 (덮어쓰기 확인용)
    conflict: {}         // 모둠 공동 칸: 친구가 먼저 저장해서 확인이 필요한 칸
  };

  /* ------------------------------------------------------------------
   * 작은 도구들
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function orDash(s) { return s && String(s).trim() ? nl(s) : '<span style="color:var(--muted)">—</span>'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(t) {
    if (!t) return '';
    var d = new Date(t);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function byTime(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }

  function L() { return S.d.lesson; }
  function me() { return S.user; }
  function isTeacher() { return !!(S.user && S.user.role === 'teacher'); }
  function isOpen(k) { return !!L().open[k]; }
  function curPhase() {
    var c = null;
    PK.forEach(function (k) { if (isOpen(k)) c = k; });
    return c;
  }
  function myGroup() {
    if (isTeacher()) {
      if (!S.tGroup || L().groups.indexOf(S.tGroup) < 0) S.tGroup = L().groups[0];
      return S.tGroup;
    }
    return me().group;
  }
  function membersOf(g) {
    return S.d.students.filter(function (s) { return s.group === g; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  }
  function groupQs(g) { return S.d.questions.filter(function (q) { return q.group === g; }).sort(byTime); }
  // 검증표 행은 I단계 질문과 1:1 — 질문 순서대로, 질문마다 한 줄
  function verifyByQ(g) {
    var by = {};
    S.d.verify.forEach(function (v) { if (v.group === g && !v.deleted && v.source) by[v.source] = v; });
    return by;
  }
  function groupVerify(g) {
    var by = verifyByQ(g);
    return groupQs(g).map(function (q) { return by[q.id]; }).filter(Boolean);
  }

  /* ---------- 참여 확인: H·I·N 단계마다 한 명당 1개 이상 ---------- */
  var MAX_H_COMMENTS = 2;   // H단계: T카드 하나에 달 수 있는 댓글 수
  function isMyQ(q, s) {
    s = s || me();
    return q.createdById ? q.createdById === s.id : q.createdBy === s.name;
  }
  var DID = {
    H: function (s) { return S.d.questions.some(function (q) { return q.group === s.group && isMyQ(q, s); }); },
    I: function (s) { return S.d.aianswers.some(function (a) { return a.group === s.group && a['c_' + s.id]; }); },
    N: function (s) { return groupVerify(s.group).some(function (v) { return v['c_' + s.id]; }); }
  };
  var TODO = {
    H: 'AI에게 물어볼 질문을 1개 이상 추가해요.',
    I: 'AI 답변을 1개 이상 기록하고 저장해요.',
    N: '검증표에서 1줄 이상 판단하고 저장해요.'
  };
  function participation(phase, g) {
    var mem = membersOf(g), fn = DID[phase];
    var done = mem.filter(fn).length, mine = '';
    if (!isTeacher()) {
      var myQi = -1;
      groupQs(g).forEach(function (q, i) { if (myQi < 0 && isMyQ(q)) myQi = i; });
      mine = fn(me())
        ? '<span class="todo ok">✅ 나의 할 일 완료!</span>'
        : '<span class="todo">📌 나의 할 일: ' + TODO[phase] +
          (phase !== 'H' && myQi >= 0 ? ' 내가 낸 <b>Q' + (myQi + 1) + '</b>부터 해 보세요.' : '') + '</span>';
    }
    return '<div class="particip ph-' + phase + '">' +
      '<div class="particip-top">' + mine + '<span class="pcount">우리 모둠 참여 ' + done + '/' + mem.length + '명</span></div>' +
      '<div class="pchips">' + mem.map(function (s) {
        var ok = fn(s);
        return '<span class="pc' + (ok ? ' ok' : '') + '">' + (ok ? '✅' : '⬜') + ' ' + esc(s.name) + '</span>';
      }).join('') + '</div>' +
      '<small>모둠원 모두 한 명당 1개 이상 꼭 참여해요.</small></div>';
  }
  function myQTag(q) { return !isTeacher() && isMyQ(q) ? '<span class="mytag">📌 내가 낸 질문</span>' : ''; }

  /* I단계 "우리 말로 정리"를 N단계 검증표로 자동 반영
   * - 아직 행이 없으면 새로 만들고 (문서ID를 질문ID로 고정해 중복 생성 방지)
   * - N단계에서 문장을 직접 고치지 않은 행은 최신 정리 내용으로 갱신 */
  function syncVerify(g) {
    var all = S.d.verify.filter(function (v) { return v.group === g; });
    var jobs = [];
    groupQs(g).forEach(function (q) {
      var a = S.d.aianswersById[q.id];
      var info = a && (a.summary || a.answer);
      if (!info) return;
      var row = all.filter(function (r) { return r.source === q.id; })[0];
      if (!row) {
        jobs.push(DataStore.setDoc('verify', 'ai_' + q.id, {
          group: g, source: q.id, question: q.text, info: info, infoEdited: false, deleted: false,
          decision: '', reason: '', createdAt: q.createdAt || Date.now(), updatedBy: '', updatedAt: 0
        }, { merge: true }));
      } else if (!row.deleted && !row.infoEdited && row.info !== info) {
        jobs.push(DataStore.setDoc('verify', row.id, { info: info }, { merge: true }));
      }
    });
    return Promise.all(jobs).then(function () { return jobs.length; });
  }
  function syncVerifyAndRefresh() {
    if (S.tab !== 'N' || !S.user) return;
    syncVerify(myGroup()).then(function (n) { if (n) refresh(false); });
  }
  function gw(g) { return S.d.groupworkById[g] || {}; }
  function commentsOn(phase, tt, tid) {
    return S.d.comments.filter(function (c) {
      return c.phase === phase && c.targetType === tt && c.targetId === tid;
    }).sort(byTime);
  }
  function isOnline(id) { return S.presence.some(function (p) { return p.id === id; }); }

  /* 입력값(초안) */
  function dv(key, fallback) { return Object.prototype.hasOwnProperty.call(S.drafts, key) ? S.drafts[key] : (fallback == null ? '' : fallback); }
  function take(key, fallback) { return String(dv(key, fallback)).trim(); }
  function clearDrafts(prefix) {
    Object.keys(S.drafts).forEach(function (k) {
      if (k === prefix || k.indexOf(prefix + '.') === 0) delete S.drafts[k];
    });
    delete S.base[prefix];
    delete S.conflict[prefix];
  }

  /* ---------- 모둠 공동 칸 덮어쓰기 방지 ----------
   * 여러 모둠원이 같은 칸을 동시에 고칠 수 있는 곳:
   *   sol.모둠 / uniq.모둠 / ai.질문ID.* / v.검증행ID.* / qe.질문ID
   * 입력을 시작한 뒤 다른 친구가 먼저 저장했다면, 저장할 때 알려 줍니다. */
  function sharedPrefix(key) {
    if (/^(sol|uniq|qe)\./.test(key)) return key;
    var m = /^((ai|v)\.[^.]+)\./.exec(key);
    return m ? m[1] : null;
  }
  function stampOf(prefix) {   // [마지막 저장 시각, 저장한 사람, 최신 내용(글)]
    var dot = prefix.indexOf('.'), kind = prefix.slice(0, dot), id = prefix.slice(dot + 1), x;
    if (kind === 'sol') { x = gw(id); return [x.solutionAt || 0, x.solutionBy || '', x.solution || '']; }
    if (kind === 'uniq') { x = gw(id); return [x.uniqueIdeaAt || 0, x.uniqueIdeaBy || '', x.uniqueIdea || '']; }
    if (kind === 'ai') { x = S.d.aianswersById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', x.summary || x.answer || '']; }
    if (kind === 'v') { x = S.d.verifyById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', (x.decision ? '[' + x.decision + '] ' : '') + (x.info || '') + (x.reason ? '\n근거: ' + x.reason : '')]; }
    if (kind === 'qe') { x = S.d.questionsById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', x.text || '']; }
    return [0, '', ''];
  }
  function noteEditStart(key) {
    var p = sharedPrefix(key);
    if (p && !(p in S.base)) S.base[p] = stampOf(p)[0];
  }
  // 저장해도 되면 true(Promise). 친구가 먼저 저장했으면 물어보고, 아니면 최신 내용을 보여 줌
  function okToSave(prefix) {
    var base = S.base[prefix], st = stampOf(prefix);
    if (base == null || st[0] <= base || st[1] === me().name) return Promise.resolve(true);
    return ask({
      title: '친구가 먼저 저장했어요',
      msg: st[1] + ' 님이 방금 이 칸을 먼저 저장했어요.\n내 글로 저장하면 친구가 쓴 글은 덮어써져요.',
      ok: '내 글로 저장하기',
      cancel: '친구 글 먼저 보기'
    }).then(function (yes) {
      if (yes) return true;
      S.conflict[prefix] = true;
      S.base[prefix] = st[0];   // 확인했으니, 다음 저장은 그대로 진행
      render();
      return false;
    });
  }
  function conflictBox(prefix) {
    if (!S.conflict[prefix]) return '';
    var st = stampOf(prefix);
    return '<div class="notice conflict">⚠️ <b>' + esc(st[1]) + '</b> 님이 ' + fmt(st[0]) + '에 먼저 저장한 최신 내용이에요. ' +
      '내 글(아래 입력칸)과 합쳐서 다시 저장해 주세요.<div class="latest">' + orDash(st[2]) + '</div></div>';
  }
  function ta(key, fallback, ph, rows) {
    return '<textarea data-d="' + esc(key) + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(dv(key, fallback)) + '</textarea>';
  }
  function inp(key, fallback, ph, type) {
    return '<input type="' + (type || 'text') + '" data-d="' + esc(key) + '" value="' + esc(dv(key, fallback)) + '" placeholder="' + esc(ph || '') + '">';
  }

  /* 페이지 안에 그리는 확인 창
   * (브라우저 기본 confirm 창은 일부 환경·크롬북 설정에서 막힐 수 있어 직접 만듦)
   * ask({title, msg, ok, cancel, danger, input}) → Promise<true/false>
   *   input: 이 글자를 똑같이 입력해야 확인 버튼이 눌림 */
  function ask(o) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'modal-back';
      wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
        (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') +
        '<div class="modal-msg">' + nl(o.msg || '') + '</div>' +
        (o.input ? '<label class="lbl">확인을 위해 <b>' + esc(o.input) + '</b> 를 똑같이 입력하세요</label><input type="text" class="modal-input" autocomplete="off">' : '') +
        '<div class="modal-btns"><button class="btn" data-m="no">' + esc(o.cancel || '취소') + '</button>' +
        '<button class="btn ' + (o.danger ? 'danger-solid' : 'primary') + '" data-m="yes"' + (o.input ? ' disabled' : '') + '>' + esc(o.ok || '확인') + '</button></div>' +
        '</div>';
      document.body.appendChild(wrap);
      var yes = wrap.querySelector('[data-m=yes]');
      var field = wrap.querySelector('.modal-input');
      var closed = false;
      function close(v) {
        if (closed) return;
        closed = true;
        wrap.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
        else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); if (!yes.disabled) close(true); }
      }
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) return close(false);          // 바깥을 누르면 취소
        var b = e.target.closest('[data-m]');
        if (b && !b.disabled) close(b.dataset.m === 'yes');
      });
      if (field) {
        field.addEventListener('input', function () { yes.disabled = field.value.trim() !== o.input; });
        field.focus();
      } else {
        yes.focus();
      }
    });
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.className = ''; }, 2300);
  }

  /* ------------------------------------------------------------------
   * 데이터 불러오기
   * ------------------------------------------------------------------ */
  var COLS = ['students', 'tcards', 'comments', 'questions', 'aianswers', 'groupwork', 'verify', 'finals'];

  function loadAll() {
    return Promise.all([DataStore.getDoc('config', 'lesson')].concat(COLS.map(function (c) { return DataStore.listDocs(c); })))
      .then(function (res) {
        var d = { lesson: normalizeLesson(res[0]) };
        COLS.forEach(function (c, i) {
          d[c] = res[i + 1];
          d[c + 'ById'] = {};
          res[i + 1].forEach(function (x) { d[c + 'ById'][x.id] = x; });
        });
        return d;
      });
  }
  function normalizeLesson(l) {
    l = l || {};
    l.subject = l.subject || '';
    l.title = l.title || '새 수업';
    l.teacherCode = l.teacherCode || '1234';
    l.groups = (l.groups && l.groups.length) ? l.groups : ['1모둠', '2모둠', '3모둠', '4모둠'];
    l.open = l.open || { T: true };
    l.prompts = l.prompts || {};
    l.commentFields = l.commentFields || {};
    COMMENT_PHASES.forEach(function (p) {
      if (!l.commentFields[p] || !l.commentFields[p].length) l.commentFields[p] = ['나와 비슷한 점', '다른 점', '잘한 점'];
    });
    return l;
  }

  function isEditing() {
    var a = document.activeElement;
    if (!a || !a.closest || !a.closest('#app')) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
    return a.tagName === 'INPUT' && ['checkbox', 'radio', 'button'].indexOf(a.type) < 0;
  }

  function refresh(force) {
    return loadAll().then(function (d) {
      S.d = d;
      if (checkStillHere()) return;
      if (!force && (isEditing() || S.pointerDown)) { S.pending = true; return; }
      render();
    }).catch(function (e) { console.error(e); toast('데이터를 불러오지 못했어요'); });
  }
  function tryPendingRender() {
    if (S.pending && !isEditing() && !S.pointerDown) render();
  }
  function done(msg) { if (msg) toast(msg); return refresh(true); }

  /* ------------------------------------------------------------------
   * 화면 그리기
   * ------------------------------------------------------------------ */
  function render() {
    S.pending = false;
    var app = document.getElementById('app');
    if (!S.user) { app.innerHTML = renderLogin(); return; }
    if (!S.tab) S.tab = curPhase() || 'T';
    if (S.tab === 'A' && !isTeacher()) S.tab = 'T';
    app.innerHTML = renderHeader() + renderFlow() + renderTabs() + '<main class="main">' + renderTab() + '</main>';
    renderPresence();
    renderSync();
    updateCommentButtons(app);
  }

  /* ---------- 입장 화면 ---------- */
  function renderLogin() {
    var l = L();
    var local = DataStore.mode === 'local';
    var samples = ['s01', 's05', 's09'].map(function (id) { return S.d.studentsById[id]; }).filter(Boolean);
    return '' +
      '<div class="login-wrap">' +
      '  <div class="login-hero">' +
      '    <div class="think">' + PHASES.map(function (p) { return '<span class="ph-' + p.k + '">' + p.k + '</span>'; }).join('') + '</div>' +
      '    <p>THINK 인간-AI 협력 수업' + (l.subject ? ' · ' + esc(l.subject) : '') + '</p>' +
      '    <h1>' + esc(l.title) + '</h1>' +
      '    <div class="class-pick"><label for="classSel">우리 반</label><select id="classSel" data-change="classSel">' +
      S.classes.map(function (c) { return '<option' + (c === S.classId ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
      '</select></div>' +
      (local ? '<div class="mode-note">💻 지금은 <b>화면 확인용</b>이에요. 이 기기 안에만 저장되고, 다른 기기와 공유되지 않아요.</div>' : '') +
      '  </div>' +
      '  <div class="login-grid">' +
      '    <div class="login-card ph-I">' +
      '      <h2>🙋 학생 입장</h2><small>이름과 모둠을 입력하고 들어가요. 같은 이름·모둠으로 들어오면 내 기록이 이어져요.</small>' +
      '      <label class="lbl">이름</label>' + inp('login.name', '', '예) 홍길동') +
      '      <label class="lbl">모둠</label>' +
      '      <select data-d="login.group">' + l.groups.map(function (g) {
        return '<option ' + (dv('login.group', l.groups[0]) === g ? 'selected' : '') + '>' + esc(g) + '</option>';
      }).join('') + '</select>' +
      '      <button class="btn primary" data-act="loginStudent">입장하기 →</button>' +
      (samples.length ? '<div class="sample-people"><small>화면 확인용 샘플 학생으로 들어가 보기</small><div class="chips">' +
        samples.map(function (s) { return '<button class="btn small" data-act="quickLogin" data-id="' + s.id + '">' + esc(s.group) + ' ' + esc(s.name) + '</button>'; }).join('') +
        '</div></div>' : '') +
      '    </div>' +
      '    <div class="login-card ph-A">' +
      '      <h2>🧑‍🏫 교사 입장</h2><small>단계 열기·잠그기, 질문 수정, 진행 현황, 내보내기를 할 수 있어요.</small>' +
      '      <label class="lbl">교사 코드</label>' +
      '      <input type="password" data-d="login.code" data-enter="loginTeacher" value="' + esc(dv('login.code', '')) + '" placeholder="교사 코드 입력">' +
      '      <button class="btn primary" data-act="loginTeacher">교사로 입장</button>' +
      (local ? '      <div class="sample-people"><small>샘플 교사 코드: <b>1234</b> (교사 관리에서 바꿀 수 있어요)</small></div>' : '') +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  /* ---------- 상단 ---------- */
  function renderHeader() {
    var u = me();
    return '' +
      '<header class="top">' +
      '  <div class="lesson">' + (L().subject ? '<span class="subject">' + esc(L().subject) + '</span>' : '') + '<h1>' + esc(L().title) + '</h1></div>' +
      '  <div class="me">' +
      '<span id="syncbadge"></span>' +
      (isTeacher()
        ? '<span class="me-chip teacher">🧑‍🏫 ' + esc(S.classId) + ' · 교사 모드</span>'
        : '<span class="me-chip">🙋 ' + esc(S.classId) + ' · ' + esc(u.name) + ' · ' + esc(u.group) + '</span>') +
      '    <button class="btn small ghost" data-act="logout">나가기</button>' +
      '  </div>' +
      '  <div class="presence" id="presence"></div>' +
      '</header>';
  }

  // 저장 상태 표시: 저장 중… / 저장됨 / 연결 문제
  function renderSync() {
    var b = document.getElementById('syncbadge');
    if (!b) return;
    if (DataStore.mode === 'local') { b.className = 'sync local'; b.textContent = '💻 이 기기에만 저장'; return; }
    if (S.netError) { b.className = 'sync err'; b.textContent = '⚠️ ' + S.netError; return; }
    if (S.syncing > 0) { b.className = 'sync busy'; b.textContent = '☁️ 저장 중…'; return; }
    b.className = 'sync ok'; b.textContent = '✓ 모두 저장됨';
  }
  function netMessage(code) {
    if (/resource-exhausted/.test(code)) return '오늘 무료 사용량을 다 썼어요 (오후 4~5시 초기화)';
    if (/permission-denied/.test(code)) return 'Firebase 보안 규칙 때문에 막혔어요';
    if (/unavailable|failed-precondition|network/.test(code)) return '인터넷 연결이 불안정해요 (다시 연결되면 자동 저장)';
    if (/script-load-failed/.test(code)) return 'Firebase를 불러오지 못했어요 (인터넷 확인)';
    return '저장 서버 연결에 문제가 있어요';
  }

  function renderPresence() {
    var box = document.getElementById('presence');
    if (!box || !S.user) return;
    var html;
    if (isTeacher()) {
      var online = S.d.students.filter(function (s) { return isOnline(s.id); });
      html = '<span class="plabel">지금 접속 중인 학생 ' + online.length + '명</span>' +
        L().groups.map(function (g) {
          var on = online.filter(function (s) { return s.group === g; });
          return '<span class="pchip ' + (on.length ? 'on' : '') + '">' + esc(g) + ' ' + on.length + '명' +
            (on.length ? ' (' + on.map(function (s) { return esc(s.name); }).join(', ') + ')' : '') + '</span>';
        }).join('');
    } else {
      html = '<span class="plabel">지금 접속 중인 모둠원</span>' +
        membersOf(me().group).map(function (s) {
          var on = s.id === me().id || isOnline(s.id);
          return '<span class="pchip ' + (on ? 'on' : '') + '">' + esc(s.name) + (s.id === me().id ? ' (나)' : '') + '</span>';
        }).join('');
    }
    box.innerHTML = html;
  }

  /* ---------- 진행 흐름 바 ---------- */
  function renderFlow() {
    var cp = curPhase();
    return '<nav class="flow" aria-label="수업 진행 흐름">' + PHASES.map(function (p, i) {
      // 동그라미 강조는 "지금 보고 있는 탭", 아래 작은 글씨는 교사가 연 "지금 단계"
      var cls = (p.k === S.tab ? 'cur ' : '') + (isOpen(p.k) ? 'open' : 'locked');
      var sub = p.k === cp ? '지금 단계' : (isOpen(p.k) ? '열림' : '🔒 잠김');
      return '<button class="flow-step ph-' + p.k + ' ' + cls + '" data-act="tab" data-tab="' + p.k + '">' +
        '<span class="dot">' + p.k + '</span><span class="lbl2">' + p.title + enName(p) + '<small>' + sub + '</small></span></button>' +
        (i < PHASES.length - 1 ? '<span class="arrow">→</span>' : '');
    }).join('') + '</nav>';
  }

  /* ---------- 탭 ---------- */
  function renderTabs() {
    var tabs = PHASES.map(function (p) {
      var locked = !isOpen(p.k);
      return '<button class="tab ph-' + p.k + (S.tab === p.k ? ' active' : '') + (locked && S.tab !== p.k ? ' locked' : '') +
        '" data-act="tab" data-tab="' + p.k + '">' + (locked ? '🔒 ' : '') + p.k + ' · ' + p.short + '</button>';
    });
    tabs.push('<button class="tab ph-F' + (S.tab === 'F' ? ' active' : '') + '" data-act="tab" data-tab="F">🗺️ 전체 흐름</button>');
    if (isTeacher()) tabs.push('<button class="tab ph-A' + (S.tab === 'A' ? ' active' : '') + '" data-act="tab" data-tab="A">⚙️ 교사 관리</button>');
    return '<div class="tabs" role="tablist">' + tabs.join('') + '</div>';
  }

  function renderTab() {
    var k = S.tab;
    if (PH[k] && !isTeacher() && !isOpen(k)) return renderLocked(k);
    switch (k) {
      case 'T': return renderT();
      case 'H': return renderH();
      case 'I': return renderI();
      case 'N': return renderN();
      case 'K': return renderK();
      case 'F': return renderFlowTab();
      case 'A': return renderAdmin();
    }
    return '';
  }

  function renderLocked(k) {
    return '<div class="locked-view ph-' + k + '"><div class="ic">🔒</div><h2>' + k + ' 단계 · ' + PH[k].title + '</h2>' +
      '<p>선생님이 아직 이 단계를 열지 않았어요.<br>지금 단계를 먼저 끝내 볼까요?</p>' +
      (curPhase() ? '<button class="btn primary ph-' + curPhase() + '" data-act="tab" data-tab="' + curPhase() + '">지금 단계(' + curPhase() + ')로 가기</button>' : '') +
      '</div>';
  }

  function phaseHead(k, withPicker) {
    var p = PH[k];
    var pick = '';
    if (withPicker && isTeacher()) {
      pick = '<div class="pick"><label class="lbl" style="margin-top:0">볼 모둠</label><select data-change="tgroup">' +
        L().groups.map(function (g) { return '<option ' + (g === myGroup() ? 'selected' : '') + '>' + esc(g) + '</option>'; }).join('') +
        '</select></div>';
    }
    var lockNote = (isTeacher() && !isOpen(k)) ? ' <span class="status">🔒 학생에게 잠김</span>' : '';
    return '<div class="phase-head ph-' + k + '"><div class="big">' + k + '</div><div>' +
      '<h2>' + p.icon + ' ' + p.title + lockNote + '</h2>' + enName(p) +
      (L().prompts[k] ? '<p class="q">' + nl(L().prompts[k]) + '</p>' : '') +
      '</div>' + pick + '</div>';
  }

  function section(k, title, right) {
    return '<div class="section ph-' + k + '"><span class="tag">' + k + '</span><h2>' + title + '</h2>' +
      (right ? '<div class="right">' + right + '</div>' : '') + '</div>';
  }

  /* ---------- T 카드 표시 ---------- */
  function tCardBody(c) {
    return '<dl class="tfields">' + TFIELDS.map(function (f) {
      return '<dt>' + f.label + '</dt><dd>' + orDash(c && c[f.f]) + '</dd>';
    }).join('') + '</dl>';
  }
  function tStatus(c) {
    if (c && c.submitted) return '<span class="status ok">✅ 제출 완료</span>';
    if (c && (c.claim || c.reason || c.solution)) return '<span class="status wip">✏️ 작성 중</span>';
    return '<span class="status">아직 작성 전</span>';
  }

  /* ---------- 댓글 (표 양식) ---------- */
  function commentTable(c) {
    var canDel = isTeacher() || c.authorId === me().id;
    return '<table class="ctable">' +
      '<caption>💬 ' + esc(c.authorName) + (c.authorGroup ? ' <small>' + esc(c.authorGroup) + '</small>' : '') +
      ' <small>' + fmt(c.createdAt) + '</small>' +
      (canDel ? ' <button class="btn small ghost danger cdel" data-act="delComment" data-id="' + c.id + '">삭제</button>' : '') +
      '</caption>' +
      (c.fields || []).map(function (f) { return '<tr><th>' + esc(f.label) + '</th><td>' + nl(f.value) + '</td></tr>'; }).join('') +
      '</table>';
  }
  function commentForm(phase, tt, tid) {
    var prefix = 'c.' + phase + '.' + tt + '.' + tid;
    var fields = L().commentFields[phase];
    return '<div class="cform ph-' + phase + '">' +
      '<table class="ctable"><caption>✍️ 댓글 쓰기 <small>표의 모든 칸을 채워 주세요</small></caption>' +
      fields.map(function (label, i) {
        return '<tr><th>' + esc(label) + '</th><td>' + ta(prefix + '.' + i, '', label + '을(를) 적어요', 2) + '</td></tr>';
      }).join('') +
      '</table>' +
      '<div class="foot"><button class="btn primary cbtn" disabled data-act="addComment" data-phase="' + phase +
      '" data-tt="' + tt + '" data-tid="' + esc(tid) + '">댓글 등록</button><span class="chint"></span></div>' +
      '</div>';
  }
  function commentsBlock(phase, tt, tid, canWrite, title) {
    var list = commentsOn(phase, tt, tid);
    var limited = phase === 'H', full = limited && list.length >= MAX_H_COMMENTS;
    return '<div class="comments">' +
      '<div class="ctitle">' + (title || '댓글') + ' ' + list.length + (limited ? '/' + MAX_H_COMMENTS : '') + '개</div>' +
      list.map(commentTable).join('') +
      (full ? '<div class="clock">🔒 댓글 ' + MAX_H_COMMENTS + '개가 모두 찼어요. 아직 댓글이 적은 다른 친구 카드에 남겨 주세요.</div>'
            : (canWrite ? commentForm(phase, tt, tid) : '')) +
      '</div>';
  }
  function updateCommentButtons(root) {
    (root || document).querySelectorAll('.cform').forEach(function (f) {
      var ok = Array.prototype.every.call(f.querySelectorAll('textarea'), function (t) { return t.value.trim(); });
      var b = f.querySelector('.cbtn');
      var hint = f.querySelector('.chint');
      if (b) b.disabled = !ok;
      if (hint) {
        hint.textContent = ok ? '✔ 모든 칸을 채웠어요. 등록할 수 있어요!' : '모든 칸을 채워야 등록 버튼이 눌려요.';
        hint.className = 'chint' + (ok ? ' ok' : '');
      }
    });
  }

  /* ==================================================================
   * T — 개인 사고 형성
   * ================================================================== */
  function renderT() {
    var out = phaseHead('T', true);
    if (isTeacher()) {
      var g = myGroup();
      out += section('T', g + ' 초기 생각 카드');
      var mem = membersOf(g);
      if (!mem.length) return out + '<div class="empty">이 모둠에는 아직 입장한 학생이 없어요.</div>';
      out += '<div class="grid3">' + mem.map(function (s) {
        var c = S.d.tcardsById[s.id];
        return '<div class="card accent ph-T"><div class="card-head"><span class="avatar">' + esc(s.name[0]) + '</span><b>' + esc(s.name) + '</b>' +
          '<span class="right">' + tStatus(c) + '</span></div>' + tCardBody(c) +
          (c && c.submitted ? '<div class="btn-row"><button class="btn small ghost" data-act="unlockT" data-id="' + s.id + '">↩ 제출 취소 (다시 수정 허용)</button><span class="meta">제출 ' + fmt(c.submittedAt) + '</span></div>' : '') +
          '</div>';
      }).join('') + '</div>';
      return out;
    }

    var c = S.d.tcardsById[me().id];
    out += '<div class="notice noai">🙅 AI를 사용하지 않고, 나의 생각만으로 작성해요. 정답은 없어요!</div>';
    if (c && c.submitted) {
      out += '<div class="card accent ph-T"><div class="card-head"><span class="avatar">' + esc(me().name[0]) + '</span><b>나의 초기 생각</b>' +
        '<span class="right">' + tStatus(c) + ' <small>' + fmt(c.submittedAt) + '</small></span></div>' + tCardBody(c) +
        '<div class="notice info" style="margin:16px 0 0">제출한 카드는 수정할 수 없어요. 이 생각은 K단계에서 지금의 생각과 비교하게 돼요.</div></div>';
    } else {
      out += '<div class="card accent ph-T">' +
        TFIELDS.map(function (f) {
          return '<label class="lbl">' + f.label + '</label>' + ta('T.' + f.f, c && c[f.f], f.ph, f.f === 'claim' ? 2 : 4);
        }).join('') +
        '<div class="btn-row"><button class="btn primary ph-T" data-act="submitT">제출하기</button>' +
        '<button class="btn" data-act="saveTDraft">임시 저장</button>' +
        '<span class="meta">⚠️ 제출하면 수정할 수 없어요.' + (c && c.updatedAt ? ' · 마지막 저장 ' + fmt(c.updatedAt) : '') + '</span></div>' +
        '</div>';
    }
    out += isOpen('H')
      ? '<div class="notice info">🤝 H단계가 열렸어요! H 탭에서 모둠 친구들의 카드를 볼 수 있어요.</div>'
      : '<div class="notice info">🔒 친구들의 카드는 H단계가 열리면 볼 수 있어요. 지금은 나의 생각에 집중해요.</div>';
    return out;
  }

  /* ==================================================================
   * H — 인간 협력
   * ================================================================== */
  function renderH() {
    var g = myGroup();
    var out = phaseHead('H', true);

    out += section('H', '💭 ' + esc(g) + ' 친구들의 초기 생각');
    var mem = membersOf(g);
    if (!mem.length) out += '<div class="empty">이 모둠에는 아직 입장한 학생이 없어요.</div>';
    out += '<div class="grid2">' + mem.map(function (s) {
      var c = S.d.tcardsById[s.id];
      var mine = !isTeacher() && s.id === me().id;
      if (!c || !c.submitted) {
        return '<div class="card"><div class="card-head"><span class="avatar">' + esc(s.name[0]) + '</span><b>' + esc(s.name) + '</b>' +
          '<span class="right">' + tStatus(c) + '</span></div><div class="empty">아직 T카드를 제출하지 않았어요.</div></div>';
      }
      return '<div class="card accent ph-H"><div class="card-head"><span class="avatar">' + esc(s.name[0]) + '</span><b>' + esc(s.name) + (mine ? ' (나)' : '') + '</b></div>' +
        tCardBody(c) +
        commentsBlock('H', 'tcard', s.id, !mine, mine ? '내가 받은 댓글' : '댓글') +
        '</div>';
    }).join('') + '</div>';

    out += section('H', '❓ 우리 모둠 AI 질문 리스트');
    var qs = groupQs(g);
    out += '<div class="card result ph-H">' +
      '<div class="result-head"><span class="ribbon">모둠 질문 리스트</span><span>한 명당 질문을 1개 이상 꼭 추가해요. 이 질문들로 I단계에서 AI에게 물어봐요.</span></div>' +
      participation('H', g);
    out += qs.length ? '<ol class="qlist">' + qs.map(function (q) {
      if (S.editingQ === q.id) {
        return (S.conflict['qe.' + q.id] ? '<li class="qconf">' + conflictBox('qe.' + q.id) + '</li>' : '') +
          '<li><span class="num"></span>' + inp('qe.' + q.id, q.text, '질문 내용', 'text').replace('<input', '<input data-enter="saveQ" data-id="' + q.id + '"') +
          '<button class="btn small primary" data-act="saveQ" data-id="' + q.id + '">저장</button>' +
          '<button class="btn small ghost" data-act="cancelQ">취소</button></li>';
      }
      return '<li' + (!isTeacher() && isMyQ(q) ? ' class="mine"' : '') + '><span class="num"></span><span class="text">' + esc(q.text) + (q.createdBy ? '<small>' + esc(q.createdBy) + (!isTeacher() && isMyQ(q) ? ' · 내 질문' : '') + '</small>' : '') + '</span>' +
        '<button class="btn small" data-act="editQ" data-id="' + q.id + '">✏️ 수정</button>' +
        '<button class="btn small ghost danger" data-act="delQ" data-id="' + q.id + '">🗑 삭제</button></li>';
    }).join('') + '</ol>' : '<div class="empty" style="margin-bottom:12px">아직 질문이 없어요. 모둠원과 이야기하며 AI에게 물어볼 질문을 만들어 보세요.</div>';
    out += '<div class="qadd">' + inp('qnew', '', '예) 유전자 조작으로 치료된 병이 실제로 있을까?').replace('<input', '<input data-enter="addQ"') +
      '<button class="btn primary ph-H" data-act="addQ">＋ 질문 추가</button></div>';
    out += '</div>';
    return out;
  }

  /* ==================================================================
   * I — AI 협업
   * ================================================================== */
  function renderI() {
    var g = myGroup();
    var out = phaseHead('I', true);
    var qs = groupQs(g);

    out += section('I', '🤖 질문별 AI 답변 기록');
    if (qs.length) out += participation('I', g);
    if (!qs.length) out += '<div class="empty">H단계에서 AI 질문을 먼저 만들어 주세요.</div>';
    qs.forEach(function (q, i) {
      var a = S.d.aianswersById[q.id] || {};
      var k = 'ai.' + q.id;
      out += '<div class="card accent ph-I">' +
        '<div class="ai-q"><span class="qn">Q' + (i + 1) + '</span><span>' + esc(q.text) + myQTag(q) + '</span></div>' +
        '<label class="lbl">AI 답변 붙여넣기</label>' + ta(k + '.answer', a.answer, 'AI가 한 답변을 그대로 붙여 넣어요.', 5) +
        '<div class="ai-row">' +
        '  <div><label class="lbl">사용한 AI 도구 이름</label>' + inp(k + '.tool', a.tool, '예) ChatGPT, Gemini, 뤼튼') + '</div>' +
        '  <div><label class="check"><input type="checkbox" data-d="' + k + '.hasSource"' + (dv(k + '.hasSource', !!a.hasSource) ? ' checked' : '') + '> AI 답변에 출처가 있어요</label>' +
        inp(k + '.sourceNote', a.sourceNote, '출처 (있으면 자료명이나 주소)') + '</div>' +
        '</div>' +
        conflictBox(k) +
        '<label class="lbl">우리 말로 정리 <small>어려운 말은 쉽게, 중요한 것만 골라서</small></label>' + ta(k + '.summary', a.summary, 'AI 답변을 우리 모둠의 말로 다시 써요.', 3) +
        '<div class="btn-row"><button class="btn primary ph-I" data-act="saveAI" data-id="' + q.id + '">저장</button>' +
        (a.updatedAt ? '<span class="meta">마지막 저장: ' + esc(a.updatedBy || '') + ' · ' + fmt(a.updatedAt) + '</span>' : '') + '</div>' +
        '</div>';
    });

    var w = gw(g);
    out += section('I', '🧩 ' + esc(g) + ' 중간 해결안');
    out += '<div class="card result ph-I">' +
      '<div class="result-head"><span class="ribbon">모둠 결과</span><span>위의 AI 답변과 모둠 토의를 모아, 우리 모둠의 해결안을 정리해요</span></div>' +
      conflictBox('sol.' + g) +
      ta('sol.' + g, w.solution, 'AI 답변과 모둠 토의를 바탕으로, 지금까지의 해결안을 적어요.', 6) +
      '<div class="btn-row"><button class="btn primary ph-I" data-act="saveSol">중간 해결안 저장</button>' +
      (w.solutionAt ? '<span class="meta">마지막 저장: ' + esc(w.solutionBy || '') + ' · ' + fmt(w.solutionAt) + '</span>' : '') + '</div>' +
      (w.solution ? commentsBlock('I', 'solution', g, isTeacher(), '다른 모둠이 남긴 댓글') : '') +
      '</div>';

    out += section('I', '👀 다른 모둠의 중간 해결안', '<small>다른 모둠 해결안에 표 양식으로 댓글을 남겨요</small>');
    var others = L().groups.filter(function (x) { return x !== g; });
    var any = false;
    out += '<div class="grid2">' + others.map(function (og) {
      var ow = gw(og);
      if (!ow.solution) return '';
      any = true;
      return '<div class="card"><div class="card-head"><span class="avatar ph-I">' + esc(og.replace(/[^0-9]/g, '') || og[0]) + '</span><b>' + esc(og) + '</b>' +
        '<span class="right"><small>' + fmt(ow.solutionAt) + '</small></span></div>' +
        '<div class="result-text ph-I">' + nl(ow.solution) + '</div>' +
        commentsBlock('I', 'solution', og, true) +
        '</div>';
    }).join('') + '</div>';
    if (!any) out += '<div class="empty">아직 다른 모둠이 중간 해결안을 올리지 않았어요.</div>';
    return out;
  }

  /* ==================================================================
   * N — 검증과 종합
   * ================================================================== */
  function renderN() {
    var g = myGroup();
    var out = phaseHead('N', true);
    var qs = groupQs(g), byQ = verifyByQ(g);
    var count = { '수용': 0, '수정': 0, '제외': 0 };
    qs.forEach(function (q) { var r = byQ[q.id]; if (r && count[r.decision] != null) count[r.decision]++; });

    out += section('N', '🔍 AI 정보 검증표', '<small>I단계 질문 ' + qs.length + '개 → 검증 ' + qs.length + '줄</small>');
    out += '<div class="notice info">🔗 I단계 질문과 같은 번호로 한 줄씩 있어요. I단계에서 <b>"우리 말로 정리"</b>를 저장하면 그 줄에 자동으로 들어와요. ' +
      '이 표에서 AI 정보 문장을 직접 고쳐 저장한 줄은, 그 뒤로 I단계를 고쳐도 덮어쓰지 않아요.</div>';
    if (qs.length) out += participation('N', g);
    out += '<div class="vsum" style="margin-bottom:12px">' + DECISIONS.map(function (d) {
      return '<span class="b-' + d.v + '">' + d.icon + ' ' + d.v + ' ' + count[d.v] + '</span>';
    }).join('') + '<span class="b-없음">판단 전 ' + (qs.length - count['수용'] - count['수정'] - count['제외']) + '</span></div>';

    if (!qs.length) {
      out += '<div class="empty">검증할 AI 정보가 없어요. H단계에서 질문을 만들고, I단계에서 AI 답변을 정리해 주세요.</div>';
    } else {
      out += '<div class="ph-N"><div class="vhead"><span>#</span><span>AI 정보</span><span>판단</span><span>판단 근거</span><span></span></div>' +
        qs.map(function (q, i) {
          var r = byQ[q.id];
          if (!r) {   // 아직 I단계에서 정리하지 않은 질문
            return '<div class="vrow vwait"><div class="vnum">' + (i + 1) + '</div>' +
              '<div class="vwait-msg"><div class="vq">질문: ' + esc(q.text) + myQTag(q) + '</div>' +
              '⏳ I단계에서 이 질문(Q' + (i + 1) + ')의 <b>"우리 말로 정리"</b>를 먼저 저장해 주세요. 저장하면 여기에 자동으로 들어와요.</div></div>';
          }
          var k = 'v.' + r.id;
          var dec = dv(k + '.decision', r.decision || '');
          return (S.conflict[k] ? '<div class="vrow vconf">' + conflictBox(k) + '</div>' : '') +
            '<div class="vrow">' +
            '<div class="vnum">' + (i + 1) + '</div>' +
            '<div><label class="lbl">AI 정보</label><div class="vq">질문: ' + esc(q.text) + myQTag(q) + '</div>' +
            ta(k + '.info', r.info, 'AI가 알려 준 정보', 3) + '</div>' +
            '<div><label class="lbl">판단</label><div class="decisions">' + DECISIONS.map(function (d) {
              return '<label class="dec ' + d.cls + '"><input type="radio" name="' + k + '" data-d="' + k + '.decision" value="' + d.v + '"' +
                (dec === d.v ? ' checked' : '') + '><span>' + d.icon + ' ' + d.v + '</span></label>';
            }).join('') + '</div></div>' +
            '<div><label class="lbl">판단 근거</label>' + ta(k + '.reason', r.reason, '왜 그렇게 판단했나요? (교과서, 믿을 만한 자료, 모둠 토의 등)', 3) +
            (r.updatedBy ? '<small>' + esc(r.updatedBy) + ' · ' + fmt(r.updatedAt || r.createdAt) + '</small>' : '') + '</div>' +
            '<div class="vactions"><button class="btn small primary" data-act="saveV" data-id="' + r.id + '">저장</button></div>' +
            '</div>';
        }).join('') + '</div>';
    }

    var w = gw(g);
    out += section('N', '🌟 AI가 제시하지 못한 우리 모둠만의 아이디어');
    out += '<div class="card accent ph-N">' +
      conflictBox('uniq.' + g) +
      ta('uniq.' + g, w.uniqueIdea, 'AI 답변에는 없었지만, 우리 모둠이 토의하며 새로 떠올린 아이디어를 적어요.', 5) +
      '<div class="btn-row"><button class="btn primary ph-N" data-act="saveUniq">저장</button>' +
      (w.uniqueIdeaAt ? '<span class="meta">마지막 저장: ' + esc(w.uniqueIdeaBy || '') + ' · ' + fmt(w.uniqueIdeaAt) + '</span>' : '') + '</div>' +
      '</div>';
    return out;
  }

  /* ==================================================================
   * K — 재구성과 내면화
   * ================================================================== */
  function myTBox(c, title) {
    return '<div class="mine"><h3>💭 ' + (title || '나의 처음 생각 (T단계)') + '</h3>' +
      (c && (c.claim || c.reason || c.solution) ? tCardBody(c) : '<div class="empty">T단계 카드가 없어요.</div>') + '</div>';
  }
  function renderK() {
    var out = phaseHead('K', true);
    if (isTeacher()) {
      var g = myGroup();
      var mem = membersOf(g);
      if (!mem.length) return out + '<div class="empty">이 모둠에는 아직 입장한 학생이 없어요.</div>';
      mem.forEach(function (s) {
        var f = S.d.finalsById[s.id] || {};
        out += section('K', esc(s.name), f.updatedAt ? '<small>' + fmt(f.updatedAt) + '</small>' : '<span class="status">아직 작성 전</span>');
        out += '<div class="compare">' + myTBox(S.d.tcardsById[s.id], s.name + '의 처음 생각 (T)') +
          '<div class="card accent ph-K"><dl class="tfields" style="--t:var(--k)">' +
          '<dt>최종 결과물</dt><dd>' + orDash(f.text) + '</dd>' +
          KFIELDS.map(function (x) { return '<dt>' + x.label + '</dt><dd>' + orDash(f[x.f]) + '</dd>'; }).join('') +
          '</dl></div></div>';
      });
      return out;
    }

    var f = S.d.finalsById[me().id] || {};
    out += section('K', '🏁 최종 결과물');
    out += '<div class="card accent ph-K">' +
      '<label class="lbl">최종 결과물 (글)</label>' + ta('K.text', f.text, '모둠 활동을 거쳐 완성한 나의 최종 주장과 해결 방안을 적어요.', 7) +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="saveFinal">저장</button>' +
      (f.updatedAt ? '<span class="meta">마지막 저장 ' + fmt(f.updatedAt) + '</span>' : '') + '</div>' +
      '</div>';

    out += section('K', '🪞 성찰 — 처음 생각과 비교해요');
    out += '<div class="compare">' + myTBox(S.d.tcardsById[me().id]) +
      '<div class="card accent ph-K">' +
      KFIELDS.map(function (x) { return '<label class="lbl">' + x.label + '</label>' + ta('K.' + x.f, f[x.f], x.ph, 4); }).join('') +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="saveFinal">성찰 저장</button></div>' +
      '</div></div>';
    return out;
  }

  /* ==================================================================
   * 전체 흐름
   * ================================================================== */
  function timeline(sid) {
    var s = S.d.studentsById[sid];
    if (!s) return '<div class="empty">학생 정보를 찾을 수 없어요.</div>';
    var g = s.group;
    var c = S.d.tcardsById[sid];
    var qs = groupQs(g);
    var written = S.d.comments.filter(function (x) { return x.authorId === sid; });
    var received = commentsOn('H', 'tcard', sid);
    var w = gw(g);
    var rows = groupVerify(g);
    var f = S.d.finalsById[sid] || {};

    function item(k, body) {
      return '<div class="tl-item ph-' + k + '"><div class="tl-dot">' + k + '</div><div class="tl-body"><h3>' + PH[k].icon + ' ' + PH[k].title +
        (isOpen(k) ? '' : ' <span class="status">🔒 잠김</span>') + '</h3>' + body + '</div></div>';
    }

    var tBody = tStatus(c) + '<div style="margin-top:10px">' + tCardBody(c) + '</div>';
    var hBody = '<div class="sub">❓ 모둠 AI 질문 (' + qs.length + '개)</div>' +
      (qs.length ? '<ol class="mini-list">' + qs.map(function (q) { return '<li>' + esc(q.text) + '</li>'; }).join('') + '</ol>' : '<small>아직 없음</small>') +
      '<div class="sub">💬 댓글: 내가 쓴 댓글 ' + written.length + '개 · 내 카드가 받은 댓글 ' + received.length + '개</div>' +
      received.map(commentTable).join('');
    var iBody = '<div class="sub">🤖 AI 답변을 우리 말로 정리</div>' +
      (qs.length ? '<ol class="mini-list">' + qs.map(function (q) {
        var a = S.d.aianswersById[q.id] || {};
        return '<li><b>' + esc(q.text) + '</b><br>' + (a.summary ? nl(a.summary) + ' <small>(' + esc(a.tool || 'AI') + (a.hasSource ? ', 출처 있음' : ', 출처 없음') + ')</small>' : '<small>아직 정리 전</small>') + '</li>';
      }).join('') + '</ol>' : '<small>아직 없음</small>') +
      '<div class="sub">🧩 모둠 중간 해결안</div>' + orDash(w.solution);
    var nBody = '<div class="sub">🔍 검증 결과</div>' +
      (rows.length ? '<ul class="mini-list" style="list-style:none;padding:0">' + rows.map(function (r) {
        return '<li><span class="badge-dec b-' + (r.decision || '없음') + '">' + (r.decision || '판단 전') + '</span>' + esc(r.info) +
          (r.reason ? '<br><small>근거: ' + esc(r.reason) + '</small>' : '') + '</li>';
      }).join('') + '</ul>' : '<small>아직 없음</small>') +
      '<div class="sub">🌟 우리 모둠만의 아이디어</div>' + orDash(w.uniqueIdea);
    var kBody = '<div class="sub">🏁 최종 결과물</div>' + orDash(f.text) +
      KFIELDS.map(function (x) { return '<div class="sub">' + x.label + '</div>' + orDash(f[x.f]); }).join('');

    return '<div class="timeline">' + item('T', tBody) + item('H', hBody) + item('I', iBody) + item('N', nBody) + item('K', kBody) + '</div>';
  }

  function renderFlowTab() {
    var head = '<div class="phase-head ph-F"><div class="big">🗺️</div><div><h2>전체 흐름</h2><p class="q">' +
      (isTeacher() ? '모둠별·학생별로 T부터 K까지의 기록을 한눈에 봐요.' : '나의 생각이 T에서 K까지 어떻게 이어졌는지 돌아봐요.') + '</p></div>';

    if (!isTeacher()) return head + '</div>' + timeline(me().id);

    if (S.flowStudent) {
      var st = S.d.studentsById[S.flowStudent];
      return head + '</div><div class="btn-row" style="margin:0 0 16px"><button class="btn" data-act="flowBack">← 전체 보기로</button>' +
        (st ? '<b style="font-size:1.2rem">' + esc(st.group) + ' · ' + esc(st.name) + '의 타임라인</b>' : '') + '</div>' + timeline(S.flowStudent);
    }

    head += '<div class="pick"><label class="lbl" style="margin-top:0">볼 모둠</label><select data-change="flowGroup">' +
      '<option value="all"' + (S.flowGroup === 'all' ? ' selected' : '') + '>전체 모둠</option>' +
      L().groups.map(function (g) { return '<option' + (S.flowGroup === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') +
      '</select></div></div>';

    var groups = S.flowGroup === 'all' ? L().groups : [S.flowGroup];
    return head + groups.map(function (g) {
      var qs = groupQs(g), rows = groupVerify(g), w = gw(g);
      var answered = qs.filter(function (q) { var a = S.d.aianswersById[q.id]; return a && a.summary; }).length;
      var cnt = { '수용': 0, '수정': 0, '제외': 0 };
      rows.forEach(function (r) { if (cnt[r.decision] != null) cnt[r.decision]++; });
      var mem = membersOf(g);
      return '<div class="section ph-F"><span class="tag">' + esc(g) + '</span><h2>모둠 기록</h2></div>' +
        '<div class="card">' +
        '<div class="grid2">' +
        '<div><div class="sub" style="font-weight:800;color:var(--h)">H · AI 질문 ' + qs.length + '개</div>' +
        (qs.length ? '<ol class="mini-list">' + qs.map(function (q) { return '<li>' + esc(q.text) + '</li>'; }).join('') + '</ol>' : '<small>없음</small>') + '</div>' +
        '<div><div class="sub" style="font-weight:800;color:var(--i)">I · 답변 정리 ' + answered + '/' + qs.length + ' · 중간 해결안</div>' + orDash(w.solution) + '</div>' +
        '<div><div class="sub" style="font-weight:800;color:var(--n)">N · 검증 ' + rows.length + '행</div>' +
        '<div class="vsum">' + DECISIONS.map(function (d) { return '<span class="b-' + d.v + '">' + d.v + ' ' + cnt[d.v] + '</span>'; }).join('') + '</div></div>' +
        '<div><div class="sub" style="font-weight:800;color:var(--n)">N · 우리 모둠만의 아이디어</div>' + orDash(w.uniqueIdea) + '</div>' +
        '</div></div>' +
        (mem.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>이름</th><th>T 초기 주장</th><th>H 댓글<br>(쓴/받은)</th><th>K 최종 결과물</th><th>K 바뀐 생각</th><th></th></tr></thead><tbody>' +
          mem.map(function (s) {
            var c = S.d.tcardsById[s.id] || {}, f = S.d.finalsById[s.id] || {};
            var wr = S.d.comments.filter(function (x) { return x.authorId === s.id; }).length;
            var rc = commentsOn('H', 'tcard', s.id).length;
            return '<tr><td><b>' + esc(s.name) + '</b></td><td><div class="clip">' + orDash(c.claim) + '</div></td>' +
              '<td class="c">' + wr + ' / ' + rc + '</td><td><div class="clip">' + orDash(f.text) + '</div></td>' +
              '<td><div class="clip">' + orDash(f.changed) + '</div></td>' +
              '<td><button class="btn small" data-act="flowStudent" data-id="' + s.id + '">타임라인</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">학생 없음</div>');
    }).join('');
  }

  /* ==================================================================
   * 교사 관리
   * ================================================================== */
  function progressRows() {
    return L().groups.map(function (g) {
      var qs = groupQs(g), rows = groupVerify(g);
      var answered = qs.filter(function (q) { var a = S.d.aianswersById[q.id]; return a && (a.summary || a.answer); }).length;
      var judged = rows.filter(function (r) { return r.decision && r.reason; }).length;
      return { g: g, qs: qs, rows: rows, answered: answered, judged: judged, mem: membersOf(g) };
    });
  }

  function renderAdmin() {
    var l = L();
    var out = '<div class="phase-head ph-A"><div class="big">⚙️</div><div><h2>교사 관리</h2><p class="q">단계를 열고 잠그며 수업 흐름을 조절해요. 가장 뒤에 열린 단계가 "지금 단계"로 표시돼요.</p></div></div>';

    /* 1. 단계 열기·잠그기 */
    out += section('A', '🔓 단계 열기·잠그기');
    out += PHASES.map(function (p) {
      return '<div class="phase-toggle ph-' + p.k + '"><span class="badge">' + p.k + '</span><div><b>' + p.title + '</b><small>' + p.short +
        (curPhase() === p.k ? ' · <b style="color:var(--c)">지금 단계</b>' : '') + '</small></div>' +
        '<button class="btn ' + (isOpen(p.k) ? 'on' : 'off') + '" data-act="togglePhase" data-k="' + p.k + '">' + (isOpen(p.k) ? '🔓 열림' : '🔒 잠김') + '</button></div>';
    }).join('');

    /* 1-2. 모둠별 학생 명단 (강퇴·삭제) */
    var total = S.d.students.length;
    out += section('A', '👥 모둠별 학생 명단', '<small>' + esc(S.classId) + ' · 입장한 학생 ' + total + '명 · 🟢 접속 중</small>');
    out += '<div class="roster">' + L().groups.concat(
      // 모둠 목록에서 빠진 모둠에 남아 있는 학생도 보이게
      S.d.students.map(function (s) { return s.group; }).filter(function (g, i, arr) { return L().groups.indexOf(g) < 0 && arr.indexOf(g) === i; })
    ).map(function (g) {
      var mem = membersOf(g);
      return '<div class="roster-col"><div class="roster-head">' + esc(g) + ' <span>' + mem.length + '명</span></div>' +
        (mem.length ? mem.map(function (s) {
          return '<div class="roster-row">' +
            '<span class="dotx ' + (isOnline(s.id) ? 'on' : '') + '"></span>' +
            '<span class="rname">' + esc(s.name) + '</span>' +
            '<button class="btn small ghost" data-act="kickStudent" data-id="' + s.id + '" title="학생 화면을 입장 화면으로 돌려보내요. 기록은 남아요.">내보내기</button>' +
            '<button class="btn small ghost danger" data-act="deleteStudent" data-id="' + s.id + '" title="명단과 개인 기록을 지워요.">삭제</button>' +
            '</div>';
        }).join('') : '<div class="roster-empty">아직 없어요</div>') + '</div>';
    }).join('') + '</div>';
    out += '<p style="margin:8px 0 0"><small><b>내보내기</b>: 학생 화면을 입장 화면으로 돌려보내요. 기록은 남아요. (다른 자리에서 잘못 로그인했을 때)<br>' +
      '<b>삭제</b>: 이름·모둠을 잘못 쓰고 들어온 경우, 명단과 그 학생의 개인 기록을 지워요.</small></p>';

    /* 2. 진행 현황표 */
    var prog = progressRows();
    var all = S.d.students;
    var tDone = all.filter(function (s) { var c = S.d.tcardsById[s.id]; return c && c.submitted; }).length;
    var kDone = all.filter(function (s) { var f = S.d.finalsById[s.id]; return f && f.text; }).length;
    var qTotal = S.d.questions.length;
    var aTotal = prog.reduce(function (n, p) { return n + p.answered; }, 0);
    var vTotal = prog.reduce(function (n, p) { return n + p.judged; }, 0);
    out += section('A', '📊 학급 전체 진행 현황',
      '<button class="btn small" data-act="exportCSV">📥 학생 기록 엑셀(CSV)</button> <button class="btn small" data-act="exportComments">📥 댓글 엑셀(CSV)</button>');
    out += '<div class="stat-row">' +
      '<div class="stat ph-T"><b>' + tDone + '/' + all.length + '</b><span>T 카드 제출</span></div>' +
      '<div class="stat ph-H"><b>' + qTotal + '</b><span>H AI 질문 수</span></div>' +
      '<div class="stat ph-I"><b>' + aTotal + '/' + qTotal + '</b><span>I 답변 기록</span></div>' +
      '<div class="stat ph-N"><b>' + vTotal + '</b><span>N 판단 완료 행</span></div>' +
      '<div class="stat ph-K"><b>' + kDone + '/' + all.length + '</b><span>K 최종 결과물</span></div></div>';
    out += '<div class="table-wrap"><table class="data"><thead><tr><th>접속</th><th>이름</th><th>T 카드</th><th>H 댓글 쓴 수</th><th>H 질문</th><th>I 답변 기록</th><th>N 검증</th><th>K 최종</th><th>K 성찰</th></tr></thead><tbody>' +
      prog.map(function (p) {
        return '<tr class="grp"><td colspan="9">' + esc(p.g) + ' · ' + p.mem.length + '명 · 질문 ' + p.qs.length + '개 · AI 답변 ' + p.answered + '/' + p.qs.length + ' · 검증 판단 ' + p.judged + '/' + p.qs.length + ' · 중간 해결안 ' + (gw(p.g).solution ? '✅' : '—') +
          ' · 우리 아이디어 ' + (gw(p.g).uniqueIdea ? '✅' : '—') + '</td></tr>' +
          (p.mem.length ? p.mem.map(function (s) {
            var c = S.d.tcardsById[s.id], f = S.d.finalsById[s.id] || {};
            var wr = S.d.comments.filter(function (x) { return x.authorId === s.id; }).length;
            var refl = KFIELDS.filter(function (x) { return f[x.f]; }).length;
            return '<tr><td class="c">' + (isOnline(s.id) ? '🟢' : '⚪') + '</td><td><b>' + esc(s.name) + '</b></td>' +
              '<td>' + tStatus(c) + '</td><td class="c">' + wr + '</td>' +
              ['H', 'I', 'N'].map(function (ph) { return '<td class="c">' + (DID[ph](s) ? '✅' : '—') + '</td>'; }).join('') +
              '<td class="c">' + (f.text ? '✅' : '—') + '</td><td class="c">' + refl + '/' + KFIELDS.length + '</td></tr>';
          }).join('') : '<tr><td colspan="9"><small>아직 입장한 학생이 없어요.</small></td></tr>');
      }).join('') + '</tbody></table></div>';

    /* 3. 수업 설정 */
    out += section('A', '📝 수업명과 단계별 질문');
    out += '<div class="card"><div class="grid2">' +
      '<div><label class="lbl">과목</label>' + inp('set.subject', l.subject, '예) 과학') + '</div>' +
      '<div><label class="lbl">교사 코드</label>' + inp('set.code', l.teacherCode, '교사 입장 코드') + '</div>' +
      '</div>' +
      '<label class="lbl">수업명</label>' + inp('set.title', l.title, '수업 주제') +
      '<label class="lbl">모둠 목록 <small>쉼표(,)로 구분</small></label>' + inp('set.groups', l.groups.join(', '), '1모둠, 2모둠, 3모둠') +
      PHASES.map(function (p) {
        return '<label class="lbl ph-' + p.k + '"><span style="color:var(--c)">' + p.k + '</span> · ' + p.title + ' 단계 질문</label>' +
          '<div class="ph-' + p.k + '">' + ta('set.prompt.' + p.k, l.prompts[p.k], p.title + ' 단계에서 학생에게 보여 줄 질문', 2) + '</div>';
      }).join('') +
      '<div class="btn-row"><button class="btn primary" data-act="saveSettings">설정 저장</button></div></div>';

    /* 4. 댓글 양식 */
    out += section('A', '💬 댓글 표 양식 (단계별)');
    out += '<div class="grid2">' + COMMENT_PHASES.map(function (ph) {
      if (!S.cfEdit[ph]) S.cfEdit[ph] = l.commentFields[ph].slice();
      var list = S.cfEdit[ph];
      return '<div class="card accent ph-' + ph + '"><h3 style="color:var(--c);margin-bottom:10px">' + ph + ' 단계 댓글 항목</h3>' +
        list.map(function (name, i) {
          return '<div class="field-edit"><span class="n">' + (i + 1) + '</span>' +
            '<input type="text" data-cf="' + ph + '.' + i + '" value="' + esc(name) + '" placeholder="항목 이름">' +
            '<button class="btn small ghost danger" data-act="removeField" data-ph="' + ph + '" data-i="' + i + '"' + (list.length <= 1 ? ' disabled' : '') + '>삭제</button></div>';
        }).join('') +
        '<div class="btn-row"><button class="btn small" data-act="addField" data-ph="' + ph + '">＋ 항목 추가</button>' +
        '<button class="btn small primary" data-act="saveFields" data-ph="' + ph + '">양식 저장</button></div>' +
        '<div style="margin-top:14px"><small>미리 보기</small><table class="ctable">' +
        list.map(function (n) { return '<tr><th>' + esc(n || '(빈 항목)') + '</th><td><small>(학생 입력)</small></td></tr>'; }).join('') + '</table></div>' +
        '<small>※ 이미 등록된 댓글은 쓸 때의 양식 그대로 보여요.</small></div>';
    }).join('') + '</div>';

    /* 5. 반 관리 */
    out += section('A', '🏫 반 관리');
    out += '<div class="card"><p style="margin-top:0">반마다 기록과 단계 열림 상태가 따로 저장돼요. 지금은 <b>' + esc(S.classId) + '</b>을(를) 보고 있어요. ' +
      '다른 반은 "나가기" 후 입장 화면에서 반을 바꿔 들어가요.</p>' +
      '<label class="lbl">반 목록 <small>쉼표(,)로 구분</small></label>' + inp('cls.list', S.classes.join(', '), '1반, 2반, 3반') +
      '<div class="btn-row"><button class="btn" data-act="saveClasses">반 목록 저장</button></div>' +
      '<label class="lbl">수업 설정을 모든 반에 똑같이 적용</label>' +
      '<p style="margin:0"><small>지금 반의 수업명·과목·교사 코드·모둠 목록·단계별 질문·댓글 양식을 다른 반에도 그대로 복사해요. (단계 열림 상태와 학생 기록은 복사하지 않아요)</small></p>' +
      '<div class="btn-row"><button class="btn" data-act="copySettings">📋 모든 반에 적용</button></div></div>';

    /* 6. 데이터 관리 */
    out += section('A', '♻️ 데이터 관리');
    out += '<div class="card">' +
      (DataStore.mode === 'local'
        ? '<p style="margin-top:0">지금은 <b>화면 확인용</b>이라 데이터가 이 브라우저 안에만 저장돼요. firebase-config.js에 Firebase 설정을 넣으면 여러 기기가 함께 쓸 수 있어요.</p>'
        : '<p style="margin-top:0">☁️ <b>Firebase에 저장 중</b>이에요. 학생 기기들과 실시간으로 공유돼요.</p>') +
      '<label class="lbl">반을 처음 상태로</label>' +
      '<div class="btn-row" style="margin-top:4px">' + S.classes.map(function (c) {
        return c === DataStore.TEST_CLASS
          ? '<button class="btn" data-act="resetData" data-class="' + esc(c) + '">🧪 ' + esc(c) + ' 처음 상태로</button>'
          : '<button class="btn danger" data-act="resetData" data-class="' + esc(c) + '">🧹 ' + esc(c) + ' 비우기</button>';
      }).join('') + '</div>' +
      '<p style="margin-bottom:0"><small><b>비우기</b>: 그 반의 학생 명단과 기록이 모두 지워지고, 수업 설정(수업명·질문·댓글 양식)만 남아요. ' +
      '그 반 학생들은 입장 화면으로 돌아가요. 지우기 전에 그 반으로 들어가 엑셀(CSV)을 먼저 내려받아 두세요.<br>' +
      '<b>' + esc(DataStore.TEST_CLASS) + '</b> 반은 연습용이에요. 가짜 학생 12명의 샘플 기록이 들어 있고, "처음 상태로"를 누르면 샘플 기록으로 되돌아가요.</small></p></div>';
    return out;
  }

  /* ------------------------------------------------------------------
   * CSV 내보내기 (엑셀에서 한글이 깨지지 않도록 BOM 포함)
   * ------------------------------------------------------------------ */
  function csvCell(v) {
    v = String(v == null ? '' : v);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function downloadCSV(name, rows) {
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function today() { var d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }

  /* ------------------------------------------------------------------
   * 동작 (버튼)
   * ------------------------------------------------------------------ */
  function connectNow() {
    var u = S.user;
    S.connecting = (S.connecting || 0) + 1;
    function end() { S.connecting--; }
    return DataStore.connect({
      classId: S.classId,
      role: u ? u.role : 'guest',
      group: u ? u.group : '',
      userId: u ? u.id : ''
    }).then(end, function (e) { end(); throw e; });
  }
  // 선생님이 이 학생을 내보내거나 삭제했으면 입장 화면으로
  function checkStillHere() {
    var u = S.user;
    if (!u || u.role !== 'student' || S.connecting) return false;
    var s = S.d.studentsById[u.id];
    var msg = !s ? '선생님이 명단에서 삭제했어요. 이름과 모둠을 확인하고 다시 들어와 주세요.'
      : ((s.kickedAt || 0) !== (u.kickSeen || 0)) ? '선생님이 입장 화면으로 돌려보냈어요.' : '';
    if (!msg) return false;
    setUser(null).then(function () { toast(msg); });
    return true;
  }
  function setUser(u) {
    S.user = u;
    if (u) u.classId = S.classId;   // u.kickSeen: 입장할 때 본 "내보내기" 기록 (기기 시계와 무관하게 비교)
    try {
      if (u) sessionStorage.setItem('think-user', JSON.stringify(u));
      else sessionStorage.removeItem('think-user');
    } catch (e) { /* 무시 */ }
    S.tab = null; S.drafts = {}; S.base = {}; S.conflict = {}; S.editingQ = null; S.flowStudent = null; S.cfEdit = {};
    return connectNow().then(function () { return refresh(true); }).then(function () {
      heartbeat();
      loadPresence();
      syncVerifyAndRefresh();
      window.scrollTo(0, 0);
    });
  }

  function saveT(submit) {
    var c = S.d.tcardsById[me().id] || {};
    if (c.submitted) return toast('이미 제출한 카드예요');
    var v = {};
    TFIELDS.forEach(function (f) { v[f.f] = take('T.' + f.f, c[f.f]); });
    if (submit && (!v.claim || !v.reason || !v.solution)) return toast('주장, 근거, 해결 방안을 모두 채워 주세요');
    var go = submit
      ? ask({ title: '제출할까요?', msg: '제출하면 더 이상 수정할 수 없어요.', ok: '제출하기' })
      : Promise.resolve(true);
    return go.then(function (yes) {
      if (!yes) return;
      clearDrafts('T');
      var data = Object.assign(v, { group: me().group, submitted: !!submit, updatedAt: Date.now() });
      if (submit) data.submittedAt = Date.now();
      return DataStore.setDoc('tcards', me().id, data, { merge: true }).then(function () { return done(submit ? '제출했어요! 🎉' : '임시 저장했어요'); });
    });
  }

  var A = {
    tab: function (el) {
      S.tab = el.dataset.tab; S.flowStudent = null; S.editingQ = null;
      render();
      syncVerifyAndRefresh();
    },
    logout: function () {
      if (S.user) DataStore.clearPresence(S.user.id);
      return setUser(null);
    },
    loginStudent: function (el) {
      var name = take('login.name').replace(/\s+/g, ' ');
      var group = dv('login.group', L().groups[0]);
      if (L().groups.indexOf(group) < 0) group = L().groups[0];
      if (!name) return toast('이름을 입력해 주세요');
      if (el) el.disabled = true;
      // 같은 반·같은 모둠에 같은 이름이 있으면 그 학생으로 이어서 입장
      return DataStore.findDocs('students', { name: name, group: group }).then(function (list) {
        var found = list[0];
        if (found) return setUser({ role: 'student', id: found.id, name: found.name, group: found.group, kickSeen: found.kickedAt || 0 });
        return DataStore.addDoc('students', { name: name, group: group, createdAt: Date.now() }).then(function (id) {
          return setUser({ role: 'student', id: id, name: name, group: group }).then(function () { toast(name + '님, 환영해요!'); });
        });
      }).catch(function (e) {
        if (el) el.disabled = false;
        throw e;
      });
    },
    quickLogin: function (el) {
      var s = S.d.studentsById[el.dataset.id];
      if (s) setUser({ role: 'student', id: s.id, name: s.name, group: s.group, kickSeen: s.kickedAt || 0 });
    },
    loginTeacher: function () {
      if (take('login.code') !== String(L().teacherCode)) return toast('교사 코드가 맞지 않아요');
      setUser({ role: 'teacher', id: 'teacher', name: '선생님', group: '' });
    },

    /* T */
    saveTDraft: function () { return saveT(false); },
    submitT: function () { return saveT(true); },
    unlockT: function (el) {
      var s = S.d.studentsById[el.dataset.id];
      return ask({ title: '제출 취소', msg: (s ? s.name : '') + ' 학생의 제출을 취소하고 다시 수정할 수 있게 할까요?', ok: '제출 취소하기' }).then(function (yes) {
        if (!yes) return;
        return DataStore.setDoc('tcards', el.dataset.id, { submitted: false }, { merge: true }).then(function () { return done('제출을 취소했어요'); });
      });
    },

    /* 댓글 */
    addComment: function (el) {
      var phase = el.dataset.phase, tt = el.dataset.tt, tid = el.dataset.tid;
      var prefix = 'c.' + phase + '.' + tt + '.' + tid;
      var fields = L().commentFields[phase].map(function (label, i) { return { label: label, value: take(prefix + '.' + i) }; });
      if (fields.some(function (f) { return !f.value; })) return toast('표의 모든 칸을 채워 주세요');
      if (phase === 'H' && commentsOn(phase, tt, tid).length >= MAX_H_COMMENTS) { render(); return toast('🔒 이 카드는 댓글 ' + MAX_H_COMMENTS + '개가 이미 찼어요'); }
      clearDrafts(prefix);
      return DataStore.addDoc('comments', {
        phase: phase, targetType: tt, targetId: tid,
        targetGroup: tt === 'tcard' ? ((S.d.studentsById[tid] || {}).group || '') : tid,
        authorId: me().id, authorName: me().name, authorGroup: me().group || '',
        fields: fields, createdAt: Date.now()
      }).then(function () { return done('댓글을 등록했어요'); });
    },
    delComment: function (el) {
      return ask({ title: '댓글 삭제', msg: '이 댓글을 삭제할까요?', ok: '삭제', danger: true }).then(function (yes) {
        if (!yes) return;
        return DataStore.deleteDoc('comments', el.dataset.id).then(function () { return done('삭제했어요'); });
      });
    },

    /* H 질문 */
    addQ: function () {
      var text = take('qnew');
      if (!text) return toast('질문을 입력해 주세요');
      clearDrafts('qnew');
      return DataStore.addDoc('questions', { group: myGroup(), text: text, createdAt: Date.now(), createdBy: me().name, createdById: me().id })
        .then(function () { return done('질문을 추가했어요'); });
    },
    editQ: function (el) { S.editingQ = el.dataset.id; render(); },
    cancelQ: function () { if (S.editingQ) clearDrafts('qe.' + S.editingQ); S.editingQ = null; render(); },
    saveQ: function (el) {
      var id = el.dataset.id, q = S.d.questionsById[id];
      var text = take('qe.' + id, q && q.text);
      if (!text) return toast('질문 내용을 입력해 주세요');
      return okToSave('qe.' + id).then(function (ok) {
        if (!ok) return;
        clearDrafts('qe.' + id);
        S.editingQ = null;
        return DataStore.setDoc('questions', id, { text: text, updatedBy: me().name, updatedAt: Date.now() }, { merge: true }).then(function () { return done('질문을 수정했어요'); });
      });
    },
    delQ: function (el) {
      var id = el.dataset.id;
      var hasAns = !!S.d.aianswersById[id];
      return ask({ title: '질문 삭제', msg: hasAns ? '이 질문에는 AI 답변 기록도 있어요. 함께 삭제할까요?' : '이 질문을 삭제할까요?', ok: '삭제', danger: true }).then(function (yes) {
        if (!yes) return;
        return DataStore.deleteDoc('questions', id)
          .then(function () { return hasAns ? DataStore.deleteDoc('aianswers', id) : null; })
          .then(function () { return done('삭제했어요'); });
      });
    },

    /* I */
    saveAI: function (el) {
      var id = el.dataset.id, a = S.d.aianswersById[id] || {}, k = 'ai.' + id;
      var data = {
        group: myGroup(),
        answer: take(k + '.answer', a.answer),
        tool: take(k + '.tool', a.tool),
        hasSource: !!dv(k + '.hasSource', !!a.hasSource),
        sourceNote: take(k + '.sourceNote', a.sourceNote),
        summary: take(k + '.summary', a.summary),
        updatedBy: me().name, updatedAt: Date.now()
      };
      data['c_' + me().id] = Date.now();   // 참여 기록 (한 명당 1개 이상 확인용)
      var g = myGroup();
      return okToSave(k).then(function (ok) {
        if (!ok) return;
        clearDrafts(k);
        return DataStore.setDoc('aianswers', id, data, { merge: true })
          .then(function () { return refresh(true); })
          .then(function () { return syncVerify(g); })
          .then(function (n) { return done(n ? 'AI 답변을 저장했어요 · N단계 검증표에도 반영됐어요' : 'AI 답변 기록을 저장했어요'); });
      });
    },
    saveSol: function () {
      var g = myGroup();
      var text = take('sol.' + g, gw(g).solution);
      return okToSave('sol.' + g).then(function (ok) {
        if (!ok) return;
        clearDrafts('sol.' + g);
        return DataStore.setDoc('groupwork', g, { solution: text, solutionBy: me().name, solutionAt: Date.now() }, { merge: true })
          .then(function () { return done('중간 해결안을 저장했어요'); });
      });
    },

    /* N */
    saveV: function (el) {
      var id = el.dataset.id, r = S.d.verifyById[id] || {}, k = 'v.' + id;
      var data = {
        info: take(k + '.info', r.info),
        decision: String(dv(k + '.decision', r.decision || '')),
        reason: take(k + '.reason', r.reason),
        updatedBy: me().name, updatedAt: Date.now()
      };
      // N단계에서 AI 정보 문장을 직접 고쳤으면, 이후 I단계 수정이 덮어쓰지 않도록 표시
      data.infoEdited = !!r.infoEdited || data.info !== (r.info || '');
      data['c_' + me().id] = Date.now();   // 참여 기록
      if (data.decision && !data.reason) return toast('판단 근거도 함께 적어 주세요');
      return okToSave(k).then(function (ok) {
        if (!ok) return;
        clearDrafts(k);
        return DataStore.setDoc('verify', id, data, { merge: true }).then(function () { return done('검증 내용을 저장했어요'); });
      });
    },
    saveUniq: function () {
      var g = myGroup();
      var text = take('uniq.' + g, gw(g).uniqueIdea);
      return okToSave('uniq.' + g).then(function (ok) {
        if (!ok) return;
        clearDrafts('uniq.' + g);
        return DataStore.setDoc('groupwork', g, { uniqueIdea: text, uniqueIdeaBy: me().name, uniqueIdeaAt: Date.now() }, { merge: true })
          .then(function () { return done('우리 모둠 아이디어를 저장했어요'); });
      });
    },

    /* K */
    saveFinal: function () {
      var f = S.d.finalsById[me().id] || {};
      var data = { text: take('K.text', f.text), updatedAt: Date.now() };
      KFIELDS.forEach(function (x) { data[x.f] = take('K.' + x.f, f[x.f]); });
      clearDrafts('K');
      return DataStore.setDoc('finals', me().id, data, { merge: true }).then(function () { return done('저장했어요'); });
    },

    /* 전체 흐름 */
    flowStudent: function (el) { S.flowStudent = el.dataset.id; render(); window.scrollTo(0, 0); },
    flowBack: function () { S.flowStudent = null; render(); },

    /* 교사 관리 */
    togglePhase: function (el) {
      var open = Object.assign({}, L().open);
      open[el.dataset.k] = !open[el.dataset.k];
      return DataStore.setDoc('config', 'lesson', { open: open }, { merge: true })
        .then(function () { return done(el.dataset.k + ' 단계를 ' + (open[el.dataset.k] ? '열었어요' : '잠갔어요')); });
    },
    saveSettings: function () {
      var l = L();
      var groups = take('set.groups', l.groups.join(', ')).split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!groups.length) return toast('모둠을 하나 이상 입력해 주세요');
      var used = S.d.students.map(function (s) { return s.group; }).filter(function (g) { return groups.indexOf(g) < 0; });
      var prompts = {};
      PK.forEach(function (k) { prompts[k] = take('set.prompt.' + k, l.prompts[k]); });
      var data = {
        subject: take('set.subject', l.subject),
        title: take('set.title', l.title) || l.title,
        teacherCode: take('set.code', l.teacherCode) || l.teacherCode,
        groups: groups, prompts: prompts
      };
      var go = used.length
        ? ask({ title: '모둠 목록 확인', msg: '학생이 있는 모둠(' + used.filter(function (g, i) { return used.indexOf(g) === i; }).join(', ') + ')이 목록에서 빠져요. 그래도 저장할까요?', ok: '저장' })
        : Promise.resolve(true);
      return go.then(function (yes) {
        if (!yes) return;
        clearDrafts('set');
        return DataStore.setDoc('config', 'lesson', data, { merge: true }).then(function () { return done('수업 설정을 저장했어요'); });
      });
    },
    addField: function (el) { S.cfEdit[el.dataset.ph].push(''); render(); },
    removeField: function (el) {
      var list = S.cfEdit[el.dataset.ph];
      if (list.length <= 1) return;
      list.splice(+el.dataset.i, 1);
      render();
    },
    saveFields: function (el) {
      var ph = el.dataset.ph;
      var list = S.cfEdit[ph].map(function (x) { return x.trim(); }).filter(Boolean);
      if (!list.length) return toast('항목을 하나 이상 입력해 주세요');
      var cf = Object.assign({}, L().commentFields);
      cf[ph] = list;
      S.cfEdit[ph] = null;
      return DataStore.setDoc('config', 'lesson', { commentFields: cf }, { merge: true }).then(function () { return done(ph + ' 단계 댓글 양식을 저장했어요'); });
    },
    resetData: function (el) {
      var c = el.dataset.class || S.classId;
      var sample = c === DataStore.TEST_CLASS;
      return ask({
        title: sample ? c + ' 처음 상태로' : c + ' 비우기',
        msg: c + '의 학생 명단과 기록이 모두 지워지고 ' + (sample ? '샘플 기록으로 되돌아가요.' : '빈 수업으로 시작해요.') + '\n되돌릴 수 없어요.',
        ok: sample ? '처음 상태로' : '비우기',
        danger: true,
        input: sample ? '' : c                    // 실제 반은 반 이름을 입력해야 진행
      }).then(function (yes) {
        if (!yes) return;
        if (c === S.classId) { S.drafts = {}; S.cfEdit = {}; S.base = {}; S.conflict = {}; }
        return DataStore.resetClass({ classId: c }).then(function () { return done(sample ? c + '를 샘플 기록으로 되돌렸어요' : c + '를 비웠어요'); });
      });
    },

    /* 학생 명단: 강퇴(내보내기) / 삭제 */
    kickStudent: function (el) {
      var s = S.d.studentsById[el.dataset.id];
      if (!s) return;
      return ask({
        title: s.group + ' ' + s.name + ' 내보내기',
        msg: '학생 화면이 입장 화면으로 돌아가요.\n기록은 그대로 남아서, 같은 이름·모둠으로 다시 들어오면 이어서 쓸 수 있어요.',
        ok: '내보내기'
      }).then(function (yes) {
        if (!yes) return;
        return DataStore.setDoc('students', s.id, { kickedAt: Date.now() }, { merge: true })
          .then(function () { return DataStore.clearPresence(s.id); })
          .then(function () { return done(s.name + ' 학생을 내보냈어요'); });
      });
    },
    deleteStudent: function (el) {
      var s = S.d.studentsById[el.dataset.id];
      if (!s) return;
      var cs = S.d.comments.filter(function (c) {
        return c.authorId === s.id || (c.targetType === 'tcard' && c.targetId === s.id);
      });
      return ask({
        title: s.group + ' ' + s.name + ' 삭제',
        msg: '명단에서 삭제할까요?\n\n함께 지워지는 것: T카드, K 최종 결과물·성찰, 이 학생이 쓴 댓글과 받은 댓글 ' + cs.length + '개\n(모둠이 함께 쓴 질문·AI 답변·검증표는 남아요)\n\n되돌릴 수 없어요.',
        ok: '삭제',
        danger: true
      }).then(function (yes) {
        if (!yes) return;
        var jobs = [
          DataStore.deleteDoc('students', s.id),
          DataStore.deleteDoc('tcards', s.id),
          DataStore.deleteDoc('finals', s.id),
          DataStore.clearPresence(s.id)
        ].concat(cs.map(function (c) { return DataStore.deleteDoc('comments', c.id); }));
        return Promise.all(jobs).then(function () { return done(s.name + ' 학생을 삭제했어요'); });
      });
    },
    saveClasses: function () {
      var list = take('cls.list', S.classes.join(', ')).split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean)
        .filter(function (c, i, arr) { return arr.indexOf(c) === i; });
      if (!list.length) return toast('반을 하나 이상 입력해 주세요');
      if (list.indexOf(S.classId) < 0) list.unshift(S.classId);
      clearDrafts('cls');
      S.classes = list;
      return DataStore.saveClasses(list).then(function () { return done('반 목록을 저장했어요'); });
    },
    copySettings: function () {
      var others = S.classes.filter(function (c) { return c !== S.classId; });
      if (!others.length) return toast('다른 반이 없어요');
      var l = L();
      return ask({ title: '모든 반에 적용', msg: '지금 반(' + S.classId + ')의 수업 설정을\n' + others.join(', ') + '에 똑같이 적용할까요?', ok: '적용하기' }).then(function (yes) {
        if (!yes) return;
        return DataStore.setDocInClasses(others, 'config', 'lesson', {
          subject: l.subject, title: l.title, teacherCode: l.teacherCode, groups: l.groups,
          prompts: l.prompts, commentFields: l.commentFields
        }, { merge: true }).then(function () { return done(others.length + '개 반에 적용했어요'); });
      });
    },
    exportCSV: function () {
      var header = ['모둠', '이름', 'T 초기 주장', 'T 근거', 'T 해결 방안', 'T 제출', 'H 모둠 AI 질문', 'H 쓴 댓글 수', 'H 받은 댓글 수',
        'I AI 답변 기록(도구/출처/우리 말 정리)', 'I 모둠 중간 해결안', 'N 검증표', 'N 우리 모둠만의 아이디어',
        'K 최종 결과물'].concat(KFIELDS.map(function (x) { return 'K ' + x.label; }));
      var rows = [header];
      L().groups.concat(S.d.students.map(function (s) { return s.group; }))
        .filter(function (g, i, arr) { return arr.indexOf(g) === i; })
        .forEach(function (g) {
          var qs = groupQs(g), w = gw(g);
          var qText = qs.map(function (q, i) { return 'Q' + (i + 1) + '. ' + q.text; }).join('\n');
          var aText = qs.map(function (q, i) {
            var a = S.d.aianswersById[q.id];
            return a ? 'Q' + (i + 1) + ' [' + (a.tool || 'AI') + ' / 출처 ' + (a.hasSource ? '있음' : '없음') + '] ' + (a.summary || '') : '';
          }).filter(Boolean).join('\n');
          var vText = groupVerify(g).map(function (r) { return '[' + (r.decision || '판단 전') + '] ' + r.info + (r.reason ? ' — 근거: ' + r.reason : ''); }).join('\n');
          membersOf(g).forEach(function (s) {
            var c = S.d.tcardsById[s.id] || {}, f = S.d.finalsById[s.id] || {};
            rows.push([g, s.name, c.claim, c.reason, c.solution, c.submitted ? '제출 ' + fmt(c.submittedAt) : '미제출', qText,
              S.d.comments.filter(function (x) { return x.authorId === s.id; }).length,
              commentsOn('H', 'tcard', s.id).length,
              aText, w.solution, vText, w.uniqueIdea, f.text].concat(KFIELDS.map(function (x) { return f[x.f]; })));
          });
        });
      downloadCSV('THINK_' + S.classId + '_학생기록_' + today() + '.csv', rows);
      toast('학생 기록 CSV를 내려받았어요');
    },
    exportComments: function () {
      var rows = [['단계', '작성 시각', '작성자 모둠', '작성자', '대상', '댓글 내용']];
      S.d.comments.slice().sort(byTime).forEach(function (c) {
        var target = c.targetType === 'tcard'
          ? ((S.d.studentsById[c.targetId] || {}).name || '') + '의 T카드'
          : c.targetId + ' 중간 해결안';
        rows.push([c.phase, fmt(c.createdAt), c.authorGroup, c.authorName, target,
          (c.fields || []).map(function (f) { return f.label + ': ' + f.value; }).join('\n')]);
      });
      downloadCSV('THINK_' + S.classId + '_댓글_' + today() + '.csv', rows);
      toast('댓글 CSV를 내려받았어요');
    }
  };

  /* ------------------------------------------------------------------
   * 이벤트 연결
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = A[el.dataset.act];
    if (!fn) return;
    try {
      var r = fn(el);
      if (r && r.catch) r.catch(function (err) { console.error(err); toast('저장하지 못했어요. 다시 시도해 주세요'); });
    } catch (err) { console.error(err); toast('문제가 생겼어요'); }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.d !== undefined) {
      noteEditStart(t.dataset.d);
      if (t.type === 'checkbox') S.drafts[t.dataset.d] = t.checked;
      else if (t.type === 'radio') { if (t.checked) S.drafts[t.dataset.d] = t.value; }
      else S.drafts[t.dataset.d] = t.value;
    }
    if (t.dataset && t.dataset.cf) {
      var p = t.dataset.cf.split('.');
      if (S.cfEdit[p[0]]) S.cfEdit[p[0]][+p[1]] = t.value;
    }
    var f = t.closest && t.closest('.cform');
    if (f) updateCommentButtons(f.parentNode);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.d !== undefined && (t.type === 'checkbox' || t.type === 'radio' || t.tagName === 'SELECT')) {
      noteEditStart(t.dataset.d);
      if (t.type === 'checkbox') S.drafts[t.dataset.d] = t.checked;
      else if (t.type !== 'radio' || t.checked) S.drafts[t.dataset.d] = t.value;
    }
    if (t.dataset && t.dataset.change === 'classSel') chooseClass(t.value);
    if (t.dataset && t.dataset.change === 'tgroup') { S.tGroup = t.value; S.editingQ = null; render(); syncVerifyAndRefresh(); }
    if (t.dataset && t.dataset.change === 'flowGroup') { S.flowGroup = t.value; render(); }
  });

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Enter' && !e.isComposing && t.tagName === 'INPUT' && t.dataset.enter) {
      e.preventDefault();
      var fn = A[t.dataset.enter];
      if (fn) {
        t.blur();
        var r = fn(t);
        if (r && r.catch) r.catch(function (err) { console.error(err); toast('저장하지 못했어요'); });
      }
    }
  });

  // 입력하는 도중에는 화면을 다시 그리지 않고, 입력을 마치면 반영
  document.addEventListener('pointerdown', function () { S.pointerDown = true; }, true);
  document.addEventListener('pointerup', function () { S.pointerDown = false; setTimeout(tryPendingRender, 60); }, true);
  document.addEventListener('pointercancel', function () { S.pointerDown = false; }, true);
  document.addEventListener('focusout', function () { setTimeout(tryPendingRender, 60); });

  /* ------------------------------------------------------------------
   * 접속 표시
   * ------------------------------------------------------------------ */
  var lastBeat = 0;
  function heartbeat() {
    if (!S.user || document.visibilityState === 'hidden') return;
    lastBeat = Date.now();
    DataStore.setPresence(S.user.id, { name: S.user.name, group: S.user.group || '', role: S.user.role });
  }
  // 화면으로 돌아오면(태블릿 잠금 해제 등) 바로 접속 신호
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - lastBeat > 60000) heartbeat();
  });
  function loadPresence() {
    return DataStore.listPresence().then(function (list) {
      S.presence = list;
      renderPresence();
    });
  }
  window.addEventListener('pagehide', function () { if (S.user) DataStore.clearPresence(S.user.id); });

  /* ------------------------------------------------------------------
   * 시작
   * ------------------------------------------------------------------ */
  // 입장 화면에서 반 바꾸기
  function chooseClass(c) {
    S.classId = c;
    try { localStorage.setItem('think-last-class', c); } catch (e) { /* 무시 */ }
    S.drafts = {};
    return connectNow().then(function () { return refresh(true); });
  }

  function init() {
    try { S.user = JSON.parse(sessionStorage.getItem('think-user') || 'null'); } catch (e) { S.user = null; }

    // 15초가 지나도 못 불러오면 "불러오는 중…"에서 멈추지 않게 안내
    setTimeout(function () {
      if (S.d) return;
      document.getElementById('app').innerHTML =
        '<div class="locked-view"><div class="ic">📶</div><h2>연결이 늦어지고 있어요</h2>' +
        '<p>인터넷(와이파이) 연결을 확인한 뒤 새로고침해 주세요.</p>' +
        '<button class="btn primary" onclick="location.reload()">새로고침</button></div>';
    }, 15000);

    DataStore.onError(function (code) { S.netError = netMessage(code); renderSync(); toast('⚠️ ' + S.netError); });
    DataStore.onSync(function (n) {
      S.syncing = n;
      if (n === 0) S.netError = '';
      renderSync();
    });

    DataStore.listClasses().then(function (list) {
      S.classes = list;
      // 반 고르기: 주소의 ?반=2반 → 이 탭에서 입장한 반 → 이 기기에서 마지막으로 고른 반 → 첫 번째 반
      var fromUrl = new URLSearchParams(location.search).get('반') || new URLSearchParams(location.search).get('class');
      var last = null;
      try { last = localStorage.getItem('think-last-class'); } catch (e) { /* 무시 */ }
      var pick = [fromUrl, S.user && S.user.classId, last].filter(function (c) { return c && list.indexOf(c) >= 0; })[0] || list[0];
      if (S.user && S.user.classId !== pick) S.user = null;
      S.classId = pick;
      return connectNow();
    }).then(function () {
      return loadAll();
    }).then(function (d) {
      S.d = d;
      // 데이터를 비운 뒤 등으로 학생 기록이 없어졌으면 입장 화면으로
      if (S.user && S.user.role === 'student' && !S.d.studentsById[S.user.id]) return setUser(null);
      render();
      syncVerifyAndRefresh();
    }).then(function () {
      DataStore.onChange(function () { refresh(false); });
      DataStore.onPresence(loadPresence);
      heartbeat();
      loadPresence();
      setInterval(heartbeat, DataStore.HEARTBEAT_MS);
      setInterval(loadPresence, 30000);
    }).catch(function (e) {
      console.error(e);
      var msg = DataStore.mode === 'firebase'
        ? 'Firebase에 연결하지 못했어요. 인터넷 연결과 firebase-config.js 설정값을 확인해 주세요.'
        : '데이터를 불러오지 못했어요. 새로고침해 주세요.';
      document.getElementById('app').innerHTML = '<p style="padding:40px;text-align:center">' + msg + '</p>';
    });
  }
  init();
})();
