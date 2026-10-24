import {local,type Lang} from '../lib/config';
import {seoText,type SeoCopy,type SeoGuide} from '../lib/seo-content';

export type SeoLink={href:string;label:SeoCopy};

/** Useful, human-readable search-intent guidance; no hidden keyword lists. */
export function SeoGuideSection({lang,guide,links=[]}:{lang:Lang;guide:SeoGuide;links?:SeoLink[]}){
 return <section className="seo-guide container" aria-label={local(lang,'دليل اختيار معدات وخدمات السلامة','Safety equipment and services guide')}>
  <div className="seo-guide-intro">
   <h2>{seoText(guide.title,lang)}</h2>
   <p>{seoText(guide.introduction,lang)}</p>
   <p>{seoText(guide.detail,lang)}</p>
  </div>
  {guide.questions.length>0&&<div className="seo-guide-questions">
   <h3>{local(lang,'أسئلة تساعدك قبل طلب عرض السعر','Questions before requesting a quotation')}</h3>
   <div className="seo-guide-answers">{guide.questions.map((item,index)=><div key={index}><h4>{seoText(item.question,lang)}</h4><p>{seoText(item.answer,lang)}</p></div>)}</div>
  </div>}
  {links.length>0&&<nav className="seo-guide-links" aria-label={local(lang,'صفحات ومعلومات ذات صلة','Related pages')}>
   {links.map(link=><a key={link.href} href={link.href}>{seoText(link.label,lang)}</a>)}
  </nav>}
 </section>;
}
