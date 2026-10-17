/** HTTP boundary for the browser's Google-only authentication API. */
export const AUTH_BODY_LIMIT=24*1024;

export function authRequestError(request:Request,baseURL:string):{code:string;status:number}|null{
 const url=new URL(request.url);
 if(url.origin!==baseURL)return {code:'INVALID_ORIGIN',status:403};
 if(request.method==='POST'){
  // Google redirects its authorization-code callback with GET. Browser POSTs
  // are our own client actions and always need the configured exact origin.
  if(request.headers.get('origin')!==baseURL||request.headers.get('sec-fetch-site')==='cross-site')
   return {code:'INVALID_ORIGIN',status:403};
  const contentType=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
  if(contentType&&contentType!=='application/json')return {code:'UNSUPPORTED_MEDIA_TYPE',status:415};
  const length=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(length)||length<0||length>AUTH_BODY_LIMIT)return {code:'TOO_LARGE',status:413};
 }
 return null;
}

/** Bound the actual body too; Content-Length alone is not trustworthy. */
export async function boundedAuthRequest(request:Request):Promise<Request|null>{
 if(request.method!=='POST'||!request.body)return request;
 const reader=request.body.getReader();
 const chunks:Uint8Array[]=[];
 let length=0;
 try{
  while(true){
   const part=await reader.read();if(part.done)break;
   length+=part.value.byteLength;
   if(length>AUTH_BODY_LIMIT){await reader.cancel();return null;}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new Request(request,{body:new TextDecoder().decode(bytes)});
}
