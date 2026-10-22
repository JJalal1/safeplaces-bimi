import {local,type Lang} from '../lib/config';
import {responsiveImage} from '../lib/responsive-images';

export function Brand({lang,footer=false,logoSizes='80px'}:{lang:Lang;footer?:boolean;logoSizes?:string}){
 return <a className={'wordmark '+(footer?'footer-brand':'')} href={'/'+lang}>
  <img className="brand-logo" src="/images/safeplaces-logo.webp" {...responsiveImage('/images/safeplaces-logo.webp',footer?'72px':logoSizes)} alt={local(lang,'شعار المناطق الآمنة','Safe Places logo')} width={100} height={91} loading={footer?'lazy':undefined} decoding="async"/>
  <span className="brand-copy"><strong>{local(lang,'المناطق الآمنة','SAFE PLACES')}</strong>{' '}<small>{local(lang,'لأدوات ومواد السلامة','Safety Tools & Materials')}</small></span>
  <span className="sr-only">{local(lang,'الرئيسية','Home')}</span>
 </a>;
}

