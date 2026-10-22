import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {getDb} from '../../../../db';
import {content} from '../../../../db/schema';
import {eq,asc} from 'drizzle-orm';
import {getProducts,getSettings} from '../../../../lib/data';
import {resolveCategories,resolveServices,resolveClients} from '../../../../lib/content';
import {company,local,money,langOf,type Lang} from '../../../../lib/config';
import {siteOrigin,siteIndexable} from '../../../../lib/site-origin';
import {isSupportedSiteRoute} from '../../../../lib/site-routes';
import {homeSeo,shopSeo,regionalSeo,categorySeo,serviceSeo,productSeo,seoText} from '../../../../lib/seo-content';
import {SeoGuideSection} from '../../../../components/seo-guide';
import {RegionalEnquiries} from '../../../../components/regional-enquiries';
const SITE_URL=siteOrigin();
import {categories,services,clients,industries,productName,type Product} from '../../../../lib/catalog';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '../../../chatgpt-auth';
import {adminUser,canBootstrap} from '../../../../lib/access';
import {getAdminData} from '../../../../lib/admin-data';
import {Header,ProductActions,ProductGallery,RecentRecorder} from '../../../../components/store';
import {QuoteForm,ContactForm,CartPage,Checkout,Account} from '../../../../components/forms';
import {SiteFooter as Footer} from '../../../../components/site-footer';
import {Brand} from '../../../../components/brand';
import {ProductCard,ProductPrice,ProductShelf,ProductRail,PersonalRecommendations,RecentProducts,SavedProducts,CompleteYourKit,ProductInformation} from '../../../../components/catalog-browser';
import {presentCatalog,matchesProduct,relatedProducts,complementaryProducts} from '../../../../lib/shopping';
import {Icon,Arrow,EquipmentPhoto} from '../../../../components/visuals';
import {ShopToolbar} from '../../../../components/shop-filters';
import {HomeHero} from '../../../../components/home-hero';
import {HomeOverview,AboutOverview,ServicesOverview,ServiceOverview} from '../../../../components/company-pages';
import {PageIntro,QuoteOverview,ContactOverview,ProjectsOverview,DocumentsOverview,PolicyOverview} from '../../../../components/support-pages';
import {customerUser,customerAuthConfig} from '../../../../lib/customer-session';
import {getStandaloneAuth} from '../../../../lib/better-auth-server';
import {enabledProviders,authBindings,emailPasswordEnabled} from '../../../../lib/auth-settings';
import {customerLoginPath,customerReturnPath} from '../../../../lib/customer-routes';
import {CustomerLogin,type LoginMode} from '../../../../components/customer-login';
import {parseShopFilters,filterShopProducts,shopUrl} from '../../../../lib/shop-filters';
export const dynamic='force-dynamic';
type Props={params:Promise<{lang:string;slug?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
const names:Record<string,[string,string]>={'':['الحماية من الحريق ومعدات السلامة في الخبر','Fire protection & safety equipment in Al Khobar'],'eastern-province':['طلبات المشاريع في الشرقية','Eastern Province enquiries'],about:['من نحن','About us'],services:['حلول وخدمات السلامة','Safety solutions & services'],shop:['متجر معدات السلامة','Safety equipment shop'],projects:['مشاريعنا','Our projects'],contact:['تواصل معنا','Contact us'],quote:['طلب عرض سعر','Request a quote'],cart:['سلة المشتريات','Shopping cart'],checkout:['إتمام الطلب','Checkout'],wishlist:['المفضلة','Wishlist'],account:['حسابي','My account'],admin:['لوحة الإدارة','Administration'],certificates:['مستندات الشركة وشهاداتها','Company documents & certificates'],privacy:['سياسة الخصوصية','Privacy policy'],terms:['الشروط والأحكام','Terms & conditions'],returns:['الإلغاء والاسترجاع','Cancellation & returns'],collection:['استلام المشتريات','Purchase collection']};
export async function generateMetadata({params,searchParams}:Props):Promise<Metadata>{
 const {lang,slug=[]}=await params;
 if(!isSupportedSiteRoute(slug))notFound();
 const l=langOf(lang),key=slug[0]||'',query=await searchParams;
 const needsCms=(key==='services'&&!!slug[1])||(key==='shop'&&slug[1]==='category')||(key==='projects'&&!!slug[1]);
 const cms=needsCms?await getDb().select().from(content).orderBy(asc(content.sortOrder)):[];
 const serviceList=resolveServices(cms),categoryList=resolveCategories(cms);
 let title=names[key]?.[l==='ar'?0:1]||'Safe Places';
 const pageDescriptions:Record<string,[string,string]>={
  projects:['اطّلع على المشاريع المنشورة لمؤسسة المناطق الآمنة في أنظمة الحماية من الحريق والسلامة بالخبر، وتواصل لمناقشة نطاق مشروعك.','Explore published Safe Places fire protection and safety projects in Al Khobar and discuss the scope of your project.'],
  certificates:['اطّلع على مستندات الشركة والشهادات المنشورة، أو تواصل لطلب المستند المناسب لمتطلبات مشروعك.','View published company documents and certificates, or request the documentation your project requires.'],
  privacy:['اقرأ سياسة الخصوصية للمناطق الآمنة وطريقة التعامل مع بيانات الحسابات وطلبات عروض الأسعار والتواصل.','Read how Safe Places handles account information, quotation requests and contact details.'],
  terms:['اقرأ شروط استخدام موقع المناطق الآمنة وتقديم طلبات عروض الأسعار والاستفسارات عن معدات السلامة.','Read the terms for using Safe Places and submitting safety equipment quotation requests and enquiries.'],
  returns:['اطّلع على سياسة الإلغاء والاسترجاع للمناطق الآمنة وكيفية التواصل بشأن طلبك.','Read the Safe Places cancellation and returns policy and find out how to contact us about your request.'],
  collection:['تعرّف على إرشادات تنسيق الاستلام من المناطق الآمنة والتواصل لتأكيد تفاصيل الطلب.','Read Safe Places collection guidance and contact our team to confirm your request details.']
 };
 let description=pageDescriptions[key]?.[l==='ar'?0:1]||seoText(homeSeo.description,l);
 if(!key){title=seoText(homeSeo.title,l);}
 if(key==='eastern-province'){title=seoText(regionalSeo.title,l);description=seoText(regionalSeo.description,l);}
 if(key==='shop'){
  if(slug[1]==='category'&&slug[2]){
   const category=categoryList.find(c=>c.slug===slug[2]);const guide=categorySeo[slug[2]];
   if(category)title=local(l,category.ar+' | توريد وعرض سعر بالخبر',category.en+' | Al Khobar quotes');
   if(guide)description=seoText(guide.description,l);
  }else if(slug[1]){
   const product=(await getProducts()).find(p=>p.slug===slug[1]);const guide=productSeo[slug[1]];
   if(product){title=productName(product,l)+local(l,' | عرض سعر بالخبر',' | Request a quote in Al Khobar');description=guide?seoText(guide.description,l):local(l,'تعرّف على '+productName(product,l)+' واطلب عرض سعر وفق المواصفات والكميات المطلوبة من مؤسسة المناطق الآمنة بالخبر.','Explore '+productName(product,l)+' and request a quotation by specification and quantity from Safe Places in Al Khobar.');}
  }else{title=seoText(shopSeo.title,l);description=seoText(shopSeo.description,l);}
 }else if(key==='services'){
  const service=slug[1]?serviceList.find(s=>s.slug===slug[1]):null;
  if(service){title=serviceSeo[service.slug]?seoText(serviceSeo[service.slug].title,l):local(l,service.ar+' | خدمات بالخبر',service.en+' | Services in Al Khobar');description=serviceSeo[service.slug]?seoText(serviceSeo[service.slug].description,l):local(l,service.descAr,service.descEn);}
  else if(!slug[1]){title=local(l,'خدمات الحماية من الحريق والسلامة بالخبر','Fire protection and safety services in Al Khobar');description=local(l,'توريد وتركيب وصيانة أنظمة الحريق والإنذار وفحص المعدات وخدمات الطوارئ والتدريب في الخبر. اطلب عرض سعر حسب نطاق مشروعك.','Fire protection supply, alarm installation, inspection, maintenance and safety training enquiries in Al Khobar. Request a project quotation.');}
 }else if(key==='quote'){
  title=local(l,'طلب عرض سعر معدات السلامة ومكافحة الحريق بالخبر','Request a fire protection and safety equipment quote');
  description=local(l,'أرسل قائمة معدات السلامة أو مخططات الحريق والكميات لتلقي عرض سعر بعد مراجعة المواصفات ونطاق التوريد أو التركيب في الخبر.','Submit equipment quantities, fire protection drawings and specifications for a tailored quotation in Al Khobar.');
 }else if(key==='contact'){
  title=local(l,'تواصل مع مؤسسة المناطق الآمنة بالخبر','Contact Safe Places in Al Khobar');
  description=local(l,'تواصل مع المناطق الآمنة في الخبر للاستفسار عن طفايات الحريق ومعدات الوقاية وأنظمة مكافحة وإنذار الحريق وطلبات عروض الأسعار.','Contact Safe Places in Al Khobar for fire protection, PPE, safety equipment and project quotation enquiries.');
 }else if(key==='about'){
  title=local(l,'عن مؤسسة المناطق الآمنة لمعدات السلامة بالخبر','About Safe Places safety equipment company in Al Khobar');
  description=local(l,'تعرّف على مؤسسة المناطق الآمنة لأدوات ومواد السلامة في الخبر وخدمات التوريد والتركيب والاختبار والصيانة للمنشآت والمشاريع.','Learn about Safe Places for Safety Tools & Materials Est. in Al Khobar and its supply, installation, inspection and maintenance services.');
 }else if(key==='projects'&&slug[1]){
  const project=cms.find(p=>p.type==='project'&&p.slug===slug[1]&&p.active);
  if(project){title=local(l,project.titleAr,project.titleEn);description=local(l,project.descriptionAr,project.descriptionEn).slice(0,160);}
 }
 const suffix=slug.length?'/'+slug.join('/'):'';
 const pageUrl=SITE_URL+'/'+l+suffix;
 const privatePage=['account','admin','cart','checkout','wishlist'].includes(key)||Object.keys(query).length>0;
 const index=siteIndexable()&&!privatePage;
 return {
  title,description,
  alternates:{canonical:pageUrl,languages:{ar:SITE_URL+'/ar'+suffix,en:SITE_URL+'/en'+suffix,'x-default':SITE_URL+'/ar'+suffix}},
  robots:{index,follow:siteIndexable()&&!['account','admin','cart','checkout','wishlist'].includes(key)},
  openGraph:{type:'website',siteName:company.nameEn,title,description,url:pageUrl,locale:l==='ar'?'ar_SA':'en_US',alternateLocale:l==='ar'?'en_US':'ar_SA',images:[{url:SITE_URL+'/images/hero.webp',width:1920,height:692,alt:local(l,company.nameAr,company.nameEn)}]},
  twitter:{card:'summary_large_image',title,description,images:[SITE_URL+'/images/hero.webp']}
 };
}
function JSONLD({value}:{value:unknown}){return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(value).replace(/</g,'\\u003c')}}/>;}
function SectionTitle({lang,kicker,ar,en,description,href}:{lang:Lang;kicker:string;ar:string;en:string;description?:string;href?:string}){return <div className="section-heading"><div><span className="eyebrow">{kicker}</span><h2>{local(lang,ar,en)}</h2>{description&&<p>{description}</p>}</div>{href&&<a className="text-link" href={href}>{local(lang,'استعرض الكل','Explore all')}<Arrow lang={lang}/></a>}</div>;}
const PageHeading=PageIntro;
function ClientStrip({lang,rows}:{lang:Lang;rows:any[]}){const data=rows;return <div className="client-grid">{data.map(c=><div key={c.id}>{c.image?<img src={c.image} alt={local(lang,c.titleAr,c.titleEn)} loading="lazy" width={150} height={60}/>:<span dir="ltr">{local(lang,c.titleAr,c.titleEn)}</span>}</div>)}</div>;}
function CTA({lang}:{lang:Lang}){return <section className="cta-section"><div className="container cta-inner"><div><span className="eyebrow">PROJECT ENQUIRIES</span><h2>{local(lang,'حلول سلامة تبدأ بفهم احتياجك.','A safer place starts with your needs.')}</h2><p>{local(lang,'منتجات لموقعك أو نظام متكامل لمنشأتك؟ حدثنا عن مشروعك.','Equipment for your site or a complete system for your facility? Tell us about your project.')}</p></div><a className="button white" href={'/'+lang+'/quote'}>{local(lang,'اطلب عرض سعر','Request a quote')}<Arrow lang={lang}/></a></div></section>;}
export default async function Page({params,searchParams}:Props){const {lang,slug=[]}=await params;if(!isSupportedSiteRoute(slug))notFound();const l=langOf(lang);const root='/'+l;const section=slug[0]||'';if(section==='cart'||section==='checkout')redirect(root+'/quote');if(section==='admin'){const {Admin}=await import('../../../../components/admin');if(slug.length>1)notFound();const admin=await adminUser();const standalone=getStandaloneAuth();const deniedCustomer=!admin&&standalone?await customerUser():null;const externalHosting=(env as unknown as Record<string,string>).SITE_PUBLIC==='true';const user=admin||(externalHosting?null:await getChatGPTUser());return <><a className="skip-link" href="#main">{local(l,'انتقل للمحتوى','Skip to content')}</a><Admin authorized={!!admin} bootstrap={!admin&&!!user&&await canBootstrap()} authConfigured={!externalHosting||!!standalone} deniedAccount={deniedCustomer?{email:deniedCustomer.email,userId:deniedCustomer.userId}:undefined} signin={externalHosting?customerLoginPath(l,root+'/admin','admin'):chatGPTSignInPath(root+'/admin')} signout={standalone?'standalone':chatGPTSignOutPath(root+'/admin')} userName={user?.displayName||''} isOwner={admin?.role==='owner'} permissions={admin?.permissions||[]} initialData={admin?await getAdminData(admin):null}/></>;}const search=await searchParams;const q=typeof search.q==='string'?search.q.slice(0,100):'';const [settings,rawProducts,rows]=await Promise.all([getSettings(),getProducts(),getDb().select().from(content).orderBy(asc(content.sortOrder))]);const products=presentCatalog(rawProducts,(env as unknown as Record<string,string>).SITE_DEMO_PRICES==='true' && (env as unknown as Record<string,string>).SITE_INDEXABLE!=='true');const items=(type:string)=>rows.filter(r=>r.type===type&&r.active);const categories=resolveCategories(rows);const serviceList=resolveServices(rows);const clientList=resolveClients(rows);let body:React.ReactNode;
 if(!section){body=<><HomeOverview lang={l} settings={settings} services={serviceList} products={products} categories={categories} projects={items('project')}/><SeoGuideSection lang={l} guide={homeSeo} links={[{href:root+'/shop',label:['تصفح معدات السلامة','Browse safety equipment']},{href:root+'/services',label:['خدمات الحماية من الحريق','Fire protection services']},{href:root+'/eastern-province',label:['طلبات معدات السلامة في الشرقية','Eastern Province project enquiries']},{href:root+'/quote',label:['طلب عرض سعر','Request a quotation']}]}/></>;}
 else if(section==='eastern-province'){body=<RegionalEnquiries lang={l}/>;}
 else if(section==='about'){body=<AboutOverview lang={l} settings={settings}/>;}
 else if(section==='services'){
  const service=slug[1]?serviceList.find(s=>s.slug===slug[1]):null;if(slug[1]&&!service)notFound();
  body=service?<><ServiceOverview lang={l} service={service} categories={categories}/>{serviceSeo[service.slug]&&<SeoGuideSection lang={l} guide={serviceSeo[service.slug]} links={[{href:root+'/quote?service='+service.slug,label:['طلب عرض سعر للخدمة','Request a service quote']},{href:root+'/shop',label:['معدات السلامة','Safety equipment']}]}/>}<JSONLD value={{'@context':'https://schema.org','@type':'Service','@id':SITE_URL+root+'/services/'+service.slug+'#service',url:SITE_URL+root+'/services/'+service.slug,name:local(l,service.ar,service.en),description:local(l,service.descAr,service.descEn),provider:{'@id':SITE_URL+'/#organization'}}}/></>:<ServicesOverview lang={l} services={serviceList}/>;
 }
 else if(section==='shop'&&slug[1]&&slug[1]!=='category'){
 const p=products.find(p=>p.slug===slug[1]);if(!p)notFound();const related=relatedProducts(p,products),complements=complementaryProducts(p,products);
 body=<><div className="container breadcrumb product-breadcrumb"><a href={root}>{local(l,'الرئيسية','Home')}</a><span>/</span><a href={root+'/shop'}>{local(l,'المتجر','Shop')}</a><span>/</span><a href={root+'/shop/category/'+p.category}>{local(l,categories.find(c=>c.slug===p.category)?.ar||p.category,categories.find(c=>c.slug===p.category)?.en||p.category)}</a><span>/</span><span>{productName(p,l)}</span></div>
 <div className="container product-page"><section className="product-detail"><ProductGallery product={p}/><article className="product-info"><span className="eyebrow">{local(l,categories.find(c=>c.slug===p.category)?.ar||p.category,categories.find(c=>c.slug===p.category)?.en||p.category)}</span><h1>{productName(p,l)}</h1><div className="product-meta">{p.brand&&<span>{local(l,'العلامة التجارية','Brand')}: {p.brand}</span>}{p.sku&&<span dir="ltr">SKU: {p.sku}</span>}</div><ProductPrice product={p} lang={l}/>{p.price!==null&&<small>{settings.pricesIncludeVat?local(l,'شامل ضريبة القيمة المضافة','VAT included'):local(l,'قبل ضريبة القيمة المضافة','Before VAT')}</small>}<p className="lead">{local(l,p.descriptionAr,p.descriptionEn)}</p><ProductActions product={p}/><div className="product-assurances"><span><Icon name="clipboard" size={18}/>{local(l,'المواصفات حسب نوع المنتج واستخدامه','Specifications matched to product type and application')}</span><span><Icon name="phone" size={18}/><a href={'tel:'+settings.phone}>{local(l,'تحتاج مساعدة في الاختيار؟ تحدث معنا','Need help choosing? Contact our team')}</a></span></div><div className="product-company-line"><strong>SAFE PLACES</strong><span>{local(l,settings.locationAr,settings.locationEn)}</span></div></article></section>
 <ProductInformation product={p} lang={l}/><CompleteYourKit key={p.id} product={p} products={complements} lang={l}/><ProductRail products={related} categories={categories} lang={l} title={local(l,'منتجات مشابهة ومقترحة','Similar & related products')} subtitle={local(l,'خيارات مرتبطة بهذا المنتج واحتياجات تجهيز موقعك.','Related choices for your equipment and site needs.')}/><RecentProducts products={products} categories={categories} lang={l} exclude={p.id}/></div>{productSeo[p.slug]&&<SeoGuideSection lang={l} guide={productSeo[p.slug]} links={[{href:root+'/shop/category/'+p.category,label:['جميع منتجات القسم','More products in this category']},{href:root+'/quote',label:['إرسال طلب عرض سعر','Send a quotation request']}]}/>}<RecentRecorder id={p.id}/>
  <JSONLD value={{'@context':'https://schema.org','@type':'Product','@id':SITE_URL+root+'/shop/'+p.slug+'#product',url:SITE_URL+root+'/shop/'+p.slug,name:productName(p,l),description:productSeo[p.slug]?seoText(productSeo[p.slug].description,l):local(l,p.descriptionAr,p.descriptionEn),category:local(l,categories.find(c=>c.slug===p.category)?.ar||p.category,categories.find(c=>c.slug===p.category)?.en||p.category),...(p.image?{image:p.image.startsWith('/')?SITE_URL+p.image:p.image}:{}),...(p.sku?{sku:p.sku}:{}),...(p.brand?{brand:{'@type':'Brand',name:p.brand}}:{})}}/></>;
 }
 else if(section==='shop'){
 const selected=slug[1]==='category'?slug[2]:'';const category=categories.find(c=>c.slug===selected);if(slug[1]==='category'&&!category)notFound();
 const filters=parseShopFilters(search,selected);const filtered=filterShopProducts(products,filters,l);const pageSize=20;const page=Math.min(filters.page,Math.max(1,Math.ceil(filtered.length/pageSize)));const pageProducts=filtered.slice((page-1)*pageSize,page*pageSize);
 body=<><PageHeading lang={l} title={category?local(l,category.ar,category.en):local(l,'متجر معدات السلامة','Safety equipment shop')} description={seoText(category&&categorySeo[category.slug]?categorySeo[category.slug].description:shopSeo.description,l)} kicker="SAFE PLACES SHOP"/><section className="section container shopping-catalog"><ShopToolbar products={products} categories={categories} filters={filters} total={filtered.length} lang={l}/>{pageProducts.length?<div className="product-grid shop-products">{pageProducts.map(p=><ProductCard key={p.id} p={p} lang={l} categoryList={categories} headingLevel={2}/>)}</div>:<div className="empty-state"><Icon name="clipboard" size={40}/><h2>{local(l,'لم نجد نتائج مطابقة','No matching results')}</h2><p>{local(l,'جرّب تخفيف الفلاتر أو استخدام كلمات بحث أخرى.','Try fewer filters or different search words.')}</p><a href={root+'/shop'} className="button primary">{local(l,'عرض كل المنتجات','View all products')}</a></div>}{filtered.length>pageSize&&<nav className="shop-pagination" aria-label={local(l,'صفحات المنتجات','Product pages')}>{page>1&&<a className="button light" href={shopUrl(filters,l,{page:page-1})}>{local(l,'السابق','Previous')}</a>}<span>{page} / {Math.ceil(filtered.length/pageSize)}</span>{page<Math.ceil(filtered.length/pageSize)&&<a className="button light" href={shopUrl(filters,l,{page:page+1})}>{local(l,'التالي','Next')}</a>}</nav>}<div className="shop-business-help"><span>{local(l,'تحتاج كميات أو تجهيز مشروع؟','Need bulk supply or equipment for a project?')}</span><a href={root+'/quote'} className="text-link">{local(l,'تواصل لطلب تسعير','Request a quotation')}<Arrow lang={l}/></a></div></section><SeoGuideSection lang={l} guide={category&&categorySeo[category.slug]?categorySeo[category.slug]:shopSeo} links={category?[{href:root+'/shop',label:['كل أقسام معدات السلامة','All safety equipment categories']},{href:root+'/quote',label:['طلب عرض سعر','Request a quote']}]:[{href:root+'/services',label:['خدمات الحماية من الحريق','Fire protection services']},{href:root+'/quote',label:['إرسال طلب عرض سعر','Submit a quotation request']}]}/></>;
 }
 else if(section==='quote'){body=<QuoteOverview lang={l} settings={settings} services={serviceList} selected={typeof search.service==='string'?search.service:''} uploadsAvailable={!!env.BUCKET} signInAvailable={!!(getStandaloneAuth()||customerAuthConfig())}/>;}
 else if(section==='contact'){body=<ContactOverview lang={l} settings={settings}/>;}
 else if(section==='projects'){const projects=items('project');const project=slug[1]?projects.find(p=>p.slug===slug[1]):null;if(slug[1]&&!project)notFound();body=<ProjectsOverview lang={l} projects={projects} project={project}/>;}
 else if(section==='certificates'){body=<DocumentsOverview lang={l} settings={settings} certificates={settings.documentsVerified?items('certificate'):[]}/>;}
 else if(['cart','checkout','wishlist','account'].includes(section)){
  const user=await customerUser(),standalone=!!getStandaloneAuth(),configured=standalone||!!customerAuthConfig(),returnTo=customerReturnPath(typeof search.return_to==='string'?search.return_to:undefined,l);
  const explicit=section==='account'&&slug[1];
  if(explicit&&!['login','register','forgot','confirm','reset','verify'].includes(slug[1]))notFound();
  const login=explicit||(!user&&(section==='wishlist'||section==='account'));
  if(login)return <><a className="skip-link" href="#main">{local(l,'انتقل للمحتوى','Skip to content')}</a><main id="main" className="customer-login-page"><CustomerLogin lang={l} mode={(explicit||'login') as LoginMode} configured={configured} standalone={standalone} emailPasswordEnabled={standalone&&emailPasswordEnabled(authBindings())} resetToken={typeof search.token==='string'&&/^[A-Za-z0-9_-]{16,512}$/.test(search.token)?search.token:''} socialProviders={standalone?enabledProviders(authBindings()):[]} returnTo={explicit?returnTo:root+'/'+section} reason={typeof search.reason==='string'?search.reason:section} tokenHash={typeof search.token_hash==='string'?search.token_hash:''} previewHref={!configured&&(env as unknown as Record<string,string>).SITE_PUBLIC!=='true'?chatGPTSignInPath(explicit?returnTo:root+'/'+section):undefined}/></main></>;
  body=<>{!['cart','checkout'].includes(section)&&<PageHeading lang={l} title={names[section][l==='ar'?0:1]} kicker="YOUR SAFE PLACES"/>}<section className={'section container '+(section==='cart'?'cart-route-section':section==='checkout'?'checkout-route-section':'customer-route-section')}>{section==='cart'?<CartPage includes={!!settings.pricesIncludeVat} vatRate={Number(settings.vatRate)}/>:section==='checkout'?<Checkout buyNowMode={search.intent==='buy-now'} vatRate={Number(settings.vatRate)} enabled={!!settings.orderEnabled} fulfillment={local(l,settings.fulfillmentAr,settings.fulfillmentEn)} includes={!!settings.pricesIncludeVat}/>:section==='wishlist'?<SavedProducts products={products} categories={categories} lang={l}/>:<Account user={user} signin={customerLoginPath(l,root+'/account')} signout={user?.provider==='supabase'||user?.provider==='standalone'?'customer':chatGPTSignOutPath(root)} products={products}/>}</section></>;
 }
 else if(['privacy','terms','returns','collection'].includes(section)){body=<PolicyOverview lang={l} policy={section as 'privacy'|'terms'|'returns'|'collection'} title={names[section][l==='ar'?0:1]} settings={settings}/>;}
 else notFound();
 const breadcrumbs=[{name:local(l,'الرئيسية','Home'),item:SITE_URL+root},{name:names[section]?.[l==='ar'?0:1]||section,item:SITE_URL+root+'/'+section}];
 if(section==='shop'&&slug[1]){
  const product=slug[1]!=='category'?products.find(p=>p.slug===slug[1]):null;
  const category=categories.find(c=>c.slug===(product?.category||slug[2]));
  if(category)breadcrumbs.push({name:local(l,category.ar,category.en),item:SITE_URL+root+'/shop/category/'+category.slug});
  if(product)breadcrumbs.push({name:productName(product,l),item:SITE_URL+root+'/shop/'+product.slug});
 }else if(section==='services'&&slug[1]){
  const service=serviceList.find(s=>s.slug===slug[1]);
  if(service)breadcrumbs.push({name:local(l,service.ar,service.en),item:SITE_URL+root+'/services/'+service.slug});
 }else if(section==='projects'&&slug[1]){
  const project=items('project').find(p=>p.slug===slug[1]);
  if(project)breadcrumbs.push({name:local(l,project.titleAr,project.titleEn),item:SITE_URL+root+'/projects/'+project.slug});
 }
 return <><a className="skip-link" href="#main">{local(l,'انتقل للمحتوى','Skip to content')}</a><Header path={slug.join('/')} phone={settings.phone} products={products} categories={categories} query={q} preview={products.some(p=>p.previewOnly)} checkoutIntent={section==='checkout'&&search.intent==='buy-now'}/><main id="main" className={section==='shop'&&slug[1]&&slug[1]!=='category'?'product-route':section==='cart'?'cart-route':section==='checkout'?'checkout-route':undefined}>{body}</main><Footer lang={l} settings={settings}/><JSONLD value={{'@context':'https://schema.org','@type':'Organization','@id':SITE_URL+'/#organization',legalName:settings.legalNameAr,name:company.nameEn,alternateName:company.nameAr,url:SITE_URL,logo:SITE_URL+'/images/safeplaces-logo.webp',telephone:settings.phone.startsWith('0')?'+966'+settings.phone.slice(1):settings.phone,email:settings.email,address:{'@type':'PostalAddress',addressLocality:'Al Khobar',addressRegion:'Eastern Province',addressCountry:'SA'},areaServed:{'@type':'AdministrativeArea',name:'Eastern Province, Saudi Arabia'}}}/>{!section&&<JSONLD value={{'@context':'https://schema.org','@type':'WebSite','@id':SITE_URL+'/#website',url:SITE_URL,name:company.nameEn,alternateName:company.nameAr,inLanguage:['ar','en'],publisher:{'@id':SITE_URL+'/#organization'}}}/>}{section&&<JSONLD value={{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:breadcrumbs.map((item,index)=>({'@type':'ListItem',position:index+1,...item}))}}/>}</>;
}
