import {local,type Lang} from '../lib/config';
import {responsiveImage} from '../lib/responsive-images';

export function Brand({lang,footer=false}:{lang:Lang;footer?:boolean}){
 return <a className={'wordmark '+(footer?'footer-brand':'')} href={'/'+lang} aria-label={local(lang,'المناطق الآمنة لأدوات ومواد السلامة — الرئيسية','Safe Places Safety Tools & Materials — Home')}>
  <img className="brand-logo" src="/images/safeplaces-logo.webp" {...responsiveImage('/images/safeplaces-logo.webp','100px')} alt={local(lang,'شعار المناطق الآمنة','Safe Places logo')} width={100} height={91} decoding="async"/>
  <span className="brand-copy"><strong>{local(lang,'المناطق الآمنة','SAFE PLACES')}</strong><small>{local(lang,'لأدوات ومواد السلامة','Safety Tools & Materials')}</small></span>
 </a>;
}

