import type {Product} from './catalog';

// Owner-approved private review prices. Order APIs always use the persisted
// catalog instead of this display-only projection. Public pages exclude it.
const reviewPrices:Record<string,number>={'fire-extinguishers':14900,'fire-alarm-devices':8900,'fire-pumps':685000,'sprinklers':2900,'hoses-and-reels':34900,'safety-helmets':3500,'protective-equipment':6900,'emergency-and-signs':4900};
export function presentCatalog(products:Product[],privateReview:boolean):Product[]{
 return products.map(p=>privateReview&&p.price===null&&reviewPrices[p.slug]?{...p,kind:'direct',price:reviewPrices[p.slug],oldPrice:null,previewOnly:true,descriptionAr:'الصورة والسعر للمعاينة. تُعتمد المواصفات والنوع والسعر النهائي قبل إتاحة الشراء. تواصل مع الفريق لتحديد المنتج المناسب لاحتياجك.',descriptionEn:'The photograph and price are illustrative. Product type, specifications and final price are confirmed before purchasing is enabled. Contact our team to select equipment for your needs.'}:p);
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
