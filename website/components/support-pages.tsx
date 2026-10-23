import {local, type Lang, type initialSettings} from '../lib/config';
import type {ContentRow, resolveServices} from '../lib/content';
import {QuoteForm, ContactForm} from './forms';
import {Icon, Arrow} from './visuals';
import {getPolicy, policyLinks, POLICY_UPDATED, type PolicyKey} from '../lib/policies';
import {BusinessDetails} from './business-details';
import {publishedBusinessIdentity} from '../lib/business-identity';

type Settings = typeof initialSettings;
type Service = ReturnType<typeof resolveServices>[number];
type Copy = readonly [string, string];
const text = (lang: Lang, copy: Copy) => local(lang, copy[0], copy[1]);

export function PageIntro({lang, title, description, kicker, parent}: {lang: Lang; title: string; description?: string; kicker?: string; parent?: {href: string; label: string}}) {
  return <header className="page-heading"><div className="container">
    <nav className="breadcrumb" aria-label={local(lang, 'مسار التنقل', 'Breadcrumb')}>
      <a href={'/' + lang}>{local(lang, 'الرئيسية', 'Home')}</a>
      {parent && <><span aria-hidden="true">/</span><a href={parent.href}>{parent.label}</a></>}
    </nav>
    {kicker && <span className="eyebrow">{kicker}</span>}
    <h1>{title}</h1>{description && <p>{description}</p>}
  </div></header>;
}

function RelatedLink({lang, href, title, detail}: {lang: Lang; href: string; title: Copy; detail: Copy}) {
  return <a className="support-related-link" href={href}><div><strong>{text(lang, title)}</strong><span>{text(lang, detail)}</span></div><Arrow lang={lang}/></a>;
}

export function QuoteOverview({lang, settings, services, selected, selectedTopic, uploadsAvailable, signInAvailable}: {lang: Lang; settings: Settings; services: Service[]; selected: string; selectedTopic?:{slug:string;title:string}; uploadsAvailable: boolean; signInAvailable: boolean}) {
  const root = '/' + lang;
  return <>
    <PageIntro lang={lang} title={local(lang, 'طلب عرض سعر', 'Request a quotation')} description={local(lang, 'للتوريد بالكميات أو تجهيز الأنظمة أو طلب خدمة. شارك المعلومات المتاحة لنراجع المواصفات ونطاق العمل معك؛ إرسال الاستفسار لا يلزمك بالشراء.', 'For bulk supply, system requirements or a service enquiry. Share the information you have so we can review specifications and scope with you. An enquiry does not commit you to a purchase.')}/>
    <section className="section container quote-layout support-request-layout">
      <QuoteForm services={services} selected={selected} selectedTopic={selectedTopic} uploadsAvailable={uploadsAvailable} signInAvailable={signInAvailable}/>
      <aside className="support-request-guide">
        <h2>{local(lang, 'معلومات تساعدنا في مراجعة طلبك', 'Help us understand your requirements')}</h2>
        <p>{local(lang, 'ليس مطلوبًا أن تكون جميع التفاصيل جاهزة. ابدأ بما تعرفه، وحدد النقاط التي تحتاج إلى توضيح.', 'You do not need every detail at this stage. Start with what you know and identify anything that needs clarification.')}</p>
        <section><h3>{local(lang, 'لأدوات ومعدات السلامة', 'For equipment and supplies')}</h3><ul>
          <li>{local(lang, 'اسم الصنف أو الموديل إن وجد، والمقاس أو المواصفات المطلوبة.', 'Item or model, where known, and the required size or specification.')}</li>
          <li>{local(lang, 'الكمية لكل صنف، وموقع الاستلام أو المشروع والموعد المطلوب.', 'Quantity per item, collection or project location, and the requested timing.')}</li>
          <li>{local(lang, 'هل تقبل بديلًا بالمواصفات نفسها أم تحتاج صنفًا محددًا؟', 'Whether an equivalent specification can be considered or an exact item is required.')}</li>
        </ul></section>
        <section><h3>{local(lang, 'للأنظمة والخدمات', 'For systems and services')}</h3><ul>
          <li>{local(lang, 'نوع المنشأة وموقعها، وهل النظام جديد أم قائم.', 'Facility type and location, and whether the system is new or existing.')}</li>
          <li>{local(lang, 'النطاق المطلوب: توريد أو تركيب أو فحص أو اختبار أو صيانة.', 'The requested scope: supply, installation, inspection, testing or maintenance.')}</li>
          <li>{local(lang, 'المخططات أو جدول الكميات أو سجلات المعدات المتاحة، وأي قيود على الوصول للموقع.', 'Available drawings, quantity schedules or equipment records, and any site access constraints.')}</li>
        </ul></section>
        {selected==='training'&&<section><h3>{local(lang,'لتنظيم التدريب أو تمرين الإخلاء','For training or an evacuation exercise')}</h3><ul><li>{local(lang,'عدد المشاركين وأدوارهم واللغة المناسبة لهم.','Participant numbers, roles and language needs.')}</li><li>{local(lang,'المحاور والمدة والموعد ومكان التدريب المقترح.','Requested topics, duration, date and proposed venue.')}</li><li>{local(lang,'هل تريد برنامجًا توعويًا أو نشاطًا عمليًا؟ أرفق خطة الطوارئ المتاحة إن وجدت.','Whether you need awareness training or a practical activity. Include an existing emergency plan if available.')}</li></ul></section>}
        <section className="support-next-steps"><h3>{local(lang, 'بعد إرسال الطلب', 'After you submit')}</h3><ol>
          <li>{local(lang, 'نراجع وصف الاحتياج والأصناف والمعلومات المتاحة.', 'We review the requirement, items and available information.')}</li>
          <li>{local(lang, 'نستكمل التفاصيل اللازمة لتحديد البنود والمواصفات.', 'We clarify the details needed to define items and specifications.')}</li>
          <li>{local(lang, 'يُعتمد النطاق والأسعار والشروط والمواعيد قبل التوريد أو التنفيذ.', 'Scope, prices, terms and timing are agreed before supply or work begins.')}</li>
        </ol></section>
        <div className="support-direct-contact"><span>{local(lang, 'للاستفسار المباشر', 'For a direct enquiry')}</span><a dir="ltr" href={'tel:' + settings.phone}>{settings.phone}</a><a dir="ltr" href={'mailto:' + settings.email}>{settings.email}</a></div>
        <RelatedLink lang={lang} href={root + '/services'} title={['تفاصيل الخدمات', 'Service details']} detail={['راجع النطاق والمعلومات الخاصة بكل خدمة.', 'Review the scope and information for each service.']}/>
      </aside>
    </section>
  </>;
}

export function ContactOverview({lang, settings}: {lang: Lang; settings: Settings}) {
  const root = '/' + lang;
  const channels = [
    {icon: 'phone', label: local(lang, 'الهاتف', 'Phone'), value: settings.phone, href: 'tel:' + settings.phone},
    {icon: 'mail', label: local(lang, 'المبيعات', 'Sales'), value: settings.email, href: 'mailto:' + settings.email},
    {icon: 'mail', label: local(lang, 'استفسارات المبيعات', 'Sales enquiries'), value: settings.email2, href: 'mailto:' + settings.email2},
    {icon: 'mail', label: local(lang, 'الإدارة', 'Management'), value: settings.managerEmail, href: 'mailto:' + settings.managerEmail},
  ].filter((item, index, all) => item.value && all.findIndex(other => other.value === item.value) === index);
  return <>
    <PageIntro lang={lang} title={local(lang, 'تواصل معنا', 'Contact us')} description={local(lang, 'للاستفسار عن معدات السلامة والخدمات، أو متابعة طلب سابق، تواصل مع المؤسسة أو أرسل رسالتك من هذه الصفحة.', 'Ask about safety equipment and services, or follow up on an existing enquiry. Contact the company directly or send a message below.')}/>
    <section className="section container contact-layout support-contact-layout">
      <div className="contact-details">
        <h2>{local(lang, settings.legalNameAr, settings.legalNameEn)}</h2>
        <p className="support-location"><Icon name="pin" size={18}/>{local(lang, settings.locationAr, settings.locationEn)}</p><BusinessDetails lang={lang} settings={settings}/>
        <dl className="support-contact-list">{channels.map(channel => <div key={channel.value}><dt><Icon name={channel.icon} size={19}/>{channel.label}</dt><dd><a href={channel.href} dir="ltr">{channel.value}</a></dd></div>)}</dl>
        <p>{local(lang, 'عند متابعة طلب قائم، اذكر رقمه ووسيلة التواصل المستخدمة عند إرساله. ولزيارة الموقع أو استلام مشتريات، تواصل أولًا لتأكيد المكان والجاهزية.', 'When following up, include your request number and the contact details used to submit it. Before a visit or collection, contact the team to confirm the location and readiness.')}</p>
        <RelatedLink lang={lang} href={root + '/quote'} title={['لديك قائمة توريد أو مشروع؟', 'Have a supply list or project?']} detail={['استخدم طلب عرض السعر لتوضيح الأصناف والكميات والنطاق.', 'Use the quotation form to specify items, quantities and scope.']}/>
        <RelatedLink lang={lang} href={root + '/shop'} title={['تبحث عن صنف محدد؟', 'Looking for a specific item?']} detail={['تصفح أقسام المتجر ومعلومات المنتجات.', 'Browse shop categories and product information.']}/>
      </div>
      <ContactForm/>
    </section>
  </>;
}

function projectFacts(project: ContentRow): Record<string, string> {
  try {
    const value: unknown = JSON.parse(project.extra || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, item]) => ['client', 'location', 'completedAt'].includes(key) && typeof item === 'string' && item.trim())) as Record<string, string>;
  } catch { return {}; }
}

export function ProjectsOverview({lang, projects, project}: {lang: Lang; projects: ContentRow[]; project?: ContentRow | null}) {
  const root = '/' + lang;
  const labels: Record<string, Copy> = {client: ['العميل', 'Client'], location: ['الموقع', 'Location'], completedAt: ['تاريخ الإنجاز', 'Completion date']};
  if (project) {
    const facts = projectFacts(project);
    return <>
      <PageIntro lang={lang} title={local(lang, project.titleAr, project.titleEn)} parent={{href: root + '/projects', label: local(lang, 'المشاريع', 'Projects')}}/>
      <article className="section container support-project-detail">
        {project.image && <img className="support-project-photo" src={project.image} alt={local(lang, project.titleAr, project.titleEn)} width={1100} height={620}/>}
        <div className="support-project-body"><section><h2>{local(lang, 'عن المشروع', 'About the project')}</h2><p>{local(lang, project.descriptionAr, project.descriptionEn)}</p></section>
          {Object.keys(facts).length > 0 && <dl className="support-project-facts">{Object.entries(facts).map(([key, value]) => <div key={key}><dt>{text(lang, labels[key])}</dt><dd>{value}</dd></div>)}</dl>}
        </div>
        <RelatedLink lang={lang} href={root + '/quote'} title={['ناقش متطلبات مشروعك', 'Discuss your project requirements']} detail={['شارك نوع المنشأة والموقع ونطاق العمل المطلوب.', 'Share the facility type, location and required work scope.']}/>
      </article>
    </>;
  }
  return <>
    <PageIntro lang={lang} title={local(lang, 'أعمال المؤسسة ومشاريعها', 'Company work and projects')} description={local(lang, 'معلومات الأعمال المتاحة للنشر، لمساعدتك في التعرف على نطاق التوريد والخدمات المرتبطة بالمشاريع.', 'Published work information to help you understand the scope of supply and services associated with projects.')}/>
    <section className="section container support-projects">
      {projects.length > 0 ? <div className="project-grid">{projects.map(item => <article className="project-card" key={item.id}>
        {item.image && <a href={root + '/projects/' + item.slug}><img src={item.image} alt={local(lang, item.titleAr, item.titleEn)} width={550} height={320} loading="lazy"/></a>}
        <h2><a href={root + '/projects/' + item.slug}>{local(lang, item.titleAr, item.titleEn)}</a></h2><p>{local(lang, item.descriptionAr, item.descriptionEn)}</p><a className="text-link" href={root + '/projects/' + item.slug}>{local(lang, 'تفاصيل المشروع', 'Project details')}<Arrow lang={lang}/></a>
      </article>)}</div> : <div className="support-empty-layout"><div><Icon name="shield" size={36}/><h2>{local(lang, 'نتحدث عن احتياج مشروعك', 'Let’s discuss your project')}</h2><p>{local(lang, 'تُضاف تفاصيل المشاريع إلى هذه الصفحة عند إتاحة معلوماتها للنشر. يمكنك الآن التواصل مع المؤسسة لمراجعة نطاق التوريد أو التركيب أو الصيانة الذي تحتاجه.', 'Project details are added here when information is available for publication. You can contact the company now to discuss the supply, installation or maintenance scope you need.')}</p><a className="button primary" href={root + '/quote'}>{local(lang, 'طلب عرض سعر لمشروع', 'Request a project quotation')}<Arrow lang={lang}/></a></div><aside><h3>{local(lang, 'لتوضيح نطاق المشروع', 'To explain your project scope')}</h3><ul><li>{local(lang, 'نوع المنشأة وموقعها ومرحلة المشروع الحالية.', 'Facility type, location and current project stage.')}</li><li>{local(lang, 'الأصناف أو الأنظمة المطلوبة والكميات المتاحة.', 'Required items or systems and available quantities.')}</li><li>{local(lang, 'حدود العمل والمخططات والموعد المتوقع.', 'Work boundaries, drawings and anticipated timing.')}</li></ul><a href={root + '/services'} className="text-link">{local(lang, 'راجع الخدمات المتاحة', 'Explore available services')}<Arrow lang={lang}/></a></aside></div>}
    </section>
  </>;
}

export function DocumentsOverview({lang, certificates, settings}: {lang: Lang; certificates: ContentRow[]; settings: Settings}) {
  const root = '/' + lang;
  return <>
    <PageIntro lang={lang} title={local(lang, 'مستندات المؤسسة', 'Company documents')} description={local(lang, 'للاطلاع على المستندات المنشورة، أو طلب الوثائق اللازمة لمراجعة متطلبات التعامل والتوريد.', 'View published documents or request the paperwork needed to review business and supply requirements.')}/>
    <section className="section container support-documents">
      {publishedBusinessIdentity(settings, lang).length > 0 && <article className="document-card support-registration"><Icon name="clipboard" size={30}/><div><span className="eyebrow">{local(lang, 'بيانات السجل التجاري', 'Commercial registration details')}</span><h2>{local(lang, settings.legalNameAr, settings.legalNameEn)}</h2><BusinessDetails lang={lang} settings={settings}/><p>{local(lang, 'بيانات المؤسسة مطابقة لشهادة السجل المقدمة. يمكنك الاستعلام عن بيانات السجل بالرقم الوطني الموحد عبر وزارة التجارة.', 'These company details match the supplied registration certificate. You can look up registration information using the national unified number through the Ministry of Commerce.')}</p><a className="text-link" href="https://mc.gov.sa/ar/eservices/Pages/Commercial-data.aspx" target="_blank" rel="noreferrer">{local(lang, 'التحقق عبر وزارة التجارة', 'Verify through the Ministry of Commerce')}<Arrow lang={lang}/></a></div></article>}
      {certificates.length > 0 && <div className="project-grid">{certificates.map(item => <article className="document-card" key={item.id}>
        {item.image ? <img src={item.image} alt={local(lang, item.titleAr, item.titleEn)} width={400} height={300} loading="lazy"/> : <Icon name="clipboard" size={32}/>}
        <h2>{local(lang, item.titleAr, item.titleEn)}</h2><p>{local(lang, item.descriptionAr, item.descriptionEn)}</p>{item.file && <a className="button light" href={item.file}>{local(lang, 'فتح المستند', 'Open document')}<Arrow lang={lang}/></a>}
      </article>)}</div>}
      <div className="support-document-request"><div><h2>{local(lang, 'طلب مستند لتعاملاتك', 'Request a document for your enquiry')}</h2><p>{local(lang, 'حدد اسم المستند والغرض من طلبه، مثل إجراءات تسجيل مورد أو استكمال ملف توريد، مع بيانات الجهة ووسيلة التواصل. يراجع الفريق الوثائق المتاحة والمناسبة للطلب.', 'Specify the document and its purpose, such as supplier registration or a supply enquiry, together with your organisation and contact details. The team will review the documentation available for the request.')}</p><p>{local(lang, 'المواصفات والشهادات الخاصة بمنتج معين تُراجع بالرجوع إلى الموديل وورقة بياناته. لا يُعد عرض فئة منتجات إثباتًا لاعتماد جميع أصنافها.', 'Product specifications and certificates are reviewed against the particular model and its datasheet. A product category listing does not establish certification for every item in that category.')}</p></div><a className="button primary" href={root + '/contact'}>{local(lang, 'التواصل لطلب مستند', 'Contact us about a document')}<Arrow lang={lang}/></a></div>
    </section>
  </>;
}

export function PolicyOverview({lang, title, policy, settings}: {lang: Lang; title: string; policy: PolicyKey; settings: Settings}) {
  const sections = getPolicy(policy, settings);
  return <>
    <PageIntro lang={lang} title={title} description={local(lang, 'معلومات واضحة عن استخدام الموقع والتعامل مع المؤسسة وحقوقك.', 'Information about using the website, dealing with the company and your rights.')}/>
    <div className="section container support-policy-layout"><nav className="support-policy-nav" aria-label={local(lang, 'صفحات السياسات', 'Policy pages')}>
      {policyLinks.map(item => <a href={'/' + lang + '/' + item.path} key={item.path} aria-current={item.path === policy ? 'page' : undefined}>{text(lang, item.title)}</a>)}
    </nav><article className="legal-copy support-policy-copy">
      <p className="policy-updated">{local(lang, 'آخر تحديث:', 'Last updated:')} <time dateTime={POLICY_UPDATED}>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {dateStyle: 'long', calendar: 'gregory', timeZone: 'UTC'}).format(new Date(POLICY_UPDATED + 'T00:00:00Z'))}</time></p>
      <nav className="policy-contents" aria-label={local(lang, 'محتويات الصفحة', 'On this page')}>{sections.map(section => <a key={section.id} href={'#policy-' + section.id}>{text(lang, section.title)}</a>)}</nav>
      <BusinessDetails lang={lang} settings={settings}/>
      {sections.map(section => <section id={'policy-' + section.id} key={section.id}><h2>{text(lang, section.title)}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{text(lang, paragraph)}</p>)}</section>)}
      <div className="support-policy-contact"><strong>{local(lang, 'للاستفسارات والطلبات', 'Questions & requests')}</strong><a dir="ltr" href={'mailto:' + settings.email}>{settings.email}</a><a dir="ltr" href={'tel:' + settings.phone}>{settings.phone}</a><a href={'/' + lang + '/contact'}>{local(lang, 'أرسل رسالة للمؤسسة', 'Send the company a message')}</a></div>
      <p className="policy-reference">{policy === 'privacy' ? <a href="https://dgp.sdaia.gov.sa/wps/portal/pdp/">{local(lang, 'المنصة الوطنية لحوكمة البيانات: الحقوق والشكاوى', 'National Data Governance Platform: rights & complaints')}</a> : <a href="https://mc.gov.sa/ar/ECC/pages/default.aspx">{local(lang, 'نظام التجارة الإلكترونية — وزارة التجارة', 'E-Commerce Law — Ministry of Commerce')}</a>}</p>
    </article></div>
  </>;
}
