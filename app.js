(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i) || document.createElement('div'); };
  var vw = $('viewport'), inn = $('inner'), q = $('q'), resEl = $('results'),
      msg = $('msg'), dl = $('dl');
  /* ===== قلب الصورة: غيّر false إلى true =====
     FLIP_X = مرآة يمين/يسار | FLIP_Y = قلب فوق/تحت | الاثنين معاً = دوران 180°
     (مواقع القطع بملف data.js ما بتتغير)
     للتجربة السريعة بدون تعديل: أضف للرابط ?flip=x أو ?flip=y أو ?flip=xy */
  var FLIP_X = false, FLIP_Y = false;
  var fm = /[?&]flip=(\w+)/.exec(location.search);
  if (fm) { FLIP_X = /x/i.test(fm[1]); FLIP_Y = /y/i.test(fm[1]); }
  /* دوران الصورة: ملف map.jpg محفوظ مدوّر 90° باتجاه عقارب الساعة (مثل p.jpg).
     القيم: 0 | 90 | 180 | 270 — بيانات data.js (الاحداثيات الأصلية) ما بتتغير */
  var ROT = 90;
  var rm = /[?&]rot=(\d+)/.exec(location.search);
  if (rm) ROT = (+rm[1]) % 360;
  function toView(x, y) {
    var a, b;
    if (ROT === 90) { a = 100 - y; b = x; }
    else if (ROT === 180) { a = 100 - x; b = 100 - y; }
    else if (ROT === 270) { a = y; b = 100 - x; }
    else { a = x; b = y; }
    return { x: FLIP_X ? 100 - a : a, y: FLIP_Y ? 100 - b : b };
  }
  function fromView(a, b) {
    if (FLIP_X) a = 100 - a;
    if (FLIP_Y) b = 100 - b;
    if (ROT === 90) return { x: b, y: 100 - a };
    if (ROT === 180) return { x: 100 - a, y: 100 - b };
    if (ROT === 270) return { x: 100 - b, y: a };
    return { x: a, y: b };
  }
  $('mapimg').style.transform = 'scale(' + (FLIP_X ? -1 : 1) + ',' + (FLIP_Y ? -1 : 1) + ')';
  var D = [], z = 1, pinEl = null, cur = null, tmp = null, tmpEl = null;
  var admin = /admin/.test(location.hash) || window.ADMIN === true;
  if (admin) $('admin').hidden = false;

  /* ---------- تحميل البيانات (data.js) ---------- */
  var s = document.createElement('script');
  s.src = 'data.js?v=' + Date.now();
  s.onload = function () {
    D = (window.MAP_DATA || []).slice();
    if (admin) {
      try {
        var dr = localStorage.getItem('mapDraft');
        if (dr) { D = JSON.parse(dr); msg.textContent = 'تم تحميل نسختك المحفوظة بالمتصفح (' + D.length + ' مكان)'; }
      } catch (e) {}
    }
    fillList();
  };
  s.onerror = function () { msg.textContent = 'تعذر تحميل ملف data.js'; };
  document.head.appendChild(s);

  function fillList() {
    dl.innerHTML = '';
    D.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.name;
      dl.appendChild(o);
    });
  }

  /* ---------- البحث ---------- */
  function norm(t) {
    return String(t).toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 1632; })
      .replace(/[\u06F0-\u06F9]/g, function (c) { return c.charCodeAt(0) - 1776; })
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  }
  function find(text) {
    var k = norm(text);
    if (!k) return [];
    var exact = D.filter(function (d) {
      var n = norm(d.name);
      return n === k || n.split(' ').indexOf(k) > -1;
    });
    if (exact.length) return exact;
    return D.filter(function (d) { return norm(d.name).indexOf(k) > -1; });
  }
  function go() {
    var r = find(q.value);
    if (!r.length) {
      msg.textContent = 'ما في نتيجة لـ "' + q.value + '"';
      chips([]);
      return;
    }
    chips(r);
    show(r[0], r.length);
    q.blur();
  }
  function chips(r) {
    resEl.innerHTML = '';
    if (r.length < 2) return;
    r.slice(0, 50).forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = d.name;
      b.onclick = function () { show(d, r.length); };
      resEl.appendChild(b);
    });
  }

  /* ---------- العرض والتكبير ---------- */
  function clearPin() { if (pinEl) { pinEl.remove(); pinEl = null; } }
  function makePin(d, cls) {
    var p = document.createElement('div');
    p.className = 'pin' + (cls ? ' ' + cls : '');
    var v = toView(d.x, d.y);
    p.style.left = v.x + '%';
    p.style.top = v.y + '%';
    p.appendChild(document.createElement('i'));
    if (d.name) {
      var b = document.createElement('b');
      b.textContent = d.name;
      p.appendChild(b);
    }
    inn.appendChild(p);
    return p;
  }
  function show(d, count) {
    cur = d;
    clearPin();
    pinEl = makePin(d, 's');
    msg.textContent = d.name + (count > 1 ? '  (' + count + ' نتائج)' : '');
    setZoom(Math.max(z, 3));
    center(d);
  }
  function center(d) {
    var v = toView(d.x, d.y);
    vw.scrollLeft = v.x / 100 * inn.clientWidth - vw.clientWidth / 2;
    vw.scrollTop = v.y / 100 * inn.clientHeight - vw.clientHeight / 2;
  }
  function setZoom(nz, fx, fy) {
    nz = Math.max(1, Math.min(8, nz));
    if (fx == null) { fx = vw.clientWidth / 2; fy = vw.clientHeight / 2; }
    var ox = (vw.scrollLeft + fx) / inn.clientWidth,
        oy = (vw.scrollTop + fy) / inn.clientHeight;
    z = nz;
    inn.style.width = (vw.clientWidth * z) + 'px';
    vw.scrollLeft = ox * inn.clientWidth - fx;
    vw.scrollTop = oy * inn.clientHeight - fy;
    inn.classList.toggle('lab', z >= 2.5);
  }
  window.addEventListener('resize', function () {
    inn.style.width = (vw.clientWidth * z) + 'px';
  });

  /* ---------- سحب + تكبير بإصبعين + عجلة الماوس ---------- */
  var ptrs = {}, pd = 0, moved = 0;
  function count() { return Object.keys(ptrs).length; }
  function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  vw.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { vw.setPointerCapture(e.pointerId); } catch (x) {}
    moved = 0;
    if (count() === 2) { var a = pts(); pd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  });
  vw.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId];
    if (!p) return;
    if (count() === 1) {
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      vw.scrollLeft -= dx; vw.scrollTop -= dy;
      moved += Math.abs(dx) + Math.abs(dy);
    } else if (count() === 2) {
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var a = pts(), nd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), r = vw.getBoundingClientRect();
      if (pd) setZoom(z * nd / pd, (a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top);
      pd = nd; moved = 99;
      return;
    }
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
  });
  function up(e) {
    var wasOne = count() === 1;
    delete ptrs[e.pointerId];
    pd = 0;
    if (wasOne && moved < 8 && admin && e.type === 'pointerup') {
      var r = inn.getBoundingClientRect();
      var u = fromView((e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100);
      tmp = { x: Math.round(u.x * 100) / 100, y: Math.round(u.y * 100) / 100 };
      if (tmpEl) tmpEl.remove();
      tmpEl = makePin({ x: tmp.x, y: tmp.y, name: '' }, 't');
      msg.textContent = 'تم تحديد الموقع، اكتب الاسم ثم "حفظ المكان"';
    }
  }
  vw.addEventListener('pointerup', up);
  vw.addEventListener('pointercancel', up);
  vw.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = vw.getBoundingClientRect();
    setZoom(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  $('zi').onclick = function () { setZoom(z * 1.4); };
  $('zo').onclick = function () { setZoom(z / 1.4); };
  $('zr').onclick = function () { setZoom(1); vw.scrollLeft = 0; vw.scrollTop = 0; clearPin(); resEl.innerHTML = ''; msg.textContent = ''; };
  $('go').onclick = go;
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

  /* ---------- عرض كل النقاط (للإدارة) ---------- */
  var allEls = [], allOn = false;
  function drawAll() {
    allEls.forEach(function (e) { e.remove(); }); allEls = [];
    if (!allOn) return;
    D.forEach(function (d) { allEls.push(makePin(d, 'm')); });
  }
  function refreshAll() { if (allOn) drawAll(); }
  function toggleAll() {
    allOn = !allOn; drawAll();
    $('aall').classList.toggle('on', allOn);
    msg.textContent = allOn ? 'ظاهر ' + D.length + ' مكان بأرقامها — اضغط "عرض الكل" مرة ثانية للإخفاء' : '';
  }
  $('zall').onclick = toggleAll;
  $('aall').onclick = toggleAll;

  /* ---------- لوحة الإدارة ---------- */
  if (!admin) return;
  function draft() { try { localStorage.setItem('mapDraft', JSON.stringify(D)); } catch (e) {} refreshAll(); }
  var undo = [];
  function refreshList() { if (!$('alist').hidden) renderList(); }
  function renderList() {
    var box = $('alist'); box.innerHTML = '';
    D.slice().reverse().forEach(function (d) {
      var r = document.createElement('div'); r.className = 'li';
      var sp = document.createElement('span'); sp.textContent = d.name;
      sp.onclick = function () { show(d, 1); };
      var b = document.createElement('button'); b.type = 'button'; b.className = 's'; b.textContent = 'حذف';
      b.onclick = function () {
        undo.push({ op: 'del', d: d });
        D = D.filter(function (x) { return x !== d; });
        if (cur === d) { cur = null; clearPin(); }
        fillList(); draft(); renderList();
        msg.textContent = 'تم حذف "' + d.name + '" — اضغط "تراجع" لإرجاعها';
      };
      r.appendChild(sp); r.appendChild(b); box.appendChild(r);
    });
  }
  $('alistbtn').onclick = function () {
    var box = $('alist'); box.hidden = !box.hidden;
    if (!box.hidden) renderList();
  };
  $('aundo').onclick = function () {
    var u = undo.pop();
    if (!u) { msg.textContent = 'ما في شي للتراجع عنه'; return; }
    if (u.op === 'add') { D = D.filter(function (x) { return x !== u.d; }); msg.textContent = 'تم التراجع عن إضافة "' + u.d.name + '"'; }
    else { D.push(u.d); msg.textContent = 'تم إرجاع "' + u.d.name + '"'; }
    fillList(); draft(); refreshList();
  };
  $('areset').onclick = function () {
    try { localStorage.removeItem('mapDraft'); } catch (e) {}
    D = (window.MAP_DATA || []).slice(); fillList(); refreshAll();
    msg.textContent = 'رجعنا لنسخة data.js الأصلية';
  };
  $('as').onclick = function () {
    var name = $('an').value.trim();
    if (!tmp) { msg.textContent = 'اضغط على الخريطة أولاً لتحديد الموقع'; return; }
    if (!name) { msg.textContent = 'اكتب الرقم أو الاسم'; return; }
    var type = $('at').value;
    if (type === 'plot' && /^[\d\u0660-\u0669]+$/.test(name)) name = 'قطعة ' + norm(name);
    D.push({ name: name, type: type, x: tmp.x, y: tmp.y });
    undo.push({ op: 'add', d: D[D.length - 1] });
    fillList();
    if (tmpEl) { tmpEl.remove(); tmpEl = null; }
    tmp = null; $('an').value = '';
    draft(); refreshList();
    msg.textContent = 'تمت إضافة "' + name + '" وانحفظت بالمتصفح — العدد: ' + D.length + '. لما تخلص اضغط "تنزيل data.js"';
  };
  $('ad').onclick = function () {
    if (!cur) { msg.textContent = 'ابحث عن المكان أولاً ثم احذفه'; return; }
    undo.push({ op: 'del', d: cur });
    D = D.filter(function (d) { return d !== cur; });
    msg.textContent = 'تم حذف "' + cur.name + '" (اضغط نشر)';
    cur = null; clearPin(); fillList(); draft(); refreshList();
  };
  function dataText() { return 'window.MAP_DATA=' + JSON.stringify(D) + ';\n'; }
  $('adl').onclick = function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([dataText()], { type: 'text/javascript' }));
    a.download = 'data.js';
    document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = 'تم التنزيل. انسخ data.js من مجلد التنزيلات فوق الملف القديم بمجلد الموقع (وإذا اسمه data (1).js غيّره لـ data.js)';
  };
  $('apub').onclick = function () {
    msg.textContent = 'جاري النشر...';
    fetch('save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('ap').value, items: D })
    }).then(function (r) { return r.json(); }).then(function (j) {
      msg.textContent = j.ok ? 'تم النشر ✔ (' + j.count + ' مكان)' : 'فشل: ' + (j.error || '');
    }).catch(function () {
      msg.textContent = 'ما اشتغل النشر (save.php غير متوفر). استخدم "تنزيل data.js" وارفعه يدوياً.';
    });
  };
})();
