const { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, dialog, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
// Pin a stable data folder so dev-run and the packaged app share the same storage.
app.setPath('userData', path.join(app.getPath('appData'), 'rega'));
const store = require('./store');

const SECTION_ORDER = ['vision', 'mantra', 'traits', 'anchor', 'gratitude'];
const SECTION_LABEL = { vision: 'חזון אישי', mantra: 'מנטרה', traits: 'התכונות שלי', anchor: 'עוגן', gratitude: 'הודיה' };

let tray = null;
let settingsWin = null;
let momentWin = null;
let tickTimer = null;

// ---------- scheduling state ----------
let currentDay = null;   // 'YYYY-MM-DD'
let slots = [];          // {key, section, minute, snoozeUsed, status:'waiting'|'shown'|'done'}
let emailSlot = null;    // {minute, status}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function parseHM(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function seededOffset(key) {
  // deterministic-ish per day+slot so the time doesn't jump every tick
  let h = 0;
  const s = currentDay + '|' + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 31) - 15; // -15..+15
}

function rebuildSlots() {
  const data = store.get();
  currentDay = store.ymd(new Date());
  const weekday = new Date().getDay();
  slots = [];
  for (const id of SECTION_ORDER) {
    const sec = data.sections[id];
    if (!sec || !sec.enabled) continue;
    if (Array.isArray(sec.days) && !sec.days.includes(weekday)) continue;
    (sec.times || []).forEach((t, i) => {
      const key = `${id}@${t}#${i}`;
      let minute = parseHM(t);
      if (sec.random15) minute = Math.max(0, Math.min(1439, minute + seededOffset(key)));
      slots.push({ key, section: id, minute, snoozeUsed: 0, status: 'waiting' });
    });
  }
  const em = data.email;
  emailSlot = em && em.enabled ? { minute: parseHM(em.time), status: 'waiting' } : null;
}

function tick() {
  const today = store.ymd(new Date());
  if (today !== currentDay) rebuildSlots();
  const nm = nowMinutes();

  for (const slot of slots) {
    if (slot.status === 'waiting' && nm >= slot.minute) {
      slot.status = 'shown';
      openMoment(slot.section, slot);
      break; // one at a time
    }
  }
  if (emailSlot && emailSlot.status === 'waiting' && nm >= emailSlot.minute) {
    emailSlot.status = 'done';
    sendSummary().catch((e) => console.error('summary send failed', e));
  }
}

// ---------- windows ----------
function openMoment(section, slot, test = false) {
  const data = store.get();
  const sec = data.sections[section];
  const snoozeMax = sec ? (sec.snooze || 0) : 0;
  const snoozeLeft = slot ? Math.max(0, snoozeMax - slot.snoozeUsed) : 0;

  if (momentWin && !momentWin.isDestroyed()) momentWin.close();
  const disp = screen.getPrimaryDisplay();
  momentWin = new BrowserWindow({
    x: disp.bounds.x, y: disp.bounds.y, width: disp.bounds.width, height: disp.bounds.height,
    frame: false, transparent: false, backgroundColor: '#15132a',
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  momentWin.setAlwaysOnTop(true, 'screen-saver');
  momentWin._section = section;
  momentWin._slotKey = slot ? slot.key : null;
  momentWin._test = test;
  momentWin.loadFile(path.join(__dirname, 'windows', 'moment.html'), {
    hash: `s=${section}&sz=${snoozeLeft}&test=${test ? 1 : 0}`
  });
  momentWin.once('ready-to-show', () => { momentWin.show(); app.focus({ steal: true }); });
}

function openSettings(focusEditor) {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 720, height: 760, minWidth: 560, minHeight: 560,
    title: 'רגע — הגדרות', backgroundColor: '#15132a', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  settingsWin.loadFile(path.join(__dirname, 'windows', 'settings.html'), {
    hash: focusEditor ? `tab=editor&sec=${focusEditor}` : 'tab=settings'
  });
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------- email relay ----------
function summaryHtml(items, dateLabel) {
  const rows = items.length
    ? items.map((g) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eee;font-size:16px;color:#2b2340;">— ${escapeHtml(g.text)}</td><td style="padding:12px 0;border-bottom:1px solid #eee;font-size:12px;color:#a08b5a;text-align:left;white-space:nowrap;">${g.time}</td></tr>`).join('')
    : `<tr><td style="padding:16px 0;color:#8a8a8a;">היום לא נרשמו רגעי הודיה. גם זה בסדר — מחר יום חדש.</td></tr>`;
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;direction:rtl;text-align:right;background:#faf7f0;border-radius:16px;overflow:hidden;border:1px solid #eee;">
    <div style="background:linear-gradient(135deg,#2a2140,#5f3444);padding:24px 26px;color:#f4eee1;">
      <div style="font-size:12px;letter-spacing:.15em;color:#e2b566;">רגע · סיכום היום</div>
      <div style="font-size:22px;margin-top:8px;">היום, בעבודה, הודית על</div>
      <div style="font-size:12px;opacity:.7;margin-top:4px;">${dateLabel}</div>
    </div>
    <div style="padding:20px 26px;"><table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:18px;font-size:13px;color:#8a7a55;">גם ביום קשה — זה מה שהיה טוב. תזכורת קטנה כמה אתה מסוגל. 🌅</div>
    </div>
  </div>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function sendSummary(forDay) {
  return new Promise((resolve, reject) => {
    const data = store.get();
    const day = forDay || store.ymd(new Date());
    const items = (data.log[day] && data.log[day].gratitude) || [];
    if (!data.email || !data.email.enabled || !data.email.address) return reject(new Error('email disabled/empty'));
    if (!data.relay || !data.relay.url) return reject(new Error('relay not configured'));

    const payload = JSON.stringify({
      secret: data.relay.secret || '',
      to: data.email.address,
      subject: 'רגע · סיכום היום — על מה הודית',
      html: summaryHtml(items, day)
    });
    let url;
    try { url = new URL(data.relay.url); } catch { return reject(new Error('bad relay url')); }
    const finish = (status, body) => {
      if (status < 200 || status >= 400) return reject(new Error('relay ' + status));
      // Apps Script echoes {code,msg} — treat code>=400 as an app-level failure (e.g. bad secret).
      try {
        const j = JSON.parse(body);
        if (j && typeof j.code === 'number' && j.code >= 400) return reject(new Error(j.msg || ('relay code ' + j.code)));
      } catch { /* non-JSON body: HTTP 2xx already means success */ }
      resolve(body);
    };
    const getUrl = (u, cb) => {
      let uu; try { uu = new URL(u); } catch (e) { return cb(e); }
      (uu.protocol === 'http:' ? http : https).get(uu, (r) => {
        let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => cb(null, r.statusCode, b));
      }).on('error', cb);
    };
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      // Apps Script sends the email in doPost, then 302-redirects to the JSON result — follow it.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return getUrl(res.headers.location, (err, status, body) => err ? reject(err) : finish(status, body));
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => finish(res.statusCode, body));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---------- IPC ----------
ipcMain.handle('data:get', () => store.get());

ipcMain.handle('data:save', (_e, next) => {
  store.update((d) => {
    if (next.language) d.language = next.language;
    if (next.sections) d.sections = next.sections;
    if (next.email) d.email = next.email;
    if (next.relay) d.relay = next.relay;
  });
  rebuildSlots();
  return store.get();
});

ipcMain.handle('image:pick', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'תמונות', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] });
  if (res.canceled || !res.filePaths[0]) return null;
  const src = res.filePaths[0];
  const ext = path.extname(src) || '.png';
  const destDir = path.join(app.getPath('userData'), 'images');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'anchor' + ext);
  fs.copyFileSync(src, dest);
  return dest;
});

ipcMain.handle('moment:action', (_e, { section, gratitudeText }) => {
  if (section === 'gratitude' && gratitudeText && gratitudeText.trim()) store.logGratitude(gratitudeText);
  markSlotDone();
  if (momentWin && !momentWin.isDestroyed()) momentWin.close();
  return true;
});

ipcMain.handle('moment:snooze', () => {
  const slot = slots.find((s) => s.key === (momentWin && momentWin._slotKey));
  if (slot) {
    slot.snoozeUsed += 1;
    slot.minute = nowMinutes() + 10;
    slot.status = 'waiting';
  }
  if (momentWin && !momentWin.isDestroyed()) momentWin.close();
  return true;
});

ipcMain.handle('moment:close', () => { markSlotDone(); if (momentWin && !momentWin.isDestroyed()) momentWin.close(); return true; });

ipcMain.handle('summary:send', async () => {
  try { await sendSummary(); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
});

ipcMain.handle('open:editor', (_e, sec) => { openSettings(sec || 'vision'); return true; });

function markSlotDone() {
  if (!momentWin || momentWin._test) return;
  const slot = slots.find((s) => s.key === momentWin._slotKey);
  if (slot) slot.status = 'done';
}

// ---------- tray ----------
function buildTray() {
  const img1 = path.join(__dirname, 'assets', 'tray.png');
  let icon = nativeImage.createFromPath(img1);
  if (icon.isEmpty()) icon = nativeImage.createFromNamedImage('NSImageNameApplicationIcon', [0, 0, 22]);
  tray = new Tray(icon);
  tray.setToolTip('רגע');
  refreshTrayMenu();
}
function refreshTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'הגדרות ותוכן', click: () => openSettings() },
    { type: 'separator' },
    {
      label: 'הצג רגע עכשיו', submenu: SECTION_ORDER.map((id) => ({
        label: SECTION_LABEL[id], click: () => openMoment(id, null, true)
      }))
    },
    { label: 'שלח סיכום למייל עכשיו', click: async () => {
        try { await sendSummary(); notify('נשלח', 'סיכום היום נשלח למייל.'); }
        catch (e) { notify('לא נשלח', relayHint(e)); }
      } },
    { type: 'separator' },
    { label: 'יציאה', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}
function relayHint(e) {
  const msg = String(e.message || e);
  if (msg.includes('relay not configured')) return 'צריך להגדיר קודם את חיבור המייל (Apps Script) בהגדרות.';
  return 'שגיאה: ' + msg;
}
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
}

// ---------- lifecycle ----------
app.on('window-all-closed', (e) => { /* keep running in tray */ });
app.on('before-quit', () => { app.isQuitting = true; });

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  store.load();
  buildTray();
  rebuildSlots();
  tickTimer = setInterval(tick, 30 * 1000);
  tick();

  // Debug helpers for manual verification (no effect in normal use).
  if (process.env.REGA_OPEN_SETTINGS) openSettings(process.env.REGA_OPEN_SETTINGS === '1' ? undefined : process.env.REGA_OPEN_SETTINGS);
  if (process.env.REGA_OPEN_MOMENT) openMoment(process.env.REGA_OPEN_MOMENT, null, true);
  if (process.env.REGA_SEND_TEST) {
    sendSummary().then((r) => { console.log('SEND_TEST_OK', r); app.exit(0); })
      .catch((e) => { console.log('SEND_TEST_FAIL', e.message); app.exit(1); });
  }
});
