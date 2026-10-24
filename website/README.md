# Safe Places — Complete Website Source

> الحالة الحالية للمعاينة والإدارة والتفعيل: [OPERATIONS_HANDOFF.md](docs/OPERATIONS_HANDOFF.md).
> تفاصيل التصدير التاريخية أدناه لا تمثل تفعيل Google أو R2 أو البريد الحالي.

مؤسسة المناطق الآمنة لأدوات ومواد السلامة  
Safe Places for Safety Tools & Materials Est.

This package contains the complete application source and bundled images for the deployed website.
Source commit: ede9f83df8a99becc95dd71d83f88a6b8285ac52

## محتويات الحزمة

- جميع الصفحات العربية والإنجليزية، وواجهة المتجر والمنتجات والسلة والمفضلة.
- صفحات الشركة والخدمات وطلب عرض السعر والتواصل.
- لوحة الإدارة وإدارة المنتجات والطلبات والمحتوى.
- الصور والشعار وملفات CSS ومكونات الواجهة.
- API الخادم، وهيكل قاعدة البيانات، وترحيلاتها الأصلية.
- ملف قفل الاعتماديات وملفات البناء والاختبارات.
- نسخة من محتوى الموقع والمنتجات المنشورة في data/public-content.snapshot.json ونسخة SQL للاستيراد.

الحزمة غير محمية بكلمة مرور. لا تتضمن مفاتيح تشغيل أو كلمات مرور حقيقية.
ملفات الاختبار تحتوي قيمًا تجريبية مصطنعة لا تمنح صلاحية الوصول لأي حساب.
ملفات .git وnode_modules ومخرجات البناء وملفات البيئة الحقيقية غير مضمنة؛ الاعتماديات والبناء يعاد إنشاؤهما من المصدر.
بيانات العملاء والطلبات وطلبات المشاريع والرسائل وهويات الإدارة ليست جزءًا من التصدير.

## التقنية والمتطلبات

- Node.js >=22.13.0
- pnpm 11.25.0، حسب packageManager في package.json
- TypeScript / React / Vinext (Next.js-compatible)
- Cloudflare Workers + D1 (SQLite) + R2
- Drizzle ORM

## التشغيل المحلي

From the extracted safe-places directory:

```sh
pnpm install --frozen-lockfile
pnpm run build
```

Build output is generated into dist/. Configure a new local database using the included migrations, in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wide_mikhail_rasputin.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_melted_vector.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file data/public-content.snapshot.sql
pnpm run dev
```

The development server prints its local URL (normally http://localhost:5173).
Use /ar for Arabic and /en for English. The development scripts use the portable profile when no local execution-profile file exists.
Import the snapshot into a newly created database after its migrations. It excludes the original site-owner identity so a new installation is not bound to an unrelated administrator.

## الإعدادات الخارجية

ملف .env.example يوضح أسماء الإعدادات فقط، بلا قيم سرية.
إعدادات التشغيل الحقيقية تضبط في بيئة الاستضافة، ولا ترفع إلى GitHub.
الموقع الحالي يستضاف في Sites، وملف .openai/hosting.json يحفظ معرّف الموقع الحالي وارتباط DB وBUCKET.
رفع المصدر إلى GitHub وحده لا ينقل الاستضافة أو ينشئ قاعدة بيانات أو يفعّل الدفع أو تسجيل الحسابات.

عند تشغيل نسخة في استضافة أخرى، يلزم إعداد D1 وR2 ومصادقة الإدارة الموثوقة وضبط SITE_URL في lib/config.ts للدومين المطلوب.
الإدارة في النسخة الحالية تعتمد على هوية Sites الموثوقة؛ لا يوجد حساب مدير بكلمة مرور ثابتة داخل المصدر.
المصادقة التجريبية في بيئة التطوير المحلية ليست نظام تسجيل عملاء للإنتاج.
This source retains the current protected admin and customer-account flows. The ZIP itself has no password.

## حالة الميزات

- واجهة تسجيل العملاء والتأكيد والاستعادة جاهزة، لكن Supabase Auth والبريد الفعلي لم يفعّلا بعد.
- الإعدادات اللازمة: CUSTOMER_AUTH_URL وCUSTOMER_AUTH_PUBLIC_KEY وCUSTOMER_AUTH_ENABLED.
- يجب استخدام publishable key، وليس service-role key، وتكوين رسائل التأكيد والاستعادة في خدمة الحسابات.
- الأسعار التجريبية تظهر للمراجعة الخاصة فقط؛ الشراء الفعلي يحتاج أسعارًا معتمدة وتفعيل الطلبات.
- لا توجد بوابة دفع فعلية مرتبطة، ولا نظام توصيل أو خرائط أو إدارة مخزن.
- لا يوجد ادعاء امتثال الفواتير لمتطلبات ZATCA.

## الفحوصات

After installing dependencies and building:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-customer-auth.mjs
node scripts/check-site.mjs
```

These checks cover server-rendered routes, access isolation, forms, quotes, account policy, commerce and admin behavior.
Provider mock tests do not verify live customer email delivery.

## سجل التصدير

EXPORT-MANIFEST.json records included file paths and SHA-256 hashes.
Original startup and hosting reference material is retained in README-PLATFORM.md.

