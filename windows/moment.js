const params = new URLSearchParams(location.hash.slice(1));
const section = params.get('s');
const snoozeLeft = parseInt(params.get('sz') || '0', 10);

const el = (id) => document.getElementById(id);
const LABEL = { vision: 'חזון אישי', mantra: 'מנטרה', traits: 'התכונות שלי', anchor: 'תזכורת לעצמי', gratitude: 'רגע של הודיה' };

let carousel = null; // { items, idx, show }

function timeLabel() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function render() {
  const data = await window.rega.getData();
  const sec = data.sections[section];
  el('eyebrow').innerHTML = `${LABEL[section]} <span class="dot">·</span> ${timeLabel()}`;

  if (section === 'vision') {
    const aspects = (sec.aspects && sec.aspects.length) ? sec.aspects
      : [{ title: '', text: 'עדיין לא הוזן חזון. פתח את ההגדרות כדי להזין.' }];
    el('title').classList.add('vision', 'ts-' + (sec.textSize || 'm'));
    document.querySelector('.wrap').classList.add('wide');
    setupCarousel(aspects, (a) => {
      el('facet').textContent = a.title || ''; el('facet').style.display = a.title ? 'block' : 'none';
      el('title').textContent = a.text || '';
    });
    el('cue').textContent = aspects.length > 1 ? 'קרא לאט. החלק לצדדים לעוד היבטים.' : 'קרא לאט. זה מי שאתה במיטבך.';
    el('act').textContent = 'קראתי';
  } else if (section === 'mantra') {
    const items = (sec.items && sec.items.length) ? sec.items : ['עדיין לא הוזנו מנטרות. פתח את ההגדרות.'];
    setupCarousel(items, (m) => { el('title').textContent = m; });
    el('cue').textContent = items.length > 1 ? 'החלק לצדדים לראות עוד.' : 'משפט אחד. קרא אותו, אולי בקול.';
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
    const items = (sec.items && sec.items.length) ? sec.items : [{ image: '', caption: '' }];
    setupCarousel(items, (it) => {
      if (it.image) { el('anchor').src = 'file://' + it.image + '?t=' + Date.now(); el('anchor').style.display = 'block'; }
      else el('anchor').style.display = 'none';
      el('extra').innerHTML = `<div class="mantra" style="font-size:24px">${escapeHtml(it.caption || '')}</div>`;
    });
    el('cue').textContent = items.length > 1 ? 'החלק לצדדים לעוד עוגנים.' : '';
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

/* ---------- carousel (mantra / vision / anchor) ---------- */
function setupCarousel(items, show) {
  carousel = { items, idx: Math.floor(Math.random() * items.length), show };
  show(items[carousel.idx]);
  if (items.length > 1) { el('navPrev').style.display = 'flex'; el('navNext').style.display = 'flex'; renderDots(); }
}
function renderDots() {
  const d = el('dots'); d.style.display = 'flex';
  d.innerHTML = carousel.items.map((_, i) => `<i class="${i === carousel.idx ? 'on' : ''}"></i>`).join('');
}
function move(dir) {
  if (!carousel || carousel.items.length < 2) return;
  carousel.idx = (carousel.idx + dir + carousel.items.length) % carousel.items.length;
  carousel.show(carousel.items[carousel.idx]);
  renderDots();
}
el('navPrev').onclick = () => move(-1);   // › previous (right, in RTL)
el('navNext').onclick = () => move(1);    // ‹ next (left)

el('act').onclick = () => {
  let text = null;
  if (section === 'gratitude') {
    const g = el('grat'); text = g ? g.value.trim() : '';
    if (!text) { g.focus(); g.style.borderColor = 'var(--gold)'; return; }
  }
  window.rega.action(section, text);
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return window.rega.closeMoment();
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && section === 'gratitude') return el('act').click();
  const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (!typing && e.key === 'ArrowRight') move(-1);   // RTL: right = previous
  if (!typing && e.key === 'ArrowLeft') move(1);
});
let sx = null;
document.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (sx == null) return; const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 40) move(dx > 0 ? -1 : 1); sx = null;
});

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

render();
