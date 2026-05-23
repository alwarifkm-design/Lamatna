# النشر — Vercel + Supabase فقط

لا حاجة لـ **Render** بعد الآن.

## الخطوات

1. نفّذ `supabase/schema.sql` في Supabase (راجع [SUPABASE.md](./SUPABASE.md))
2. فعّل Realtime لجدول `game_rooms`
3. على Vercel أضف `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`
4. **Root Directory:** `client` — **Output:** `dist`
5. Redeploy

## محلي

```bash
cd client
cp .env.example .env
# عدّل .env بمفاتيح Supabase
npm install
npm run dev
```
