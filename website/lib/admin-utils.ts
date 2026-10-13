export type AdminPeriod = 'today' | '7' | '30' | '90';
type OrderRecord = {id:string;email:string;name:string;phone?:string|null;company?:string|null;createdAt:string;total:number;status:string;paymentStatus:string};

// Company reporting uses the Saudi calendar, regardless of the browser timezone.
export function saudiDay(value:string|number) {
  return new Date(new Date(value).getTime() + 3 * 3600000).toISOString().slice(0,10);
}
export function reportingDays(period:AdminPeriod, timestamp=Date.now()) {
  const count=period==='today'?1:Number(period);
  const end=new Date(saudiDay(timestamp)+'T00:00:00Z').getTime();
  return Array.from({length:count},(_,i)=>new Date(end-(count-1-i)*86400000).toISOString().slice(0,10));
}
export function confirmedSale(order:Pick<OrderRecord,'status'|'paymentStatus'>) {
  return order.paymentStatus==='paid' && order.status!=='cancelled';
}
export function reportingSummary(orders:OrderRecord[],quotes:{createdAt:string}[],period:AdminPeriod,timestamp=Date.now()) {
  const days=reportingDays(period,timestamp);
  const included=new Set(days);
  const current=orders.filter(order=>included.has(saudiDay(order.createdAt)));
  const paid=current.filter(confirmedSale);
  const buckets=days.map(day=>({day,amount:paid.filter(order=>saudiDay(order.createdAt)===day).reduce((sum,order)=>sum+order.total,0)}));
  return {orders:current.length,paidOrders:paid.length,sales:paid.reduce((sum,order)=>sum+order.total,0),quotes:quotes.filter(quote=>included.has(saudiDay(quote.createdAt))).length,buckets};
}
export function customerSummary(profiles:any[],orders:OrderRecord[],quotes:any[]) {
  const people=new Map<string,any>();
  const requests=[...quotes,...orders].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  for(const record of [...requests,...profiles]) {
    if(!record.email)continue;
    const email=record.email.trim().toLowerCase();
    const old=people.get(email)||{email};
    people.set(email,{...old,name:record.name||old.name,phone:record.phone||old.phone,company:record.company||old.company});
  }
  return Array.from(people.values()).map(person=>{
    const customerOrders=orders.filter(order=>order.email.trim().toLowerCase()===person.email);
    return {...person,orders:customerOrders.length,paidTotal:customerOrders.filter(confirmedSale).reduce((sum,order)=>sum+order.total,0),lastOrder:customerOrders.map(order=>order.createdAt).sort().at(-1)||null};
  });
}
export function productReady(product:{kind:string;price:number|null}) {
  return product.kind==='quote'||(product.price!==null && Number.isSafeInteger(product.price) && product.price>0);
}
export function csvText(headers:string[],rows:unknown[][]) {
  const cell=(value:unknown)=>{
    let text=value===null||value===undefined?'':String(value);
    // Prevent spreadsheet formula execution, including formulas hidden by whitespace.
    if(typeof value==='string'&&/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
export const requestStates:Record<string,string[]>={orders:['new','confirmed','processing','ready','completed','cancelled'],quotes:['new','review','information','quoted','accepted','declined','closed'],contacts:['new','reviewed','closed']};
export const paymentStates=['pending','paid','failed','refunded','partially_refunded'];
