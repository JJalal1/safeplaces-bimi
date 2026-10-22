import {local,type Lang} from '../lib/config';
import {regionalSeo,seoText} from '../lib/seo-content';
import {SeoGuideSection} from './seo-guide';
import {PageIntro} from './support-pages';

/** One regional guide: real enquiry information, without invented city branches. */
export function RegionalEnquiries({lang}:{lang:Lang}){
 const root='/'+lang;
 const scopes=[
  {href:'/shop/category/extinguishers',ar:'طفايات الحريق',en:'Fire extinguishers',detailAr:'نوع المادة المطفئة والسعة والعدد، مع وصف استخدام الموقع.',detailEn:'Extinguishing agent, capacity and quantities, with the intended site use.'},
  {href:'/services/fire-alarm',ar:'أنظمة إنذار الحريق',en:'Fire alarm systems',detailAr:'النظام القائم أو الجديد، موديل اللوحة والكواشف والمخططات المتاحة.',detailEn:'New or existing system, panel and detector models, and available drawings.'},
  {href:'/shop/category/firefighting',ar:'مضخات وشبكات الإطفاء',en:'Fire pumps and networks',detailAr:'التدفق والضغط والمقاسات والمواصفات أو جدول الكميات.',detailEn:'Flow, pressure, dimensions, specifications or a bill of quantities.'},
  {href:'/services/maintenance',ar:'فحص وصيانة أنظمة الحريق',en:'Fire system inspection and maintenance',detailAr:'نوع الأنظمة وحالتها وآخر فحص والملاحظات المطلوب مراجعتها.',detailEn:'System type and condition, previous inspection and issues to review.'},
  {href:'/shop/category/ppe',ar:'معدات الوقاية الشخصية',en:'Personal protective equipment',detailAr:'طبيعة العمل والمخاطر والمقاسات والكميات لكل صنف.',detailEn:'Tasks, hazards, sizes and quantities for each PPE item.'},
  {href:'/shop/category/emergency',ar:'لوحات السلامة والطوارئ',en:'Safety signs and emergency supplies',detailAr:'نوع اللوحة ولغتها وأبعادها وموقع تركيبها والكميات.',detailEn:'Sign type, language, dimensions, installation position and quantity.'}
 ];
 return <>
  <PageIntro lang={lang} title={seoText(regionalSeo.title,lang)} description={seoText(regionalSeo.description,lang)} kicker="SAFE PLACES · EASTERN PROVINCE"/>
  <article className="container regional-enquiries">
   <section className="regional-location" aria-labelledby="regional-location-title">
    <div><span className="eyebrow">{local(lang,'من الخبر، لطلبات مشروعك','Based in Al Khobar')}</span><h2 id="regional-location-title">{local(lang,'طلب واضح لمشروعك في الشرقية','A clear enquiry for your Eastern Province project')}</h2><p>{local(lang,'يقع مقر مؤسسة المناطق الآمنة في الخبر. إذا كان مشروعك في الدمام أو الظهران أو مدينة أخرى في المنطقة الشرقية، أرسل موقعه ونوع المنشأة لبحث متطلبات التوريد أو التركيب أو الصيانة.','Safe Places is based in Al Khobar. For a project in Dammam, Dhahran or elsewhere in the Eastern Province, share its location and facility type to discuss supply, installation or maintenance requirements.')}</p><p>{local(lang,'يؤكد الفريق إمكانية تنفيذ نطاق العمل وتنسيق الزيارة أو الاستلام أو التسليم بعد مراجعة الطلب. وللطلبات من بقية مناطق السعودية، اذكر المدينة ضمن طلبك لمراجعة الترتيبات المتاحة.','The team confirms the work scope and arrangements for a visit, collection or delivery after reviewing your enquiry. For requests from elsewhere in Saudi Arabia, include your city so available arrangements can be assessed.')}</p></div>
    <aside><h3>{local(lang,'معلومات الموقع التي نحتاجها','Useful site information')}</h3><ul><li>{local(lang,'المدينة والحي أو موقع المشروع','City and district or project location')}</li><li>{local(lang,'نوع المنشأة وحالة النظام الحالي','Facility type and existing system condition')}</li><li>{local(lang,'توريد فقط، أم تركيب، أم فحص وصيانة؟','Supply, installation, or inspection and maintenance?')}</li><li>{local(lang,'المواصفات والكميات والموعد المستهدف إن توفرت','Specifications, quantities and target timing, if available')}</li></ul><a className="button primary" href={root+'/quote'}>{local(lang,'أرسل تفاصيل مشروعك','Send your project details')}</a></aside>
   </section>
   <section aria-labelledby="regional-scope-title"><h2 id="regional-scope-title">{local(lang,'اختر نطاق طلب معدات أو خدمات السلامة','Choose your equipment or service enquiry')}</h2><div className="regional-scopes">{scopes.map(scope=><div key={scope.href}><h3><a href={root+scope.href}>{local(lang,scope.ar,scope.en)}</a></h3><p>{local(lang,scope.detailAr,scope.detailEn)}</p></div>)}</div></section>
   <section className="regional-projects" aria-labelledby="regional-projects-title"><h2 id="regional-projects-title">{local(lang,'للمكاتب والمستودعات والمواقع الصناعية','For offices, warehouses and industrial sites')}</h2><p>{local(lang,'تختلف احتياجات السلامة حسب نشاط المنشأة والمخاطر وتصميم المبنى. للمكاتب أرفق توزيع المساحات؛ وللمستودعات وضح طبيعة التخزين؛ وللمواقع الصناعية شارك المواصفات المعتمدة للمشروع. تُراجع ملاءمة المعدات والمتطلبات الفنية قبل اعتماد العرض.','Safety requirements depend on the facility’s activity, hazards and building design. For offices, share the layout; for warehouses, describe the storage; for industrial sites, include the project specifications. Equipment suitability and technical requirements are reviewed before a quotation is agreed.')}</p><a href={root+'/services/safety-supply'} className="text-link">{local(lang,'توريد معدات السلامة وقوائم الكميات','Safety equipment supply and bills of quantities')}</a></section>
  </article>
  <SeoGuideSection lang={lang} guide={regionalSeo} links={[{href:root+'/contact',label:['التواصل مع فريق الخبر','Contact our Al Khobar team']},{href:root+'/services',label:['استعرض خدمات السلامة','Explore safety services']}]}/>
 </>;
}
