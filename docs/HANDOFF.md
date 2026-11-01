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

## الجلسة 3 — الوارد والمسودات (منجزة)
- **الشاشة `/inbox`:** قائمة الإيميلات (الجديد أولاً ثم حسب الاستعجال) + تفاصيل بأربع نقاط: ما هو، ماذا يريد، هل نرد، المسودة. الإيميل الأصلي مطوي.
- **المسودة (`components/DraftPanel.tsx`):** إنجليزية دائماً، نسخ العنوان والموضوع والنص، تعديل وحفظ، ثم «أرسلتُه من بريدي». SKYEYE لا يرسل شيئاً: الموظف يرسل من بريد الشركة ثم يسجّل ذلك.
- **قاعدة البيانات (migration `draft_review_rpcs`):** دالتان `save_draft_edit` (تحفظ التعديل وتسجل before/after في `reply_draft_edits`) و`mark_draft_sent` (المسودة approved والإيميل replied). تتحققان من `private.can_write`، ومحجوبتان عن الزوار. اختُبرتا داخل معاملة تراجعت ولم يتغير شيء.
- **سبب الدالتين:** جدول `reply_draft_edits` ليس فيه سياسة كتابة للمستخدمين عمداً.
- **غير منجز:** قراءة المرفقات (`email_attachments`)، الرد على إيميل بلا مسودة، تعلّم الوكيل من التعديلات (يحتاج موافقة مسؤول، جلسة 7).
- **قاعدة ثابتة:** لا يوجد «لا يحتاج رداً» لأن القيد `email_triage_always_reply` يفرض رداً على كل إيميل.

## الجلسة 4 — ملفات الطلبات والتنبيهات (تبدأ من هنا)
- جداول جاهزة: `request_files`, `request_file_messages`, `request_file_events`, `request_stages`, `request_stage_transitions`, `request_policies`.
- الشاشة `/requests`: ملف لكل طلب بشريط مراحل، المسؤول والموعد وآخر حدث والإجراء التالي، ويُغلق بدليل من الإيميل. تنبيه قبل الموعد بيوم وتنبيه للراكد.
- أرقام المهل (مثل مهلة التصريح العاجل) ما زالت معلّقة لأن ملفات SOP لم تكن متاحة، فتُعرض للمراجعة ولا تُفترض.
