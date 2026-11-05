/* להעלות יחד עם SW_VERSION ב-index.html בכל שינוי */
const CACHE_NAME = 'ninety-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ninety-v') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* רשת קודם, מטמון כגיבוי — כדי שעדכון ייתפס מהר כשיש קליטה. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

/* ---------- התראות ----------
   ה-push מגיע ריק (בלי payload מוצפן). מה להציג נקבע לפי השעה הקרובה
   מבין השעות שהאפליקציה שמרה ב-Cache 'ninety-cfg'. */

function toMin(t) { const [h, m] = String(t || '').split(':').map(Number); return isNaN(h) ? null : h * 60 + m; }

async function readCfg() {
  try {
    const c = await caches.open('ninety-cfg');
    const r = await c.match('cfg');
    return r ? await r.json() : null;
  } catch (e) { return null; }
}

function pickKind(cfg) {
  if (!cfg || !cfg.sched) return 'evening';
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const s = cfg.sched;
  const slots = [['morning', toMin(s.morning)], ['evening', toMin(s.evening)]];
  if (now.getDay() === Number(s.weeklyDay)) slots.push(['weekly', toMin(s.weeklyTime)]);
  let best = 'evening', bestD = Infinity;
  slots.forEach(([k, m]) => {
    if (m === null) return;
    const d = Math.abs(nowMin - m);
    if (d < bestD) { bestD = d; best = k; }
  });
  return best;
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const cfg = await readCfg();
    const kind = pickKind(cfg);
    const msg = {
      morning: { title: 'בוקר. לפני הטלפון:', body: (cfg && cfg.morning) || 'ההרגל החשוב קודם.', url: './' },
      evening: { title: 'סגירת יום', body: 'לסמן, קבלה אחת, ולהכין משהו שיקל על מחר.', url: './?v=close' },
      weekly: { title: 'סקירה שבועית', body: 'איפה זה עבד, איפה נשבר' + (cfg && cfg.partner ? ', ועדכון ל' + cfg.partner : '') + '.', url: './?v=review' }
    }[kind];
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'ninety-' + kind,
      data: { url: msg.url },
      lang: 'he',
      dir: 'rtl'
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        if ('navigate' in c) return c.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
