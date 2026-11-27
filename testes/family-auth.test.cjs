'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),load=p=>import(pathToFileURL(path.join(root,p)).href);
test('family confirmation discards tokens and expired links',async()=>{
 const m=await load('family-auth.js');
 assert.deepEqual(m.familyAuthReturn('?familia=confirmar','#access_token=demo&refresh_token=demo&type=signup'),{kind:'confirmation'});
 assert.equal(m.familyAuthReturn('?familia=confirmar','#error_code=otp_expired').kind,'invalid');
 assert.equal(m.familyAuthReturn('','#access_token=demo&refresh_token=demo').kind,'invalid');
 assert.equal(m.familyAuthReturn('?familia=1','').kind,'none');
});
test('family recovery requires explicit route and both tokens',async()=>{
 const m=await load('family-auth.js');
 assert.equal(m.familyAuthReturn('?familia=recuperar','#type=recovery&access_token=fake&refresh_token=fake2').kind,'recovery');
 for(const h of ['','#type=recovery&access_token=fake','#type=signup&access_token=fake&refresh_token=fake2','#type=recovery&access_token=fake&refresh_token=fake2&error=expired'])assert.equal(m.familyAuthReturn('?familia=recuperar',h).kind,'invalid');
 assert.equal(m.familyAuthReturn('','#type=recovery&access_token=fake&refresh_token=fake2').kind,'invalid');
});
test('family password policy',async()=>{
 const m=await load('family-auth.js');
 assert.equal(m.strongFamilyPassword(' Aa123456! '),true);
 for(const p of ['short','aaaaaaaaaa','AAAAAAAAA1!','Aa123456789','Aa!123456','Aa!1'+'a'.repeat(125)])assert.equal(m.strongFamilyPassword(p),false);
});
test('family UI exposes resend and recovery and escapes account identity',async()=>{
 const m=await load('kids-ui.js'),esc=s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const l=m.familyAccessUI({family:null,auth:'family-login',esc});
 assert.match(l,/family-forgot-tab/);assert.match(l,/family-resend-tab/);
 assert.match(m.familyAccessUI({family:null,auth:'family-forgot',esc}),/data-form="family-forgot"/);
 assert.match(m.familyAccessUI({family:null,auth:'family-resend',esc}),/data-form="family-resend"/);
 const reset=m.familyAccessUI({family:null,auth:'family-reset',recoveryEmail:'<fake>',esc});
 assert.match(reset,/&lt;fake&gt;/);assert.doesNotMatch(reset,/<fake>/);assert.match(reset,/reset-confirm/);
});
test('family auth return scrubbed, recovery isolated, service worker includes helper',()=>{
 const a=read('app.js'),sw=read('sw.js');
 assert.match(a,/history\.replaceState\(null, '', location\.pathname\)/);
 assert.match(a,/persistSession:false,autoRefreshToken:false,detectSessionInUrl:false/);
 assert.match(a,/client\.auth\.getUser\(\)/);assert.match(a,/resetPasswordForEmail/);assert.match(a,/sb\.auth\.resend/);
 assert.match(a,/emailRedirectTo:familyMailLink\('confirmar'\)/);assert.match(sw,/family-auth\.js\?v=1\.2\.9/);
});
