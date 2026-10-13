import {local,type Lang,type initialSettings} from '../lib/config';
import {Icon,Arrow} from './visuals';

type HeroSettings=Pick<typeof initialSettings,'heroImage'|'heroImageReference'|'heroTitleAr'|'heroTitleEn'|'heroDescriptionAr'|'heroDescriptionEn'|'locationAr'|'locationEn'>;

export function HomeHero({lang,settings,serviceSlugs}:{lang:Lang;settings:HeroSettings;serviceSlugs:string[]}){
 const root='/'+lang;
 const image=settings.heroImage&&!settings.heroImage.startsWith('/images/facility/')?settings.heroImage:'/images/hero.webp';
 const reference=image==='/images/hero.webp'||settings.heroImageReference;
 const links=[
  {icon:'helmet',ar:'معدات السلامة',en:'Safety equipment',descAr:'تسوق المنتجات ومستلزماتها',descEn:'Shop equipment & accessories',href:root+'/shop'},
  {icon:'shield',ar:'أنظمة الحماية',en:'Protection systems',descAr:'توريد وتركيب أنظمة الحريق',descEn:'Fire system supply & installation',href:root+'/services'},
  {icon:'wrench',ar:'الصيانة والاختبار',en:'Maintenance & testing',descAr:'دعم فني لاحتياجات منشأتك',descEn:'Technical support for your facility',href:root+'/services'+(serviceSlugs.includes('maintenance')?'/maintenance':'')},
  {icon:'phone',ar:'تحدث مع فريقنا',en:'Talk to our team',descAr:'المساعدة في اختيار الحل المناسب',descEn:'Help choosing the right solution',href:root+'/contact'}
 ];
 return <section className="safety-hero" aria-labelledby="safety-hero-title">
  <img className="safety-hero-photo" src={image} alt={local(lang,'معدات وأنظمة الحماية من الحريق','Fire protection equipment and systems')} width={1920} height={692} fetchPriority="high" decoding="async"/>
  <div className="safety-hero-shade" aria-hidden="true"/>
  <div className="container safety-hero-inner">
   <div className="safety-hero-copy">
    <div className="safety-hero-kicker"><span aria-hidden="true"/><span>SAFE PLACES</span><i aria-hidden="true"/><span>{local(lang,'حلول الحماية والسلامة','FIRE PROTECTION & SAFETY')}</span></div>
    <h1 id="safety-hero-title">{local(lang,settings.heroTitleAr,settings.heroTitleEn).split('\n').map((line,index)=><span key={index}>{line}</span>)}</h1>
    <p>{local(lang,settings.heroDescriptionAr,settings.heroDescriptionEn)}</p>
    <div className="safety-hero-actions">
     <a className="button primary" href={root+'/shop'}>{local(lang,'تسوق معدات السلامة','Shop safety equipment')}<Arrow lang={lang}/></a>
     <a className="button safety-hero-secondary" href={root+'/quote'}>{local(lang,'ناقش مشروعك معنا','Discuss your project')}<Arrow lang={lang}/></a>
    </div>
    <div className="safety-hero-scope"><span>{local(lang,'توريد','Supply')}</span><i aria-hidden="true"/><span>{local(lang,'تركيب','Installation')}</span><i aria-hidden="true"/><span>{local(lang,'اختبار','Testing')}</span><i aria-hidden="true"/><span>{local(lang,'صيانة','Maintenance')}</span></div>
    <div className="safety-hero-location"><Icon name="pin" size={14}/><span>{local(lang,settings.locationAr,settings.locationEn)}</span></div>
   </div>
   {reference&&<small className="safety-hero-caption">{local(lang,'صورة توضيحية لأنظمة الحماية من الحريق','Reference image of fire protection systems')}</small>}
  </div>
  <nav className="safety-hero-links" aria-label={local(lang,'المعدات والخدمات','Equipment and services')}>
   <div className="container">{links.map(link=><a key={link.icon} href={link.href}><span className="safety-hero-link-icon"><Icon name={link.icon} size={23}/></span><span><strong>{local(lang,link.ar,link.en)}</strong><small>{local(lang,link.descAr,link.descEn)}</small></span><Arrow lang={lang}/></a>)}</div>
  </nav>
 </section>;
}
