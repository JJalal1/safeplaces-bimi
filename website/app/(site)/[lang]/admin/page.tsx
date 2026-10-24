import SharedPage,{generateMetadata as sharedMetadata} from '../[[...slug]]/page';
import '../../../admin.css';

type Props={params:Promise<{lang:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
async function adminProps(props:Props){const {lang}=await props.params;return {...props,params:Promise.resolve({lang,slug:['admin']})};}
export async function generateMetadata(props:Props){return sharedMetadata(await adminProps(props));}
export default async function AdminPage(props:Props){return SharedPage(await adminProps(props));}
