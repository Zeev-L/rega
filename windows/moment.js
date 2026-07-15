const params = new URLSearchParams(location.hash.slice(1));
const section = params.get('s');
const snoozeLeft = parseInt(params.get('sz') || '0', 10);

const el = (id) => document.getElementById(id);
const LABEL = { vision: 'חזון אישי', mantra: 'מנטרה', traits: 'התכונות שלי', anchor: 'תזכורת לעצמי', gratitude: 'רגע של הודיה' };

let mantras = [];
let mIdx = 0;

function timeLabel() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function render() {
  const data = await window.rega.getData();
  const sec = data.sections[section];
  el('eyebrow').innerHTML = `${LABEL[section]} <span class="dot">·</span> ${timeLabel()}`;

  if (section === 'vision') {
    const asp = (sec.aspects && sec.aspects.length) ? sec.aspects[Math.floor(Math.random() * sec.aspects.length)] : { title: '', text: 'עדיין לא הוזן חזון. פתח את ההגדרות כדי להזין.' };
    el('facet').textContent = asp.title; el('facet').style.display = 'block';
    el('title').textContent = asp.text;
    el('cue').textContent = 'קרא לאט. זה מי שאתה במיטבך.';
    el('act').textContent = 'קראתי';
  } else if (section === 'mantra') {
    mantras = (sec.items && sec.items.length) ? sec.items.slice() : ['עדיין לא הוזנו מנטרות. פתח את ההגדרות.'];
    mIdx = Math.floor(Math.random() * mantras.length);
    showMantra();
    if (mantras.length > 1) { el('prev').style.display = ''; el('next').style.display = ''; el('cue').textContent = 'החלק לצדדים לראות עוד.'; }
    else el('cue').textContent = 'משפט אחד. קרא אותו, אולי בקול.';
    el('act').textContent = 'המשך ליום'; el('act').classList.add('ghost');
    el('extra').innerHTML = '<div class="ring"><i></i><b class="breathe"></b></div>';
  } else if (section === 'traits') {
    const items = (sec.items && sec.items.length) ? sec.items : [{ text: 'עדיין לא הוזנו תכונות', hot: false }];
    el('cloud').style.display = 'flex';
    el('cloud').innerHTML = items.map((t) => `<span class="word${t.hot ? ' hot' : ''}">${escapeHtml(t.text)}</span>`).join('');
    el('title').style.display = 'none';
    el('cue').innerHTML = 'אלה הכוחות שאתה מביא לעבודה.<br>המודגשות בזהב — אלה שבחרת להבליט.';
    el('act').textContent = 'יופי, ממשיך'; el('act').classList.add('ghost');
  } else if (section === 'anchor') {
    el('title').style.display = 'none';
    if (sec.image) { el('anchor').src = 'file://' + sec.image + '?t=' + Date.now(); el('anchor').style.display = 'block'; }
    el('extra').innerHTML = `<div class="mantra" style="font-size:24px">${escapeHtml(sec.caption || '')}</div>`;
    el('cue').textContent = '';
    el('act').textContent = 'תודה, ממשיך'; el('act').classList.add('ghost');
  } else if (section === 'gratitude') {
    el('title').classList.add('sm');
    el('title').textContent = sec.question || 'על מה אתה אסיר תודה עכשיו?';
    el('extra').innerHTML = `<textarea class="field" id="grat" placeholder="${escapeAttr(sec.placeholder || '')}" style="margin-top:22px"></textarea>
      <div class="meta"><span>משפט אחד מספיק — יישמר וישלח אליך הערב</span></div>`;
    el('cue').textContent = '';
    el('act').textContent = 'שמור';
    setTimeout(() => { const g = el('grat'); if (g) g.focus(); }, 60);
  }

  if (snoozeLeft > 0) {
    const s = el('snooze'); s.style.display = ''; s.textContent = `נודניק (עוד 10 דק׳)`;
    s.onclick = () => window.rega.snooze();
  }
}

function showMantra() { el('title').textContent = mantras[mIdx]; el('title').classList.remove('sm'); }
el('prev').onclick = () => { mIdx = (mIdx - 1 + mantras.length) % mantras.length; showMantra(); };
el('next').onclick = () => { mIdx = (mIdx + 1) % mantras.length; showMantra(); };

el('act').onclick = () => {
  let text = null;
  if (section === 'gratitude') {
    const g = el('grat'); text = g ? g.value.trim() : '';
    if (!text) { g.focus(); g.style.borderColor = 'var(--gold)'; return; }
  }
  window.rega.action(section, text);
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.rega.closeMoment();
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && section === 'gratitude') el('act').click();
});

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

render();
