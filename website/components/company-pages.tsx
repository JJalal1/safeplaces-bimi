import {local,type Lang,type initialSettings} from '../lib/config';
import {resolveServices,resolveCategories,type ContentRow} from '../lib/content';
import {getServiceAreas,serviceQuotePath} from '../lib/service-areas';
import {categories as defaultCategories,type Product} from '../lib/catalog';
import {getAboutSections,getServiceGuide,overviewQuestions,type Bilingual,type RequestStep,type Question} from '../lib/company-copy';
import {HomeHero} from './home-hero';
import {ProductCard} from './catalog-browser';
import {Icon,Arrow} from './visuals';

type Settings=typeof initialSettings;
type Service=ReturnType<typeof resolveServices>[number];
type Category=ReturnType<typeof resolveCategories>[number];
const t=(lang:Lang,copy:Bilingual)=>local(lang,copy[0],copy[1]);

function SectionHeading({lang,title,detail,href,action}:{lang:Lang;title:Bilingual;detail?:Bilingual;href?:string;action?:Bilingual}){
 return <div className="company-section-heading"><div><h2>{t(lang,title)}</h2>{detail&&<p>{t(lang,detail)}</p>}</div>{href&&<a className="text-link" href={href}>{t(lang,action||['عرض التفاصيل','Explore more'])}<Arrow lang={lang}/></a>}</div>;
}

function ServiceTile({lang,s,heading='h3',compact=false}:{lang:Lang;s:Service;heading?:'h2'|'h3';compact?:boolean}){
 const scope=lang==='ar'?s.scopeAr:s.scopeEn;
 const Heading=heading;
 return <article className={'company-service-tile'+(compact?' is-compact':'')} data-service={s.slug}>
  <div className="company-service-title"><span className="company-service-icon" aria-hidden="true"><Icon name={s.icon} size={24}/></span><Heading>{local(lang,s.ar,s.en)}</Heading></div>
  <p>{local(lang,s.descAr,s.descEn)}</p>
  {!compact&&scope.length>0&&<ul className="company-service-scope">{scope.slice(0,3).map((item,index)=><li key={index}>{item}</li>)}</ul>}
  <a className="text-link" href={'/'+lang+'/services/'+encodeURIComponent(s.slug)} aria-label={local(lang,'نطاق وتفاصيل '+s.ar,'Scope & details: '+s.en)}>{local(lang,'النطاق والتفاصيل','Scope & details')}<Arrow lang={lang}/></a>
 </article>;
}

function Process({lang,steps}:{lang:Lang;steps:RequestStep[]}){
 return <ol className="company-process">{steps.map((step,index)=><li key={index}><span className="company-step-no" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><h3>{t(lang,step.title)}</h3><p>{t(lang,step.detail)}</p></div></li>)}</ol>;
}

function Enquiry({lang,service}:{lang:Lang;service?:string}){
 return <aside className="company-enquiry"><span className="company-enquiry-icon" aria-hidden="true"><Icon name="clipboard" size={28}/></span><div>
  <h2>{service?local(lang,'ناقش نطاق الخدمة معنا','Discuss your service requirements'):local(lang,'لديك قائمة توريد أو مشروع خاص؟','Have a supply list or a project?')}</h2>
  <p>{service?local(lang,'ابدأ بمعلومات الموقع والاحتياج والمرفقات المتاحة. نراجع التفاصيل لتحديد النطاق قبل اعتماد العرض.','Start with your site information, requirements and available attachments. The details are reviewed to define the scope before a proposal is approved.'):local(lang,'أرسل الكميات أو مخططات المشروع أو وصف الاحتياج. إرسال الاستفسار لا يعني التزامًا بالشراء.','Share your quantities, project drawings or requirements. An enquiry does not commit you to a purchase.')}</p>
 </div><a className="button primary" href={'/'+lang+'/quote'+(service?'?service='+encodeURIComponent(service):'')}>{local(lang,'إرسال طلب عرض سعر','Request a quotation')}<Arrow lang={lang}/></a></aside>;
}

function Intro({lang,title,description,kind='service',icon='shield'}:{lang:Lang;title:Bilingual;description:Bilingual;kind?:'about'|'services'|'service';icon?:string}){
 const label:Bilingual=kind==='about'?['عن المؤسسة','COMPANY PROFILE']:kind==='services'?['الخدمات والحلول','SERVICES & SOLUTIONS']:['خدمات المؤسسة','OUR SERVICES'];
 return <header className={'company-page-heading company-brand-intro company-intro-'+kind}><div className="company-intro-copy"><div className="company-intro-kicker"><span aria-hidden="true"/><span>{t(lang,label)}</span></div><h1>{t(lang,title)}</h1><p>{t(lang,description)}</p></div><span className="company-intro-mark" aria-hidden="true"><Icon name={icon} size={42}/></span></header>;
}

function ArticleTitle({lang,title,id,number}:{lang:Lang;title:Bilingual;id:string;number:string}){
 return <h2 id={id} tabIndex={-1}><span className="company-section-number" aria-hidden="true">{number}</span><span>{t(lang,title)}</span></h2>;
}

function ReadingContents({lang,sections}:{lang:Lang;sections:{id:string;title:Bilingual}[]}){
 return <nav className="company-contents" aria-labelledby="company-contents-title"><div className="company-contents-heading"><h2 id="company-contents-title">{local(lang,'في هذه الصفحة','On this page')}</h2><span className="company-contents-hint" aria-hidden="true">{local(lang,'مرّر لبقية الأقسام','Swipe for more sections')}</span></div><ol>{sections.map((section,index)=><li key={section.id}><a href={'#'+section.id}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span>{t(lang,section.title)}</span></a></li>)}</ol></nav>;
}

function ContactPanel({lang,settings}:{lang:Lang;settings:Settings}){
 return <section className="company-contact-panel" aria-labelledby="company-contact-title"><h3 id="company-contact-title">{local(lang,'تواصل مع المؤسسة','Contact the company')}</h3><dl>
  <div><dt>{local(lang,'الموقع','Location')}</dt><dd>{local(lang,settings.locationAr,settings.locationEn)}</dd></div>
  <div><dt>{local(lang,'الهاتف','Phone')}</dt><dd><a dir="ltr" href={'tel:'+settings.phone}>{settings.phone}</a></dd></div>
  <div><dt>{local(lang,'البريد الإلكتروني','Email')}</dt><dd><a dir="ltr" href={'mailto:'+settings.email}>{settings.email}</a></dd></div>
 </dl><a className="text-link" href={'/'+lang+'/contact'}>{local(lang,'صفحة التواصل','Contact page')}<Arrow lang={lang}/></a></section>;
}

function Questions({lang,questions}:{lang:Lang;questions:Question[]}){
 return <div className="company-faq">{questions.map((item,index)=><details key={index}><summary>{t(lang,item.question)}</summary><p>{t(lang,item.answer)}</p></details>)}</div>;
}

export function HomeOverview({lang,settings,services,products,categories,projects}:{lang:Lang;settings:Settings;services:Service[];products:Product[];categories:Category[];projects:ContentRow[]}){
 const root='/'+lang,featured=products.slice().sort((a,b)=>b.featured-a.featured).slice(0,4);
 return <div className="company-experience"><HomeHero lang={lang} settings={settings} serviceSlugs={services.map(s=>s.slug)}/><div className="container company-home">
  <section className="company-home-about" aria-labelledby="home-company-title"><div><span className="company-overline">{local(lang,'مؤسسة المناطق الآمنة · الخبر','Safe Places · Al Khobar')}</span><h2 id="home-company-title">{local(lang,'معدات سلامة وخدمات في نطاق واضح.','Safety equipment. Clear service scope.')}</h2></div><div><p>{local(lang,'مؤسسة المناطق الآمنة لأدوات ومواد السلامة تقدم معدات السلامة ومكافحة الحريق، إلى جانب خدمات التوريد والتركيب والاختبار والصيانة للمنشآت والمشاريع.','Safe Places for Safety Tools & Materials offers safety and fire protection equipment, alongside supply, installation, testing and maintenance for facilities and projects.')}</p><a className="text-link" href={root+'/about'}>{local(lang,'تعرف على المؤسسة','About our company')}<Arrow lang={lang}/></a></div></section>
  <section className="company-block"><SectionHeading lang={lang} title={['الصيانة والتدريب وخدمات أنظمة الحريق','Maintenance, training & fire system services']} detail={['اختر الخدمة لمعرفة نطاقها والمعلومات اللازمة لطلبها.','Explore each service and the information needed to request it.']} href={root+'/services'} action={['جميع الخدمات','All services']}/><div className="company-service-grid">{services.map(s=><ServiceTile key={s.slug} lang={lang} s={s} compact/>)}</div></section>
  <section className="company-block"><SectionHeading lang={lang} title={['متجر أدوات ومعدات السلامة','Safety equipment shop']} detail={['منتجات للأفراد والمنشآت مع مسار عرض سعر للكميات والأنظمة الخاصة.','Equipment for individuals and facilities, with quotations for special quantities and systems.']} href={root+'/shop'} action={['تصفح المتجر','Browse shop']}/><nav className="company-categories" aria-label={local(lang,'أقسام المنتجات','Product categories')}>{categories.map(c=><a key={c.slug} href={root+'/shop/category/'+encodeURIComponent(c.slug)}>{local(lang,c.ar,c.en)}</a>)}</nav><div className="product-grid company-products">{featured.map(p=><ProductCard key={p.id} p={p} lang={lang} categoryList={categories}/>)}</div></section>
  {projects.length>0&&<section className="company-block"><SectionHeading lang={lang} title={['أعمال ومشاريع المؤسسة','Company work & projects']} href={root+'/projects'} action={['استعرض المشاريع','View projects']}/><div className="company-project-grid">{projects.slice(0,3).map(p=><a className="company-project-item" key={p.id} href={root+'/projects/'+encodeURIComponent(p.slug)}>{p.image&&<img src={p.image} alt={local(lang,p.titleAr,p.titleEn)} loading="lazy" width={550} height={300}/>}<h3>{local(lang,p.titleAr,p.titleEn)}</h3><p>{local(lang,p.descriptionAr,p.descriptionEn)}</p></a>)}</div></section>}
  <Enquiry lang={lang}/>
 </div></div>;
}

export function AboutOverview({lang,settings}:{lang:Lang;settings:Settings}){
 const root='/'+lang,sections=getAboutSections(settings);
 const destinations:{path:string;title:Bilingual;detail:Bilingual}[]=[
  {path:'/shop',title:['المتجر','Shop'],detail:['الأقسام والمنتجات والمواصفات','Categories, products and specifications']},
  {path:'/services',title:['الخدمات','Services'],detail:['النطاق والمعلومات المطلوبة','Scope and required information']},
  {path:'/projects',title:['المشاريع','Projects'],detail:['الأعمال والمعلومات المنشورة','Published work and project information']},
  {path:'/certificates',title:['المستندات','Documents'],detail:['الملفات المتاحة والاستفسار عنها','Available files and document enquiries']}
 ];
 return <div className="company-experience container company-main company-about-page">
  <Intro lang={lang} kind="about" title={['عن مؤسسة المناطق الآمنة','About Safe Places']} description={['تعرف على نشاط المؤسسة في الخبر، ومن نخدم، وكيف نراجع احتياجات السلامة والتوريد والخدمات من أول استفسار إلى تحديد النطاق.','Learn about our business in Al Khobar, the requirements we serve, and how equipment and service enquiries move from an initial brief to a defined scope.']}/>
  <div className="company-reading-layout">
   <aside className="company-reading-aside"><ReadingContents lang={lang} sections={sections}/></aside>
   <article className="company-article company-prose" aria-label={local(lang,'التعريف بالمؤسسة وطريقة العمل','Company profile and enquiry process')}>
    {sections.map((section,index)=><section className="company-article-section" id={section.id} key={section.id} aria-labelledby={section.id+'-title'}><ArticleTitle lang={lang} title={section.title} id={section.id+'-title'} number={String(index+1).padStart(2,'0')}/>{section.paragraphs.map((paragraph,index)=><p key={index}>{t(lang,paragraph)}</p>)}{section.id==='records'&&<ContactPanel lang={lang} settings={settings}/>}</section>)}
    <nav className="company-related-links" aria-label={local(lang,'خطوتك التالية','Your next step')}>{destinations.map(item=><a href={root+item.path} key={item.path}><strong>{t(lang,item.title)}</strong><span>{t(lang,item.detail)}<Arrow lang={lang}/></span></a>)}</nav>
    <Enquiry lang={lang}/>
   </article>
  </div>
 </div>;
}

export function ServicesOverview({lang,services}:{lang:Lang;services:Service[]}){
 return <div className="company-experience container company-main company-services-page">
  <Intro lang={lang} kind="services" icon="clipboard" title={['خدمات السلامة ومكافحة الحريق','Fire protection & safety services']} description={['ابدأ من احتياج الموقع: نظام جديد، معدات تحتاج فحصًا، دعم جاهزية، تدريب أو قائمة توريد. لكل مسار نطاق ومعلومات تساعد على مراجعته.','Start with the site requirement: a new system, equipment inspection, readiness support, training or a supply list. Each route has its own scope and information needs.']}/>
  <div className="company-services-intro company-prose"><p>{local(lang,'تشرح الصفحات التالية متى تكون كل خدمة مناسبة، وما البنود الممكن مراجعتها، وما نحتاجه لتحديد العرض. يمكن أن يجمع الطلب عدة خدمات، مع فصل التوريد عن التركيب والاختبار والصيانة وأي مخرجات مطلوبة.','The pages below explain when each service is relevant, the activities that can be reviewed, and the information needed to define a proposal. One enquiry can cover several services, with supply, installation, testing, maintenance and required deliverables identified separately.')}</p></div>
  <section className="company-service-grid company-service-directory" aria-label={local(lang,'دليل الخدمات','Service directory')}>{services.map(s=><ServiceTile key={s.slug} lang={lang} s={s} heading="h2"/>)}</section>
  <section className="company-block company-service-brief" aria-labelledby="service-brief-title"><div><h2 id="service-brief-title">{local(lang,'طلب واضح من البداية','A clear brief from the start')}</h2><p>{local(lang,'لا يلزم أن تكون جميع التفاصيل مكتملة عند أول تواصل. اذكر ما هو مؤكد وما يحتاج إلى مراجعة، مع تحديد الأولوية والموعد المطلوب.','Your initial enquiry does not need every detail. Distinguish confirmed information from points that need review, and identify your priority and requested timing.')}</p></div><ol>
   <li><strong>{local(lang,'الموقع والغرض','Site and purpose')}</strong><span>{local(lang,'نوع المنشأة وموقعها، وهل المطلوب تجهيز جديد أو عمل على معدات قائمة.','Facility type and location, and whether this is new work or existing equipment.')}</span></li>
   <li><strong>{local(lang,'المواصفات والمرفقات','Details and attachments')}</strong><span>{local(lang,'الأصناف والكميات وبيانات الأجهزة أو المخططات والسجلات المتاحة.','Items, quantities, equipment details, or available drawings and records.')}</span></li>
   <li><strong>{local(lang,'النطاق والتنسيق','Scope and coordination')}</strong><span>{local(lang,'الأعمال المطلوبة والمخرجات المتوقعة وبيانات المسؤول عن المتابعة.','Requested activities, expected deliverables and the coordination contact.')}</span></li>
  </ol></section>
  <section className="company-block" aria-labelledby="services-questions"><h2 className="company-subheading" id="services-questions">{local(lang,'أسئلة قبل طلب الخدمة','Before requesting a service')}</h2><Questions lang={lang} questions={overviewQuestions}/></section>
  <Enquiry lang={lang}/>
 </div>;
}

export function ServiceOverview({lang,service,categories,services=[]}:{lang:Lang;service:Service;categories?:Category[];services?:Service[]}){
 const root='/'+lang,guide=getServiceGuide(service.slug),scope=lang==='ar'?service.scopeAr:service.scopeEn,areas=getServiceAreas(service.slug);
 const relatedServiceSlugs:Record<string,string[]>={maintenance:['fire-protection','fire-alarm','training'],training:['maintenance','readiness','safety-supply'],'fire-protection':['fire-alarm','maintenance'],'fire-alarm':['fire-protection','maintenance'],readiness:['maintenance','training'],'safety-supply':['maintenance','training']};
 const relatedSlugs=Object.hasOwn(relatedServiceSlugs,service.slug)?relatedServiceSlugs[service.slug]:[];
 const relatedServices=services.filter(s=>relatedSlugs.includes(s.slug));
 const directory=categories||defaultCategories;
 const related=[...new Set([service.category,...guide.related].filter(Boolean))].map(slug=>({slug,category:directory.find(category=>category.slug===slug)})).filter(item=>!categories||item.category);
 const sections:{id:string;title:Bilingual}[]=[
  {id:'service-context',title:['متى تحتاج هذه الخدمة؟','When this service is relevant']},
  {id:'service-scope',title:service.slug==='maintenance'?['خدمات صيانة أنظمة الحريق والفحص','Fire system maintenance and inspection services']:service.slug==='training'?['برامج التدريب على السلامة والطوارئ','Safety and emergency training programmes']:['النطاق الممكن مراجعته','Scope for review']},
  {id:'service-inputs',title:['المعلومات المطلوبة','Information to prepare']},
  {id:'service-boundaries',title:['حدود العرض','Quotation boundaries']},
  {id:'service-process',title:['خطوات الطلب','Enquiry steps']},
  {id:'service-questions',title:['أسئلة شائعة','Common questions']}
 ];
 return <div className="company-experience container company-main company-service-page">
  <a className="company-back" href={root+'/services'}><Arrow lang={lang}/>{local(lang,'جميع الخدمات','All services')}</a>
  <Intro lang={lang} icon={service.icon} title={[service.ar,service.en]} description={[service.descAr,service.descEn]}/>
  <div className="company-reading-layout">
   <aside className="company-reading-aside"><ReadingContents lang={lang} sections={sections}/><div className="company-side-note"><h2>{local(lang,'جهّز طلبك','Prepare your enquiry')}</h2><p>{local(lang,'ابدأ بالمعلومات المتاحة، وحدد ما إذا كان المطلوب توريدًا أو عملًا في الموقع أو كليهما.','Start with the information available and clarify whether you need supply, on-site work, or both.')}</p><a className="text-link" href={root+'/quote?service='+encodeURIComponent(service.slug)}>{local(lang,'طلب هذه الخدمة','Request this service')}<Arrow lang={lang}/></a></div></aside>
   <article className="company-article company-prose" aria-label={local(lang,'تفاصيل '+service.ar,service.en+' details')}>
    <section className="company-article-section" id="service-context" aria-labelledby="service-context-title"><ArticleTitle lang={lang} title={sections[0].title} id="service-context-title" number="01"/>{guide.introduction.map((paragraph,index)=><p key={index}>{t(lang,paragraph)}</p>)}</section>
    <section className="company-article-section" id="service-scope" aria-labelledby="service-scope-title"><ArticleTitle lang={lang} title={sections[1].title} id="service-scope-title" number="02"/>{scope.length>0&&<ul className="company-scope-list">{scope.map((item,index)=><li key={index}>{item}</li>)}</ul>}{guide.scopeNotes.map((paragraph,index)=><p key={index}>{t(lang,paragraph)}</p>)}
     {areas.length>0&&<><nav className="company-area-links" aria-label={local(lang,'انتقل إلى نطاق الخدمة','Jump to a service scope')}>{areas.map(area=><a href={'#'+service.slug+'-'+area.slug} key={area.slug}>{t(lang,area.title)}</a>)}</nav><div className="company-service-areas">{areas.map(area=><section className="company-service-area" id={service.slug+'-'+area.slug} key={area.slug} aria-labelledby={service.slug+'-'+area.slug+'-title'}><h3 id={service.slug+'-'+area.slug+'-title'}>{t(lang,area.title)}</h3><p>{t(lang,area.description)}</p><p className="company-area-prepare"><strong>{local(lang,'لتجهيز الطلب: ','For your enquiry: ')}</strong>{t(lang,area.prepare)}</p><a className="text-link" href={serviceQuotePath(lang,service.slug,area.slug)} aria-label={local(lang,'طلب عرض سعر: ','Request a quote: ')+t(lang,area.title)}>{local(lang,'طلب عرض سعر لهذا النطاق','Request a quote for this scope')}<Arrow lang={lang}/></a></section>)}</div></>}
    </section>
    <section className="company-article-section" id="service-inputs" aria-labelledby="service-inputs-title"><ArticleTitle lang={lang} title={sections[2].title} id="service-inputs-title" number="03"/><p>{t(lang,guide.inputsIntro)}</p><ul className="company-input-list">{guide.inputs.map((item,index)=><li key={index}>{t(lang,item)}</li>)}</ul></section>
    <section className="company-article-section" id="service-boundaries" aria-labelledby="service-boundaries-title"><ArticleTitle lang={lang} title={sections[3].title} id="service-boundaries-title" number="04"/>{guide.boundaries.map((paragraph,index)=><p key={index}>{t(lang,paragraph)}</p>)}</section>
    <section className="company-article-section" id="service-process" aria-labelledby="service-process-title"><ArticleTitle lang={lang} title={sections[4].title} id="service-process-title" number="05"/><Process lang={lang} steps={guide.steps}/></section>
    {related.length>0&&<section className="company-article-section" aria-labelledby="service-related-title"><h2 id="service-related-title">{local(lang,'أقسام منتجات مرتبطة','Related product categories')}</h2><p>{local(lang,'استعرض الأصناف والمواصفات المتاحة، وأضف ما يلزم إلى طلبك مع توضيح ارتباطه بالخدمة.','Explore the available items and specifications, and include relevant equipment in your enquiry with its intended role in the service.')}</p><nav className="company-category-links" aria-label={local(lang,'منتجات مرتبطة بالخدمة','Products related to this service')}>{related.map(({slug,category})=><a key={slug} href={root+'/shop/category/'+encodeURIComponent(slug)}>{category?local(lang,category.ar,category.en):local(lang,'منتجات مرتبطة بالخدمة','Related products')}<Arrow lang={lang}/></a>)}</nav></section>}
    <section className="company-article-section" id="service-questions" aria-labelledby="service-questions-title"><ArticleTitle lang={lang} title={sections[5].title} id="service-questions-title" number="06"/><Questions lang={lang} questions={guide.questions}/></section>
    {relatedServices.length>0&&<section className="company-article-section" aria-labelledby="related-services-title"><h2 id="related-services-title">{local(lang,'خدمات مرتبطة باحتياج منشأتك','Related facility services')}</h2><nav className="company-related-links" aria-label={local(lang,'خدمات مرتبطة','Related services')}>{relatedServices.map(s=><a href={root+'/services/'+encodeURIComponent(s.slug)} key={s.slug}><strong>{local(lang,s.ar,s.en)}</strong><span>{local(lang,s.descAr,s.descEn)}<Arrow lang={lang}/></span></a>)}</nav></section>}
    <Enquiry lang={lang} service={service.slug}/>
   </article>
  </div>
 </div>;
}

