import type {Product} from './catalog';

/** All public product listings request a quotation; never expose stored or demo prices. */
export function presentCatalog(products:Product[],_privateReview:boolean):Product[]{
 return products.map(p=>({...p,kind:'quote',price:null,oldPrice:null,previewOnly:false}));
}
export const normalizeSearch=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا');
export function matchesProduct(p:Product,query:string){const text=normalizeSearch([p.nameAr,p.nameEn,p.sku,p.brand,p.category,p.keywords].filter(Boolean).join(' '));return normalizeSearch(query).trim().split(/\s+/).every(word=>text.includes(word));}
export function relatedProducts(product:Product,products:Product[],limit=6):Product[]{
 let manual:string[]=[];try{const value=JSON.parse(product.related||'[]');if(Array.isArray(value))manual=value;}catch{}
 const available=products.filter(p=>p.id!==product.id&&p.active);
 const ordered=[...manual.map(id=>available.find(p=>p.id===id)).filter((p):p is Product=>!!p),...available.filter(p=>p.category===product.category),...available];
 return [...new Map(ordered.map(p=>[p.id,p])).values()].slice(0,limit);
}
const complements:Record<string,string[]>={extinguishers:['emergency','firefighting'],alarms:['firefighting','emergency'],firefighting:['extinguishers','alarms'],suppression:['alarms','extinguishers'],ppe:['emergency','extinguishers'],emergency:['ppe','extinguishers']};
export function complementaryProducts(product:Product,products:Product[],limit=3){const types=complements[product.category]||[];return products.filter(p=>p.id!==product.id&&p.price!==null&&p.kind!=='quote'&&types.includes(p.category)).sort((a,b)=>types.indexOf(a.category)-types.indexOf(b.category)).slice(0,limit);}
