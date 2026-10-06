/* =====================================================================
 * sample-data.js — 수업 기본 설정과 "테스트용" 반의 샘플 데이터
 *
 * - 1~5반: 처음 만들 때 아래 config(수업 설정)만 들어갑니다.
 * - 테스트용 반: 가짜 학생 32명(8모둠 × 4명)과 진행 기록이 함께 들어갑니다.
 *   (교사 관리 → "테스트용 처음 상태로"를 누르면 이 상태로 되돌아갑니다)
 * ===================================================================== */
window.SAMPLE_DATA = function () {
  var now = Date.now();
  var min = 60 * 1000;
  function t(minAgo) { return now - minAgo * min; }
  function pad(n) { return String(n).padStart(2, '0'); }

  var GROUPS = ['1모둠', '2모둠', '3모둠', '4모둠', '5모둠', '6모둠', '7모둠', '8모둠'];

  /* ---------- 학생 32명 (4명씩 8모둠) ---------- */
  var NAMES = [
    '권다윤', '김나은', '김영훈', '김유빈',
    '김주원', '김태현', '김효린', '문서현',
    '박시우', '박예린', '송서진', '송예솔',
    '송채원', '송현지', '심은유', '안경민',
    '안슬아', '안승민', '양수진', '엄유정',
    '오세훈', '용석진', '유승현', '유지성',
    '유희성', '이윤아', '이지호', '장은솔',
    '정시우', '정연우', '차승훈', '홍재민'
  ];

  var data = {
    config: {
      lesson: {
        subject: '과학',
        title: '유전자 조작 기술, 인간에게 축복일까? 재앙일까?',
        teacherCode: '1234',
        groups: GROUPS.slice(),
        open: { T: true, H: true, I: true, N: true, K: false },
        prompts: {
          T: '유전자 조작 기술은 인간에게 축복일까요, 재앙일까요? AI를 사용하지 않고 나의 생각을 먼저 정리해 봅시다.',
          H: '모둠 친구들의 생각을 읽고 표 양식으로 댓글을 남긴 뒤, AI에게 물어볼 질문을 함께 만들어 봅시다.',
          I: '우리가 만든 질문을 AI에게 묻고 답변을 기록한 뒤 우리 말로 정리해 봅시다. 그리고 모둠 중간 해결안을 작성해 봅시다.',
          N: 'AI가 준 정보를 그대로 믿어도 될까요? 정보마다 수용·수정·제외를 판단하고 근거를 적어 봅시다.',
          K: '처음 생각과 지금 생각을 비교하며 최종 결과물을 완성하고 성찰해 봅시다.'
        },
        commentFields: {
          H: ['나와 비슷한 점', '다른 점', '잘한 점'],
          I: ['나와 비슷한 점', '다른 점', '잘한 점']
        }
      }
    },
    students: {}, tcards: {}, comments: {}, questions: {},
    aianswers: {}, groupwork: {}, verify: {}, finals: {}
  };

  var ids = NAMES.map(function (name, i) {
    var id = 's' + pad(i + 1);
    data.students[id] = { name: name, group: GROUPS[Math.floor(i / 4)], createdAt: t(120 - i) };
    return id;
  });

  /* ---------- T 카드 (입장별 문장 묶음을 섞어서 만듦) ---------- */
  var STANCE = {
    bless: {
      claims: ['유전자 조작 기술은 인간에게 축복이라고 생각한다.', '축복에 더 가깝다고 생각한다.', '잘 쓰면 큰 축복이 될 기술이다.'],
      reasons: [
        '유전병을 가진 사람들이 치료를 받을 수 있게 되기 때문이다.',
        '가뭄이나 병충해에 강한 작물을 만들어 식량 문제를 줄일 수 있다.',
        '비타민을 더 많이 담은 쌀처럼 영양이 부족한 나라 사람들을 도울 수 있다.',
        '암처럼 치료가 어려운 병을 고칠 새로운 방법이 될 수 있다.',
        '모기가 옮기는 말라리아 같은 감염병을 줄이는 데 쓸 수 있다.',
        '멸종 위기 동물을 지키는 데도 도움이 될 수 있다.'
      ],
      solutions: [
        '안전성 검사를 철저히 하고, 치료 목적으로만 사용하도록 법으로 정한다.',
        '연구 결과를 모두에게 공개해서 누구나 확인할 수 있게 한다.',
        '작은 지역에서 먼저 시험해 보고 효과와 위험을 확인한 뒤 넓힌다.',
        '치료 비용을 건강보험으로 지원해 누구나 혜택을 받게 한다.',
        '유전자 조작 식품에는 표시를 해서 소비자가 고를 수 있게 한다.'
      ]
    },
    curse: {
      claims: ['재앙이 될 가능성이 더 크다고 생각한다.', '재앙이라고 생각한다.', '지금은 위험이 더 크다고 생각한다.'],
      reasons: [
        '예상하지 못한 부작용이 생길 수 있고, 한 번 바뀐 유전자는 되돌리기 어렵다.',
        '조작된 생물이 자연으로 퍼지면 원래 있던 생태계가 무너질 수 있다.',
        '돈이 많은 사람만 혜택을 받아서 불평등이 더 커질 수 있다.',
        '생명을 사람이 마음대로 바꾸는 것은 옳지 않다고 생각한다.',
        '원하는 외모나 능력을 고르는 "맞춤 아기"가 생기면 새로운 차별이 생긴다.'
      ],
      solutions: [
        '사람의 생식세포 조작은 금지하고, 나라끼리 함께 지킬 규칙을 만든다.',
        '꼭 필요한 치료 외에는 사용하지 않는다.',
        '실험실 밖으로 나가지 않도록 관리하고, 퍼졌을 때 대책을 먼저 세운다.',
        '시민도 참여하는 위원회가 허용 범위를 정한다.'
      ]
    },
    both: {
      claims: ['축복도 재앙도 될 수 있다. 쓰는 방법에 달려 있다.', '둘 다라고 생각한다.'],
      reasons: [
        '질병 치료에는 큰 도움이 되지만, 차별이나 무기에 쓰이면 재앙이 된다.',
        '기술 자체보다 누가 어떤 목적으로 쓰느냐가 더 중요하다.',
        '좋은 점과 위험한 점이 모두 분명해서 한쪽만 고르기 어렵다.'
      ],
      solutions: [
        '과학자뿐 아니라 시민도 참여하는 윤리 위원회가 사용 범위를 정한다.',
        '사용 목적을 투명하게 공개하도록 한다.',
        '치료는 허용하고 능력 강화 목적은 금지하는 식으로 선을 긋는다.'
      ]
    }
  };
  var ORDER = ['bless', 'curse', 'both', 'bless', 'curse', 'bless', 'both', 'curse'];
  // 진행 상황을 다양하게: 몇 명은 작성 중, 몇 명은 아직 안 씀
  var WIP = { s04: 1, s15: 1, s27: 1 }, EMPTY = { s08: 1, s23: 1, s32: 1 };

  ids.forEach(function (id, i) {
    var s = data.students[id];
    if (EMPTY[id]) return;
    var st = STANCE[ORDER[i % ORDER.length]];
    var card = {
      group: s.group,
      claim: st.claims[i % st.claims.length],
      reason: st.reasons[(i * 3) % st.reasons.length],
      solution: st.solutions[(i * 5) % st.solutions.length],
      submitted: true, submittedAt: t(100 - i), updatedAt: t(100 - i)
    };
    if (WIP[id]) { card.reason = ''; card.solution = ''; card.submitted = false; delete card.submittedAt; }
    data.tcards[id] = card;
  });

  /* ---------- H 댓글 (모둠 안에서 서로) ---------- */
  var HC = [
    ['법으로 사용 범위를 정해야 한다는 생각이 나와 같아.', '나는 부작용이 더 걱정돼서 반대쪽이었어.', '예를 들어 설명해서 근거가 구체적이야.'],
    ['치료에 도움이 된다는 점은 나도 동의해.', '나는 쓰는 방법에 따라 달라진다고 생각했어.', '해결 방안까지 현실적으로 썼어.'],
    ['규칙이 필요하다는 생각이 비슷해.', '그 방법까지는 생각 못 했어.', '불평등 문제를 짚은 게 좋았어.'],
    ['생태계를 걱정하는 마음이 나랑 같아.', '나는 식량 문제 해결 쪽을 더 중요하게 봤어.', '근거와 해결 방안이 잘 이어져.']
  ];
  var cn = 0;
  for (var g = 0; g < 6; g++) {                       // 1~6모둠에 댓글
    var mem = ids.slice(g * 4, g * 4 + 4).filter(function (id) { return data.tcards[id] && data.tcards[id].submitted; });
    mem.forEach(function (target, k) {
      var author = mem[(k + 1) % mem.length];
      if (author === target) return;
      var f = HC[(g + k) % HC.length];
      data.comments['c' + pad(++cn)] = {
        phase: 'H', targetType: 'tcard', targetId: target, targetGroup: GROUPS[g],
        authorId: author, authorName: data.students[author].name, authorGroup: GROUPS[g],
        createdAt: t(75 - cn),
        fields: [
          { label: '나와 비슷한 점', value: f[0] },
          { label: '다른 점', value: f[1] },
          { label: '잘한 점', value: f[2] }
        ]
      };
    });
  }

  /* ---------- H 질문 리스트 (1~6모둠) ---------- */
  var QPOOL = [
    '유전자 가위(크리스퍼)로 실제로 치료된 질병이 있을까?',
    '유전자 조작 작물(GMO)은 사람 몸에 안전할까?',
    '유전자 조작으로 생길 수 있는 부작용에는 어떤 것이 있을까?',
    '다른 나라들은 유전자 조작을 어떻게 규제하고 있을까?',
    '유전자 조작 모기로 말라리아를 줄인 사례가 있을까?',
    '유전자 조작 생물이 자연으로 퍼지면 어떤 일이 생길까?',
    '황금쌀은 실제로 영양 문제를 해결했을까?',
    '유전자 치료는 비용이 얼마나 들까?'
  ];
  var qn = 0, groupQs = {};
  for (g = 0; g < 6; g++) {
    groupQs[GROUPS[g]] = [];
    var count = g < 4 ? 4 : 3;
    for (var k = 0; k < count; k++) {
      var qid = 'q' + pad(++qn);
      data.questions[qid] = {
        group: GROUPS[g], text: QPOOL[(g * 2 + k) % QPOOL.length],
        createdAt: t(60 - qn), createdBy: data.students[ids[g * 4 + (k % 4)]].name
      };
      groupQs[GROUPS[g]].push(qid);
    }
  }

  /* ---------- I AI 답변 (1~4모둠, 앞 질문 2~3개) ---------- */
  var ANSWERS = {
    '유전자 가위(크리스퍼)로 실제로 치료된 질병이 있을까?': {
      answer: '네. 2023년 영국과 미국에서 크리스퍼 유전자 가위를 이용한 치료제가 겸상 적혈구 빈혈증 등 유전성 혈액 질환 치료용으로 처음 승인되었습니다.',
      summary: '유전자 가위로 혈액 유전병을 치료하는 약이 2023년에 처음 허가를 받았다.', tool: 'ChatGPT', hasSource: false },
    '유전자 조작 작물(GMO)은 사람 몸에 안전할까?': {
      answer: '현재까지 승인된 GMO 식품이 인체에 해롭다는 과학적 근거는 확인되지 않았지만, 장기적인 영향은 계속 연구 중입니다.',
      summary: '지금까지 허가된 GMO 음식이 몸에 나쁘다는 증거는 없지만, 오래 먹었을 때의 영향은 아직 연구 중이다.', tool: 'Gemini', hasSource: true, sourceNote: '식품의약품안전처 GMO 안내 페이지' },
    '유전자 조작으로 생길 수 있는 부작용에는 어떤 것이 있을까?': {
      answer: '원하지 않는 위치의 유전자가 잘리는 "오프타깃 효과", 면역 반응, 생식세포 편집 시 다음 세대로의 유전 등이 대표적인 위험입니다.',
      summary: '엉뚱한 곳의 유전자가 잘릴 수 있고, 생식세포를 바꾸면 자손에게도 전해진다.', tool: 'ChatGPT', hasSource: false },
    '다른 나라들은 유전자 조작을 어떻게 규제하고 있을까?': {
      answer: '나라마다 다릅니다. 많은 나라가 사람 배아의 유전자 편집을 출산 목적으로 쓰는 것을 금지하거나 엄격히 제한하고 있습니다.',
      summary: '나라마다 규칙이 다르고, 아기를 낳기 위한 배아 유전자 편집은 대부분 금지하거나 엄격히 막는다.', tool: '뤼튼', hasSource: false },
    '유전자 조작 모기로 말라리아를 줄인 사례가 있을까?': {
      answer: '유전자 조작 모기를 풀어 모기 수를 줄이는 시험이 여러 나라에서 진행되었고, 일부 지역에서 모기 수가 줄었다는 보고가 있습니다.',
      summary: '조작한 모기를 풀어서 모기 수를 줄이는 시험이 있었고, 일부 지역에서 효과가 있었다.', tool: 'Gemini', hasSource: true, sourceNote: '과학 뉴스 기사' },
    '유전자 조작 생물이 자연으로 퍼지면 어떤 일이 생길까?': {
      answer: '먹이사슬 변화, 다른 종과의 교배 등 예측하기 어려운 생태계 영향이 생길 수 있어 엄격한 관리가 필요합니다.',
      summary: '먹이사슬이 바뀌거나 다른 생물과 섞이는 등 예측하기 어려운 일이 생길 수 있다.', tool: 'ChatGPT', hasSource: false }
  };
  for (g = 0; g < 4; g++) {
    groupQs[GROUPS[g]].slice(0, g < 2 ? 3 : 2).forEach(function (qid, k) {
      var a = ANSWERS[data.questions[qid].text];
      if (!a) return;
      data.aianswers[qid] = {
        group: GROUPS[g], answer: a.answer, tool: a.tool, hasSource: !!a.hasSource,
        sourceNote: a.sourceNote || '', summary: a.summary,
        updatedBy: data.students[ids[g * 4 + k]].name, updatedAt: t(35 - g * 3 - k)
      };
    });
  }

  /* ---------- I 중간 해결안 (1~5모둠) + 다른 모둠 댓글 ---------- */
  var SOLS = [
    '치료 목적에는 허용하되, 생식세포 조작과 외모·능력을 고르는 목적은 금지한다. 과학자와 시민이 함께 참여하는 위원회가 사용 범위를 정하고, 치료 비용은 건강보험으로 지원한다.',
    '유전자 조작 식품에는 누구나 알아볼 수 있는 표시를 하고, 자연으로 퍼질 수 있는 생물은 좁은 지역에서 충분히 시험한 뒤에만 사용한다.',
    '유전병 치료처럼 다른 방법이 없는 경우에만 허용하고, 연구 결과와 부작용을 모두 공개하도록 법으로 정한다.',
    '나라끼리 공동 규칙을 만들고, 규칙을 어긴 연구는 국제적으로 제재한다. 학교에서도 생명 윤리 교육을 강화한다.',
    '새 기술은 작은 범위에서 먼저 시험하고, 결과를 시민에게 설명한 뒤 사용 범위를 넓힌다.'
  ];
  for (g = 0; g < 5; g++) {
    data.groupwork[GROUPS[g]] = {
      solution: SOLS[g], solutionBy: data.students[ids[g * 4 + 2]].name, solutionAt: t(25 - g),
      uniqueIdea: g === 0 ? '유전자 치료를 받은 사람의 건강을 10년 넘게 꾸준히 살펴보는 "장기 추적 제도"를 만든다.' : '',
      uniqueIdeaBy: g === 0 ? data.students[ids[1]].name : '', uniqueIdeaAt: g === 0 ? t(8) : 0
    };
  }
  [[1, 0], [2, 1], [0, 2], [3, 4]].forEach(function (pair, k) {   // [댓글 쓴 모둠, 받은 모둠]
    var author = ids[pair[0] * 4 + k % 4];
    data.comments['c' + pad(++cn)] = {
      phase: 'I', targetType: 'solution', targetId: GROUPS[pair[1]], targetGroup: GROUPS[pair[1]],
      authorId: author, authorName: data.students[author].name, authorGroup: GROUPS[pair[0]],
      createdAt: t(18 - k),
      fields: [
        { label: '나와 비슷한 점', value: '우리 모둠도 치료 목적은 허용하자는 의견이었어.' },
        { label: '다른 점', value: '우리는 식품 표시제와 시험 범위를 중심으로 해결안을 만들었어.' },
        { label: '잘한 점', value: '누가 결정하는지까지 정한 점이 구체적이야.' }
      ]
    };
  });

  /* ---------- N 검증표 (1~2모둠) ---------- */
  var vn = 0;
  [['1모둠', [['수용', '과학 뉴스 기사 두 곳에서 같은 내용을 확인했다.'],
              ['수정', '"안전하다"가 아니라 "해롭다는 증거가 아직 없다"로 고쳐야 정확하다.'],
              ['', '']]],
   ['2모둠', [['수용', '교과서 생명 윤리 단원 내용과 같다.'],
              ['제외', '출처가 없고, 다른 자료에서는 다르게 설명해서 믿기 어렵다.']]]
  ].forEach(function (row) {
    var gname = row[0];
    groupQs[gname].forEach(function (qid, k) {
      var a = data.aianswers[qid], d = row[1][k];
      if (!a || !d) return;
      data.verify['v' + pad(++vn)] = {
        group: gname, source: qid, question: data.questions[qid].text, info: a.summary, infoEdited: false,
        decision: d[0], reason: d[1], createdAt: t(15 - vn),
        updatedBy: d[0] ? data.students[ids[GROUPS.indexOf(gname) * 4 + k]].name : '', updatedAt: d[0] ? t(12 - vn) : 0
      };
    });
  });
  data.verify['v' + pad(++vn)] = {
    group: '1모둠', source: '', question: '', infoEdited: true,
    info: 'AI가 "모든 나라가 인간 배아 유전자 편집을 금지했다"고 말했다.',
    decision: '제외', reason: '나라마다 규제가 달라서 "모든 나라"라는 말은 사실이 아니다. 출처도 없었다.',
    createdAt: t(10), updatedBy: data.students[ids[3]].name, updatedAt: t(9)
  };

  return data;
};
