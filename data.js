/* =====================================================================
 * data.js — 데이터 저장·불러오기 담당
 *
 * 두 가지 방식을 자동으로 고릅니다.
 *   - firebase-config.js 에 Firebase 설정값이 채워져 있으면 → Firebase(온라인, 여러 기기 공유)
 *   - 비어 있으면 → 이 브라우저 안에만 저장(화면 확인용)
 * app.js는 아래 함수만 사용하므로, 저장 방식을 바꿔도 app.js는 그대로입니다.
 *
 *   DataStore.mode                          'firebase' 또는 'local'
 *   DataStore.listClasses() / saveClasses(목록)          반 목록
 *   DataStore.connect({classId, role, group, userId})    반·사용자에 맞춰 연결
 *   DataStore.getDoc(컬렉션, ID) / listDocs(컬렉션, {필드:값})   (연결된 데이터에서 읽기)
 *   DataStore.findDocs(컬렉션, {필드:값})                서버에서 직접 찾기 (입장할 때)
 *   DataStore.setDoc(컬렉션, ID, 데이터, {merge}) / addDoc / deleteDoc
 *   DataStore.setDocInClasses(반목록, 컬렉션, ID, 데이터, {merge})
 *   DataStore.resetClass({classId})         처음 상태로 (classId 생략 시 지금 반. 테스트용 반은 샘플 데이터로)
 *   DataStore.TEST_CLASS                    샘플 데이터가 들어 있는 연습용 반 이름
 *   DataStore.onChange / onPresence / onError / onSync   알림 받기
 *   DataStore.setPresence / clearPresence / listPresence 접속 표시
 *
 * Firebase 구조:  meta/app  {classes:[...]}
 *                classes/{반}/{컬렉션}/{문서}
 *   컬렉션: config, students, tcards, comments, questions, aianswers,
 *          groupwork, verify, finals, presence
 *
 * 비용(읽기 횟수)을 줄이는 방법
 *   - 반마다 데이터를 나눕니다.
 *   - 학생은 "자기 모둠" 데이터만 실시간으로 받습니다. 교사는 반 전체를 받습니다.
 *   - 화면을 열어 둔 동안에는 바뀐 것만 새로 받습니다. (새로고침하면 처음부터 다시 받음)
 *   - 접속 표시는 4분에 한 번만 신호를 보냅니다.
 * ===================================================================== */
(function () {
  'use strict';

  var COLLECTIONS = ['config', 'students', 'tcards', 'comments', 'questions',
                     'aianswers', 'groupwork', 'verify', 'finals'];
  var TEST_CLASS = '테스트용';   // 이 반만 샘플 데이터로 시작, 나머지 반은 빈 상태로 시작
  var DEFAULT_CLASSES = ['1반', '2반', '3반', '4반', '5반', TEST_CLASS];

  var cfg = window.FIREBASE_CONFIG || {};
  var useFirebase = !!(cfg.apiKey && cfg.projectId && String(cfg.apiKey).indexOf('여기에') < 0);

  /* ---------- 공통 도구 ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function stripId(d) { var c = clone(d || {}); delete c.id; return c; }
  function match(doc, where) {
    return !where || Object.keys(where).every(function (k) { return doc[k] === where[k]; });
  }
  function sampleData() { return window.SAMPLE_DATA ? window.SAMPLE_DATA() : { config: {} }; }
  function lessonOnly() {   // 실제 반: 수업 설정만, T단계만 열린 상태로 시작
    var config = sampleData().config;
    config.lesson.open = { T: true, H: false, I: false, N: false, K: false };
    return { config: config };
  }
  function initialData(c) { return c === TEST_CLASS ? sampleData() : lessonOnly(); }
  function emitter() {
    var ls = [];
    return {
      on: function (cb) { ls.push(cb); return function () { ls = ls.filter(function (f) { return f !== cb; }); }; },
      emit: function () { var args = arguments; ls.slice().forEach(function (f) { try { f.apply(null, args); } catch (e) { console.error(e); } }); }
    };
  }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function conflict(current) { var e = new Error('conflict'); e.code = 'conflict'; e.current = clone(current || {}); return e; }
  function checkExpected(current, expected) {
    if (expected && Object.keys(expected).some(function (k) { return JSON.stringify(current[k] == null ? null : current[k]) !== JSON.stringify(expected[k]); })) throw conflict(current);
  }
  function commentLimit() { var e = new Error('이미 이 글에 댓글이 2개 달렸어요'); e.code = 'comment-limit'; return e; }
  function migrateCode(lesson) {
    if (lesson.teacherCodeRevision !== '2026-10-30') { lesson.teacherCode = '12341234'; lesson.teacherCodeRevision = '2026-10-30'; }
    return lesson;
  }

  window.DataStore = useFirebase ? createFirebaseStore() : createLocalStore();

  /* =================================================================
   * 1) 이 브라우저 안에만 저장 (화면 확인용)
   * ================================================================= */
  function createLocalStore() {
    var CLASSES_KEY = 'think-class-classes-v2';
    var PRESENCE_KEY = 'think-class-presence-v2';
    var classId = null;
    var changes = emitter(), presenceEv = emitter(), errors = emitter(), syncEv = emitter();

    function key(c) { return 'think-class-data-v2::' + (c || classId); }
    function read(c) {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(key(c))); } catch (e) { raw = null; }
      if (!raw) {
        raw = initialData(c || classId);
        localStorage.setItem(key(c), JSON.stringify(raw));
      }
      if (raw.config && raw.config.lesson && raw.config.lesson.teacherCodeRevision !== '2026-10-30') { migrateCode(raw.config.lesson); localStorage.setItem(key(c), JSON.stringify(raw)); }
      return raw;
    }
    function write(db) { localStorage.setItem(key(), JSON.stringify(db)); changes.emit(); }
    function readP() { try { return JSON.parse(localStorage.getItem(PRESENCE_KEY)) || {}; } catch (e) { return {}; } }
    function writeP(p) { localStorage.setItem(PRESENCE_KEY, JSON.stringify(p)); presenceEv.emit(); }

    window.addEventListener('storage', function (e) {
      if (classId && e.key === key()) changes.emit();
      if (e.key === PRESENCE_KEY) presenceEv.emit();
    });

    return {
      mode: 'local',
      TEST_CLASS: TEST_CLASS,
      HEARTBEAT_MS: 15000,
      ONLINE_MS: 45000,

      listClasses: function () {
        var l = null;
        try { l = JSON.parse(localStorage.getItem(CLASSES_KEY)); } catch (e) { l = null; }
        return Promise.resolve(l && l.length ? l : DEFAULT_CLASSES.slice());
      },
      saveClasses: function (list) { localStorage.setItem(CLASSES_KEY, JSON.stringify(list)); return Promise.resolve(); },

      connect: function (opt) { classId = opt.classId; read(); return Promise.resolve(); },

      getDoc: function (col, id) {
        var d = read()[col];
        return Promise.resolve(d && d[id] ? Object.assign(clone(d[id]), { id: id }) : null);
      },
      listDocs: function (col, where) {
        var all = read()[col] || {};
        return Promise.resolve(Object.keys(all)
          .map(function (id) { return Object.assign(clone(all[id]), { id: id }); })
          .filter(function (d) { return match(d, where); }));
      },
      findDocs: function (col, where) { return this.listDocs(col, where); },

      setDoc: function (col, id, data, opt) {
        var c = classId;
        function save() {
          var db = read(c);
          db[col] = db[col] || {};
          checkExpected(db[col][id] || {}, opt && opt.expected);
          db[col][id] = (opt && opt.merge) ? Object.assign({}, db[col][id] || {}, stripId(data)) : stripId(data);
          localStorage.setItem(key(c), JSON.stringify(db)); changes.emit();
        }
        if (navigator.locks) return navigator.locks.request('think-data-' + c, save);
        return Promise.resolve().then(save);
      },
      addComment: function (data) {
        var c = classId;
        function save() {
          var db = read(c), all = db.comments || {};
          if (data.phase === 'H' && Object.keys(all).filter(function (id) { var x = all[id]; return x.phase === 'H' && x.targetType === data.targetType && x.targetId === data.targetId; }).length >= 2) throw commentLimit();
          var id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
          db.comments = all; all[id] = stripId(data);
          localStorage.setItem(key(c), JSON.stringify(db)); changes.emit(); return id;
        }
        if (navigator.locks) return navigator.locks.request('think-data-' + c, save);
        return Promise.reject(new Error('이 브라우저에서는 댓글 동시 저장 보호를 지원하지 않아요. 최신 Chrome 또는 Edge를 사용해 주세요.'));
      },
      addDoc: function (col, data) {
        var id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        return this.setDoc(col, id, data).then(function () { return id; });
      },
      deleteDoc: function (col, id) {
        var db = read();
        if (db[col]) delete db[col][id];
        write(db);
        return Promise.resolve();
      },
      setDocInClasses: function (ids, col, docId, data, opt) {
        ids.forEach(function (c) {
          var db = read(c);
          db[col] = db[col] || {};
          db[col][docId] = (opt && opt.merge) ? Object.assign({}, db[col][docId] || {}, stripId(data)) : stripId(data);
          localStorage.setItem(key(c), JSON.stringify(db));
        });
        changes.emit();
        return Promise.resolve();
      },
      resetClass: function (opt) {   // opt.classId 없으면 지금 반
        var c = (opt && opt.classId) || classId;
        localStorage.setItem(key(c), JSON.stringify(initialData(c)));
        changes.emit();
        return Promise.resolve();
      },

      onChange: changes.on, onPresence: presenceEv.on, onError: errors.on, onSync: syncEv.on,

      setPresence: function (id, info) {
        var p = readP();
        p[classId + '/' + id] = Object.assign({}, info, { t: Date.now() });
        writeP(p);
        return Promise.resolve();
      },
      clearPresence: function (id) {
        var p = readP();
        delete p[classId + '/' + id];
        writeP(p);
        return Promise.resolve();
      },
      listPresence: function () {
        var p = readP(), now = Date.now(), pre = classId + '/', ms = this.ONLINE_MS;
        return Promise.resolve(Object.keys(p)
          .filter(function (k) { return k.indexOf(pre) === 0 && now - p[k].t < ms; })
          .map(function (k) { return Object.assign({}, p[k], { id: k.slice(pre.length) }); }));
      }
    };
  }

  /* =================================================================
   * 2) Firebase Firestore (온라인, 여러 기기 공유)
   * ================================================================= */
  function createFirebaseStore() {
    var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
    var HEARTBEAT_MS = 4 * 60 * 1000;
    var ONLINE_MS = 9 * 60 * 1000;
    var changes = emitter(), presenceEv = emitter(), errors = emitter(), syncEv = emitter();
    var db = null, classId = null, listeners = [], pending = 0, connectSeq = 0;
    var fireChange = debounce(function () { changes.emit(); }, 60);

    function loadScript(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = src; s.onload = res;
        s.onerror = function () { rej(new Error('script-load-failed')); };
        document.head.appendChild(s);
      });
    }

    var ready = (window.firebase && window.firebase.firestore
      ? Promise.resolve()
      : loadScript(SDK + 'firebase-app-compat.js').then(function () { return loadScript(SDK + 'firebase-firestore-compat.js'); }))
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        db = firebase.firestore();
        // 기기 저장소(IndexedDB) 캐시는 쓰지 않음: 연결이 끊겼다 돌아올 때 캐시가 잠겨
        // "불러오는 중…"에서 멈추는 일이 있어서, 항상 서버에서 새로 받는 방식이 더 안전함
      })
      .then(function () { return db; })
      .catch(function (e) { report(e); throw e; });

    function report(e) {
      console.error(e);
      errors.emit((e && (e.code || e.message)) || String(e));
    }
    function colRef(col, c) { return db.collection('classes').doc(c || classId).collection(col); }

    // 저장 진행 상황 (화면의 "저장 중…" 표시용)
    var failed = {};
    function track(p, key) {
      key = key || 'operation';
      pending++; syncEv.emit(pending, Object.keys(failed).length > 0);
      return p.then(function (r) {
        delete failed[key]; pending--; syncEv.emit(pending, Object.keys(failed).length > 0); return r;
      }, function (e) {
        if (e.code !== 'conflict' && e.code !== 'comment-limit') { failed[key] = true; report(e); }
        pending--; syncEv.emit(pending, Object.keys(failed).length > 0); throw e;
      });
    }

    /* 역할에 따라 실시간으로 받을 범위 */
    function specsFor(sc) {
      if (sc.role === 'teacher') {
        return COLLECTIONS.map(function (c) { return { col: c }; }).concat([{ col: 'presence', presence: true }]);
      }
      if (sc.role === 'student') {
        var g = sc.group, u = sc.userId;
        return [
          { col: 'config' },
          { col: 'students', where: { group: g } },
          { col: 'tcards', where: { group: g } },
          { col: 'comments', where: { targetGroup: g } },   // 우리 모둠이 받은 댓글
          { col: 'comments', where: { authorId: u } },      // 내가 쓴 댓글
          { col: 'questions', where: { group: g } },
          { col: 'aianswers', where: { group: g } },
          { col: 'verify', where: { group: g } },
          { col: 'groupwork' },                             // 모둠 수만큼만 (다른 모둠 중간 해결안 보기)
          { col: 'finals', docId: u },
          { col: 'presence', where: { group: g }, presence: true }
        ];
      }
      return [{ col: 'config' }];   // 입장 전
    }

    function ensureLesson(c) {
      return colRef('config', c).doc('lesson').get().then(function (snap) {
        if (snap.exists) {
          if (snap.data().teacherCodeRevision === '2026-10-30') return;
          return db.runTransaction(function (tx) {
            var ref = colRef('config', c).doc('lesson');
            return tx.get(ref).then(function (s) {
              if (s.exists && s.data().teacherCodeRevision !== '2026-10-30') tx.set(ref, {teacherCode: '12341234', teacherCodeRevision: '2026-10-30'}, {merge:true});
            });
          });
        }
        var data = initialData(c), ops = [];
        Object.keys(data).forEach(function (col) {
          Object.keys(data[col]).forEach(function (id) { ops.push({ ref: colRef(col, c).doc(id), data: data[col][id] }); });
        });
        return chunkedBatch(ops);
      });
    }

    function docsOf(col) {
      var out = {};
      listeners.forEach(function (l) { if (l.spec.col === col) Object.assign(out, l.docs); });
      return out;
    }

    // 저장 즉시 화면에 반영 (서버 응답을 기다리지 않음 → 와이파이가 약해도 끊김 없음)
    function applyLocal(col, id, data, merge, del) {
      var touchedPresence = false;
      listeners.forEach(function (l) {
        var s = l.spec;
        if (s.col !== col || (s.docId && s.docId !== id)) return;
        if (del) { delete l.docs[id]; }
        else {
          var next = merge ? Object.assign({}, l.docs[id] || {}, data) : data;
          if (s.where && !match(next, s.where)) delete l.docs[id];
          else l.docs[id] = next;
        }
        if (s.presence) touchedPresence = true;
      });
      if (touchedPresence) presenceEv.emit(); else fireChange();
    }

    function chunkedBatch(ops) {   // ops: [{ref, data?}] — 500개 제한을 피해 나눠서 처리
      var jobs = [];
      for (var i = 0; i < ops.length; i += 400) {
        var b = db.batch();
        ops.slice(i, i + 400).forEach(function (o) { if (o.data) b.set(o.ref, o.data); else b.delete(o.ref); });
        jobs.push(b.commit());
      }
      return Promise.all(jobs);
    }

    return {
      mode: 'firebase',
      TEST_CLASS: TEST_CLASS,
      HEARTBEAT_MS: HEARTBEAT_MS,
      ONLINE_MS: ONLINE_MS,

      listClasses: function () {
        return ready.then(function () { return db.collection('meta').doc('app').get(); })
          .then(function (s) {
            var l = s.exists && s.data().classes;
            return l && l.length ? l : DEFAULT_CLASSES.slice();
          });
      },
      saveClasses: function (list) {
        return ready.then(function () { return track(db.collection('meta').doc('app').set({ classes: list }, { merge: true }), 'classes'); });
      },

      connect: function (sc) {
        var seq = ++connectSeq;
        return ready.then(function () {
          listeners.forEach(function (l) { l.unsub(); });
          listeners = [];
          classId = sc.classId;
          return ensureLesson(classId);
        }).then(function () {
          if (seq !== connectSeq) return;   // 그 사이 다른 연결이 시작됨
          return Promise.all(specsFor(sc).map(function (s) {
            return new Promise(function (resolve) {
              var entry = { spec: s, docs: {}, first: true, unsub: function () {} };
              listeners.push(entry);
              var ref = s.docId ? colRef(s.col).doc(s.docId) : colRef(s.col);
              if (s.where) Object.keys(s.where).forEach(function (k) { ref = ref.where(k, '==', s.where[k]); });
              entry.unsub = ref.onSnapshot(function (snap) {
                var docs = {};
                if (s.docId) { if (snap.exists) docs[snap.id] = snap.data(); }
                else snap.docs.forEach(function (d) { docs[d.id] = d.data(); });
                entry.docs = docs;
                if (entry.first) { entry.first = false; resolve(); }
                if (s.presence) presenceEv.emit(); else fireChange();
              }, function (err) {
                report(err);
                if (entry.first) { entry.first = false; resolve(); }
              });
            });
          }));
        });
      },

      getDoc: function (col, id) {
        return ready.then(function () {
          var d = docsOf(col)[id];
          return d ? Object.assign(clone(d), { id: id }) : null;
        });
      },
      listDocs: function (col, where) {
        return ready.then(function () {
          var all = docsOf(col);
          return Object.keys(all)
            .map(function (id) { return Object.assign(clone(all[id]), { id: id }); })
            .filter(function (d) { return match(d, where); });
        });
      },
      findDocs: function (col, where) {
        return ready.then(function () {
          var q = colRef(col);
          Object.keys(where || {}).forEach(function (k) { q = q.where(k, '==', where[k]); });
          return q.get();
        }).then(function (snap) {
          return snap.docs.map(function (d) { return Object.assign(d.data(), { id: d.id }); });
        });
      },

      setDoc: function (col, id, data, opt) {
        return ready.then(function () {
          var clean = stripId(data), merge = !!(opt && opt.merge);
          var ref = colRef(col).doc(id);
          var write = opt && opt.expected ? db.runTransaction(function (tx) {
            return tx.get(ref).then(function (snap) {
              checkExpected(snap.exists ? snap.data() : {}, opt.expected);
              tx.set(ref, clean, {merge:merge});
            });
          }) : ref.set(clean, {merge:merge});
          return track(write, ref.path);
        });
      },
      addComment: function (data) {
        if (data.phase !== 'H' || data.targetType !== 'tcard') return this.addDoc('comments', data);
        var c = classId;
        return ready.then(function () {
          var comments = colRef('comments', c), card = colRef('tcards', c).doc(data.targetId), ref = comments.doc();
          return track(comments.where('targetId', '==', data.targetId).get().then(function (existing) {
            var legacy = existing.docs.filter(function (s) { var x=s.data(); return x.phase === 'H' && x.targetType === 'tcard'; }).map(function (s) { return s.id; });
            return db.runTransaction(function (tx) {
              return tx.get(card).then(function (s) {
                if (!s.exists) throw new Error('댓글을 달 글이 없어졌어요.');
                var ids = s.data().hCommentIds;
                if (!Array.isArray(ids)) ids = legacy;
                return Promise.all(ids.map(function (id) { return tx.get(comments.doc(id)); })).then(function (snaps) {
                  var live = ids.filter(function (_, i) { return snaps[i].exists; });
                  if (live.length >= 2) throw commentLimit();
                  tx.set(card, {hCommentIds:live.concat([ref.id])}, {merge:true});
                  tx.set(ref, stripId(data));
                  return ref.id;
                });
              });
            });
          }), 'comment/' + c + '/' + data.targetId);
        });
      },
      addDoc: function (col, data) {
        return ready.then(function () {
          var ref = colRef(col).doc();
          var clean = stripId(data);
          return track(ref.set(clean), ref.path).then(function () { return ref.id; });
        });
      },
      deleteDoc: function (col, id) {
        return ready.then(function () {
          var ref = colRef(col).doc(id);
          if (col !== 'comments') return track(ref.delete(), ref.path);
          return track(db.runTransaction(function (tx) {
            return tx.get(ref).then(function (snap) {
              if (!snap.exists) return;
              var c = snap.data();
              if (c.phase !== 'H' || c.targetType !== 'tcard') { tx.delete(ref); return; }
              var card = colRef('tcards').doc(c.targetId);
              return tx.get(card).then(function (s) {
                var ids = s.exists && s.data().hCommentIds;
                if (ids) tx.set(card, {hCommentIds:ids.filter(function (x) { return x !== id; })}, {merge:true});
                tx.delete(ref);
              });
            });
          }), ref.path);
        });
      },
      setDocInClasses: function (ids, col, docId, data, opt) {
        return ready.then(function () {
          var clean = stripId(data), merge = !!(opt && opt.merge);
          // The snapshot listener updates the screen after the server acknowledges the batch.
          var b = db.batch();
          ids.forEach(function (c) { b.set(colRef(col, c).doc(docId), clean, { merge: merge }); });
          return track(b.commit());
        });
      },
      resetClass: function (opt) {   // opt.classId 없으면 지금 반
        var c = (opt && opt.classId) || classId;
        return ready.then(function () {
          return Promise.all(COLLECTIONS.concat(['presence']).map(function (col) { return colRef(col, c).get(); }));
        }).then(function (snaps) {
          var ops = [];
          snaps.forEach(function (s) { s.docs.forEach(function (d) { ops.push({ ref: d.ref }); }); });
          return track(chunkedBatch(ops));
        }).then(function () {
          var data = initialData(c);
          var ops = [];
          Object.keys(data).forEach(function (col) {
            Object.keys(data[col]).forEach(function (id) { ops.push({ ref: colRef(col, c).doc(id), data: data[col][id] }); });
          });
          return track(chunkedBatch(ops));
        });
      },

      onChange: changes.on, onPresence: presenceEv.on, onError: errors.on, onSync: syncEv.on,

      // 접속 표시는 "저장 중" 표시에 넣지 않음
      setPresence: function (id, info) {
        return ready.then(function () {
          var data = Object.assign({}, info, { t: Date.now() });
          applyLocal('presence', id, data, false, false);
          colRef('presence').doc(id).set(data).catch(report);
        });
      },
      clearPresence: function (id) {
        return ready.then(function () {
          applyLocal('presence', id, null, false, true);
          colRef('presence').doc(id).delete().catch(function () {});
        });
      },
      listPresence: function () {
        return ready.then(function () {
          var all = docsOf('presence'), now = Date.now();
          return Object.keys(all)
            .filter(function (id) { return now - (all[id].t || 0) < ONLINE_MS; })
            .map(function (id) { return Object.assign({}, all[id], { id: id }); });
        });
      }
    };
  }
})();
