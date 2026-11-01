# تسليم الجلسات

## الجلسة 1 — الأساس والهوية (منجزة)
- **تم:** هيكل Next.js، `app/globals.css` (الألوان والخطوط)، `components/Shell.tsx`، `components/Radar.tsx`، `components/UtcClock.tsx`، شاشة `app/page.tsx`.
- **الخلفية:** `public/bg-sky.jpg` للصفحة و`public/bg-hero.jpg` للبطاقة العلوية (من الصورة المرفوعة).
- **عقد البيانات:** `lib/data.ts` يعيد بيانات مثال (`isSample: true`) والأرقام `null` وتظهر «—». الجلسة 2 تستبدله باستعلامات Supabase.
- **غير منجز عمداً:** الدخول، RLS، باقي الشاشات (روابط القائمة معطّلة وعليها رقم جلستها).
- **للتشغيل:** `npm install && cp .env.example .env.local && npm run dev`

## الجلسة 2 — تبدأ من هنا
1. إنشاء `app/login` و`middleware.ts` (Supabase SSR).
2. جدول `profiles(user_id, company_id)` ومستخدم لشركة واحدة فقط، وسياسات RLS على كل جدول بـ `company_id`.
3. قراءة اسم الشركة ولوجوها من القاعدة بدل `lib/data.ts`.
