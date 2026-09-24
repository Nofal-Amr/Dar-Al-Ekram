# دار الإكرام — نظام إدارة الحالات والصرف

موقع ثابت (HTML + JS) شغال على Supabase. مفيش build ولا npm.

## الرفع على Vercel
1. اعمل repo جديد على GitHub اسمه `dar-alekram`.
2. **Add file → Upload files** واسحب كل الملفات دي.
3. في Vercel: **Add New → Project** → اختار الـ repo → Framework: **Other** → Deploy.

## أول مرة
افتح الرابط ← هيطلب منك تعمل **حساب المدير** (اسمك + رقم تليفونك + رقم سري).
بعد كده من **الإعدادات → إضافة موظف** تعمل حسابات الموظفين.

## التطبيق على الموبايل
Chrome ← ⋮ ← «تثبيت التطبيق» / «إضافة إلى الشاشة الرئيسية».

## Supabase
- Project: `dar-alekram` (jvgxldhshbyyuftjgfrw)
- الصلاحيات مقفولة بـ RLS. الموظف يعلّم الاستلام عن طريق `set_received()` بس.
- إدارة الحسابات عن طريق Edge Function `manage-users`.
