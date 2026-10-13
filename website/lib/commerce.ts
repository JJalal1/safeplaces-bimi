export type CartLine={id:string;quantity:number};
export type PricedLine={id:string;nameAr:string;nameEn:string;slug:string;category:string;price:number;quantity:number};
export function totals(items:PricedLine[],rate:number,includes:boolean,discount:number=0){
 const gross=items.reduce((sum,p)=>sum+p.price*p.quantity,0);
 const reduction=Math.min(Math.max(0,discount),gross); const reduced=gross-reduction;
 const vat=includes?Math.round(reduced*rate/(100+rate)):Math.round(reduced*rate/100);
 const subtotal=includes?gross-Math.round(gross*rate/(100+rate)):gross;
 const netAfterDiscount=includes?reduced-vat:reduced;
 return {subtotal,discount:subtotal-netAfterDiscount,vat,total:includes?reduced:reduced+vat,grossDiscount:reduction};
}
export function discountFor(c:{type:string;value:number;minimum:number;maximum:number|null;categories:string},items:PricedLine[]){
 const gross=items.reduce((s,p)=>s+p.price*p.quantity,0);if(gross<c.minimum)throw new Error('COUPON_MINIMUM');
 const categories=JSON.parse(c.categories||'[]') as string[];
 const eligible=items.filter(p=>!categories.length||categories.includes(p.category)).reduce((s,p)=>s+p.price*p.quantity,0);
 if(!eligible)throw new Error('COUPON_NOT_APPLICABLE');
 const value=c.type==='percentage'?Math.floor(eligible*c.value/100):Math.min(c.value,eligible);
 return Math.min(value,c.maximum??value);
}
