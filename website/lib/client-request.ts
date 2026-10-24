type RequestOptions={timeoutMs?:number;fetcher?:typeof fetch};

/** No automatic POST retries: callers retain their idempotency key and form data. */
export async function requestJSON<T=any>(path:string,data?:unknown,{timeoutMs=20000,fetcher=fetch}:RequestOptions={}):Promise<T>{
 const controller=new AbortController();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const multipart=typeof FormData!=='undefined'&&data instanceof FormData;
  const response=await fetcher(path,{credentials:'same-origin',signal:controller.signal,...(data===undefined?{}:{method:'POST',...(multipart?{}:{headers:{'Content-Type':'application/json'}}),body:multipart?data as FormData:JSON.stringify(data)})});
  let result:any;
  try{result=await response.json();}catch{throw new Error(response.status>=500?'SERVER_ERROR':'INVALID_RESPONSE');}
  if(!response.ok)throw new Error(typeof result?.error==='string'&&/^[A-Z_]{2,64}$/.test(result.error)?result.error:'SERVER_ERROR');
  return result as T;
 }catch(error){
  if(timedOut)throw new Error('REQUEST_TIMEOUT');
  if(error instanceof TypeError)throw new Error('NETWORK_ERROR');
  throw error;
 }finally{clearTimeout(timer);}
}
