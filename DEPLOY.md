# نشر «لمة العائلة» على الإنترنت

اللعبة تحتاج جزئين:

| الجزء | المنصة | السبب |
|--------|--------|--------|
| **الواجهة** (موقع Vercel) | [Vercel](https://vercel.com) | ملفات ثابتة + React |
| **الخادم** (Socket.io) | [Render](https://render.com) | اتصال مباشر WebSocket (Vercel لا يدعم Socket.io بشكل مناسب) |

---

## الخطوة 1 — رفع المشروع على GitHub

1. أنشئ مستودعاً جديداً على GitHub.
2. ارفع مجلد المشروع `Play` بالكامل.

---

## الخطوة 2 — نشر الخادم على Render (مجاني)

1. ادخل [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. اربط مستودع GitHub واختر الملف `render.yaml` (يُنشأ خدمة من مجلد `server`).
3. أو يدوياً: **Web Service** → Root Directory: `server` → Build: `npm install && npm run build` → Start: `npm start`.
4. في **Environment Variables** أضف:
   - `CLIENT_ORIGIN` = `https://اسم-مشروعك.vercel.app` (تضيفه بعد نشر Vercel، أو مؤقتاً `http://localhost:5173`)
   - `SERVE_STATIC` = `false`
5. بعد النشر انسخ رابط الخدمة، مثل: `https://lamaa-family-api.onrender.com`

> الخطة المجانية على Render «تنام» بعد عدم الاستخدام؛ أول اتصال قد يتأخر 30–60 ثانية.

---

## الخطوة 3 — نشر الواجهة على Vercel

1. ادخل [vercel.com](https://vercel.com) → **Add New Project** → اختر المستودع.
2. **إعدادات المشروع (اختر أحد الخيارين):**

   **الخيار أ — من جذر المستودع (موصى به، يوجد `vercel.json` جاهز):**
   - **Root Directory:** اتركه فارغاً `.`
   - لا تغيّر Build/Output يدوياً (يأخذها من `vercel.json`)

   **الخيار ب — مجلد client فقط:**
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

3. **Environment Variables:**
   - `VITE_SERVER_URL` = رابط Render من الخطوة 2 (بدون `/` في النهاية)  
     مثال: `https://lamaa-family-api.onrender.com`
4. اضغط **Deploy**.

---

## الخطوة 4 — ربط النطاقين

1. انسخ رابط Vercel النهائي، مثل `https://lamaa-family.vercel.app`.
2. ارجع إلى Render → خدمة الخادم → **Environment** → عدّل:
   - `CLIENT_ORIGIN` = رابط Vercel بالضبط
3. **Manual Deploy** أو انتظر إعادة التشغيل التلقائية.

---

## التجربة بعد النشر

| الشاشة | الرابط |
|--------|--------|
| العرض (بروجكتر) | `https://مشروعك.vercel.app/` |
| الإدارة | ⚙ → `242011` → `/admin` |
| اللاعبون | `/play?room=XXXXXX` |

---

## Vercel لا ينشر / Build فاشل؟

| السبب الشائع | الحل |
|--------------|-----|
| Root = جذر المشروع لكن لا يُثبَّت `client` | ارفع آخر نسية فيها `vercel.json` من الجذر، أو عيّن Root = `client` |
| Output Directory خاطئ | من الجذر: `client/dist` — من داخل client: `dist` |
| `vite: command not found` | Install Command يجب أن يكون `npm install --prefix client` أو Root = `client` |
| الموقع يفتح لكن اللعبة لا تتصل | أضف `VITE_SERVER_URL` = رابط Render |
| Override في لوحة Vercel يتعارض مع `vercel.json` | Settings → Build → أزل الـ Overrides أو فعّل «Use vercel.json» |

في **Deployments** → اضغط على المحاولة الفاشلة → **Building** لقراءة سطر الخطأ الحقيقي.

---

## تحديثات لاحقة

- أي تعديل على الكود ودفع `git push` يعيد النشر تلقائياً على Vercel وRender.
- إذا غيّرت رابط Vercel حدّث `CLIENT_ORIGIN` على Render.

---

## نشر محلي كخادم واحد (بدون Vercel)

```bash
npm run build
cd server && SERVE_STATIC=true CLIENT_ORIGIN=http://localhost:3001 npm start
```

يفتح الموقع والخادم معاً من منفذ `3001`.
