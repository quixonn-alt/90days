# 90 יום — אפליקציה להמצאה מחדש

מבוסס על הסרטון "Disappear and come back unrecognizable in 90 days". הרעיון:
לא מחכים להרגיש כמו אדם חדש — עושים את הדבר שוב ושוב, ואוספים ראיות עד
שהסיפור הישן כבר לא מחזיק. ממשק בעברית, RTL, מובייל.

## מבנה

- `index.html` — כל האפליקציה (HTML + CSS + JS), בלי build ובלי תלויות חוץ
  מ-Google Fonts (Heebo, Rubik).
- `sw.js` — offline + התראות push. **בכל שינוי ב-index.html להעלות ביחד**
  `CACHE_NAME` ב-`sw.js` ו-`SW_VERSION` בתחתית `index.html` (אותה סיבה כמו
  בפקעות: GitHub Pages מגיש עם `max-age=600`).
- `worker/` — Cloudflare Worker `ninety-push` ששולח את ההתראות.
- אירוח: GitHub Pages, `https://quixonn-alt.github.io/90days/`, push ל-`master`.

## המקורות

1. "Disappear and come back unrecognizable in 90 days" — עקרונות הליבה:
   ראיות במקום מוטיבציה, רגיל + מינימום, בלי בושה, סקירה שבועית, אדם אחד.
2. "A full guide to reinvent your life in 6–12 months" (20 שעות, 30 הדרכות).
   ההדרכה הראשונה (90-day reinvention) היא שלד האשף: ביקורת מציאות →
   שני עתידים → סיבות → יעדים במספרים → reverse engineering (ABTH) →
   סביבה מבוקרת → לולאת משוב (ביצוע מול אסטרטגיה, צוואר בקבוק).
   29 ההדרכות האחרות הן ספריית התרגילים (`EXERCISES` ב-index.html), אחת לשבוע.

## המסכים

- **אשף** (10 שלבים): פתיחה + אורך עונה (90/180/365) → ביקורת מציאות
  (4 תחומים, 0–10, ראיות, לאן זה הולך) → שני עתידים (חזון לכל תחום, שבוע
  רגיל, אנטי־חזון) → סיבות (למה אני כאן / למה רוצה / למה מסרב) → זהות →
  יעדים במספרים (actual/target/unit, קצב ליום/שבוע/חודש) → הרגלים →
  סביבה → אדם אחד → שעות התראה. חובה רק הרגל אחד.
- **היום**: יום N/L, "X ימים מתוך Y", רגיל/מינימום/לא לכל הרגל, סגירת יום
  (קבלה + הכנה למחר), בלוק פוקוס, יעדים מול הקצב, תרגיל השבוע, הכנות סביבה.
- **בלוק פוקוס** (מהדרכה 17): קו סיום, דקות מתוכננות, טיימר, כפתור "דחף",
  ובסוף ארבעה מספרים: מתוכנן, בפועל, דחפים, תוצר. הצעה לפעם הבאה: +5 דק׳
  אם עמדת. `focusRun` נשמר ב-state כדי לשרוד סגירת אפליקציה.
- **ראיות**: סטטיסטיקה, יעדים (פס התקדמות + סמן "איפה צריך להיות", גרף
  מול קו קצב), קבלות, לוח, לפי הרגל, ביקורת מציאות (ראשונה מול אחרונה),
  היסטוריית פוקוס.
- **תרגילים**: 29 תרגילים; צעדים עם checkbox, מונה, "להוסיף כהרגל",
  "בלוק פוקוס", "קבלה", והערות חופשיות. המומלץ = הראשון שלא הושלם.
- **סקירה**: טבלת שבוע, המספרים מול הקצב, "איפה זה נופל", אבחון
  ביצוע/אסטרטגיה (+ צוואר בקבוק), תיקון, וטקסט עדכון לאדם האחד.
- **תוכנית**: הלמה, החזון, הזהות (לקריאה חוזרת) + עריכת הכול, התראות,
  גיבוי, איפוס.

## עקרונות (לא לשבור)

- **בלי בושה.** יום שפוספס לא מאפס כלום. "X ימים מתוך Y", לא רצף שמתאפס.
  פספוס = קווקוו אפור, לא אדום.
- **מינימום חובה** בכל הרגל.
- **מעט** — עד 4 הרגלים באשף, 1–2 יעדים.
- **יום עומד** = כל ההרגלים המתוכננים סומנו רגיל או מינימום.
- **הרגל ארכיון** (`archivedOn`) — לא מוחקים היסטוריה.
- **לא להגיב לכל נקודת נתונים** — מגמה, לא תנודה.

## נתונים

`localStorage` תחת `ninety-state` (v:2):

```js
{ v:2,
  setup:{ startDate, length, audit:{health|wealth|love|self:{score,evidence,trend}},
          vision:{...}, week, anti, reasons:{here,want,refuse},
          identity:{who,day,stop,seen}, goals:[{id,name,area,unit,actual,target}],
          habits:[{id,name,full,min,anchor,days,from,archivedOn?}],
          env:[{id,text,done}], partner:{name}, notify:{morning,evening,weeklyDay,weeklyTime,on} },
  days:{ YYYY-MM-DD:{ h:{habitId:full|min|miss}, closed, prep } },
  receipts:[{id,date,text}], goalLog:[{id,date,goalId,value}],
  audits:[{id,date,scores}], focus:[{id,date,target,planned,actual,urges,produced}],
  focusRun, ex:{ id:{steps,counts,notes,doneOn} },
  weekly:[{id,week,well,broke,cause:exec|strategy|none,reasons,bottleneck,fix,ts}] }
```

גיבוי: כל ה-state כ-base64url ב-`#restore=`. מכשיר ריק — לוקח הכול; מכשיר
עם נתונים — מוסיף ימים/קבלות/מדידות/סקירות/פוקוס/ביקורות שחסרים בלבד.
באייפון: מסך הבית ו-Safari הם אחסונים נפרדים.

## התראות

- האפליקציה נרשמת ל-Web Push עם `VAPID_PUBLIC` ושולחת ל-worker
  (`/subscribe`) את ה-subscription, השעות ואזור הזמן.
- ה-worker (cron כל 5 דקות) שולח push **ריק** כשמגיעה שעה. בלי payload אין
  צורך בהצפנת RFC 8291 — רק חתימת VAPID.
- `sw.js` בוחר מה להציג (בוקר / ערב / שבועי) לפי השעה הקרובה מתוך הקונפיג
  שהאפליקציה כותבת ל-Cache `ninety-cfg` (`writeSwConfig`) — ה-SW לא רואה
  localStorage.
- באייפון: עובד רק מהאייקון במסך הבית, iOS 16.4+.
- פריסת worker: `cd worker && npx wrangler deploy`. Secrets:
  `VAPID_PRIVATE_JWK` (JSON), `VAPID_PUBLIC`. KV: `SUBS`.
  **אסור להחליף מפתחות VAPID** — כל המנויים הקיימים יפסיקו לעבוד.

## עיצוב

כהה וממוקד (נבחר מתוך הצעות UI UX Pro Max): רקע `#0E1116`, ענבר `#F59E0B`
למינימום/הדגשה, ירוק `#10B981` לרגיל, טקסט כהה על צבע. אייקוני SVG בסגנון
Lucide, בלי אמוג׳י. כפתורי לחיצה 48–56px.
