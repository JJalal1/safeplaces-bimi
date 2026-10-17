import {getStandaloneAuth} from '../../../../lib/better-auth-server';

export const dynamic='force-dynamic';

async function handle(request:Request){
 const auth=getStandaloneAuth();
 if(!auth)return Response.json({error:'AUTH_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 const response=await auth.handler(request);
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('X-Content-Type-Options','nosniff');
 return response;
}
export const GET=handle;
export const POST=handle;
