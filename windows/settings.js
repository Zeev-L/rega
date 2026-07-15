const SEC = ['vision', 'mantra', 'traits', 'anchor', 'gratitude'];
const LABEL = { vision: 'חזון אישי', mantra: 'מנטרה', traits: 'התכונות שלי', anchor: 'עוגן ויזואלי', gratitude: 'הודיה (עבודה)' };
const ELABEL = { vision: 'חזון', mantra: 'מנטרה', traits: 'תכונות', anchor: 'עוגן', gratitude: 'הודיה' };
const ACTION = { vision: 'קראתי', mantra: 'המשך', traits: 'ממשיך', anchor: 'ממשיך', gratitude: 'שמור' };
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

let D = null;

function h(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k === 'html') e.innerHTML = props[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
    else if (k === 'value') e.value = props[k];
    else e.setAttribute(k, props[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
const $ = (s) => document.querySelector(s);

function summaryText(sec) {
  const t = (sec.times || []).join(' · ') || '—';
  const dys = (sec.days || []).map((d) => DAYS[d]).join(',');
  return `${t} · ימים: ${dys} · נודניק עד ${sec.snooze || 0}×`;
}

/* ---------------- settings tab ---------------- */
function renderSecList() {
  const list = $('#secList'); list.innerHTML = '';
  SEC.forEach((id) => {
    const sec = D.sections[id];
    const sub = h('div', { class: 'sub' }, summaryText(sec));
    const tog = h('div', { class: 'tog' + (sec.enabled ? ' on' : '') }, h('b'));
    const sched = buildSched(id, sec, sub);
    tog.addEventListener('click', () => {
      sec.enabled = !sec.enabled;
      tog.classList.toggle('on', sec.enabled);
      sched.classList.toggle('on', sec.enabled);
    });
    const hd = h('div', { class: 'sechd' }, [
      h('div', { class: 'grow' }, [h('div', { class: 'name' }, LABEL[id]), sub]),
      tog
    ]);
    list.append(h('div', { class: 'sec' }, [hd, sched]));
  });
}

function buildSched(id, sec, subEl) {
  const refresh = () => { subEl.textContent = summaryText(sec); };

  // times
  const timesWrap = h('div', { class: 'times' });
  const drawTimes = () => {
    timesWrap.innerHTML = '';
    sec.times.forEach((t, i) => {
      const inp = h('input', { value: t, oninput: (e) => { sec.times[i] = e.target.value; refresh(); } });
      const x = h('span', { class: 'x', onclick: () => { sec.times.splice(i, 1); drawTimes(); refresh(); } }, '✕');
      timesWrap.append(h('span', { class: 'time' }, [inp, x]));
    });
    const add = h('button', { class: 'addtime', onclick: () => { sec.times.push('12:00'); drawTimes(); refresh(); } }, '+ הוסף שעה');
    timesWrap.append(add);
  };
  drawTimes();

  // snooze
  const num = h('span', { class: 'num' }, String(sec.snooze));
  const dec = h('button', { class: 'rb', onclick: () => { sec.snooze = Math.max(0, sec.snooze - 1); num.textContent = sec.snooze; refresh(); } }, '−');
  const inc = h('button', { class: 'rb', onclick: () => { sec.snooze = Math.min(9, sec.snooze + 1); num.textContent = sec.snooze; refresh(); } }, '+');

  // random
  const rnd = h('div', { class: 'tog' + (sec.random15 ? ' on' : '') }, h('b'));
  rnd.addEventListener('click', () => { sec.random15 = !sec.random15; rnd.classList.toggle('on', sec.random15); });

  // days
  const daysWrap = h('div', { class: 'days' });
  DAYS.forEach((lbl, d) => {
    const btn = h('button', { class: 'day' + (sec.days.includes(d) ? ' on' : '') }, lbl);
    btn.addEventListener('click', () => {
      if (sec.days.includes(d)) sec.days = sec.days.filter((x) => x !== d);
      else { sec.days.push(d); sec.days.sort(); }
      btn.classList.toggle('on'); refresh();
    });
    daysWrap.append(btn);
  });

  const sched = h('div', { class: 'sched' + (sec.enabled ? ' on' : '') }, [
    row('שעות ביום', timesWrap),
    row('נודניק (דחיות מותרות)', h('span', { class: 'ctrl' }, [dec, num, inc])),
    row('±15 דק׳ רנדום', rnd),
    row('ימים בשבוע', daysWrap)
  ]);
  return sched;
}
function row(label, control) {
  return h('div', { class: 'srow' }, [h('span', {}, label), control]);
}

function renderEmailRelay() {
  const et = $('#emailTog'); et.classList.toggle('on', !!D.email.enabled);
  et.onclick = () => { D.email.enabled = !D.email.enabled; et.classList.toggle('on', D.email.enabled); };
  $('#emailAddr').value = D.email.address || '';
  $('#emailAddr').oninput = (e) => { D.email.address = e.target.value; };
  $('#emailTime').value = D.email.time || '19:00';
  $('#emailTime').oninput = (e) => { D.email.time = e.target.value; };
  $('#relayUrl').value = D.relay.url || '';
  $('#relayUrl').oninput = (e) => { D.relay.url = e.target.value.trim(); };
  $('#relaySecret').value = D.relay.secret || '';
  $('#relaySecret').oninput = (e) => { D.relay.secret = e.target.value; };
  [...document.querySelectorAll('#lang b')].forEach((b) => {
    b.classList.toggle('on', b.dataset.l === (D.language || 'he'));
    b.onclick = () => { D.language = b.dataset.l; [...document.querySelectorAll('#lang b')].forEach((x) => x.classList.toggle('on', x === b)); };
  });
  $('#testMail').onclick = async () => {
    const msg = $('#testMsg'); msg.style.color = 'var(--ivory-dim)'; msg.textContent = 'שומר ושולח…';
    await persist(true);
    const r = await window.rega.sendSummary();
    if (r.ok) { msg.style.color = 'var(--gold)'; msg.textContent = 'נשלח ✓ בדוק את תיבת המייל.'; }
    else { msg.style.color = '#e59'; msg.textContent = 'לא נשלח: ' + hint(r.error); }
  };
}
function hint(err) {
  if (/relay not configured|bad relay url/.test(err)) return 'חסרה כתובת Web App תקינה.';
  if (/email disabled/.test(err)) return 'המייל כבוי או ריק.';
  return err;
}

/* ---------------- editor tab ---------------- */
let curEdit = 'vision';
function renderEditor() {
  const st = $('#subtabs'); st.innerHTML = '';
  SEC.forEach((id) => {
    const b = h('b', { class: id === curEdit ? 'on' : '', onclick: () => { curEdit = id; renderEditor(); } }, ELABEL[id]);
    st.append(b);
  });
  const box = $('#editors'); box.innerHTML = '';
  box.append(editorFor(curEdit));
}
function editorFor(id) {
  const sec = D.sections[id];
  if (id === 'vision') return visionEditor(sec);
  if (id === 'mantra') return listEditor(sec, 'items', 'כתוב מנטרה חדשה…', 'במסך המנטרה מוצגת אחת בכל פעם, ואפשר להחליק לראות עוד.');
  if (id === 'traits') return traitsEditor(sec);
  if (id === 'anchor') return anchorEditor(sec);
  if (id === 'gratitude') return gratitudeEditor(sec);
}

function visionEditor(sec) {
  const wrap = h('div');
  const redraw = () => {
    wrap.innerHTML = '';
    sec.aspects.forEach((a, i) => {
      const ttl = h('input', { class: 'line ttl', value: a.title, oninput: (e) => { a.title = e.target.value; } });
      const txt = h('textarea', { rows: '2', oninput: (e) => { a.text = e.target.value; } }); txt.value = a.text;
      const x = h('span', { class: 'x', onclick: () => { sec.aspects.splice(i, 1); redraw(); } }, '✕');
      wrap.append(h('div', { class: 'row' }, [h('div', { class: 'tx' }, [ttl, txt]), x]));
    });
    const inp = h('input', { placeholder: 'הוסף היבט חדש (כותרת)…' });
    const add = h('button', { onclick: () => { if (inp.value.trim()) { sec.aspects.push({ title: inp.value.trim(), text: '' }); redraw(); } } }, 'הוסף');
    wrap.append(h('div', { class: 'addrow' }, [inp, add]));
    wrap.append(h('div', { class: 'note' }, 'כל היבט הוא חלק מהחזון (מה אני נותן · מה זה גורם לי · איך אני מרגיש). אפשר להוסיף עוד.'));
  };
  redraw(); return wrap;
}

function listEditor(sec, key, ph, note) {
  const wrap = h('div');
  const redraw = () => {
    wrap.innerHTML = '';
    sec[key].forEach((val, i) => {
      const txt = h('textarea', { rows: '1', oninput: (e) => { sec[key][i] = e.target.value; } }); txt.value = val;
      const x = h('span', { class: 'x', onclick: () => { sec[key].splice(i, 1); redraw(); } }, '✕');
      wrap.append(h('div', { class: 'row' }, [h('div', { class: 'tx' }, txt), x]));
    });
    const inp = h('input', { placeholder: ph });
    const add = h('button', { onclick: () => { if (inp.value.trim()) { sec[key].push(inp.value.trim()); redraw(); } } }, 'הוסף');
    wrap.append(h('div', { class: 'addrow' }, [inp, add]));
    wrap.append(h('div', { class: 'note' }, note));
  };
  redraw(); return wrap;
}

function traitsEditor(sec) {
  const wrap = h('div');
  const redraw = () => {
    wrap.innerHTML = '';
    const chips = h('div', { style: 'margin-bottom:6px' });
    sec.items.forEach((t, i) => {
      const star = h('span', { class: 'st', onclick: () => { t.hot = !t.hot; redraw(); } }, t.hot ? '★' : '☆');
      const x = h('span', { class: 'x', onclick: () => { sec.items.splice(i, 1); redraw(); } }, '✕');
      chips.append(h('span', { class: 'chip' + (t.hot ? ' hot' : '') }, [document.createTextNode(t.text + ' '), star, x]));
    });
    wrap.append(chips);
    const inp = h('input', { placeholder: 'הוסף תכונה…' });
    const add = h('button', { onclick: () => { if (inp.value.trim()) { sec.items.push({ text: inp.value.trim(), hot: false }); redraw(); } } }, 'הוסף');
    wrap.append(h('div', { class: 'addrow' }, [inp, add]));
    wrap.append(h('div', { class: 'note' }, 'לחץ ★ כדי להבליט תכונה (תופיע בזהב).'));
  };
  redraw(); return wrap;
}

function anchorEditor(sec) {
  const wrap = h('div');
  const prev = h('img', { class: 'anchor-prev' });
  if (sec.image) { prev.src = 'file://' + sec.image + '?t=' + Date.now(); prev.style.display = 'block'; }
  const up = h('button', { class: 'upload', onclick: async () => {
    const p = await window.rega.pickImage();
    if (p) { sec.image = p; prev.src = 'file://' + p + '?t=' + Date.now(); prev.style.display = 'block'; }
  } }, 'העלה תמונה מהמחשב');
  const cap = h('input', { class: 'cin', value: sec.caption || '', oninput: (e) => { sec.caption = e.target.value; } });
  wrap.append(prev, h('div', {}, up), h('div', { class: 'clabel' }, 'כיתוב (טקסט חופשי שלך)'), cap,
    h('div', { class: 'note' }, 'התמונה נשמרת בחשבון שלך במחשב. הכיתוב מופיע מתחתיה במסך העוגן.'));
  return wrap;
}

function gratitudeEditor(sec) {
  const q = h('input', { class: 'cin', value: sec.question || '', oninput: (e) => { sec.question = e.target.value; } });
  const p = h('input', { class: 'cin', value: sec.placeholder || '', oninput: (e) => { sec.placeholder = e.target.value; } });
  return h('div', {}, [
    h('div', { class: 'clabel', style: 'margin-top:0' }, 'שאלת ההודיה שתוצג לך'), q,
    h('div', { class: 'clabel' }, 'רמז בשדה הכתיבה'), p,
    h('div', { class: 'note' }, 'מה שתכתוב בכל פעם נשמר אוטומטית ונשלח אליך בסיכום הערב.')
  ]);
}

/* ---------------- tabs + persist ---------------- */
function switchTab(tab) {
  [...document.querySelectorAll('.tabs b')].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  [...document.querySelectorAll('.pane')].forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
}
async function persist(silent) {
  await window.rega.save({ sections: D.sections, email: D.email, relay: D.relay, language: D.language });
  if (!silent) { const s = $('#saved'); s.classList.add('show'); setTimeout(() => s.classList.remove('show'), 1600); }
}

async function init() {
  D = await window.rega.getData();
  renderSecList();
  renderEmailRelay();
  renderEditor();

  document.querySelectorAll('.tabs b').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#save').addEventListener('click', () => persist(false));
  $('#cancel').addEventListener('click', async () => { D = await window.rega.getData(); renderSecList(); renderEmailRelay(); renderEditor(); });

  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('tab') === 'editor') { switchTab('editor'); if (p.get('sec')) { curEdit = p.get('sec'); renderEditor(); } }
}
init();
