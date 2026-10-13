import {local,type Lang} from '../lib/config';

export function Brand({lang,footer=false}:{lang:Lang;footer?:boolean}){
 return <a className={'wordmark '+(footer?'footer-brand':'')} href={'/'+lang} aria-label={local(lang,'المناطق الآمنة — الرئيسية','Safe Places — Home')}>
  <img className="brand-logo" src="/images/safeplaces-logo.webp" alt={local(lang,'شعار المناطق الآمنة','Safe Places logo')} width={100} height={91}/>
  <span className="brand-copy"><strong>{local(lang,'المناطق الآمنة','SAFE PLACES')}</strong><small>{local(lang,'لأدوات ومواد السلامة','Safety Tools & Materials')}</small></span>
 </a>;
}
