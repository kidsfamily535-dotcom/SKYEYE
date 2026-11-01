# تسليم الجلسات

## الجلسة 1 — الأساس والهوية (منجزة)
هيكل Next.js، نظام التصميم في `app/globals.css`، الخلفية (`public/bg-*.jpg`)، `components/Shell|Radar|UtcClock`.

## الجلسة 2 — الدخول وعزل الشركات (منجزة، لم تُختبر بمستخدم حقيقي بعد)
- **الدخول:** `app/login` (بريد وكلمة مرور) + `middleware.ts` (يجدّد الجلسة ويحوّل غير المسجلين إلى `/login`) + `app/auth/signout`.
- **العزل:** كله عبر RLS الموجودة في القاعدة (`private.is_member`). الواجهة لا تفلتر بالشركة بنفسها.
- **قاعدة البيانات:** أُضيف قيد `memberships_user_id_unique`: كل مستخدم في شركة واحدة فقط.
- **البيانات الحقيقية في `lib/data.ts`:** الشركة والمستخدم، عدد الإيميلات الجديدة (`email_triage.status='new'`)، المسودات (`email_reply_drafts.status='draft'`)، أحدث 3 إيميلات كقرارات، والطلبات المفتوحة (`request_files`).
- **ما زال فارغاً عمداً:** الرادار (جلسة 5)، وضع الظل ثابت `true` (جلسة 7)، اللوجو (`companies.logo_path` موجود لكنه فارغ، يُعرض في جلسة لاحقة).

### إنشاء أول مستخدم (مرة واحدة)
1. Supabase ← Authentication ← Users ← Add user (بريد + كلمة مرور، مع Auto Confirm).
2. اربطه بالشركة:
```sql
insert into public.memberships (company_id, user_id, role)
select c.id, u.id, 'operator' from public.companies c, auth.users u
where c.code = 'SSAIR' and u.email = 'EMAIL_HERE';
```
3. (اختياري) صف في `employees` بنفس `membership_id` ليظهر اسمه الكامل.

### التشغيل
`npm install` ثم أنشئ `.env.local` من `.env.example` (الرابط والمفتاح العام) ثم `npm run dev`.

## الجلسة 3 — الوارد والمسودات (تبدأ من هنا)
- جداول جاهزة: `email_threads`, `email_messages`, `email_triage`, `email_reply_drafts`, `reply_draft_edits`.
- الشاشة: الإيميل بأربع نقاط (نوعه، المطلوب، هل يحتاج رداً، المسودة)، والمسودة بالإنجليزية، والموظف هو من يرسل. تعديلاته تُسجَّل في `reply_draft_edits`.
