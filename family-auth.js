// Never persist or log Auth return tokens.
export function familyAuthReturn(search,hash){
 const q=new URLSearchParams(search),h=new URLSearchParams(hash.replace(/^#/,''));
 const route=q.get('familia'),type=h.get('type'),error=h.has('error')||h.has('error_code')||q.has('error')||q.has('error_code');
 const access=h.get('access_token'),refresh=h.get('refresh_token');
 if(route==='recuperar')return !error&&type==='recovery'&&access&&refresh?{kind:'recovery',access_token:access,refresh_token:refresh}:{kind:'invalid'};
 if(route==='confirmar'||type==='signup')return {kind:error?'invalid':'confirmation'};
 if(access||refresh||error||type==='recovery')return {kind:'invalid'};
 return {kind:'none'};
}
export function strongFamilyPassword(p){return typeof p==='string'&&p.length>=10&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p)&&/[^a-z0-9]/i.test(p);}
