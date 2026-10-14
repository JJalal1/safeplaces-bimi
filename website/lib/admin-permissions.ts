/**
 * Safe Places admin RBAC. Permissions are server-enforced, never inferred from
 * a Google login or from a requested UI tab.
 */
export const ADMIN_PERMISSIONS=[
 'dashboard','orders','quotes','contacts',
 'products','category','brand','customers','coupons',
 'homepage','service','project','client','certificate',
 'activity','settings'
] as const;
export type AdminPermission=typeof ADMIN_PERMISSIONS[number];
export type AdminRole='owner'|'staff';
export type AdminGrant={role:AdminRole;permissions:readonly AdminPermission[]};

export const HOMEPAGE_SETTINGS_KEYS=[
 'heroImage','heroImageReference','heroTitleAr','heroTitleEn',
 'heroDescriptionAr','heroDescriptionEn','aboutAr','aboutEn'
] as const;

export function parseAdminPermissions(value:unknown):AdminPermission[]{
 if(!Array.isArray(value))return [];
 const valid=new Set<string>(ADMIN_PERMISSIONS);
 return [...new Set(value.filter((item):item is AdminPermission=>typeof item==='string'&&valid.has(item)))];
}
export function canAdmin(admin:AdminGrant|null|undefined,permission:AdminPermission):boolean{
 return !!admin&&(admin.role==='owner'||admin.permissions.includes(permission));
}
export function contentPermission(type:string):AdminPermission|null{
 const mapping:Record<string,AdminPermission>={
  category:'category',brand:'brand',service:'service',project:'project',
  client:'client',certificate:'certificate',banner:'homepage'
 };
 return mapping[type]||null;
}
export function canAdminContent(admin:AdminGrant|null|undefined,type:string):boolean{
 const permission=contentPermission(type);
 return permission!==null&&canAdmin(admin,permission);
}
