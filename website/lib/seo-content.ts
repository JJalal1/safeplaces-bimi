import type {Lang} from './config';

export type SeoCopy=readonly [string,string];
export type SeoQuestion={question:SeoCopy;answer:SeoCopy};
export type SeoGuide={
 title:SeoCopy;
 description:SeoCopy;
 introduction:SeoCopy;
 detail:SeoCopy;
 questions:readonly SeoQuestion[];
};
export const seoText=(copy:SeoCopy,lang:Lang)=>copy[lang==='ar'?0:1];

/**
 * Search-intent guides for real equipment and services in the existing catalog.
 * No claims about stock, certifications, branches, response times or fixed prices.
 * Each page targets one subject rather than a block of repeated keywords.
 */
export const homeSeo:SeoGuide={
 title:['معدات السلامة ومكافحة الحريق في الخبر','Fire protection & safety equipment in Al Khobar'],
 description:['مؤسسة المناطق الآمنة في الخبر لتوريد معدات السلامة وطفايات الحريق وأنظمة الإنذار والمكافحة، مع خدمات التركيب والصيانة وطلبات عروض الأسعار.','Safe Places in Al Khobar provides safety equipment and fire protection supply, installation and maintenance enquiries. Request a tailored quotation.'],
 introduction:['تبحث عن معدات السلامة في الخبر أو حلول مكافحة الحريق لمنشأتك؟ تساعدك مؤسسة المناطق الآمنة في استعراض معدات الإطفاء والإنذار والوقاية الشخصية، وتحديد متطلبات التوريد أو التركيب أو الصيانة ضمن نطاق مشروعك.','Looking for safety equipment in Al Khobar or fire protection solutions for a facility? Explore firefighting equipment, fire alarms and personal protective equipment, then discuss supply, installation or maintenance for your project.'],
 detail:['ابدأ بالقسم المناسب، ثم أضف المنتجات والكميات إلى طلب عرض السعر دون دفع إلكتروني. يمكن مشاركة الموقع والمواصفات والمخططات المتاحة ليحدد الفريق تفاصيل العرض قبل أي اتفاق.','Choose the right category and add requested quantities to a quotation enquiry—there is no online payment. Share your site, specifications and available drawings so the team can review the scope before an agreement.'],
 questions:[
  {question:['كيف أطلب عرض سعر لمعدات السلامة في الخبر؟','How do I request a safety equipment quote in Al Khobar?'],answer:['اختر المنتجات والكميات من المتجر، ثم أرسل طلب عرض السعر مع بيانات التواصل والمواصفات المتاحة.','Choose products and quantities in the catalog, then submit a quote request with your contact details and available specifications.']},
  {question:['هل تعرضون أسعارًا ثابتة أو دفعًا مباشرًا؟','Are there fixed online prices or checkout payments?'],answer:['لا؛ يتم تحديد السعر بعد مراجعة الصنف والمواصفات والكمية ونطاق التوريد.','No. Pricing is confirmed after reviewing the item, specification, quantity and supply scope.']}
 ]
};
export const shopSeo:SeoGuide={
 title:['متجر معدات السلامة بالخبر | طلب عروض أسعار','Safety equipment catalog in Al Khobar | Request a quote'],
 description:['تصفح طفايات الحريق وأجهزة الإنذار والمضخات والرشاشات والخوذ ومستلزمات الطوارئ في متجر المناطق الآمنة بالخبر. اختر الكميات واطلب عرض سعر.','Explore fire extinguishers, alarms, pumps, sprinklers, PPE and emergency supplies in Al Khobar. Choose quantities and request a quotation.'],
 introduction:['يضم دليل معدات السلامة أقسام طفايات الحريق، أجهزة إنذار وكشف الحريق، معدات مكافحة الحريق، الوقاية الشخصية ومستلزمات الطوارئ. يمكنك مقارنة الأقسام والاطلاع على تفاصيل الأصناف قبل طلب التوريد.','The safety equipment catalog covers fire extinguishers, alarm and detection equipment, firefighting systems, personal protective equipment and emergency supplies. Browse product groups and review information before requesting supply.'],
 detail:['لا تعني إضافة منتج إلى الطلب تأكيد توافر موديل محدد أو سعر ثابت؛ تُراجع التفاصيل الفنية والكميات وموقع المشروع أولًا، ثم يُجهز العرض المناسب.','Adding an item does not guarantee a specific model, inventory or fixed price. Specifications, quantities and project location are reviewed before a tailored quotation.'],
 questions:[
  {question:['هل أستطيع طلب عدة منتجات بعرض سعر واحد؟','Can I request several products in one quotation?'],answer:['نعم، أضف الأصناف المطلوبة وحدد كمية كل صنف، ثم أرسل القائمة في نموذج واحد.','Yes. Add each required item, adjust its quantity and submit one quotation request.']},
  {question:['ما المعلومات التي تساعد في تحديد عرض سعر معدات السلامة؟','What information helps prepare a safety equipment quote?'],answer:['اسم المنتج أو الموديل والمواصفات والكمية وموقع المشروع والموعد المتوقع عند توفرها.','Product or model name, specifications, quantity, project location and expected timing, when available.']}
 ]
};
export const categorySeo:Record<string,SeoGuide>={
 extinguishers:{
  title:['طفايات الحريق ومستلزماتها في الخبر','Fire extinguishers and accessories in Al Khobar'],
  description:['تعرّف على خيارات طفايات الحريق وملحقات الإطفاء الأولي للمباني والمنشآت بالخبر. أرسل نوع الطفاية والسعة والكمية المطلوبة لعرض سعر.','Explore fire extinguishers and first-response accessories for facilities in Al Khobar. Request a quote by type, capacity and quantity.'],
  introduction:['تختلف طفايات الحريق حسب نوع المخاطر وبيئة الاستخدام والسعة المطلوبة. عند البحث عن طفايات بودرة أو ثاني أكسيد الكربون أو غيرها، ينبغي تحديد الاستخدام المقصود قبل اختيار الصنف.','Fire extinguishers differ by hazard, application and required capacity. If comparing powder, CO₂ or other extinguisher types, establish the intended use before selecting an item.'],
  detail:['يمكن الاستفسار عن طفايات الحريق للمكاتب والمستودعات والمواقع الصناعية مع ذكر السعات وأماكن التوزيع والكميات. لا يُعتمد نوع الطفاية إلا بعد مراجعة ملاءمته للمخاطر والمتطلبات الفنية.','For offices, warehouses and industrial sites, include capacities, placement and quantities. The appropriate extinguisher type should be verified against the actual hazards and technical requirements.'],
  questions:[
   {question:['كيف أحدد نوع طفاية الحريق المناسب؟','How do I select an extinguisher type?'],answer:['حدد نوع الحريق المحتمل وموقع الاستخدام وسعة الطفاية المطلوبة، ثم راجع الاختيار مع المختص.','Identify the potential fire hazard, location and required capacity, then verify the selection with a specialist.']},
   {question:['هل يمكن طلب طفايات حريق بكميات للمشاريع؟','Can I request multiple extinguishers for a project?'],answer:['نعم، اذكر عدد الطفايات والأنواع والمواقع ليتم تقييم احتياج التوريد.','Yes. Share quantities, types and locations for a project quotation.']}
  ]
 },
 alarms:{
  title:['أنظمة إنذار وكشف الحريق بالخبر','Fire alarm and detection equipment in Al Khobar'],
  description:['أجهزة إنذار حريق وكواشف دخان وحرارة ولوحات تحكم ونقاط نداء في دليل المناطق الآمنة بالخبر. اطلب عرض سعر وفق نوع النظام والمواصفات.','Fire alarm panels, smoke and heat detectors and manual call points in Al Khobar. Request a quotation matched to your system specifications.'],
  introduction:['يشمل إنذار الحريق الكشف المبكر والتنبيه وإدارة الإشارات بين الكواشف واللوحات وأجهزة الإنذار. تختلف الأجهزة حسب تصميم النظام القائم أو الجديد ومتطلبات المنشأة.','Fire alarm equipment connects early detection, control panels and warning devices. Selection depends on the new or existing system design and facility needs.'],
  detail:['عند طلب كواشف دخان أو حرارة أو لوحة إنذار أو نقاط نداء، أرفق موديل النظام إن وجد ومخطط الموقع والعدد المطلوب لتسهيل مراجعة التوافق الفني.','For smoke or heat detectors, alarm panels or manual call points, share the existing system model, drawings and requested quantities where available so compatibility can be reviewed.'],
  questions:[
   {question:['هل تتوافق كل كواشف الحريق مع أي لوحة إنذار؟','Do all fire detectors work with every alarm panel?'],answer:['ليس بالضرورة؛ يجب التحقق من نوع النظام والتوصيلات والبروتوكول والمواصفات قبل اعتماد الجهاز.','Not necessarily. The system type, interfaces, protocol and specifications must be checked first.']},
   {question:['هل يمكن طلب توريد وتركيب أنظمة الإنذار؟','Can I request alarm supply and installation?'],answer:['يمكن إرسال تفاصيل المشروع لبحث نطاق التوريد والتركيب والاختبار حسب المتطلبات.','Submit project details to discuss the scope of supply, installation and testing.']}
  ]
 },
 firefighting:{
  title:['مضخات ورشاشات وخراطيم مكافحة الحريق بالخبر','Fire pumps, sprinklers and hose equipment in Al Khobar'],
  description:['مضخات الحريق وشبكات الرشاشات والخراطيم والبكرات والخزائن لمشاريع مكافحة الحريق في الخبر. اطلب عرضًا حسب المخططات والكميات.','Fire pumps, sprinklers, hoses, reels and cabinets for firefighting systems in Al Khobar. Request a project-specific quote.'],
  introduction:['تضم أنظمة مكافحة الحريق معدات التغذية بالمياه ومضخات الحريق والرشاشات والخراطيم والبكرات والخزائن. تحديد المكونات يعتمد على تصميم الشبكة والاحتياجات التشغيلية.','Firefighting systems can include water supply equipment, pumps, sprinklers, hoses, reels and cabinets. Components depend on hydraulic design and operational requirements.'],
  detail:['عند الاستفسار عن مضخة حريق أو رشاش أو خرطوم إطفاء، اذكر المقاس أو التصنيف المطلوب والعدد والمخططات المتاحة؛ ويُراجع التصميم الفني قبل اعتماد أي بديل.','For a fire pump, sprinkler or fire hose enquiry, provide dimensions or required ratings, quantities and drawings; technical design should be reviewed before approving alternatives.'],
  questions:[
   {question:['ما المعلومات اللازمة لعرض سعر مضخة حريق؟','What is needed for a fire pump quotation?'],answer:['القدرة أو التدفق والضغط المطلوب ونوع المشروع والمخططات أو المواصفات إن توفرت.','Required flow, pressure, project type and available drawings or specifications.']},
   {question:['هل الرشاشات والخراطيم جزء من العرض نفسه؟','Can sprinklers and hoses be quoted together?'],answer:['يمكن جمع الأصناف في طلب واحد مع فصل الكميات والمواصفات لكل بند.','Yes, list each item with its own quantities and specifications in one enquiry.']}
  ]
 },
 suppression:{
  title:['حلول أنظمة إخماد الحريق للمنشآت','Fire suppression system enquiries'],
  description:['استفسر عن أنظمة الإخماد للمرافق والاحتياجات الخاصة عبر المناطق الآمنة في الخبر. نراجع نوع الخطر والمساحة والمواصفات لطلب عرض سعر.','Discuss fire suppression systems for specialised facilities with Safe Places in Al Khobar. Request a quotation based on hazards, space and specifications.'],
  introduction:['تُختار حلول إخماد الحريق وفق طبيعة المخاطر والفراغات ومتطلبات المشروع. قد تختلف المتطلبات الفنية بين غرف المعدات والمرافق التشغيلية والأنظمة الخاصة.','Fire suppression solutions are chosen according to fire hazards, protected spaces and project requirements. Equipment rooms and specialist facilities may require different technical approaches.'],
  detail:['للاستفسار عن نظام إخماد، جهز وصف المنشأة والمساحات والمعدات المراد حمايتها والمخططات المتوفرة. يُحدد نطاق الحل بعد مراجعة المتطلبات، وليس من اسم النظام وحده.','For a suppression enquiry, describe the facility, protected area, equipment and any drawings. The solution scope is determined after reviewing requirements, not from the system name alone.'],
  questions:[
   {question:['كيف أبدأ طلب نظام إخماد حريق؟','How do I start a suppression system enquiry?'],answer:['قدّم طبيعة النشاط وموقع الحماية والمساحة والتصميم المتاح لتحديد نطاق الدراسة والعرض.','Provide activity type, protected location, area and available design information to define the review scope.']}
  ]
 },
 ppe:{
  title:['خوذ وسترات وقفازات ومعدات الوقاية الشخصية بالخبر','PPE, safety helmets, vests and gloves in Al Khobar'],
  description:['معدات الوقاية الشخصية للمواقع والمنشآت: خوذ سلامة وسترات عاكسة وقفازات ونظارات حماية. اطلب عرض سعر للكميات والمقاسات بالخبر.','PPE for workplaces in Al Khobar: safety helmets, reflective vests, gloves and protective eyewear. Quote requests by sizes and quantities.'],
  introduction:['تختلف معدات الوقاية الشخصية حسب طبيعة العمل والتعرض للمخاطر. تشمل الاحتياجات الشائعة خوذ السلامة والسترات العاكسة والقفازات والنظارات الواقية، ويُراعى المقاس ومستوى الحماية الملائم.','Personal protective equipment varies with job tasks and exposure. Common requests include safety helmets, reflective vests, gloves and protective eyewear, with suitable sizing and protection levels.'],
  detail:['لطلب معدات وقاية شخصية بالكميات، اذكر وظيفة المعدات والمقاسات والأعداد والمواصفات المطلوبة لكل صنف. يمكن مناقشة بدائل مناسبة بعد مراجعة الاشتراطات.','For bulk PPE enquiries, specify intended tasks, sizes, quantities and applicable specifications for each item. Suitable alternatives can be discussed after requirements are reviewed.'],
  questions:[
   {question:['هل أستطيع طلب مقاسات مختلفة من معدات الوقاية؟','Can I request different PPE sizes?'],answer:['نعم، وضح توزيع المقاسات والكميات لكل صنف في وصف طلب عرض السعر.','Yes. Include a size breakdown and quantities for each product in the quotation details.']},
   {question:['كيف أختار قفازات أو نظارات السلامة؟','How should I choose gloves or protective eyewear?'],answer:['ابدأ بطبيعة المهمة والمخاطر المتوقعة، ثم تحقق من المواصفات الملائمة قبل طلب التوريد.','Start with the task and expected risks, then confirm the appropriate specifications before supply.']}
  ]
 },
 emergency:{
  title:['لوحات السلامة وإنارة الطوارئ ومستلزمات الإخلاء','Safety signs, emergency lighting and evacuation supplies'],
  description:['لوحات إرشاد السلامة ومستلزمات الطوارئ والإخلاء للمكاتب والمصانع والمستودعات في الخبر. اطلب عرض سعر حسب المقاسات والمواقع والكميات.','Safety signs, emergency lighting and evacuation supplies for facilities in Al Khobar. Request a quote by size, location and quantity.'],
  introduction:['تساعد لوحات السلامة والإرشاد ومستلزمات الطوارئ في توضيح مخارج الإخلاء ومواقع معدات الحريق والتنبيه إلى المخاطر. يختلف الاختيار وفق المخطط وطبيعة المنشأة.','Safety and directional signs and emergency equipment help identify exits, fire equipment and hazards. Selection depends on the building layout and operating context.'],
  detail:['أرسل أنواع اللوحات وأبعادها واللغات المطلوبة وأماكن التركيب والكميات. بالنسبة إلى إنارة الطوارئ وتجهيزات الإخلاء، أرفق تفاصيل الموقع والمواصفات المتاحة.','Provide sign types, dimensions, languages, installation positions and quantities. For emergency lighting and evacuation supplies, add location details and applicable specifications.'],
  questions:[
   {question:['ما البيانات اللازمة لطلب لوحات السلامة؟','What details are needed for a safety sign quote?'],answer:['العبارة أو الرمز والمقاس والعدد وطبيعة المكان المراد تركيب اللوحة فيه.','Text or symbol, dimensions, quantity and intended installation location.']},
   {question:['هل يمكن إضافة مستلزمات الطوارئ إلى الطلب نفسه؟','Can emergency supplies share one quote request?'],answer:['نعم؛ أضف كل صنف والكمية المطلوبة إلى قائمة عروض الأسعار.','Yes. Add each item and quantity to the same quotation list.']}
  ]
 }
};
export const serviceSeo:Record<string,SeoGuide>={
 'fire-protection':{
  title:['توريد وتركيب أنظمة مكافحة الحريق بالخبر','Fire protection system supply and installation in Al Khobar'],
  description:['خدمات توريد وتركيب أنظمة مكافحة الحريق والمضخات والرشاشات والخراطيم للمشاريع والمنشآت. اشرح نطاق العمل واطلب عرض سعر في الخبر.','Fire protection system supply and installation enquiries for facilities in Al Khobar, covering pumps, sprinklers and hoses subject to project scope.'],
  introduction:['تبدأ أعمال أنظمة مكافحة الحريق بمراجعة طبيعة المنشأة والتصميم ونطاق الأعمال المطلوب. تشمل الاستفسارات شبكات المياه والمضخات والرشاشات والخراطيم والخزائن، حسب احتياج المشروع.','Fire protection projects begin with a review of facility type, design and work scope. Enquiries may cover water networks, pumps, sprinklers, hoses and cabinets as required.'],
  detail:['يساعد تقديم المخططات وجداول الكميات ووصف النظام القائم أو الجديد في تحديد المطلوب للتوريد والتركيب والاختبار قبل تجهيز عرض سعر المشروع.','Drawings, bills of quantities and details of new or existing systems help define supply, installation and testing before a quotation is prepared.'],
  questions:[{question:['ما المطلوب لطلب عرض سعر نظام مكافحة حريق؟','What should a fire protection quote request include?'],answer:['موقع المشروع ونوع المنشأة والمخططات ونطاق العمل والمواصفات المتوفرة.','Project location, facility type, drawings, work scope and available specifications.']}]
 },
 'fire-alarm':{
  title:['توريد وتركيب أنظمة إنذار الحريق بالخبر','Fire alarm installation and detection systems in Al Khobar'],
  description:['استفسر عن توريد وتركيب واختبار أنظمة إنذار وكشف الحريق والكواشف واللوحات للمباني والمنشآت في الخبر مع عرض سعر حسب المشروع.','Request fire alarm system supply, installation and testing in Al Khobar, including panels and detection equipment subject to project requirements.'],
  introduction:['تختلف متطلبات أنظمة إنذار الحريق بين المباني الجديدة وتحديث الأنظمة القائمة. يشمل تحديد العمل دراسة اللوحات والكواشف وأجهزة التنبيه والتوصيلات وأعمال الاختبار.','Fire alarm requirements differ between new facilities and upgrades. Scope planning reviews panels, detectors, warning devices, connections and testing.'],
  detail:['لإعداد عرض فني، حدد نوع النظام القائم إن وجد وعدد المناطق أو الأجهزة والمخططات ونوع العمل المطلوب: توريد أو تركيب أو اختبار أو دعم فني.','For a technical proposal, describe any existing system, device zones, drawings and requested work—supply, installation, testing or technical support.'],
  questions:[{question:['هل يمكن استبدال جهاز إنذار دون تغيير النظام كاملًا؟','Can one fire alarm component be replaced without replacing the system?'],answer:['يتوقف ذلك على توافق الجهاز مع مكونات النظام القائم ونتيجة الفحص الفني.','This depends on component compatibility and technical inspection of the installed system.']}]
 },
 maintenance:{
  title:['صيانة وفحص أنظمة مكافحة وإنذار الحريق بالخبر','Fire system maintenance, inspection and testing in Al Khobar'],
  description:['خدمات الصيانة الوقائية وفحص واختبار أنظمة الحريق والسلامة للمنشآت بالخبر. اذكر الأجهزة والموقع والدورية المطلوبة لعرض سعر.','Preventive maintenance, inspection and functional testing enquiries for fire protection and safety systems in Al Khobar.'],
  introduction:['تشمل أعمال صيانة أنظمة الحريق الفحص الدوري والاختبارات التشغيلية ومراجعة جاهزية المعدات. يعتمد نطاق الصيانة على نوع النظام وحالته وسجلاته ومتطلبات الموقع.','Fire system maintenance can include periodic inspection, functional testing and equipment readiness checks. Scope depends on system type, condition, records and site requirements.'],
  detail:['عند طلب عقد صيانة أو زيارة فحص، اذكر أنواع الأجهزة وعددها وعمر النظام والملاحظات الحالية والمستندات المتوفرة لتحديد الخطوات اللازمة.','For a maintenance contract or inspection visit, provide equipment types, quantities, system age, current issues and available records to define the next steps.'],
  questions:[{question:['ما الفرق بين فحص الحريق والصيانة الدورية؟','What is the difference between an inspection and planned maintenance?'],answer:['يركز الفحص على التحقق من الحالة والأداء، وتشمل الصيانة الإجراءات الوقائية أو التصحيحية المتفق عليها بعد تقييم النظام.','Inspection evaluates condition and performance; maintenance covers agreed preventive or corrective work following system review.']}]
 },
 readiness:{
  title:['تجهيز المنشآت لمتطلبات السلامة والفحص بالخبر','Safety inspection readiness support in Al Khobar'],
  description:['استفسر عن مراجعة احتياجات المنشأة وتجهيز متطلبات السلامة والفحص ودعم الجاهزية في الخبر وفق نطاق العمل المتفق عليه.','Request facility safety readiness reviews and inspection preparation support in Al Khobar, subject to agreed scope and requirements.'],
  introduction:['تتطلب جاهزية المنشآت فهم الاستخدام الفعلي للموقع وحالة تجهيزات السلامة والسجلات المتاحة. يمكن مراجعة احتياجات المنشأة قبل الفحص وتحديد الأولويات الفنية.','Facility readiness starts with understanding site use, existing safety equipment and available records. A preliminary review can identify priorities before inspections.'],
  detail:['تساعد معلومات المنشأة ونشاطها وأجهزتها ووثائقها في تحديد نطاق مراجعة المتطلبات. لا تمثل الاستشارة ضمانًا للاعتماد أو نتيجة فحص جهة رسمية.','Facility use, equipment lists and documents help define the review scope. Advisory support does not guarantee approval by any authority.'],
  questions:[{question:['هل تعني مراجعة الجاهزية الحصول على اعتماد؟','Does a readiness review guarantee regulatory approval?'],answer:['لا؛ يقتصر دور المراجعة على الدعم الفني ضمن النطاق المتفق عليه، وتبقى القرارات للجهات المختصة.','No. Readiness support is technical assistance within the agreed scope; regulatory decisions remain with the relevant authorities.']}]
 },
 training:{
  title:['تدريب السلامة والطوارئ والإخلاء للمنشآت','Workplace safety, emergency and evacuation training'],
  description:['تدريب وتوعية العاملين بإجراءات السلامة والاستعداد للطوارئ والإخلاء وفق نشاط المنشأة وعدد المشاركين في الخبر. اطلب عرض سعر.','Workplace safety awareness, emergency response and evacuation training enquiries in Al Khobar, tailored to the facility and participants.'],
  introduction:['يساعد التدريب على السلامة والطوارئ العاملين في فهم إجراءات الإبلاغ والإخلاء والاستعداد للحوادث وفق طبيعة الموقع. يختلف المحتوى المناسب بين المكاتب والمستودعات والمرافق الصناعية.','Safety and evacuation training helps staff understand reporting, exit procedures and emergency readiness. Training needs differ for offices, warehouses and industrial facilities.'],
  detail:['حدد عدد المشاركين ونوع المنشأة والموضوعات المطلوبة ومكان التدريب ليتم مناقشة البرنامج ومدته ونطاقه قبل تسعيره.','State the number of participants, facility type, topics and training location to discuss programme scope and duration before pricing.'],
  questions:[{question:['ما المعلومات اللازمة لتنظيم تدريب إخلاء؟','What information is needed for evacuation training?'],answer:['عدد المتدربين وطبيعة العمل وموقع المنشأة والأهداف التدريبية المتوقعة.','Participant count, work environment, facility location and intended training objectives.']}]
 },
 'safety-supply':{
  title:['توريد معدات وأدوات السلامة للمنشآت بالخبر','Bulk safety equipment supply in Al Khobar'],
  description:['توريد طفايات الحريق والخوذ والسترات والقفازات واللوحات ومعدات الوقاية الشخصية للمشاريع في الخبر. قدّم قائمة الكميات واطلب عرضًا.','Safety equipment supply for projects in Al Khobar: extinguishers, PPE, signs and emergency supplies. Share a bill of quantities for a quote.'],
  introduction:['يمكن تجهيز طلب توريد معدات سلامة يضم أصنافًا متعددة من أدوات الوقاية ومستلزمات الإطفاء والطوارئ. مراجعة قائمة الأصناف والمواصفات مبكرًا تساعد على توضيح البدائل المطلوبة.','A safety supply enquiry can combine PPE, firefighting accessories and emergency supplies. Early review of the item list and specifications helps clarify acceptable alternatives.'],
  detail:['شارك جدول الكميات BOQ إن وجد، أو أدخل المنتجات واحدًا تلو الآخر في قائمة عرض السعر. تُراجع الكميات ومكان الاستلام والمواصفات قبل اعتماد العرض.','Share a bill of quantities (BOQ) if available, or add products to the quote list. Quantities, delivery or collection location and specifications are reviewed before quotation approval.'],
  questions:[{question:['هل يمكن إرسال جدول كميات بدل اختيار كل منتج؟','Can I submit a BOQ instead of selecting every item?'],answer:['يمكن وصف القائمة في نموذج طلب عرض السعر وإرفاق المستند عند توفر خدمة الملفات، أو التنسيق لمشاركته مع الفريق.','Describe the list in the quote form and attach a document when uploads are available, or arrange sharing it with the team.']}]
 }
};
export const productSeo:Record<string,SeoGuide>={
 'fire-extinguishers':{
  title:['طفايات الحريق | استفسار عن الأنواع والسعات','Fire extinguishers | Types, sizes and quote enquiries'],
  description:['اطلب عرض سعر لطفايات الحريق بالخبر وفق نوع المادة المطفئة والسعة والعدد والموقع. راجع متطلبات المنشأة قبل اختيار الطفاية.','Request fire extinguisher quotations in Al Khobar by type, capacity, quantity and site requirements.'],
  introduction:['عند اختيار طفاية حريق، لا تكفي مقارنة السعات وحدها؛ يجب التحقق من نوع الخطر وطبيعة المكان وطريقة التوزيع.','When selecting a fire extinguisher, capacity alone is not enough: fire hazards, placement and the intended environment must be considered.'],
  detail:['اذكر طفاية بودرة أو CO₂ أو أي نوع مطلوب إذا كان محددًا في مخططاتك، مع السعة والكمية لطلب عرض سعر مناسب.','If drawings specify powder, CO₂ or another extinguisher type, include that type with capacity and quantity in the quote request.'],
  questions:[{question:['هل تحددون السعر قبل معرفة السعة والنوع؟','Is a price shown before extinguisher type and capacity are known?'],answer:['يتم تأكيد السعر بعد تحديد نوع الطفاية والمواصفات والكمية المطلوبة.','Pricing is confirmed once type, specifications and quantity are known.']}]
 },
 'fire-alarm-devices':{
  title:['أجهزة إنذار وكشف الحريق | توريد بالخبر','Fire alarm detectors and devices | Al Khobar supply enquiries'],
  description:['كواشف دخان وحرارة ولوحات إنذار ونقاط نداء وأجهزة تنبيه؛ اطلب عرضًا لأجهزة إنذار الحريق المتوافقة مع متطلبات مشروعك.','Enquire about smoke and heat detectors, fire alarm panels, call points and sounders compatible with project requirements.'],
  introduction:['تشمل أجهزة إنذار الحريق كواشف الحرارة والدخان ووحدات التحكم وأجهزة التنبيه اليدوية والآلية.','Fire alarm equipment includes smoke and heat sensors, control panels, manual call points and audible or visual warning devices.'],
  detail:['شارك الشركة أو الطراز الموجود عند طلب استبدال قطعة، حتى تُراجع ملاءمة الجهاز لنظام الإنذار القائم.','When replacing a component, share the current system make or model so the proposed device can be checked for compatibility.'],
  questions:[{question:['ما الذي أرفقه عند طلب كاشف حريق؟','What should I provide for a detector enquiry?'],answer:['نوع الكاشف والموديل إن وجد والكمية ونوع لوحة الإنذار.','Detector type, model if known, quantity and alarm panel type.']}]
 },
 'fire-pumps':{
  title:['مضخات الحريق للمشاريع | عرض سعر','Fire pumps for projects | Request a quotation'],
  description:['اطلب عرض سعر لمضخات الحريق في الخبر وفق التدفق والضغط ومواصفات الشبكة ومخططات المشروع ومتطلبات التركيب.','Request a fire pump quotation in Al Khobar based on flow, pressure, piping network and project drawings.'],
  introduction:['تعد مضخة الحريق أحد عناصر التغذية لأنظمة مكافحة الحريق بالمياه، ويتوقف اختيارها على متطلبات الضغط والتدفق والتصميم.','A fire pump supports water-based firefighting systems. Selection depends on the design flow, pressure and connected network.'],
  detail:['أرفق منحنى الأداء أو جدول المواصفات إن توفر، واذكر موقع المشروع وحالة النظام الجديد أو القائم لمراجعة نطاق التوريد.','Supply a performance curve or specification schedule if available, plus project location and whether the installation is new or existing.'],
  questions:[{question:['ما أهم بيانات طلب مضخة حريق؟','Which fire pump details matter most?'],answer:['التدفق والضغط ومصدر الطاقة ومتطلبات الموقع والمخططات الفنية.','Flow, pressure, power source, site requirements and design drawings.']}]
 },
 sprinklers:{
  title:['رشاشات الحريق وشبكات الرش | طلب تسعير','Fire sprinklers and sprinkler networks | Quotations'],
  description:['رشاشات وأنظمة رش الحريق للمباني والمستودعات؛ اطلب عرض سعر بالخبر وفق التصميم والنوع والمقاسات والكميات.','Fire sprinklers for buildings and warehouses. Request a quotation by design, sprinkler type, size and quantity.'],
  introduction:['تعمل رشاشات الحريق كجزء من شبكة مكافحة الحريق المائية، ويختلف اختيار الرشاش وفق تصميم الشبكة وطبيعة الموقع.','Sprinklers are components of water-based fire protection networks, and their selection depends on system design and site use.'],
  detail:['اذكر نوع الرشاش المطلوب ومقاس الوصلة والتصنيف والكمية كما ورد في المخططات، أو اطلب مراجعة الاحتياج قبل التوريد.','Provide the specified sprinkler type, connection size, rating and quantity from the drawings, or request guidance before supply.'],
  questions:[{question:['هل يكفي تحديد عدد الرشاشات؟','Is sprinkler quantity alone enough for a quote?'],answer:['يُفضل إضافة النوع والمقاس والتصنيف والمخططات لتحديد المواصفات الصحيحة.','Type, connection size, rating and drawings help identify the correct specification.']}]
 },
 'hoses-and-reels':{
  title:['خراطيم وبكرات الحريق والخزائن | بالخبر','Fire hoses, hose reels and cabinets | Al Khobar'],
  description:['استفسر عن خراطيم إطفاء الحريق والبكرات والخزائن وملحقاتها للمنشآت بالخبر، واطلب عرضًا حسب المقاسات والكميات.','Enquire about firefighting hoses, reels, cabinets and accessories for facilities in Al Khobar. Quote by dimensions and quantities.'],
  introduction:['تشمل مستلزمات خراطيم الحريق الخراطيم والبكرات والخزائن والملحقات المناسبة لشبكة الإطفاء.','Fire hose equipment includes hoses, reels, cabinets and compatible accessories for the installed firefighting network.'],
  detail:['حدد طول الخرطوم وقطره ونوع الوصلات والعدد ومساحة الاستخدام؛ تختلف المواصفات حسب التصميم والاشتراطات الفنية.','Include hose length, diameter, coupling type, quantity and location. Specifications depend on the design and technical requirements.'],
  questions:[{question:['ما الذي أذكره في طلب بكرة خرطوم حريق؟','What details are useful for a hose reel quote?'],answer:['النوع والمقاس والطول والكمية وأي اشتراطات أو صور للمعدة القائمة.','Type, size, length, quantity and any requirements or photos of existing equipment.']}]
 },
 'safety-helmets':{
  title:['خوذ السلامة للمواقع والمشاريع | بالخبر','Safety helmets for worksites | Al Khobar quotes'],
  description:['خوذ سلامة للعمل والمواقع والمشاريع؛ اطلب عرض سعر بالخبر حسب المقاسات والمواصفات والعدد ومستوى الحماية المطلوب.','Safety helmet quotations for construction and industrial workplaces in Al Khobar. Specify sizes, protection requirements and quantities.'],
  introduction:['تُختار خوذ السلامة وفق طبيعة المهمة والمخاطر المحتملة وراحة المستخدم والمواصفات المعتمدة للموقع.','Safety helmets should be chosen for the task, exposure, fit and specifications required by the workplace.'],
  detail:['عند طلب الخوذ بالكميات، وضح نوع العمل والعدد والمقاسات والخصائص المطلوبة لمراجعة الخيارات المناسبة.','For bulk safety helmet enquiries, include activity, quantity, sizing and the needed protective features.'],
  questions:[{question:['هل تختلف خوذ السلامة حسب الاستخدام؟','Do safety helmets differ by workplace use?'],answer:['نعم؛ يجب مراجعة متطلبات الوقاية والمقاس وطبيعة المخاطر قبل تحديد الطراز.','Yes. Protection requirements, fit and hazards should be reviewed before selecting a model.']}]
 },
 'protective-equipment':{
  title:['سترات عاكسة وقفازات ونظارات واقية | بالخبر','Safety vests, gloves and glasses | Al Khobar'],
  description:['استفسر عن سترات السلامة العاكسة وقفازات العمل والنظارات الواقية للمشاريع في الخبر، مع تحديد المقاسات والكميات ونوع المهمة.','Request quotes for reflective safety vests, work gloves and protective eyewear in Al Khobar, by sizes, quantities and use.'],
  introduction:['تختلف السترات العاكسة والقفازات والنظارات الواقية حسب ظروف العمل ومستوى التعرض والمقاسات المناسبة.','Reflective vests, protective gloves and safety eyewear vary according to working conditions, exposure and required fit.'],
  detail:['يمكن جمع عدة أصناف في عرض واحد، مع توزيع الكميات حسب المقاس ونوع الحماية المطلوبة لكل مجموعة من العاملين.','Combine multiple PPE items in a quotation, with size and protection requirements for each worker group.'],
  questions:[{question:['هل يمكن توزيع الطلب على أكثر من مقاس؟','Can a PPE quotation include multiple sizes?'],answer:['نعم؛ وضح الأصناف والكميات المطلوبة لكل مقاس ضمن طلب العرض.','Yes. Specify items and quantities for each size in the request.']}]
 },
 'emergency-and-signs':{
  title:['لوحات السلامة ومستلزمات الطوارئ | بالخبر','Safety signs and emergency supplies | Al Khobar'],
  description:['لوحات إخلاء وتحذير وإرشاد ومستلزمات الطوارئ للمباني والمواقع في الخبر. اطلب عرض سعر وفق المقاسات واللغات والكميات.','Safety, warning and evacuation signage plus emergency supplies for Al Khobar workplaces. Quote by size, language and quantity.'],
  introduction:['تُستخدم لوحات السلامة للتحذير والإرشاد وتوضيح مواقع مخارج الإخلاء ومعدات الطوارئ داخل المنشأة.','Safety signs help communicate hazards, directions, exit routes and emergency equipment locations in a facility.'],
  detail:['حدد الرمز أو النص والمقاسات والكمية وموقع التركيب المطلوب، مع مخطط أو صورة توضيحية إن وجدت.','Share the required text or symbol, sign dimensions, quantity and installation position, plus any available site layout.'],
  questions:[{question:['هل تختلف لوحات السلامة حسب الموقع؟','Do safety sign requirements depend on the site?'],answer:['نعم؛ يتحدد الشكل والمقاس والمحتوى وفق وظيفة المكان ومتطلبات المشروع.','Yes. Design, size and messaging depend on the site and project requirements.']}]
 }
};
