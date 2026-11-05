/* ninety-push — שולח התראות Web Push לאפליקציית 90 יום.
 *
 * האפליקציה שולחת לכאן את ה-subscription של הדפדפן ואת שעות ההתראות.
 * cron רץ כל 5 דקות, בודק לפי אזור הזמן של המשתמש אם הגיע זמן של
 * התראת בוקר / ערב / סקירה שבועית, ושולח push ריק. ה-service worker
 * באפליקציה מחליט לבד איזה טקסט להציג לפי השעה — ככה לא צריך להצפין
 * payload (RFC 8291), רק לחתום VAPID (RFC 8292).
 *
 * Secrets: VAPID_PRIVATE_JWK (JSON של מפתח P-256 פרטי), VAPID_PUBLIC (base64url).
 * KV: SUBS — מפתח יחיד "subs" עם מערך המנויים.
 */

const ALLOWED_ORIGIN = 'https://quixonn-alt.github.io';
const VAPID_SUBJECT = 'https://quixonn-alt.github.io/90days/';
const WINDOW_MIN = 5; // חייב להתאים ל-cron ב-wrangler.toml

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors(origin))
  });
}

async function loadSubs(env) {
  return (await env.SUBS.get('subs', 'json')) || [];
}

async function saveSubs(env, subs) {
  await env.SUBS.put('subs', JSON.stringify(subs));
}

function validTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
}

function cleanSched(s) {
  s = s || {};
  const day = Number(s.weeklyDay);
  return {
    morning: validTime(s.morning),
    evening: validTime(s.evening),
    weeklyTime: validTime(s.weeklyTime),
    weeklyDay: day >= 0 && day <= 6 ? day : 5
  };
}

/* ---------- VAPID ---------- */

function b64url(bytes) {
  let bin = '';
  bytes = new Uint8Array(bytes);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedKey = null;
async function signingKey(env) {
  if (cachedKey) return cachedKey;
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  cachedKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return cachedKey;
}

async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT
  })));
  const data = header + '.' + claims;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), enc.encode(data));
  return 'vapid t=' + data + '.' + b64url(sig) + ', k=' + env.VAPID_PUBLIC;
}

async function sendPush(env, sub) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHeader(env, sub.endpoint),
      'TTL': '3600',
      'Urgency': 'high',
      'Content-Length': '0'
    }
  });
  return res.status;
}

/* ---------- schedule ---------- */

function localParts(ts, tz) {
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  } catch (e) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  }
  const p = {};
  fmt.formatToParts(new Date(ts)).forEach(x => { p[x.type] = x.value; });
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { min: Number(p.hour) * 60 + Number(p.minute), weekday: days[p.weekday] };
}

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function due(slot, nowMin) {
  if (!slot) return false;
  const d = nowMin - toMin(slot);
  return d >= 0 && d < WINDOW_MIN;
}

async function runSchedule(env, scheduledTime) {
  const subs = await loadSubs(env);
  if (!subs.length) return;
  const dead = new Set();
  for (const s of subs) {
    const { min, weekday } = localParts(scheduledTime, s.tz);
    const sc = s.sched;
    const fire = due(sc.morning, min) || due(sc.evening, min) ||
      (weekday === sc.weeklyDay && due(sc.weeklyTime, min));
    if (!fire) continue;
    try {
      const status = await sendPush(env, s.sub);
      if (status === 404 || status === 410) dead.add(s.sub.endpoint);
    } catch (e) { /* ננסה בפעם הבאה */ }
  }
  if (dead.size) await saveSubs(env, subs.filter(s => !dead.has(s.sub.endpoint)));
}

/* ---------- HTTP ---------- */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'origin' }, 403, origin);
    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);

    const url = new URL(request.url);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'json' }, 400, origin); }

    if (url.pathname === '/subscribe') {
      const sub = body.sub;
      if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) {
        return json({ error: 'sub' }, 400, origin);
      }
      const subs = (await loadSubs(env)).filter(s => s.sub.endpoint !== sub.endpoint);
      subs.push({
        sub: { endpoint: sub.endpoint, keys: sub.keys || {} },
        sched: cleanSched(body.sched),
        tz: typeof body.tz === 'string' ? body.tz.slice(0, 64) : 'Asia/Jerusalem'
      });
      await saveSubs(env, subs.slice(-10));
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === '/unsubscribe') {
      const subs = await loadSubs(env);
      await saveSubs(env, subs.filter(s => s.sub.endpoint !== body.endpoint));
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === '/test') {
      const s = (await loadSubs(env)).find(x => x.sub.endpoint === body.endpoint);
      if (!s) return json({ error: 'not-found' }, 404, origin);
      const status = await sendPush(env, s.sub);
      return json({ ok: status >= 200 && status < 300, status }, 200, origin);
    }

    return json({ error: 'path' }, 404, origin);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runSchedule(env, controller.scheduledTime));
  }
};
