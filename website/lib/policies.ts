import {company, type initialSettings} from './config';

type Copy = readonly [string, string];
export type PolicyKey = 'privacy' | 'terms' | 'returns' | 'collection';
export type PolicySection = {id: string; title: Copy; paragraphs: Copy[]};
export const POLICY_UPDATED = '2026-10-22';
export const POLICY_VERSION = '2026-10-22';
export const policyLinks = [
 {path: 'privacy', title: ['سياسة الخصوصية', 'Privacy policy']},
 {path: 'terms', title: ['الشروط والأحكام', 'Terms & conditions']},
 {path: 'returns', title: ['الإلغاء والاسترجاع', 'Cancellations & returns']},
 {path: 'collection', title: ['الاستلام والتوريد', 'Collection & supply']},
] as const;

/** Describes the quote-only service actually deployed, including its processors. */
export function getPolicy(key: PolicyKey, settings: typeof initialSettings): PolicySection[] {
 const identity: PolicySection = {id: 'provider', title: ['المؤسسة والتواصل', 'Company & contact'], paragraphs: [
  [`يدير الموقع ${company.nameAr}، ومقر نشاطها ${settings.locationAr}. لطلبات الخصوصية أو الشكاوى أو متابعة التعاملات: ${settings.email}، هاتف ${settings.phone}.`, `This website is operated by ${company.nameEn}, based in ${settings.locationEn}. For privacy requests, complaints or transaction enquiries: ${settings.email}; telephone ${settings.phone}.`],
 ]};
 if (key === 'privacy') return [identity,
  {id: 'scope', title: ['نطاق السياسة', 'Scope'], paragraphs: [
   ['تشرح هذه السياسة معالجة بيانات زوار الموقع وأصحاب الحسابات والاستفسارات وطلبات عروض الأسعار. يمكنك تصفح المنتجات وإرسال استفسار دون إنشاء حساب. الحقول المعلّمة مطلوبة لمعالجة النموذج؛ اسم الشركة والمرفقات اختيارية، والهاتف اختياري عند استخدام حساب مسجل.', 'This policy covers visitors, account holders, enquiries and quotation requests. You can browse products and send an enquiry without creating an account. Marked fields are required to process the form; company details and attachments are optional, and signed-in users can omit a phone number.'],
  ]},
  {id: 'data', title: ['ما نجمعه ومصادره', 'Information & sources'], paragraphs: [
   ['نجمع ما تدخله في النماذج والحساب: الاسم والبريد والهاتف إن قدمته واسم الشركة وتفاصيل الاحتياج والأصناف والكميات والمراسلات والمرفقات. نسجل مرجع الطلب وحالته وتوقيته. قد تتضمن السجلات التقنية عنوان الشبكة ومعلومات المتصفح وأحداث الدخول اللازمة للحماية وتشخيص الأخطاء.', 'We collect information entered in forms and accounts: name, email, phone if provided, company, requirements, items, quantities, correspondence and attachments. We record the request reference, status and timestamps. Technical records may include network address, browser information and sign-in events needed for security and troubleshooting.'],
   ['عند اختيار Google نتلقى معرّف حسابك والاسم والبريد وحالة تأكيده وصورة الملف الشخصي إن أتاحتها الخدمة. لا نطلب كلمة مرور Google أو الوصول إلى رسائلك أو ملفات Drive. عند التسجيل بكلمة مرور محلية تُحفظ بصيغة تجزئة، ولا يعرضها فريق المؤسسة. لا تجمع هذه النسخة أرقام البطاقات البنكية ولا تنفذ دفعًا إلكترونيًا.', 'When you choose Google, we receive your account identifier, name, email, verification status and profile image if supplied. We do not request your Google password or access to Gmail or Drive. A local account password is stored as a hash and is not displayed to staff. This version collects no payment card numbers and processes no online payments.'],
   ['أرسل فقط المعلومات اللازمة للطلب، وتجنب إرفاق الهويات أو البيانات الصحية أو كلمات المرور أو بيانات أشخاص آخرين دون مسوغ مناسب.', 'Submit only information needed for your request. Avoid attaching identity documents, health information, passwords or other people’s data without an appropriate basis.'],
  ]},
  {id: 'purpose', title: ['أغراض المعالجة ومسوغاتها', 'Purposes & legal bases'], paragraphs: [
   ['نستخدم البيانات لإنشاء الحساب والتحقق من الدخول، وحفظ المفضلة، وتعبئة بيانات التواصل لتسهيل طلباتك، وإعداد عرض السعر والرد ومتابعة التوريد المتفق عليه. نعتمد على موافقتك للمتابعة عندما تكون هي المسوغ المناسب، وعلى تنفيذ الاتفاق الذي تكون طرفًا فيه ومتطلبات حفظ السجلات النظامية عند انطباقها. تُعالج السجلات الأمنية لحماية الخدمة ومنع إساءة استخدامها وفق المصلحة المشروعة وبالقدر اللازم.', 'We use information to create accounts, verify sign-in, save favourites, prefill contact details, prepare quotations, reply and follow up on agreed supply. We rely on your consent where appropriate, performance of an agreement with you and applicable statutory recordkeeping obligations. Security records are processed as necessary to protect the service and prevent abuse on a legitimate-interest basis.'],
   ['رسائل تفعيل الحساب واستعادته وتأكيد استلام الطلب وردود فريق المبيعات رسائل تشغيلية. إرسال نموذج أو إنشاء حساب لا يشترك بك في نشرات تسويقية؛ أي تسويق يتطلب موافقة منفصلة قابلة للسحب.', 'Verification, recovery, request acknowledgements and sales replies are operational messages. Submitting a form or creating an account does not subscribe you to marketing; marketing requires separate, withdrawable consent.'],
  ]},
  {id: 'storage', title: ['ملفات الارتباط والتخزين المحلي', 'Cookies & local storage'], paragraphs: [
   ['تُستخدم ملفات ارتباط ضرورية لجلسة الحساب وحماية الدخول. يحفظ المتصفح اختيارات عرض السعر والسلة واللغة والمنتجات المشاهدة في التخزين المحلي، وتحفظ المفضلة مع الحساب. يمكنك حذف التخزين من إعدادات المتصفح؛ وقد يؤدي حظر ملفات الارتباط الضرورية إلى تعذر تسجيل الدخول. لا تضيف هذه النسخة ملفات تتبع إعلانية أو تحليلات تسويقية اختيارية.', 'Necessary cookies maintain account sessions and protect sign-in. Browser local storage retains quote selections, the basket, language and recently viewed items; favourites are stored with the account. You can clear browser storage. Blocking necessary cookies may prevent sign-in. This version adds no advertising trackers or optional marketing analytics.'],
  ]},
  {id: 'sharing', title: ['مقدمو الخدمة ومكان المعالجة', 'Service providers & processing location'], paragraphs: [
   ['يصل فريق المؤسسة المخول إلى بيانات الطلب بحسب الصلاحيات. تستخدم الخدمة Cloudflare للاستضافة وقاعدة البيانات وتخزين المرفقات، وResend لإرسال رسائل الحساب والطلبات، وGoogle للتحقق من الدخول عند اختيارك له. تُشارك مع كل مزود البيانات اللازمة لوظيفته، وقد تعالج هذه الخدمات بيانات خارج المملكة عبر بنيتها الدولية. يمكنك طلب تفاصيل المعالجة والنقل عبر البريد الرسمي؛ ولا يُعد تقديم بياناتك تنازلًا عن الضمانات النظامية المطلوبة لنقلها.', 'Authorised staff access request data according to their permissions. The service uses Cloudflare for hosting, database and attachments, Resend for account and request emails, and Google for authentication when selected. Each receives information needed for its function. These providers may process data outside Saudi Arabia through international infrastructure. You can request processing and transfer details by email; submitting data does not waive required statutory transfer safeguards.'],
   ['لا نبيع بياناتك الشخصية. يكون الإفصاح لجهة مختصة عند وجود متطلب نظامي، أو لجهة مرتبطة بتنفيذ التعامل بالقدر اللازم ومع المسوغ المنطبق.', 'We do not sell personal data. Disclosure to competent authorities requires a legal obligation; disclosure needed to fulfil a transaction is limited to its purpose and the applicable legal basis.'],
  ]},
  {id: 'retention', title: ['الحماية والاحتفاظ والإتلاف', 'Protection, retention & deletion'], paragraphs: [
   ['تُقيّد صلاحيات الحسابات والمرفقات الخاصة، وتستخدم اتصالات مشفرة والتحقق من ملكية الطلب عند الوصول إليه. تُنظف المرفقات الخاصة غير المرتبطة بطلب بعد مرور 48 ساعة ضمن دورة الصيانة. تُحفظ بيانات الحساب أثناء استخدامه، وسجلات الطلبات والمراسلات للمتابعة وتسوية المطالبات وما يلزم نظامًا؛ وتُراجع الحاجة إليها عند الإغلاق أو طلب الإتلاف. لا تُحذف سجلات الطلبات تلقائيًا بعد 48 ساعة.', 'Private requests and attachments have access controls, encrypted connections and ownership checks. Unattached private uploads become eligible for cleanup after 48 hours during maintenance. Account records are retained while in use; requests and correspondence are retained for follow-up, claims and applicable legal obligations, with necessity reviewed on closure or a deletion request. Request records are not automatically deleted after 48 hours.'],
   ['عند انتهاء الحاجة إلى البيانات ودون وجود التزام بالاحتفاظ بها، تُحذف أو تزال دلالتها على الهوية. إذا استلزم طلبك الاحتفاظ بجزء من السجل لأسباب نظامية، نوضح ذلك ونقيد استخدامه بالغرض المتبقي.', 'When data is no longer needed and no retention obligation applies, it is deleted or anonymised. If part of a record must be retained for a legal reason, we explain this and restrict its use to the remaining purpose.'],
  ]},
  {id: 'rights', title: ['حقوقك وتقديم الطلبات', 'Your rights & requests'], paragraphs: [
   ['يمكنك طلب العلم بالمعالجة والوصول إلى بياناتك والحصول على نسخة مقروءة وتصحيحها وإكمالها وطلب إتلاف ما انتهت الحاجة إليه، والرجوع عن الموافقة عندما تكون أساس المعالجة. أرسل طلبك إلى البريد المبين أعلاه بعنوان «طلب خصوصية». نتحقق من هويتك بالقدر اللازم ونستجيب خلال 30 يومًا، مع إشعارك بأي تمديد مبرر يسمح به النظام. قد يحد سحب الموافقة من متابعة الطلب دون المساس بالمعالجة السابقة المشروعة أو الالتزامات النظامية.', 'You may request information about processing, access, a readable copy, correction, completion or deletion of data no longer needed, and withdraw consent where it is the legal basis. Email the address above with the subject “Privacy request”. We verify identity proportionately and respond within 30 days, notifying you of any justified extension permitted by law. Withdrawal may limit request follow-up without affecting lawful prior processing or legal obligations.'],
   ['يمكنك تقديم شكوى للمؤسسة، أو للجهة المختصة بحماية البيانات الشخصية عبر المنصة الوطنية لحوكمة البيانات. ننشر تاريخ التحديث بهذه الصفحة ونوضح أي تغيير جوهري قبل تطبيق استخدام جديد يتطلب إشعارًا أو موافقة.', 'You may complain to the company or to the competent personal data protection authority through the National Data Governance Platform. This page shows its update date; material changes are explained before a new use requiring notice or consent.'],
  ]},
 ];
 if (key === 'terms') return [identity,
  {id: 'service', title: ['طبيعة الموقع وطلب العرض', 'Website & quotation requests'], paragraphs: [
   ['الموقع للتعريف بالمنتجات والخدمات واستقبال الاستفسارات وطلبات عروض الأسعار. إضافة الأصناف أو إرسال الطلب لا تنشئ عقد شراء ولا تلزمك بالدفع أو تفوض بدء التنفيذ. لا توجد بوابة دفع إلكتروني في هذه النسخة.', 'The website presents products and services and accepts enquiries and quotation requests. Selecting items or submitting a request does not create a purchase contract, require payment or authorise work. This version has no online payment gateway.'],
  ]},
  {id: 'agreement', title: ['اعتماد السعر والنطاق', 'Prices & agreed scope'], paragraphs: [
   ['تراجع المبيعات التوفر والموديل والمواصفات والكميات وموقع المشروع ونطاق العمل قبل إصدار العرض. يوضح العرض المعتمد السعر والعملة والضريبة المنطبقة والتكاليف الإضافية وطريقة الدفع ومدة صلاحية العرض والمواعيد والضمان. لا تُفترض أسعار أو مواعيد توريد من الصور أو قوائم الفئات. يُعتمد التعامل عند قبول العرض والاتفاق على شروطه.', 'Sales reviews availability, model, specifications, quantities, project location and work scope before issuing a quote. The approved quote states price, currency, applicable tax, additional charges, payment arrangements, quote validity, timing and warranty. Images and category listings do not establish prices or supply dates. A transaction is agreed through acceptance of its quotation and terms.'],
  ]},
  {id: 'specifications', title: ['المواصفات والضمان', 'Specifications & warranty'], paragraphs: [
   ['راجع الموديل وورقة البيانات ومدى ملاءمة المنتج للمنشأة قبل الاعتماد. الصور التوضيحية لا تثبت مواصفة أو اعتمادًا لكل صنف. يحدد العرض الضمان والمسؤول عن تنفيذه ومتطلبات التركيب والصيانة، مع بقاء حقوق العيوب وعدم المطابقة والضمانات النظامية.', 'Review the model, datasheet and suitability for the facility before approval. Reference images do not establish a specification or certification for every item. The quote identifies the applicable warranty, responsible party and installation or maintenance requirements, without limiting statutory rights for defects, non-conformity or warranties.'],
  ]},
  {id: 'account', title: ['الحساب والاستخدام', 'Account & use'], paragraphs: [
   ['يمكنك استخدام Google مباشرة أو التسجيل بالبريد وفق الخيارات المتاحة. استخدم بيانات تخصك واحتفظ بأمان حسابك. يتيح الحساب حفظ المفضلة ومتابعة طلباتك وتعبئة بياناتك المحفوظة، ويمكنك تعديل بيانات التواصل قبل إرسال الطلب. تجنب انتحال الهوية أو إرسال ملفات ضارة أو بيانات غير لازمة.', 'You can use Google directly or register by email using the available options. Use your own details and keep your account secure. Your account saves favourites, tracks requests and prefills saved details; you can edit contact information before submission. Do not impersonate others or send harmful files or unnecessary personal data.'],
  ]},
  {id: 'complaints', title: ['المتابعة والشكاوى والحقوق', 'Follow-up, complaints & rights'], paragraphs: [
   ['عند وجود خطأ أو شكوى، أرسل مرجع الطلب ووصف المشكلة إلى المؤسسة لتوثيقها ومراجعتها. تسري الأنظمة المعمول بها في المملكة العربية السعودية، ولا تتضمن هذه الشروط تنازلًا عن حق نظامي للمستهلك أو منعًا من اللجوء إلى الجهات المختصة. راجع صفحتي الإلغاء والاسترجاع والاستلام لتفاصيل التعامل.', 'To report an error or complaint, send the request reference and issue to the company for recording and review. Applicable Saudi Arabian law governs; these terms do not waive statutory consumer rights or prevent recourse to competent authorities. See the cancellations and collection pages for transaction details.'],
  ]},
 ];
 if (key === 'returns') return [identity,
  {id: 'enquiry', title: ['إلغاء الاستفسار أو عرض السعر', 'Cancel an enquiry or quote request'], paragraphs: [
   ['يمكنك طلب إغلاق الاستفسار أو طلب عرض السعر قبل اعتماد التعامل بالتواصل مع المبيعات وذكر المرجع. تقديم الطلب عبر الموقع لا يحصّل أي مبلغ، لذلك لا ينشأ عنه استرداد مالي. إذا تم الاتفاق لاحقًا على توريد أو خدمة، تطبق الشروط المعتمدة والحقوق النظامية ذات الصلة.', 'You can ask sales to close an enquiry or quotation request before a transaction is agreed, quoting its reference. Website submission collects no payment and therefore creates no payment to refund. Subsequent agreed supply or services are subject to their approved terms and applicable statutory rights.'],
  ]},
  {id: 'withdrawal', title: ['حقوق الإلغاء بعد الاتفاق', 'Cancellation after agreement'], paragraphs: [
   ['عند انطباق نظام التجارة الإلكترونية، يحق للمستهلك فسخ العقد خلال الأيام السبعة التالية لتسلم المنتج أو للتعاقد على الخدمة، إذا لم يستخدم المنتج أو الخدمة أو ينتفع بها، مع مراعاة الاستثناءات النظامية. قد تشمل الاستثناءات المنتجات المصنعة حسب الطلب، دون المساس بحقوق العيب أو عدم المطابقة. تُحدد تكاليف الإرجاع وفق الحالة والنظام والاتفاق المشروع.', 'Where the E-Commerce Law applies, consumers may withdraw within seven days after receiving a product or contracting for a service if unused and no benefit was obtained, subject to statutory exceptions. Exceptions may include custom-made goods, without affecting defect or non-conformity rights. Return costs follow the applicable law and lawful agreement.'],
  ]},
  {id: 'defect', title: ['العيب أو عدم المطابقة أو التأخير', 'Defects, non-conformity or delay'], paragraphs: [
   ['أبلغنا بالمشكلة مع مرجع التعامل والصنف وصور توضح الحالة إن أمكن. لا تقيد مدة العدول المذكورة حقوقك عند وجود عيب أو مخالفة للمواصفات أو تأخير يمنحك النظام بسببه حق الفسخ. لا تُفرض موافقة إدارية شرطًا لإسقاط حق مقرر نظامًا.', 'Report the issue with the transaction reference, item and photographs if available. The withdrawal period does not restrict rights arising from defects, non-conformity or a delay that gives a statutory cancellation right. Administrative review does not override an established statutory right.'],
  ]},
  {id: 'process', title: ['إجراءات الإرجاع ورد المبلغ', 'Return & refund arrangements'], paragraphs: [
   ['تواصل لتحديد طريقة الإرجاع ومكانه، واحتفظ بالفاتورة ومرفقات المنتج. نوضح نتيجة المراجعة وأساسها وأي تكاليف مشروعة قبل الاستكمال. عند استحقاق رد مبلغ مدفوع، ننسق وسيلة الرد ومدته بحسب وسيلة الدفع والحقوق المنطبقة، دون إلزامك برصيد متجر. لا ينفذ تغيير حالة الطلب في الحساب تحويلًا أو استردادًا بنكيًا تلقائيًا.', 'Contact us to arrange the return method and location, and keep the invoice and product accessories. We explain the review outcome, its basis and lawful costs before proceeding. Where a paid amount is refundable, we arrange its method and timing according to payment arrangements and applicable rights, without requiring store credit. Changing an account status does not automatically execute a bank refund.'],
  ]},
 ];
 return [identity,
  {id: 'arrangements', title: ['تأكيد ترتيبات الاستلام', 'Confirm collection arrangements'], paragraphs: [
   [settings.fulfillmentAr, settings.fulfillmentEn],
   ['انتظر تأكيد المبيعات للتوفر ومكان الاستلام وتاريخه قبل الزيارة أو ترتيب النقل. مشاركة موقع المشروع في طلب عرض السعر تساعد على التسعير ولا تؤكد تقديم خدمة توصيل.', 'Wait for sales to confirm availability, collection location and date before visiting or arranging transport. Providing a project location helps prepare the quote and does not confirm delivery service.'],
  ]},
  {id: 'delivery', title: ['التوريد أو التنفيذ المتفق عليه', 'Agreed supply or work'], paragraphs: [
   ['إذا شمل العرض نقلًا أو توصيلًا أو تركيبًا، يوضح الاتفاق المنطقة والتكلفة والمسؤوليات والمدة ومتطلبات دخول الموقع. لا توجد رسوم توصيل أو مدة جاهزية ثابتة لجميع المنتجات؛ يعتمد ذلك على التوفر والمواصفات ونطاق التعامل.', 'If a quote includes transport, delivery or installation, the agreement specifies coverage, cost, responsibilities, timing and site access requirements. No single delivery fee or readiness period applies to all products; these depend on availability, specifications and scope.'],
  ]},
  {id: 'receipt', title: ['عند الاستلام والتأخير', 'Receipt & delays'], paragraphs: [
   ['راجع الأصناف والكميات وحالتها والمستندات عند الاستلام، وأبلغ المؤسسة بأي نقص أو تلف مع المرجع والتفاصيل. عند تغير الموعد، يتواصل الفريق لتوضيح الوضع والخيارات المتاحة مع بقاء حقوقك النظامية في الإلغاء أو المعالجة.', 'Check items, quantities, condition and documents on receipt. Report shortages or damage with the reference and details. If timing changes, the team explains the situation and available options while preserving statutory cancellation and remedy rights.'],
  ]},
 ];
}
