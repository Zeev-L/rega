// Local JSON storage in userData. Fully local, per-machine, independent.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const FILE = path.join(app.getPath('userData'), 'rega-data.json');
const WORKDAYS = [0, 1, 2, 3, 4]; // Sun–Thu

function defaults() {
  return {
    version: 1,
    language: 'he',
    sections: {
      vision: {
        enabled: true, order: 0, times: ['08:30'], days: WORKDAYS, snooze: 3, random15: true,
        aspects: [
          { title: 'מה אני נותן למקום העבודה', text: 'אנשיוּת. סדר וארגון. ניהול מצוין. פיתוח ושיפור מתמיד — מתוך רוגע ושליטה.' },
          { title: 'מה מקום העבודה גורם לי להרגיש', text: 'ביטחון, רוגע ושליטה, שייכות אמיתית.' },
          { title: 'איך אני מרגיש את זה', text: 'רוגע וכוונה ברורה, סיפוק, מוטיבציה, שקט פנימי.' }
        ]
      },
      mantra: {
        enabled: true, order: 1, times: ['14:00'], days: WORKDAYS, snooze: 3, random15: true,
        items: [
          'אני נותן ערך אמיתי במה שאני עושה — ואני שייך לכאן.',
          'אני נשאר רגוע גם כשלוחץ. זה הכוח שלי.',
          'אני לומד ומשתפר כל יום. אני בדיוק במקום הנכון.'
        ]
      },
      traits: {
        enabled: true, order: 2, times: ['10:00'], days: [0, 3], snooze: 3, random15: true,
        items: [
          { text: 'אחראי', hot: true }, { text: 'יצירתי', hot: false }, { text: 'אכפתי', hot: true },
          { text: 'יסודי', hot: false }, { text: 'רגוע', hot: false }, { text: 'מוביל', hot: true },
          { text: 'סקרן', hot: false }, { text: 'מקצועי', hot: false }, { text: 'נחוש', hot: false }
        ]
      },
      anchor: {
        enabled: false, order: 3, times: ['16:30'], days: WORKDAYS, snooze: 3, random15: true,
        image: '', caption: 'לשם אתה הולך.'
      },
      gratitude: {
        enabled: true, order: 4, times: ['11:00', '16:00'], days: WORKDAYS, snooze: 3, random15: false,
        question: 'על מה בעבודה אתה אסיר תודה עכשיו?',
        placeholder: 'רגע טוב אחד מהעבודה היום…'
      }
    },
    email: { enabled: true, address: '', time: '19:00' },
    relay: { url: '', secret: '' },
    log: {} // { 'YYYY-MM-DD': { gratitude: [{text, time}] } }
  };
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null)
      ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    // merge defaults so new fields appear on upgrade, but keep user content
    cache = deepMerge(defaults(), raw);
  } catch {
    cache = defaults();
    save();
  }
  return cache;
}

function save() {
  if (!cache) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function get() { return load(); }

function update(mutator) {
  load();
  mutator(cache);
  save();
  return cache;
}

function logGratitude(text) {
  const now = new Date();
  const day = ymd(now);
  const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  update((d) => {
    d.log[day] = d.log[day] || { gratitude: [] };
    d.log[day].gratitude.push({ text: text.trim(), time });
  });
}

function ymd(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

module.exports = { load, save, get, update, logGratitude, ymd, FILE, defaults };
