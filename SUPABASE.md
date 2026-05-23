# لمة العائلة — Supabase فقط (بدون Render)

## 1) في Supabase

1. افتح مشروعك → **SQL Editor**
2. انسخ محتوى `supabase/schema.sql` واضغط **Run**
3. **Database** → **Replication** → فعّل **game_rooms** للـ Realtime  
   (أو من SQL: `alter publication supabase_realtime add table game_rooms;`)
4. من **Project Settings** → **API** انسخ:
   - **Project URL**
   - **anon public** key

## 2) في Vercel

**Settings** → **Environment Variables**:

| الاسم | القيمة |
|--------|--------|
| `VITE_SUPABASE_URL` | رابط المشروع |
| `VITE_SUPABASE_ANON_KEY` | المفتاح anon |

ثم **Redeploy**.

> احذف `VITE_SERVER_URL` إن كان موجوداً — لم يعد مستخدماً.

## 3) Render

**لا تحتاجه** بعد هذا التحديث.

---

## تجربة سريعة

1. الموقع على Vercel → ⚙ → `242011` → إنشاء لعبة
2. شاشة العرض `/` → باركود
3. جوال `/play` → مسح أو إدخال الرمز
