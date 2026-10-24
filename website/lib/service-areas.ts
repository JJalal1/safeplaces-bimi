import {local,type Lang} from './config';
import type {Bilingual} from './company-copy';

export type ServiceArea={
 slug:string;
 title:Bilingual;
 description:Bilingual;
 prepare:Bilingual;
};

// These are detailed scopes of the six existing services, not additional
// branches, accreditations or guarantees. Keep the same text visible in HTML
// and in service structured data; quotation links accept only these topics.
const areas:Record<string,readonly ServiceArea[]>={
 maintenance:[
  {slug:'extinguishers',title:['فحص وصيانة طفايات الحريق','Fire extinguisher inspection and maintenance'],
   description:['مراجعة حالة الطفايات وبياناتها ومواقعها وملاحظات الفحص المتاحة لتحديد احتياج الصيانة. تُراجع أعمال المعالجة أو الاستبدال وقطع الغيار بعد معرفة النوع والحالة، وتُوضح البنود المشمولة في العرض.','Review extinguisher condition, equipment labels, locations and available inspection findings to define maintenance needs. Corrective work, replacements and parts are reviewed against the equipment type and condition and identified in the quotation.'],
   prepare:['أنواع الطفايات وسعاتها وأعدادها وصور بياناتها وآخر سجل فحص إن توفر.','Extinguisher types, capacities, quantities, label photographs and the latest inspection record, if available.']},
  {slug:'fire-alarm',title:['صيانة أنظمة إنذار وكشف الحريق','Fire alarm and detection system maintenance'],
   description:['فحص نظام الإنذار القائم ومراجعة الملاحظات على اللوحات والكواشف ونقاط النداء وأجهزة التنبيه. يُحدد نطاق الاختبارات التشغيلية ومعالجة الأعطال والتنسيق مع مسؤول المنشأة قبل العمل على النظام.','Inspect the existing alarm installation and review findings involving panels, detectors, call points and warning devices. Functional tests, fault investigation and coordination with the facility contact are defined before work on the system.'],
   prepare:['نوع اللوحة وعدد الأجهزة ووصف الأعطال أو الإشارات الظاهرة وسجلات الصيانة المتاحة.','Panel type, device quantities, reported faults or indications and available maintenance records.']},
  {slug:'pumps-and-networks',title:['صيانة مضخات وشبكات مكافحة الحريق','Fire pump and firefighting network maintenance'],
   description:['مراجعة احتياجات فحص وصيانة مضخات الحريق وشبكات المياه والرشاشات والخراطيم والبكرات والخزائن ضمن المعدات المحددة للزيارة. يُفصل الفحص والاختبار عن أي إصلاح أو تغيير في الشبكة، وتُنسق الأعمال مع تشغيل الموقع.','Review inspection and maintenance requirements for fire pumps, water networks, sprinklers, hoses, reels and cabinets within the specified visit scope. Inspection and testing are distinguished from repairs or network changes, with work coordinated around site operations.'],
   prepare:['قائمة المضخات والمعدات والمخططات المتاحة والملاحظات السابقة وقيود الدخول للموقع.','Pump and equipment lists, available drawings, previous findings and site access constraints.']},
  {slug:'planned-maintenance',title:['عقود الصيانة الوقائية والدورية','Preventive and periodic maintenance contracts'],
   description:['تنظيم نطاق صيانة للأنظمة القائمة يوضح المعدات المشمولة والزيارات والفحوص والمخرجات المطلوبة. تُحدد دورية الزيارات بحسب النظام واحتياج المنشأة، وتُوضح شروط قطع الغيار وأعمال الإصلاح وأي بنود إضافية قبل اعتماد العقد.','Define a maintenance scope for existing installations, identifying covered equipment, visits, checks and required outputs. Visit frequency is agreed according to the system and facility requirements, with parts, repairs and additional activities clarified before a contract is approved.'],
   prepare:['المواقع والمعدات المشمولة والدورية المطلوبة وسجلات العقود أو الزيارات السابقة إن وجدت.','Sites and equipment to be covered, requested frequency and previous contracts or visit records, where available.']},
  {slug:'testing-and-commissioning',title:['فحص واختبار وتشغيل أنظمة السلامة','Safety system inspection, testing and commissioning'],
   description:['اختبارات لوظائف محددة في أنظمة الحريق والإنذار ضمن النطاق المتفق عليه، بما في ذلك المراجعة بعد تعديل أو عمل صيانة عند الحاجة. تُحدد نقاط الاختبار ومتطلبات التنسيق والسجلات المطلوبة قبل تنفيذ الزيارة.','Test specified functions of fire protection and alarm systems within an agreed scope, including checks following modifications or maintenance where required. Test points, coordination requirements and records are defined before the visit.'],
   prepare:['نوع النظام والغرض من الاختبار والأعمال المنفذة والمخططات أو تقارير الاختبار السابقة.','System type, test objective, completed work and available drawings or previous test reports.']},
  {slug:'technical-support',title:['الدعم الفني ومتابعة ملاحظات الصيانة','Technical support and maintenance follow-up'],
   description:['مراجعة الملاحظات التشغيلية وبيانات الأجهزة والسجلات المتاحة لفهم الاحتياج وتحديد الفحص أو الإجراء الفني المناسب. يُوضح ما يحتاج زيارة أو قطع غيار أو أعمالًا إضافية قبل إدراجه في العرض.','Review reported operating issues, equipment information and available records to identify the inspection or technical work needed. Site visits, parts and additional activities are clarified before they are included in the proposal.'],
   prepare:['وصف الملاحظة وتاريخ ظهورها وصور بيانات الأجهزة وأي تغييرات أو أعمال صيانة سابقة.','A description and history of the issue, equipment label photographs and previous modifications or maintenance.']}
 ],
 training:[
  {slug:'safety-awareness',title:['التوعية بالسلامة والوقاية من الحريق','Safety and fire prevention awareness'],
   description:['برنامج توعوي للعاملين يرتبط بطبيعة نشاط المنشأة ومخاطرها وإجراءاتها القائمة، ويتناول التعرف على احتياجات السلامة والإبلاغ عن الملاحظات والاستعداد للحوادث. تُراجع المحاور واللغة والمدة وفق المشاركين.','Staff awareness tailored to the facility activity, risks and existing procedures, covering safety needs, reporting observations and incident readiness. Topics, language and duration are reviewed according to the participants.'],
   prepare:['نشاط المنشأة وعدد المشاركين ولغتهم والمحاور المطلوبة والموعد المقترح.','Facility activity, participant numbers and language, requested topics and proposed timing.']},
  {slug:'equipment-use',title:['التدريب على استخدام طفايات ومعدات السلامة','Fire extinguisher and safety equipment guidance'],
   description:['توعية وتوجيه حول معدات السلامة والطفايات المحددة في البرنامج وربطها بإجراءات المنشأة. يُوضح قبل الاتفاق ما إذا كان المطلوب شرحًا نظريًا أو نشاطًا عمليًا، وما يحتاجه النشاط من معدات ومكان وتجهيز وتنسيق.','Awareness and guidance on the extinguishers and safety equipment identified in the programme, aligned with facility procedures. Classroom or practical delivery, equipment, venue preparation and coordination are clarified before agreement.'],
   prepare:['أنواع المعدات وعدد المتدربين والهدف من البرنامج وأي نشاط عملي مطلوب.','Equipment types, participant numbers, intended outcomes and any requested practical activity.']},
  {slug:'emergency-response',title:['التدريب على الاستعداد والاستجابة للطوارئ','Emergency readiness and response training'],
   description:['مراجعة أدوار المشاركين ووسائل الإبلاغ والتنسيق أثناء الطوارئ بالاستناد إلى إجراءات المنشأة المتاحة. تُحدد السيناريوهات والأهداف والمخرجات المناسبة لطبيعة الموقع قبل تأكيد البرنامج.','Review participant roles, reporting and coordination during emergencies using the facility procedures provided. Scenarios, objectives and outputs are defined for the workplace before the programme is confirmed.'],
   prepare:['خطة الطوارئ أو الإجراءات المتاحة وأدوار المشاركين والسيناريوهات التي تريد مراجعتها.','Available emergency plans or procedures, participant roles and the scenarios to review.']},
  {slug:'evacuation',title:['تدريب الإخلاء وأدوار فرق الطوارئ','Evacuation training and emergency team roles'],
   description:['تدريب على أدوار الإخلاء والتجمع والتنسيق وفق ترتيبات المنشأة، مع إمكان مناقشة تمرين إخلاء ضمن نطاق مستقل واضح. يُراجع أثر التمرين على تشغيل الموقع ومسؤوليات التنسيق وترتيبات المشاركين قبل التنفيذ.','Training on evacuation, assembly and coordination roles under the facility arrangements, with an evacuation exercise considered as an explicitly defined scope. Operational impact, coordination responsibilities and participant arrangements are reviewed before delivery.'],
   prepare:['نوع الموقع وأعداد المشاركين وخطة الإخلاء المتاحة ومواقع التجمع وجهة التنسيق.','Site type, participant numbers, available evacuation plan, assembly arrangements and coordination contact.']}
 ],
 'fire-protection':[
  {slug:'water-systems',title:['توريد وتركيب مضخات وشبكات ورشاشات الحريق','Fire pump, network and sprinkler supply and installation'],
   description:['تحديد نطاق توريد وتركيب أنظمة مكافحة الحريق بالمياه، بما يشمل المضخات والشبكات والرشاشات والخراطيم والبكرات والخزائن المطلوبة للمشروع. تُراجع المواصفات والمخططات والكميات ومتطلبات الموقع قبل تحديد العرض.','Define supply and installation requirements for water-based fire protection, including specified pumps, networks, sprinklers, hoses, reels and cabinets. Specifications, drawings, quantities and site requirements are reviewed before quotation.'],
   prepare:['المخططات وجدول الكميات ومواصفات النظام ومرحلة المشروع.','Drawings, bill of quantities, system specifications and project stage.']},
  {slug:'suppression',title:['أنظمة إخماد الحريق حسب متطلبات المشروع','Fire suppression systems for project requirements'],
   description:['مراجعة متطلبات أنظمة الإخماد للمساحات أو المعدات المحددة في المشروع، مع توضيح مواصفات الحل المطلوب ونطاق التوريد والتركيب والاختبار. يعتمد الاختيار على معلومات التطبيق والمواصفات الفنية المتاحة.','Review suppression requirements for specified project spaces or equipment, clarifying the requested specification and supply, installation and testing scope. Selection depends on the application information and technical requirements provided.'],
   prepare:['وصف المساحة أو المعدات والمخططات ومواصفات الإخماد المطلوبة إن توفرت.','Space or equipment description, drawings and requested suppression specifications, if available.']}
 ],
 'fire-alarm':[
  {slug:'supply-and-installation',title:['توريد وتركيب لوحات وكواشف إنذار الحريق','Fire alarm panel and detector supply and installation'],
   description:['توريد وتركيب اللوحات والكواشف ونقاط النداء وأجهزة التنبيه بحسب تفاصيل المشروع. تُراجع أنواع الأجهزة والكميات ومتطلبات الربط والتوافق مع النظام القائم أو الجديد قبل الاتفاق على البنود.','Supply and install panels, detectors, call points and warning devices according to project requirements. Device types, quantities, interfaces and compatibility with the existing or new system are reviewed before scope agreement.'],
   prepare:['نوع النظام والمخططات وقائمة الأجهزة والموديلات المطلوبة إن وجدت.','System type, drawings, device list and requested models, where known.']},
  {slug:'alarm-testing',title:['اختبار وتشغيل نظام إنذار وكشف الحريق','Fire alarm and detection testing and commissioning'],
   description:['تحديد الاختبارات التشغيلية المطلوبة لأجهزة الإنذار والكشف والوظائف المرتبطة بها ضمن نطاق المشروع. تُراجع جاهزية الموقع ومتطلبات التنسيق والسجلات المطلوبة، ويمكن توضيح احتياج الصيانة للأجهزة القائمة بصورة منفصلة.','Define functional tests for alarm and detection devices and the relevant system functions. Site readiness, coordination and required records are reviewed, with maintenance needs for existing equipment identified separately.'],
   prepare:['الغرض من الاختبار والأجهزة المشمولة وحالة التركيب وأي سجلات سابقة.','Testing objective, covered equipment, installation status and previous records.']}
 ],
 readiness:[
  {slug:'inspection-readiness',title:['مراجعة جاهزية المنشأة لفحص السلامة','Facility safety inspection readiness review'],
   description:['تنظيم قائمة الملاحظات والمتطلبات وبيانات المعدات لتحديد احتياجات التجهيز أو الفحص أو المستندات قبل متابعة الطلب. يُوضح نطاق المراجعة والمخرجات المطلوبة ومسؤول متابعة كل بند.','Organise observations, requirements and equipment information to identify preparation, inspection or document needs. Review scope, required outputs and follow-up responsibilities are defined for each item.'],
   prepare:['قائمة الملاحظات الأصلية ومصدرها وتاريخها وبيانات المنشأة.','Original observation lists, their source and date, and facility information.']},
  {slug:'technical-requirements',title:['الدعم الفني لمتطلبات السلامة والدفاع المدني','Technical support for safety and Civil Defense requirements'],
   description:['مراجعة المتطلبات التي يقدمها العميل وتحديد البنود التي تحتاج معلومات أو تجهيزًا أو فحصًا ضمن نطاق متفق عليه. تُفصل أعمال الدعم الفني عن قرارات الجهات المختصة، ولا تعني الخدمة ضمان ترخيص أو موافقة.','Review requirements supplied by the customer and identify information, equipment or inspection needs within the agreed scope. Technical support is distinct from decisions made by the responsible authorities and does not guarantee a licence or approval.'],
   prepare:['المتطلبات والمخططات المتاحة والأعمال المكتملة وجهة التنسيق.','Available requirements and drawings, completed actions and coordination contact.']}
 ],
 'safety-supply':[
  {slug:'ppe',title:['توريد معدات الوقاية الشخصية للفرق والمواقع','PPE supply for teams and workplaces'],
   description:['مراجعة احتياجات الخوذ والسترات والقفازات والنظارات وغيرها من معدات الوقاية المدرجة في الطلب بحسب الاستخدام والمقاسات والمواصفات والكميات. تُؤكد بيانات الأصناف والبدائل المقبولة في العرض.','Review requirements for helmets, vests, gloves, safety glasses and other requested PPE according to use, sizes, specifications and quantities. Item details and acceptable alternatives are confirmed in the quotation.'],
   prepare:['الاستخدام والمقاسات والكميات لكل صنف وأي مواصفات أو موديلات مطلوبة.','Intended use, sizes, quantities per item and any required specifications or models.']},
  {slug:'fire-and-emergency-equipment',title:['توريد طفايات الحريق ومستلزمات السلامة والطوارئ','Fire extinguisher, safety and emergency equipment supply'],
   description:['تجهيز طلب توريد يجمع الطفايات وملحقاتها واللوحات ومستلزمات الطوارئ أو أصناف السلامة المحددة للمنشأة. تُفصل أعمال التركيب أو الاختبار أو التدريب عند الحاجة لتحديدها في بنود مستقلة.','Prepare a supply enquiry covering extinguishers, accessories, signs, emergency supplies or other specified facility safety items. Installation, testing and training needs are identified as separate activities where required.'],
   prepare:['قائمة الأصناف والكميات والمواصفات وموقع المشروع والموعد المطلوب.','Item list, quantities, specifications, project location and required timing.']}
 ]
};

export const getServiceAreas=(service:string):readonly ServiceArea[]=>Object.hasOwn(areas,service)?areas[service]:[];
export const findServiceArea=(service:string,topic:unknown)=>typeof topic==='string'?getServiceAreas(service).find(area=>area.slug===topic):undefined;
export const serviceQuotePath=(lang:Lang,service:string,topic?:string)=>'/'+lang+'/quote?service='+encodeURIComponent(service)+(topic?'&topic='+encodeURIComponent(topic):'');

export function serviceAreaCatalog(lang:Lang,service:string,origin:string){
 const list=getServiceAreas(service);if(!list.length)return undefined;
 const url=origin+'/'+lang+'/services/'+encodeURIComponent(service);
 return {
  '@type':'OfferCatalog',name:local(lang,'نطاقات الخدمة','Service scopes'),
  itemListElement:list.map(area=>({
   '@type':'Offer',url:url+'#'+service+'-'+area.slug,
   itemOffered:{'@type':'Service','@id':url+'#'+service+'-'+area.slug,url:url+'#'+service+'-'+area.slug,
    name:local(lang,...area.title),description:local(lang,...area.description),
    provider:{'@id':origin+'/#organization'}}
  }))
 };
}
