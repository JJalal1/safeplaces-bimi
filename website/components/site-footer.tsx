import {Phone,Mail,MapPin,ArrowUpRight} from 'lucide-react';
import {Brand} from './brand';
import {BusinessDetails} from './business-details';
import {local,type Lang} from '../lib/config';
import type {getSettings} from '../lib/data';

export function SiteFooter({lang,settings,serviceSlugs=[]}:{lang:Lang;settings:Awaited<ReturnType<typeof getSettings>>;serviceSlugs?:string[]}){
 const root='/'+lang;
 return <footer className="site-footer">
  <div className="container footer-intro"><div><span className="footer-kicker">SAFE PLACES</span><h2>{local(lang,'السلامة تبدأ باختيارك الصحيح','Safety starts with the right choice')}</h2><p>{local(lang,'أخبرنا بما يحتاجه مشروعك، ودع فريقنا يساعدك في الخطوة التالية.','Tell us what your project needs. Our team will help with the next step.')}</p></div><a className="button footer-quote" href={root+'/quote'}>{local(lang,'طلب عرض سعر','Request a quote')}<ArrowUpRight size={18}/></a></div>
  <div className="container footer-grid">
   <div className="footer-brand"><Brand lang={lang} footer/><p>{local(lang,settings.legalNameAr,settings.legalNameEn)}</p><p>{local(lang,'توريد معدات السلامة وحلول الحماية من الحريق للأفراد والمنشآت.','Safety equipment supply and fire protection solutions for people and facilities.')}</p></div>
   <nav className="footer-links" aria-label={local(lang,'عن الشركة','Company links')}><h3>{local(lang,'الشركة','Company')}</h3>{[['about','من نحن','About'],['services','خدماتنا','Services'],['projects','المشاريع','Projects'],['eastern-province','طلبات المشاريع في الشرقية','Eastern Province enquiries'],['certificates','المستندات والشهادات','Documents & certificates']].map(([path,ar,en])=><a key={path} href={root+'/'+path}>{local(lang,ar,en)}</a>)}</nav>
   <nav className="footer-links" aria-label={local(lang,'روابط مهمة','Useful links')}><h3>{local(lang,'روابط مهمة','Useful links')}</h3>{[['shop','المنتجات','Products'],['quote','طلب عرض سعر','Request a quote'],['account','حسابي وطلباتي','My account'],['contact','تواصل معنا','Contact']].map(([path,ar,en])=><a key={path} href={root+'/'+path}>{local(lang,ar,en)}</a>)}{serviceSlugs.includes('maintenance')&&<a href={root+'/services/maintenance'}>{local(lang,'صيانة أنظمة الحريق','Fire system maintenance')}</a>}{serviceSlugs.includes('training')&&<a href={root+'/services/training'}>{local(lang,'التدريب والسلامة والإخلاء','Safety & evacuation training')}</a>}</nav>
   <div className="footer-contact"><h3>{local(lang,'للتواصل','Contact us')}</h3><a className="footer-contact-item" href={'tel:'+settings.phone}><Phone size={18}/><span><small>{local(lang,'اتصل بنا','Call us')}</small><bdi dir="ltr">{settings.phone}</bdi></span></a><a className="footer-contact-item" href={'mailto:'+settings.email}><Mail size={18}/><span><small>{local(lang,'راسلنا','Email us')}</small><bdi dir="ltr">{settings.email}</bdi></span></a><div className="footer-contact-item"><MapPin size={18}/><span><small>{local(lang,'موقعنا','Our location')}</small>{local(lang,settings.locationAr,settings.locationEn)}</span></div></div>
  </div>
  <div className="container"><BusinessDetails lang={lang} settings={settings}/></div>
  <div className="container footer-bottom"><span>© {new Date().getFullYear()} Safe Places. {local(lang,'جميع الحقوق محفوظة.','All rights reserved.')}</span><nav aria-label={local(lang,'السياسات','Policies')}>{[['privacy','الخصوصية','Privacy'],['terms','الشروط','Terms'],['returns','الإلغاء والاسترجاع','Returns'],['collection','الاستلام','Collection']].map(([path,ar,en])=><a key={path} href={root+'/'+path}>{local(lang,ar,en)}</a>)}<a href={root+'/admin'}>{local(lang,'الإدارة','Admin')}</a></nav></div>
 </footer>;
}
