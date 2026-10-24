import {publishedBusinessIdentity} from '../lib/business-identity';
import type {initialSettings, Lang} from '../lib/config';

export function BusinessDetails({settings, lang}: {settings: typeof initialSettings; lang: Lang}) {
 const rows = publishedBusinessIdentity(settings, lang);
 if (!rows.length) return null;
 return <dl className="business-details">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd><bdi>{row.value}</bdi></dd></div>)}</dl>;
}
