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
    { k: 'H', title: '인간 협력을 통한 사고 명료화', en: 'Human Collaboration', short: '모둠과 비교하기', icon: '🤝' },
    { k: 'I', title: 'AI와의 협업을 통한 해결 방안 확장', en: 'Interaction with AI', short: 'AI와 함께하기', icon: '🤖' },
    { k: 'N', title: '인간 중심의 검증과 종합', en: 'Navigating & Critiquing', short: '따져 보고 합치기', icon: '🔍' },
    { k: 'K', title: '지식 재구성과 내면화', en: 'Knowledge Synthesis', short: '완성하고 돌아보기', icon: '🌱' }
  ];
  // 영어 이름: 첫 글자(T·H·I·N·K)에 단계 색
  function enName(p) { return '<span class="en"><b>' + p.en[0] + '</b>' + esc(p.en.slice(1)) + '</span>'; }
  var PH = {};
  PHASES.forEach(function (p) { PH[p.k] = p; });
  var PK = PHASES.map(function (p) { return p.k; });
  var COMMENT_PHASES = ['H'];
  var GROUP_COMMENT_FIELDS = ['👍 좋은 점', '💭 아쉬운 점', '🔍 사실 확인이 필요한 부분'];
  var DECISIONS = [
    { v: '수용', icon: '✅', cls: 'acc' },
    { v: '수정', icon: '✏️', cls: 'mod' },
    { v: '제외', icon: '❌', cls: 'exc' }
  ];
  var TFIELDS = [
    { f: 'claim', label: '나의 주장', ph: '나의 입장을 선택해요.' },
    { f: 'reason', label: '이유·근거·사례', ph: '왜 그렇게 생각하나요? 이유와 근거, 사례를 적어요.' },
    { f: 'solution', label: '보완방안', ph: '문제나 우려를 줄이고 더 나은 방향으로 활용하려면 어떻게 해야 할까요?' }
  ];
  var KFIELDS = [
    { f: 'keep', label: '유지된 생각', ph: '처음 생각 중에서 끝까지 그대로인 생각은 무엇인가요?' },
    { f: 'changed', label: '바뀐 생각과 그 이유', ph: '어떤 생각이 어떻게 바뀌었나요? 왜 바뀌었나요?' },
    { f: 'groupTalk', label: '모둠과의 토의와 의견 교환이 내 생각에 준 영향', ph: '모둠에서 의견을 나누고 해결안을 함께 만들면서 내 생각이 어떻게 달라졌나요?' },
    { f: 'aiView', label: 'AI 답변을 그대로 사용하는 것과 직접 조사·검증하는 과정은 어떻게 다르다고 느꼈나요?', ph: '두 과정의 차이와 활동하며 느낀 점을 적어요.' },
    { f: 'aiThinking', label: '앞으로 AI를 사용하기 전에 어떤 과정을 거치면 내 생각을 AI에 맡기지 않고 스스로 생각할 수 있을까요?', ph: 'AI를 사용하기 전에 내가 먼저 할 일을 적어요.' }
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
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'ko') || String(a.id).localeCompare(String(b.id)); });
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
    N: function (s) { return !!gw(s.group).revision; }
  };
  var TODO = {
    H: 'AI에게 물어볼 질문을 1개 이상 추가해요.',
    I: '내가 만든 질문의 AI 답변과 검토 내용을 기록하고 저장해요.',
    N: '모둠에서 다른 모둠의 의견을 읽고 함께 수정안을 저장해요.'
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
        }, { merge: true, expected: {source:null, info:null, updatedAt:null} }).catch(function(e){if(e.code !== 'conflict') throw e;}));
      } else if (!row.deleted && !row.infoEdited && row.info !== info) {
        jobs.push(DataStore.setDoc('verify', row.id, { info: info }, { merge: true, expected: {info:row.info == null ? null : row.info, infoEdited:row.infoEdited == null ? null : row.infoEdited, updatedAt:row.updatedAt == null ? null : row.updatedAt} }).catch(function(e){if(e.code !== 'conflict') throw e;}));
      }
    });
    return Promise.all(jobs).then(function () { return jobs.length; });
  }
  function syncVerifyAndRefresh() {
    return; // 이전 검증 기록은 보존하고, 새 검토 내용은 I단계에 저장한다.
  }
  function gw(g) { return S.d.groupworkById[g] || {}; }
  function commentsOn(phase, tt, tid) {
    return S.d.comments.filter(function (c) {
      return c.phase === phase && c.targetType === tt && c.targetId === tid;
    }).sort(byTime);
  }
  function isOnline(id) { return S.presence.some(function (p) { return p.id === id; }); }

  // 숫자는 최소한의 안내 기준이며 글의 정확성이나 근거의 질을 판정하지 않아요.
  var T_MIN = { claim: 8, reason: 20, solution: 15 };
  function tFieldProblem(name, value) {
    var v = String(value || '').trim();
    if (!v) return '아직 작성하지 않았어요.';
    if (v.replace(/\s/g, '').length < T_MIN[name]) return '내용을 더 자세히 적어 보세요. (공백 제외 ' + T_MIN[name] + '자 이상)';
    if (/^(그냥|모르겠|자료에\s*있어서|몰라|없음)[.!?\s]*$/.test(v)) return '생각한 이유를 더 자세히 적어 보세요.';
    return '';
  }
  function tSavedStance(c) {
    if (!c) return '';
    if (c.stance === '축복' || c.stance === '재앙') return c.stance;
    var claim = String(c.claim || ''), bless = claim.indexOf('축복') >= 0, disaster = claim.indexOf('재앙') >= 0;
    return bless !== disaster ? (bless ? '축복' : '재앙') : '';
  }
  function updateTValidation(root) {
    var panel = (root || document).querySelector('.t-editor');
    if (!panel) return;
    var allValid = !!panel.querySelector('[data-d="T.stance"]:checked');
    var stanceHint = panel.querySelector('[data-t-hint="stance"]');
    if (stanceHint) stanceHint.textContent = allValid ? '입장을 선택했어요.' : '축복 또는 재앙을 선택해 주세요.';
    TFIELDS.filter(function (f) { return f.f !== 'claim'; }).forEach(function (f) {
      var input = panel.querySelector('[data-d="T.' + f.f + '"]');
      var hint = panel.querySelector('[data-t-hint="' + f.f + '"]');
      if (!input) return;
      var msg = tFieldProblem(f.f, input.value);
      allValid = allValid && !msg;
      input.classList.toggle('needs-detail', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (hint) hint.textContent = msg || '작성했어요.';
    });
    var submit = panel.querySelector('[data-act="submitT"]');
    if (submit) submit.disabled = !allValid;
  }

  /* 입력값(초안) */
  function dv(key, fallback) { return Object.prototype.hasOwnProperty.call(S.drafts, key) ? S.drafts[key] : (fallback == null ? '' : fallback); }
  function take(key, fallback) { return String(dv(key, fallback)).trim(); }
  var activeAction = null;
  function clearDrafts(prefix) {
    if (activeAction) {
      var captured = {};
      Object.keys(S.drafts).forEach(function (k) { if (k === prefix || k.indexOf(prefix + '.') === 0) captured[k] = S.drafts[k]; });
      activeAction.clears.push({prefix:prefix, values:captured});
      return;
    }
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
    var groupEdit = /^((?:sol|rev)\.[^.]+)(?:\.|$)/.exec(key);
    if (groupEdit) return groupEdit[1];
    if (/^(uniq|qe)\./.test(key)) return key;
    var m = /^((ai|v)\.[^.]+)\./.exec(key);
    return m ? m[1] : null;
  }
  function stampOf(prefix) {   // [마지막 저장 시각, 저장한 사람, 최신 내용(글)]
    var dot = prefix.indexOf('.'), kind = prefix.slice(0, dot), id = prefix.slice(dot + 1), x;
    if (kind === 'sol') { x = gw(id); return [x.solutionAt || 0, x.solutionBy || '', x.solution || '']; }
    if (kind === 'rev') { x = gw(id); return [x.revisionAt || 0, x.revisionBy || '', x.revision || '']; }
    if (kind === 'uniq') { x = gw(id); return [x.uniqueIdeaAt || 0, x.uniqueIdeaBy || '', x.uniqueIdea || '']; }
    if (kind === 'ai') { x = S.d.aianswersById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', x.summary || x.answer || '']; }
    if (kind === 'v') { x = S.d.verifyById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', (x.decision ? '[' + x.decision + '] ' : '') + (x.info || '') + (x.reason ? '\n근거: ' + x.reason : '')]; }
    if (kind === 'qe') { x = S.d.questionsById[id] || {}; return [x.updatedAt || 0, x.updatedBy || '', x.text || '']; }
    return [0, '', ''];
  }
  function sharedTarget(prefix) {
    var dot=prefix.indexOf('.'), kind=prefix.slice(0,dot), id=prefix.slice(dot+1);
    var spec = {
      sol:['groupwork',['solution','solutionAt']], rev:['groupwork',['revision','revisionAt','solution','solutionAt']], uniq:['groupwork',['uniqueIdea','uniqueIdeaAt']],
      ai:['aianswers',['answer','tool','hasSource','sourceNote','summary','accept','exclude','uncertain','updatedAt']],
      v:['verify',['info','infoEdited','decision','reason','updatedAt']], qe:['questions',['text','updatedAt']]
    }[kind];
    return {col:spec[0], id:id, fields:spec[1]};
  }
  function expectedFields(prefix, value) {
    var t=sharedTarget(prefix), record=value || S.d[t.col+'ById'][t.id] || {}, expected={};
    t.fields.forEach(function(k){expected[k]=record[k] == null ? null : record[k];});
    return expected;
  }
  function noteEditStart(key) {
    var p=sharedPrefix(key);
    if(p && !(p in S.base)) S.base[p]=expectedFields(p);
  }
  function okToSave(prefix) {
    if (!(prefix in S.base)) S.base[prefix]=expectedFields(prefix);
    return Promise.resolve(true);
  }
  function saveShared(prefix, col, id, data) {
    var expected=S.base[prefix] || expectedFields(prefix);
    return DataStore.setDoc(col,id,data,{merge:true,expected:expected}).catch(function(e){
      if(e.code !== 'conflict') throw e;
      var latest=e.current || {};
      // Show exactly the version rejected by the transaction, even before the listener arrives.
      S.d[col+'ById'][id]=Object.assign({},latest,{id:id});
      S.base[prefix]=expectedFields(prefix,latest);
      S.conflict[prefix]=true;
      return ask({title:'친구가 먼저 저장했어요',msg:'다른 곳에서 이 내용을 먼저 수정했어요. 내 글은 그대로 남아 있어요. 최신 글을 확인하거나 내 글로 저장할 수 있어요.',ok:'내 글로 저장하기',cancel:'최신 글 먼저 보기'}).then(function(yes){
        if(yes) return saveShared(prefix,col,id,data);
        render();
        var stop=new Error('conflict handled'); stop.code='conflict-handled'; throw stop;
      });
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
    l.teacherCode = l.teacherCode || '12341234';
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
    updateTValidation(app);
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
      (local ? '      <div class="sample-people"><small>기본 교사 코드: <b>12341234</b> (교사 관리에서 바꿀 수 있어요)</small></div>' : '') +
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
    if (/unavailable|failed-precondition|network/.test(code)) return '인터넷 연결을 확인하고 저장 버튼을 다시 눌러 주세요';
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
    if (isTeacher()) html += '<button class="btn small presence-refresh" data-act="refreshPresence">🔄 접속 상태 새로고침</button><small class="presence-help">최근 신호 기준이에요</small>';
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
    tabs.push('<button class="tab ph-K' + (S.tab === 'G' ? ' active' : '') + '" data-act="tab" data-tab="G">🖼️ 발표자료 갤러리</button>');
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
      case 'G': return renderGallery();
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
    var guides = {
      T:'자료를 읽고 나의 입장, 이유·근거·사례와 보완방안을 적은 뒤 제출해요.',
      H:'친구의 생각을 읽고 댓글을 나누며 AI에게 물어볼 질문을 만들어요.',
      I:'내 질문의 AI 답변을 기록하고, 믿을 만한 자료로 답변을 검토한 뒤 모둠 해결안을 작성해요.',
      N:'다른 모둠에 의견을 남기고 받은 의견을 살펴 우리 모둠 해결안을 수정해요.',
      K:'최종 생각을 정리하고 T단계와 비교하며 활동을 돌아봐요.'
    };
    var pending = '';
    if (!isTeacher() && S.d) {
      var c = S.d.tcardsById[me().id] || {}, f = S.d.finalsById[me().id] || {};
      if (k === 'T') pending = c.submitted ? '✅ T단계 생각을 제출했어요.' : '⬜ 아직 T단계 생각을 제출하지 않았어요.';
      else if (k === 'N') pending = gw(me().group).revision ? '✅ 모둠 수정안을 저장했어요.' : '⬜ 모둠과 상의하여 수정안을 작성해요.';
      else if (DID[k]) pending = DID[k](me()) ? '✅ 나의 할 일에 참여했어요.' : '⬜ 아직 나의 할 일을 하지 않았어요. ' + TODO[k];
      else if (k === 'K') pending = f.text ? '✅ 최종 결과물을 저장했어요.' : '⬜ 아직 최종 결과물을 저장하지 않았어요.';
    }
    return '<div class="phase-head ph-' + k + '"><div class="big">' + k + '</div><div>' +
      '<h2>' + p.icon + ' ' + p.title + lockNote + '</h2>' + enName(p) +
      ((k !== 'I' && k !== 'N' && L().prompts[k]) ? '<p class="q">' + nl(L().prompts[k]) + '</p>' : '') +
      '</div>' + pick + '</div>' +
      ((k === 'I' || k === 'N') ? '<div class="notice tablet-guide ph-' + k + '"><b>📱 모둠에서 태블릿 한 대만 사용하고 나머지 태블릿은 덮어 두세요.</b>' + (k === 'I' ? '<br><small>질문마다 작성한 학생의 이름으로 입장해 기록해요.</small>' : '') + '</div>' : '') +
      '<div class="phase-guide ph-' + k + '"><b>이 단계에서 할 일</b><span>' + guides[k] + '</span>' +
      (pending ? '<small>' + pending + '</small>' : '') + '</div>';
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
    var caption = (c.phase === 'I' || c.phase === 'N') && c.authorGroup ? esc(c.authorGroup) + ' <small>작성자: ' + esc(c.authorName) + '</small>' : esc(c.authorName) + (c.authorGroup ? ' <small>' + esc(c.authorGroup) + '</small>' : '');
    return '<table class="ctable">' +
      '<caption>💬 ' + caption +
      ' <small>' + fmt(c.createdAt) + '</small>' +
      (canDel ? ' <button class="btn small ghost danger cdel" data-act="delComment" data-id="' + c.id + '">삭제</button>' : '') +
      '</caption>' +
      (c.fields || []).map(function (f) { return '<tr><th>' + esc(f.label) + '</th><td>' + nl(f.value) + '</td></tr>'; }).join('') +
      '</table>';
  }
  function commentForm(phase, tt, tid) {
    var prefix = 'c.' + phase + '.' + tt + '.' + tid;
    var fields = phase === 'N' ? GROUP_COMMENT_FIELDS : L().commentFields[phase];
    return '<div class="cform ph-' + phase + '">' +
      '<table class="ctable"><caption>✍️ 댓글 쓰기 <small>' + (phase === 'N' ? '모둠에서 상의하여 댓글을 남겨주세요 · 각 칸 공백 제외 10자 이상' : '표의 모든 칸을 채워 주세요') + '</small></caption>' +
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
      var isGroup = f.classList.contains('ph-N');
      var ok = Array.prototype.every.call(f.querySelectorAll('textarea'), function (t) { return isGroup ? t.value.replace(/\s/g, '').length >= 10 : !!t.value.trim(); });
      var b = f.querySelector('.cbtn');
      var hint = f.querySelector('.chint');
      if (b) b.disabled = !ok;
      if (hint) {
        hint.textContent = ok ? '✔ 모든 칸을 채웠어요. 등록할 수 있어요!' : (isGroup ? '각 칸을 공백 제외 10자 이상 작성해요.' : '모든 칸을 채워야 등록 버튼이 눌려요.');
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
      out += '<div class="card accent ph-T t-editor">' +
        '<label class="lbl">나의 주장</label><div class="k-stance"><b>유전자 조작기술은 인간에게</b> <span class="decisions">' + ['축복', '재앙'].map(function (choice) {
          return '<label class="dec k-choice ' + (choice === '축복' ? 'k-blessing' : 'k-disaster') + '"><input type="radio" name="tstance" data-d="T.stance" value="' + choice + '"' + (dv('T.stance', tSavedStance(c)) === choice ? ' checked' : '') + '><span>' + choice + '</span></label>';
        }).join(' <span>/</span> ') + '</span> <b>이다.</b> <small class="k-stance-help">(자신의 의견에 해당하는 단어를 클릭하세요)</small></div><small class="t-hint" data-t-hint="stance"></small>' +
        (c && c.claim && !c.stance && !tSavedStance(c) ? '<div class="notice info">이전에 작성한 주장: ' + nl(c.claim) + '<br>계속 작성하려면 위에서 입장을 선택해 주세요.</div>' : '') +
        TFIELDS.filter(function (f) { return f.f !== 'claim'; }).map(function (f) {
          return '<label class="lbl">' + f.label + '</label>' + ta('T.' + f.f, c && c[f.f], f.ph, 4) + '<small class="t-hint" data-t-hint="' + f.f + '"></small>';
        }).join('') +
        '<div class="btn-row"><button class="btn primary ph-T" data-act="submitT" disabled>제출하기</button>' +
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

    if (!isTeacher()) {
      var writtenH = S.d.comments.filter(function (c) { return c.phase === 'H' && c.targetType === 'tcard' && c.authorId === me().id; }).length;
      out += '<div class="notice info">💬 서로 다른 친구 두 명에게 댓글을 하나씩 남겨요. 각 친구 카드에는 댓글이 최대 2개 달려요. 내가 쓴 댓글: ' + writtenH + '개. 빈 카드가 내 카드뿐이면 친구와 상의해 댓글을 삭제하고 다시 나눠 주세요.</div>';
    }

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
  function assignedGroups(g) {
    var match = String(g).match(/^(\d+)모둠/), n = match ? Number(match[1]) : 0;
    if (!n) return [];
    return [n % 8 + 1, (n + 1) % 8 + 1].map(function (x) {
      return L().groups.filter(function (name) { return new RegExp('^' + x + '모둠(?:\\D|$)').test(name); })[0];
    }).filter(function (x) { return x && x !== g; });
  }
  var PLAN_FIELDS = [{key:'plan',label:'방안'}, {key:'basis',label:'방안의 근거·사례·예시'}];
  function planFieldLabel(f, n) {
    return f.key === 'plan' ? '방안 ' + n : '방안 ' + n + '의 근거·사례·예시';
  }
  function planField(w, kind, n, key) {
    var value = w[kind + n + '_' + key];
    if (value != null) return value;
    if (key === 'basis') {
      var parts = [{key:'reason',label:'이유'}];
      if (w[kind + n + '_support'] != null) parts.push({key:'support',label:'근거·사례·예시'});
      else parts = parts.concat([{key:'evidence',label:'근거'}, {key:'example',label:'사례'}]);
      var old = parts.map(function (part) {
        var text = w[kind + n + '_' + part.key];
        return text ? part.label + ': ' + text : '';
      }).filter(Boolean).join('\n');
      if (old) return old;
    }
    if (kind === 'rev') return planField(w, 'mid', n, key);
    return n === 1 && key === 'plan' ? (w.solution || '') : '';
  }
  function planEditor(g, kind, w) {
    var prefix = (kind === 'mid' ? 'sol.' : 'rev.') + g;
    return [1,2,3].map(function (n) {
      return '<div class="plan-block"><h3>방안 ' + n + '</h3>' + PLAN_FIELDS.map(function (f) {
        return '<label class="lbl">' + planFieldLabel(f, n) + '</label>' + ta(prefix + '.' + n + '_' + f.key, planField(w, kind, n, f.key), f.label + '을(를) 적어요.', 2);
      }).join('') + '</div>';
    }).join('');
  }
  function planData(prefix, kind, w) {
    var data = {}, lines = [];
    [1,2,3].forEach(function (n) {
      var parts = PLAN_FIELDS.map(function (f) {
        var key = kind + n + '_' + f.key;
        data[key] = take(prefix + '.' + n + '_' + f.key, planField(w, kind, n, f.key));
        return data[key] ? f.label + ': ' + data[key] : '';
      }).filter(Boolean);
      if (parts.length) lines.push('방안 ' + n + '\n' + parts.join('\n'));
    });
    return { data:data, text:lines.join('\n\n') };
  }
  function storedPlans(w, kind) {
    var structured = [1,2,3].some(function (n) { return PLAN_FIELDS.some(function (f) { return w[kind + n + '_' + f.key] != null; }); });
    if (!structured) return kind === 'mid' ? (w.solution || '') : (w.revision || '');
    return [1,2,3].map(function (n) {
      var parts = PLAN_FIELDS.map(function (f) { var v = planField(w, kind, n, f.key); return v ? f.label + ': ' + v : ''; }).filter(Boolean);
      return parts.length ? '방안 ' + n + '\n' + parts.join('\n') : '';
    }).filter(Boolean).join('\n\n');
  }
  function revisionEditor(g, w) {
    var prefix = 'rev.' + g;
    return '<div class="revision-headings"><b>I단계 원래 의견</b><span></span><b>N단계 모둠 수정안</b></div>' +
      [1,2,3].map(function (n) {
        return '<div class="revision-plan"><h3>방안 ' + n + '</h3>' + PLAN_FIELDS.map(function (f) {
          var old = planField(w, 'mid', n, f.key);
          return '<div class="revision-field"><div><label class="lbl">' + planFieldLabel(f, n) + '</label><div class="revision-original">' + orDash(old) + '</div></div>' +
            '<span class="revision-arrow" aria-hidden="true">→</span><div><label class="lbl">' + planFieldLabel(f, n) + '</label>' +
            ta(prefix + '.' + n + '_' + f.key, planField(w, 'rev', n, f.key), f.label + '을(를) 수정해요.', 3) + '</div></div>';
        }).join('') + '</div>';
      }).join('');
  }
  function renderI() {
    var g = myGroup();
    var out = phaseHead('I', true);
    var qs = groupQs(g);

    out += '<div class="source-links ph-I"><b>🔎 믿을 만한 자료를 직접 찾아봐요</b><p>교과서나 아래 버튼에 없는 자료도 찾아봐도 좋아요. 공신력 있는 자료를 사용하고, 작성 기관과 날짜를 확인해요.</p>' +
      '<p class="source-warning"><strong>🚫 검증 자료를 찾을 때는 AI를 사용하지 않아요.</strong></p><div>' +
      '<a href="https://www.scienceall.com/" target="_blank" rel="noopener noreferrer">사이언스올 · 과학백과 ↗</a>' +
      '<a href="https://www.foodsafetykorea.go.kr/" target="_blank" rel="noopener noreferrer">식품안전나라 · 식품·GMO ↗</a>' +
      '<a href="https://www.nibr.go.kr/" target="_blank" rel="noopener noreferrer">국립생물자원관 · 생물·생태 ↗</a>' +
      '<a href="https://terms.naver.com/" target="_blank" rel="noopener noreferrer">네이버 지식백과 · 과학백과 ↗</a>' +
      '<a href="https://www.dongascience.com/ko" target="_blank" rel="noopener noreferrer">동아사이언스 · 과학 뉴스 ↗</a>' +
      '<a href="https://science.ytn.co.kr/" target="_blank" rel="noopener noreferrer">YTN 사이언스 · 과학 뉴스 ↗</a>' +
      '</div></div>';
    out += section('I', '🤖 질문별 AI 답변 기록');
    if (qs.length) out += participation('I', g);
    if (!qs.length) out += '<div class="empty">H단계에서 AI 질문을 먼저 만들어 주세요.</div>';
    qs.forEach(function (q, i) {
      var a = S.d.aianswersById[q.id] || {};
      var k = 'ai.' + q.id;
      var canEdit = !isTeacher() && isMyQ(q);
      if (!canEdit) {
        out += '<div class="card accent ph-I"><div class="ai-q"><span class="qn">Q' + (i + 1) + '</span><span>' + esc(q.text) + '</span></div>' +
          '<p class="meta">질문을 작성한 학생이 기록해요. 다른 모둠원은 확인할 수 있어요.</p>' +
          '<dl class="tfields"><dt>AI 답변</dt><dd>' + orDash(a.answer) + '</dd><dt>사용한 AI·출처</dt><dd>' + orDash([a.tool, a.sourceNote].filter(Boolean).join(' · ')) + '</dd>' +
          '<dt>우리 말로 정리</dt><dd>' + orDash(a.summary) + '</dd><dt>⭕ 수용할 부분</dt><dd>' + orDash(a.accept) + '</dd><dt>❌ 제외할 부분</dt><dd>' + orDash(a.exclude) + '</dd><dt>❓ 검증이 되지 않은 부분</dt><dd>' + orDash(a.uncertain) + '</dd></dl></div>';
        return;
      }
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
        '<h3>🔍 AI 답변 검토하기</h3><p class="meta">교과서나 공신력 있는 자료를 직접 찾아 확인해요. 검토 자료를 찾을 때는 AI를 사용하지 않아요.</p>' +
        '<table class="ctable ai-review"><tbody><tr><th><span class="review-icon review-ok">O</span> 수용할 부분</th><td>' + ta(k + '.accept', a.accept, '확인하여 받아들일 수 있는 내용을 적어요.', 3) + '</td></tr>' +
        '<tr><th><span class="review-icon review-no">X</span> 제외할 부분</th><td>' + ta(k + '.exclude', a.exclude, '틀리거나 맞지 않아 제외할 내용을 적어요.', 3) + '</td></tr>' +
        '<tr><th><span class="review-icon review-unknown">?</span> 검증이 되지 않은 부분</th><td>' + ta(k + '.uncertain', a.uncertain, '아직 믿을 만한 근거를 찾지 못한 내용을 적어요.', 3) + '</td></tr></tbody></table>' +
        '<div class="btn-row"><button class="btn primary ph-I" data-act="saveAI" data-id="' + q.id + '">저장</button>' +
        (a.updatedAt ? '<span class="meta">마지막 저장: ' + esc(a.updatedBy || '') + ' · ' + fmt(a.updatedAt) + '</span>' : '') + '</div>' +
        '</div>';
    });

    var w = gw(g);
    out += section('I', '🧩 ' + esc(g) + ' 중간 해결안');
    out += '<div class="card result ph-I">' +
      '<div class="result-head"><span class="ribbon">모둠 결과</span><span>위의 AI 답변과 모둠 토의를 모아, 우리 모둠의 해결안을 정리해요</span></div>' +
      conflictBox('sol.' + g) +
      planEditor(g, 'mid', w) +
      '<div class="btn-row"><button class="btn primary ph-I" data-act="saveSol">중간 해결안 저장</button>' +
      (w.solutionAt ? '<span class="meta">마지막 저장: ' + esc(w.solutionBy || '') + ' · ' + fmt(w.solutionAt) + '</span>' : '') + '</div>' +
      '</div>';
    return out;
  }

  /* ==================================================================
   * N — 검증과 종합
   * ================================================================== */
  function renderN() {
    var g = myGroup(), w = gw(g), out = phaseHead('N', true), assigned = assignedGroups(g);
    out += section('N', '💬 모둠끼리 의견을 나눠요 (모둠 피드백)', '<small>' + esc(assigned.join(', ')) + '에 모둠과 상의하여 댓글을 남겨요.</small>');
    out += '<div class="card accent ph-N"><h3>우리 모둠의 중간 해결안 · I단계</h3><div class="result-text ph-I">' + orDash(storedPlans(w, 'mid')) + '</div>' +
      '<h3>우리 모둠이 받은 댓글</h3>' + commentsBlock('N', 'solution', g, false, '다른 모둠이 남긴 댓글') + '</div>';
    var others = assigned.concat(L().groups.filter(function (x) { return x !== g && assigned.indexOf(x) < 0; }));
    out += '<div class="grid2">' + others.map(function (og) {
      var ow = gw(og), chosen = assigned.indexOf(og) >= 0;
      if (!ow.solution && !chosen) return '';
      return '<div class="card accent ph-N"><div class="card-head"><span class="avatar ph-N">' + esc(og.replace(/[^0-9]/g, '') || og[0]) + '</span><b>' + esc(og) + '</b>' +
        '<span class="status">' + (chosen ? '댓글을 남길 모둠' : '보기만 가능') + '</span></div>' +
        '<div class="result-text ph-N">' + (ow.solution ? nl(storedPlans(ow, 'mid')) : '아직 중간 해결안을 작성하지 않았어요.') + '</div>' +
        (ow.solution ? commentsBlock('N', 'solution', og, !isTeacher() && chosen) : '') + '</div>';
    }).join('') + '</div>';
    out += section('N', '🔄 친구들의 의견 보고 우리 의견 수정하기');
    out += '<div class="notice info">I단계의 원래 방안은 그대로 보존돼요. 모둠이 상의한 수정안을 오른쪽에 함께 적어 주세요.</div>' +
      '<div class="card accent ph-N">' + conflictBox('rev.' + g) + revisionEditor(g, w) +
      '<div class="btn-row"><button class="btn primary ph-N" data-act="saveRevision">모둠 수정안 저장</button>' + (w.revisionAt ? '<span class="meta">마지막 저장: ' + esc(w.revisionBy || '') + ' · ' + fmt(w.revisionAt) + '</span>' : '') + '</div></div>';
    return out;
  }

  /* ==================================================================
   * K — 재구성과 내면화
   * ================================================================== */
  function myTBox(c, title) {
    return '<div class="mine"><h3>💭 ' + (title || '나의 처음 생각 (T단계)') + '</h3>' +
      (c && (c.claim || c.reason || c.solution) ? tCardBody(c) : '<div class="empty">T단계 카드가 없어요.</div>') + '</div>';
  }
  function finalForEditor(id) {
    var saved = S.d.finalsById[id] || {};
    if (S.classId !== DataStore.TEST_CLASS || saved.stance || saved.reason1 || !window.SAMPLE_DATA) return saved;
    var example = (window.SAMPLE_DATA().finals || {})[id];
    if (!example) return saved;
    var result = Object.assign({}, saved);
    ['stance','reason1','evidence1','reason2','evidence2','reason3','evidence3'].forEach(function (key) { result[key] = example[key] || ''; });
    return result;
  }
  function kFinalSummary(f) {
    var stance = dv('K.stance', f.stance || ''), parts = [];
    if (stance) parts.push('<dt>나의 입장</dt><dd>유전자 조작기술은 인간에게 ' + esc(stance) + '이다.</dd>');
    [1,2,3].forEach(function (i) {
      var reason = dv('K.reason' + i, f['reason' + i] || ''), evidence = dv('K.evidence' + i, f['evidence' + i] || '');
      if (String(reason).trim()) parts.push('<dt>이유 ' + i + '</dt><dd>' + nl(reason) + '</dd>');
      if (String(evidence).trim()) parts.push('<dt>근거·사례 ' + i + '</dt><dd>' + nl(evidence) + '</dd>');
    });
    return parts.length ? '<dl class="tfields" style="--t:var(--k)">' + parts.join('') + '</dl>' : '<div class="empty">위에서 최종 결과물을 작성하면 여기에 보여요.</div>';
  }
  function presentationPrompt(g) {
    var members = membersOf(g), w = gw(g), qs = groupQs(g), rows = groupVerify(g);
    var lines = [
      'THINK 모델 AI 활용수업의 유전자 조작 탐구 발표자료를 만들어 주세요. 포스터 상단의 작은 수업 이름은 정확히 “THINK 모델 AI 활용수업”으로 쓰세요. “중학교 3학년 과학 토론”이나 학년 표기는 쓰지 마세요.',
      '형식: A4 세로 비율(210×297mm)의 포스터 이미지 한 장. 인쇄해도 읽을 수 있는 한글을 사용하세요.',
      '단계별 컬러: 웹앱과 동일하게 T 처음 의견은 주황 #E2703F, H 질문은 노랑 #D2951A, I 우리 말 답변은 청록 #25907F, N 검증은 파랑 #3A76C4, K 모둠 결과와 방안은 보라 #8A5FB8을 사용하세요. 같은 단계에 속한 모든 카드의 배경, 테두리, 이름표 또는 번호표는 각각 완전히 같은 색으로 통일하고 사람이나 번호에 따라 색을 바꾸지 마세요. 단계가 다른 요소만 단계별 색으로 구분하세요.',
      '디자인: 밝은 크림색 바탕에 충분한 바깥 여백과 상자 사이 간격을 두고 정렬된 격자와 가는 테두리를 사용해 차분하고 세련된 교육용 포스터로 구성하세요. 배경은 격자무늬나 빽빽한 장식 없이 깨끗하게 유지하세요. 주제에 맞는 예쁜 유전자 이중나선·잎·세포 같은 부드러운 파스텔 수채화풍 일러스트를 크기를 달리해 가장자리 두세 곳에만 배치하고, 내용과 겹치지 않게 하세요. 둥글고 단순한 형태와 은은한 그림자를 사용하세요.',
      '글자: 큰 제목은 짧고 지나치게 크지 않게 하세요. 본문은 너무 크거나 전부 굵지 않게 보통 굵기의 읽기 좋은 한글로 쓰고, 문장과 줄 사이에 충분한 간격을 두세요. 텍스트가 많으면 의미를 유지하며 핵심을 간결하게 정리하고 글을 상자에 꽉 채우거나 자르지 마세요.',
      '필수 강조 표시: 모든 학생의 이름을 색이 채워진 동그라미 또는 둥근 네모 이름표 안에 각각 넣으세요. 모든 질문 번호와 대응하는 답변·검증 번호도 같은 번호의 색깔 동그라미나 네모 배지로 각각 표시하세요. 이 이름표와 번호 배지는 빠짐없이 실제 그림에 그리세요.',
      '필수 색연필 강조: 본문의 핵심 단어에 옅은 노란색 또는 분홍색 색연필로 직접 그은 듯한 밑줄을 최소 3개, 단어를 둘러싼 동그라미를 최소 2개 실제로 그리세요. 글자는 가리지 않도록 선을 글씨 아래나 바깥에 그리세요.',
      '배치 순서: 위에서부터 작은 주제 제목, T 처음 의견, 질문에서 답변과 검증으로 이어지는 과정, K 모둠의 결과와 산출 방안 순서로 배치하세요. 제목이 지나치게 많은 공간을 차지하지 않게 하세요.',
      'T 처음 의견: 학생마다 별도의 작은 네모 카드 하나씩 만들고 가로 한 줄에 나란히 배치하세요. 모든 학생 카드의 배경색·테두리색·이름표색은 각각 동일한 T 주황 계열로 완전히 통일하세요. 학생마다 다른 색이나 밝기를 쓰지 마세요. 각 카드에는 학생 이름과 핵심 주장·근거·보완방안을 간결하게 담으세요.',
      '필수 질문·답변 배치: 질문마다 아래 구조를 독립된 한 줄로 그리세요. [질문 번호 배지 + 그 번호의 질문만 들어 있는 노란 네모] → [같은 번호 배지 + 그 질문에 대한 우리 말 답변과 검증 결과만 들어 있는 청록·파란 네모]. 질문과 답변 상자 사이에는 화살표를 그리세요. 질문이 4개면 4행과 8개의 독립된 상자, 4개의 화살표를 사용합니다. 모든 질문을 한 상자에 모으거나 모든 답변을 다른 상자에 모으지 마세요.',
      'K 모둠 결과와 산출 방안: 맨 아래 보라 계열의 넓은 상자 두 개에 각각 담고, 본문 중에서는 가장 눈에 띄게 하되 지나치게 크거나 빽빽하지 않게 쓰세요. 모둠 결과가 중간 해결안이면 최종 합의라고 단정하지 마세요.',
      'AI 답변은 검토 전의 내용입니다. 포스터에는 I단계에서 수용할 부분을 우선 사용하고, 제외할 부분이나 검증되지 않은 내용은 사실처럼 쓰지 마세요.',
      '의견이 달랐던 과정과 변화가 보이게 하되 자료에 없는 사실이나 합의는 만들지 마세요.',
      '정보가 없으면 ‘아직 작성하지 않음’으로 표시하고 제공된 모둠원 이름만 사용하세요. 이름 이외의 개인정보는 포스터에 넣지 마세요.',
      '', '[반드시 따를 도식]', '제목 → 학생별 이름표가 있는 처음 의견 카드 ' + members.length + '개',
      '그 아래 질문·답변 ' + qs.length + '쌍을 다음과 같이 각각 별도의 행으로 그리세요:'
    ];
    qs.forEach(function (q, i) { var n = i + 1; lines.push('[' + n + '번 배지 + 질문 ' + n + ' 상자] → [' + n + '번 배지 + 답변·검증 ' + n + ' 상자]'); });
    lines.push('그 아래 보라색 [모둠의 결과] 상자와 [모둠에서 산출한 방안] 상자.',
      '', '수업 주제: ' + (L().title || ''), '모둠: ' + g, '', '[T 처음 의견]');
    members.forEach(function (s, i) {
      var c = S.d.tcardsById[s.id] || {};
      lines.push(s.name + ': 주장 ' + (c.claim || '미작성') + ' / 이유·근거·사례 ' + (c.reason || '미작성') + ' / 보완방안 ' + (c.solution || '미작성'));
    });
    lines.push('', '[질문별 우리 말 답변과 검증 결과]');
    qs.forEach(function (q, i) {
      var a = S.d.aianswersById[q.id] || {};
      lines.push('[' + (i + 1) + '번 질문 상자] ' + q.text + '\n→ [' + (i + 1) + '번 답변·검증 상자] 우리 말로 정리한 답변: ' + (a.summary || '미작성') +
        ' / 수용할 부분: ' + (a.accept || '미작성') + ' / 제외할 부분: ' + (a.exclude || '미작성') + ' / 검증되지 않은 부분: ' + (a.uncertain || '미작성'));
    });
    lines.push('', '모둠의 결과 (I단계에서 저장한 중간 해결안): ' + (storedPlans(w, 'mid') || '미작성'));
    lines.push('모둠의 수정안 (N단계): ' + (storedPlans(w, 'rev') || '미작성'));
    return lines.join('\n');
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

    var f = finalForEditor(me().id), work = gw(myGroup());
    out += section('K', '💭 나의 생각과 모둠의 해결안 돌아보기');
    out += '<div class="k-reference-grid"><div class="k-reference k-reference-t"><h3>🟠 처음의 나의 생각 · T</h3>' +
      (S.d.tcardsById[me().id] ? tCardBody(S.d.tcardsById[me().id]) : '<div class="empty">아직 T단계 생각이 없어요.</div>') + '</div>' +
      '<div class="k-reference k-reference-n"><h3>🔵 모둠이 생각해 낸 해결책 · N</h3>' +
      (work.revision ? orDash(storedPlans(work, 'rev')) : (work.solution ? '<small>I단계 중간 해결안 · N단계 수정안 저장 전</small>' + orDash(storedPlans(work, 'mid')) : '<div class="empty">아직 저장된 모둠 해결안이 없어요.</div>')) + '</div></div>';
    out += section('K', '🏁 최종 결과물');
    out += '<div class="notice k-personal-guide"><b>수업을 진행하면서 바뀐 나의 생각을 포함하여 최종 결과를 작성해 보세요.</b><br><strong>나의 의견은 모둠의 의견과 달라도 괜찮아요. 개인별로 작성해요.</strong></div>' +
      '<div class="card accent ph-K">' +
      '<p><b>나의 입장을 선택해요.</b></p><div class="k-stance"><b>유전자 조작기술은 인간에게</b> <span class="decisions">' + ['축복', '재앙'].map(function (choice) {
        return '<label class="dec k-choice ' + (choice === '축복' ? 'k-blessing' : 'k-disaster') + '"><input type="radio" name="kstance" data-d="K.stance" value="' + choice + '"' + (dv('K.stance', f.stance) === choice ? ' checked' : '') + '><span>' + choice + '</span></label>';
      }).join(' <span>/</span> ') + '</span> <b>이다.</b> <small class="k-stance-help">(자신의 의견에 해당하는 단어를 클릭하세요)</small></div>' +
      '<p class="meta">이유와 그 이유를 뒷받침하는 근거나 사례를 짝지어 적어요. 최대 3가지까지 작성할 수 있어요.</p>' +
      [1, 2, 3].map(function (i) { return '<div class="k-reason"><label class="lbl">이유 ' + i + '</label>' + ta('K.reason' + i, f['reason' + i], '~하기 때문이다.', 2) + '<label class="lbl">이유 ' + i + '의 근거·사례·예시</label>' + ta('K.evidence' + i, f['evidence' + i], '이유를 뒷받침하는 근거나 사례를 적어요.', 3) + '</div>'; }).join('') +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="saveFinal">저장</button>' +
      (f.updatedAt ? '<span class="meta">마지막 저장 ' + fmt(f.updatedAt) + '</span>' : '') + '</div>' +
      '</div>';

    out += section('K', '🪞 성찰 — 처음 생각과 비교해요');
    out += '<div class="compare"><div class="k-compare-left">' + myTBox(S.d.tcardsById[me().id]) +
      '<div class="k-final-reference"><h3>🌱 나의 최종 결과물 · K</h3><div data-k-final-preview>' + kFinalSummary(f) + '</div></div></div>' +
      '<div class="card accent ph-K">' +
      KFIELDS.map(function (x) { return '<label class="lbl">' + x.label + '</label>' + ta('K.' + x.f, f[x.f], x.ph, 4); }).join('') +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="saveFinal">성찰 저장</button></div>' +
      '</div></div>';
    out += section('K', '🎨 모둠 발표자료 만들기');
    out += '<div class="card accent ph-K"><ol class="poster-steps"><li>모둠원 모두가 작성을 완료했는지 확인해요.</li><li>모둠원 한 명이 아래 <b>프롬프트 만들기</b>를 눌러요.</li><li>복사 버튼을 누르고 제미나이에 붙여 넣어요.</li><li>완성된 이미지를 저장해 <b>발표자료 갤러리</b> 탭의 우리 모둠에 올려요.</li></ol>' +
      '<p class="privacy-note">제미나이에 붙여 넣으면 모둠원 이름과 작성 내용이 제미나이로 전송돼요. 이름 외에 연락처 등 개인정보가 들어 있지 않은지 확인해 주세요.</p>' +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="generatePresentationPrompt">✨ 프롬프트 만들기</button></div>' +
      '<textarea id="presentation-prompt" data-d="presentation.prompt" rows="8" aria-label="발표자료 생성 프롬프트" placeholder="프롬프트 만들기 버튼을 눌러 주세요.">' + esc(dv('presentation.prompt', '')) + '</textarea>' +
      '<div class="btn-row"><button class="btn ph-K" data-act="copyPresentationPrompt">📋 복사해서 제미나이에 넣어주세요</button></div></div>';
    return out;
  }

  function renderGallery() {
    var html = '<div class="gallery-heading"><h2>🖼️ 발표자료 갤러리</h2><p>우리 반 모둠들의 발표자료를 함께 살펴보아요.</p></div>';
    if (!isTeacher()) html += '<div class="card gallery-upload"><h3>우리 모둠 발표자료 올리기</h3>' +
      '<ol><li>제미나이에서 완성한 포스터를 이미지로 저장하거나 화면을 캡처해요.</li>' +
      '<li>아래에서 사진을 선택하고 <b>발표자료 올리기</b>를 눌러요.</li>' +
      '<li>갤러리에서 우리 모둠 사진을 확인해요. 다시 올리면 기존 사진이 바뀌어요.</li></ol>' +
      '<label class="lbl" for="poster-file">발표자료 사진 선택 (JPG, PNG, WebP)</label>' +
      '<input id="poster-file" type="file" accept="image/jpeg,image/png,image/webp">' +
      '<div class="btn-row"><button class="btn primary ph-K" data-act="uploadPoster">발표자료 올리기</button></div></div>';
    return html + '<div class="poster-grid">' + L().groups.map(function (g) {
      var poster = gw(g).posterImage;
      return '<article class="poster-card"><h3>' + esc(g) + '</h3>' +
        (poster && /^data:image\/jpeg;base64,/.test(poster) ? '<img src="' + esc(poster) + '" alt="' + esc(g) + ' 발표자료">' : '<div class="poster-empty">아직 발표자료가 없어요</div>') + '</article>';
    }).join('') + '</div>';
  }

  function preparePoster(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('사진 파일을 선택해 주세요.'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('15MB 이하의 사진을 선택해 주세요.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요.')); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, 1500 / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        var ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var quality = 0.85, result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > 450000 && quality > 0.3) { quality -= 0.1; result = canvas.toDataURL('image/jpeg', quality); }
        if (result.length > 450000) return reject(new Error('사진이 너무 복잡해요. 더 작은 사진을 선택해 주세요.'));
        resolve(result);
      };
      img.src = url;
    });
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
    var nBody = '<div class="sub">💬 다른 모둠에게 받은 의견</div>' + commentsOn('N', 'solution', g).map(commentTable).join('') +
      '<div class="sub">🔄 모둠 수정안</div>' + orDash(w.revision);
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
        '<div><div class="sub" style="font-weight:800;color:var(--n)">N · 모둠 수정안</div>' + orDash(w.revision) + '</div>' +
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
      var judged = qs.filter(function (q) { var a = S.d.aianswersById[q.id] || {}; return a.accept || a.exclude || a.uncertain; }).length;
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
      '<div class="stat ph-I"><b>' + vTotal + '</b><span>I 답변 검토 수</span></div>' +
      '<div class="stat ph-K"><b>' + kDone + '/' + all.length + '</b><span>K 최종 결과물</span></div></div>';
    out += '<div class="table-wrap"><table class="data"><thead><tr><th>접속</th><th>이름</th><th>T 카드</th><th>H 댓글 쓴 수</th><th>H 질문</th><th>I 답변 기록</th><th>N 모둠 수정안</th><th>K 최종</th><th>K 성찰</th></tr></thead><tbody>' +
      prog.map(function (p) {
        return '<tr class="grp"><td colspan="9">' + esc(p.g) + ' · ' + p.mem.length + '명 · 질문 ' + p.qs.length + '개 · AI 답변 ' + p.answered + '/' + p.qs.length + ' · I 답변 검토 ' + p.judged + '/' + p.qs.length + ' · 중간 해결안 ' + (gw(p.g).solution ? '✅' : '—') +
          ' · 모둠 수정안 ' + (gw(p.g).revision ? '✅' : '—') + '</td></tr>' +
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
    // Quotes alone do not stop Excel from interpreting formulas.
    if (/^[\s\uFEFF]*[=+@\-＝＋－＠]/.test(v) || /^[\t\r\n]/.test(v)) v = "'" + v;
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
    var stance = take('T.stance', tSavedStance(c));
    var v = { stance: stance, claim: stance ? '유전자 조작기술은 인간에게 ' + stance + '이다.' : (c.claim || ''), reason: take('T.reason', c.reason), solution: take('T.solution', c.solution) };
    if (c.claim && c.claim !== v.claim && !c.legacyClaim) v.legacyClaim = c.claim;
    if (submit && (!stance || !v.reason || !v.solution)) return toast('입장, 이유·근거·사례, 보완방안을 모두 채워 주세요');
    if (submit && ['reason', 'solution'].some(function (f) { return !!tFieldProblem(f, v[f]); })) return toast('분홍색 칸을 더 자세히 작성해 주세요');
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
    generatePresentationPrompt: function () {
      var group = myGroup();
      return loadAll().then(function (d) {
        S.d = d;
        S.drafts['presentation.prompt'] = presentationPrompt(group);
        toast('모둠의 저장된 기록으로 프롬프트를 만들었어요.');
      }).catch(function () { toast('모둠 기록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'); });
    },
    uploadPoster: function () {
      if (isTeacher()) return;
      var input = document.getElementById('poster-file'), file = input && input.files[0], g = myGroup();
      if (!file) return toast('먼저 발표자료 사진을 선택해 주세요.');
      return preparePoster(file).then(function (image) {
        return DataStore.setDoc('groupwork', g, { posterImage: image, posterUpdatedAt: Date.now() }, { merge: true });
      }).then(function () { return done('발표자료를 올렸어요!'); }).catch(function (e) { toast(e.message || '사진을 올리지 못했어요. 인터넷 연결을 확인해 주세요.'); });
    },
    refreshPresence: function () {
      if (!isTeacher()) return;
      return DataStore.refreshPresence().then(function (list) {
        S.presence = list; renderPresence(); toast('최근 접속 신호를 새로 확인했어요');
      }).catch(function () { toast('접속 상태를 가져오지 못했어요. 인터넷 연결을 확인해 주세요.'); });
    },
    copyPresentationPrompt: function () {
      var field = document.getElementById('presentation-prompt');
      if (!field) return;
      if (!field.value.trim()) return toast('먼저 프롬프트 만들기 버튼을 눌러 주세요.');
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(field.value).then(function () { toast('프롬프트를 복사했어요. 개인정보를 확인해 주세요.'); }).catch(function () { toast('복사하지 못했어요. 글을 직접 선택해 복사해 주세요.'); });
      toast('글을 직접 선택해 복사해 주세요.');
    },
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
      return setUser({ role: 'teacher', id: 'teacher', name: '선생님', group: '' });
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
      var fields = (phase === 'N' ? GROUP_COMMENT_FIELDS : L().commentFields[phase]).map(function (label, i) { return { label: label, value: take(prefix + '.' + i) }; });
      if (fields.some(function (f) { return !f.value; })) return toast('표의 모든 칸을 채워 주세요');
      if (phase === 'N' && (isTeacher() || tt !== 'solution' || assignedGroups(myGroup()).indexOf(tid) < 0)) return toast('지정된 모둠에만 댓글을 남길 수 있어요.');
      if (phase === 'N' && fields.some(function (f) { return f.value.replace(/\s/g, '').length < 10; })) return toast('각 칸을 공백 제외 10자 이상 작성해 주세요.');
      if (phase === 'H' && commentsOn(phase, tt, tid).length >= MAX_H_COMMENTS) return toast('이미 이 글에 댓글이 2개 달렸어요');
      clearDrafts(prefix);
      return DataStore.addComment({
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
        return saveShared('qe.' + id, 'questions', id, { text: text, updatedBy: me().name, updatedAt: Date.now() }).then(function () { S.editingQ = null; return done('질문을 수정했어요'); });
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
      var question = S.d.questionsById[id];
      if (isTeacher() || !question || question.group !== myGroup() || !isMyQ(question)) return toast('내가 작성한 질문만 기록할 수 있어요.');
      var data = {
        group: myGroup(),
        answer: take(k + '.answer', a.answer),
        tool: take(k + '.tool', a.tool),
        hasSource: !!dv(k + '.hasSource', !!a.hasSource),
        sourceNote: take(k + '.sourceNote', a.sourceNote),
        summary: take(k + '.summary', a.summary),
        accept: take(k + '.accept', a.accept), exclude: take(k + '.exclude', a.exclude), uncertain: take(k + '.uncertain', a.uncertain),
        updatedBy: me().name, updatedAt: Date.now()
      };
      data['c_' + me().id] = Date.now();   // 참여 기록 (한 명당 1개 이상 확인용)
      return okToSave(k).then(function (ok) {
        if (!ok) return;
        clearDrafts(k);
        return saveShared(k, 'aianswers', id, data).then(function () { return done('AI 답변과 검토 내용을 저장했어요'); });
      });
    },
    saveSol: function () {
      var g = myGroup();
      if (isTeacher()) return;
      var prefix = 'sol.' + g, result = planData(prefix, 'mid', gw(g));
      return okToSave('sol.' + g).then(function (ok) {
        if (!ok) return;
        clearDrafts('sol.' + g);
        return saveShared(prefix, 'groupwork', g, Object.assign(result.data, { solution: result.text, solutionBy: me().name, solutionAt: Date.now() }))
          .then(function () { return done('중간 해결안을 저장했어요'); });
      });
    },

    /* N */
    saveRevision: function () {
      if (isTeacher()) return;
      var g = myGroup(), prefix = 'rev.' + g, result = planData(prefix, 'rev', gw(g));
      return okToSave(prefix).then(function (ok) {
        if (!ok) return;
        clearDrafts(prefix);
        return saveShared(prefix, 'groupwork', g, Object.assign(result.data, { revision: result.text, revisionBy: me().name, revisionAt: Date.now() }))
          .then(function () { return done('모둠 수정안을 저장했어요'); });
      });
    },
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
        return saveShared(k, 'verify', id, data).then(function () { return done('검증 내용을 저장했어요'); });
      });
    },
    saveUniq: function () {
      var g = myGroup();
      var text = take('uniq.' + g, gw(g).uniqueIdea);
      return okToSave('uniq.' + g).then(function (ok) {
        if (!ok) return;
        clearDrafts('uniq.' + g);
        return saveShared('uniq.' + g, 'groupwork', g, { uniqueIdea: text, uniqueIdeaBy: me().name, uniqueIdeaAt: Date.now() })
          .then(function () { return done('우리 모둠 아이디어를 저장했어요'); });
      });
    },

    /* K */
    saveFinal: function () {
      var f = S.d.finalsById[me().id] || {};
      var shown = finalForEditor(me().id);
      var data = { stance: take('K.stance', shown.stance), updatedAt: Date.now() };
      [1, 2, 3].forEach(function (i) { data['reason' + i] = take('K.reason' + i, shown['reason' + i]); data['evidence' + i] = take('K.evidence' + i, shown['evidence' + i]); });
      var hasStructure = data.stance || [1, 2, 3].some(function (i) { return data['reason' + i] || data['evidence' + i]; });
      if (hasStructure) {
        data.text = (data.stance ? '유전자 조작 기술은 인간에게 ' + data.stance + '이다.\n' : '') + [1, 2, 3].map(function (i) { return data['reason' + i] || data['evidence' + i] ? '이유 ' + i + ': ' + (data['reason' + i] || '미작성') + '\n근거·사례: ' + (data['evidence' + i] || '미작성') : ''; }).filter(Boolean).join('\n');
        if (f.text && !f.stance && !f.reason1 && !f.legacyText) data.legacyText = take('K.text', f.text);
      } else data.text = take('K.text', f.text);
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
      return DataStore.setDoc('config', 'lesson', { commentFields: cf }, { merge: true }).then(function () { S.cfEdit[ph] = null; return done(ph + ' 단계 댓글 양식을 저장했어요'); });
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
      var header = ['모둠', '이름', 'T 나의 주장', 'T 이유·근거·사례', 'T 보완방안', 'T 제출', 'H 모둠 AI 질문', 'H 쓴 댓글 수', 'H 받은 댓글 수',
        'I AI 답변 기록(도구/출처/우리 말 정리)', 'I 모둠 중간 해결안', 'I AI 답변 검토', 'N 모둠 수정안',
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
          var vText = qs.map(function (q, i) { var a = S.d.aianswersById[q.id] || {}; return 'Q' + (i + 1) + ' 수용: ' + (a.accept || '') + ' / 제외: ' + (a.exclude || '') + ' / 미검증: ' + (a.uncertain || ''); }).join('\n');
          membersOf(g).forEach(function (s) {
            var c = S.d.tcardsById[s.id] || {}, f = S.d.finalsById[s.id] || {};
            rows.push([g, s.name, c.claim, c.reason, c.solution, c.submitted ? '제출 ' + fmt(c.submittedAt) : '미제출', qText,
              S.d.comments.filter(function (x) { return x.authorId === s.id; }).length,
              commentsOn('H', 'tcard', s.id).length,
              aText, w.solution, vText, w.revision, f.text].concat(KFIELDS.map(function (x) { return f[x.f]; })));
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
  function actionError(err) {
    if(err.code === 'conflict-handled') return;
    console.error(err);
    toast(err.code === 'comment-limit' ? '이미 이 글에 댓글이 2개 달렸어요' : '저장하지 못했어요. 작성한 글은 남아 있어요. 연결을 확인하고 다시 저장해 주세요.');
  }
  function runAction(fn, el) {
    if(activeAction) { toast('처리 중이에요. 잠시 기다려 주세요.'); return; }
    var context={clears:[]}; activeAction=context;
    return Promise.resolve().then(function(){return fn(el);}).then(function(){
      context.clears.forEach(function(c){
        Object.keys(c.values).forEach(function(k){if(S.drafts[k] === c.values[k]) delete S.drafts[k];});
        var remains=Object.keys(S.drafts).some(function(k){return k === c.prefix || k.indexOf(c.prefix+'.') === 0;});
        if(!remains){delete S.base[c.prefix]; delete S.conflict[c.prefix];}
        else if(sharedPrefix(c.prefix) || /^(ai|v)\./.test(c.prefix)) S.base[c.prefix]=expectedFields(c.prefix);
      });
    }).catch(actionError).then(function(){activeAction=null; if(S.d) render();});
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = A[el.dataset.act];
    if (!fn) return;
    runAction(fn, el);
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
    if (t.dataset && /^K\.(stance|reason[1-3]|evidence[1-3])$/.test(t.dataset.d || '') && S.user && S.d) {
      var preview = document.querySelector('[data-k-final-preview]');
      if (preview) preview.innerHTML = kFinalSummary(finalForEditor(me().id));
    }
    var f = t.closest && t.closest('.cform');
    if (f) updateCommentButtons(f.parentNode);
    if (t.closest && t.closest('.t-editor')) updateTValidation(document);
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (activeAction && t.dataset && t.dataset.change) {
      if (t.dataset.change === 'classSel') t.value = S.classId;
      if (t.dataset.change === 'tgroup') t.value = myGroup();
      if (t.dataset.change === 'flowGroup') t.value = S.flowGroup;
      toast('저장 처리가 끝난 뒤 이동해 주세요.');
      return;
    }
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
        runAction(fn,t);
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
    DataStore.onSync(function (n, failed) {
      S.syncing = n;
      if (n === 0 && !failed) S.netError = '';
      if (failed && !S.netError) S.netError = '저장하지 못한 작업이 있어요. 다시 저장해 주세요.';
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
