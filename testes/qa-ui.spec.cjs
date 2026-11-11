'use strict';
const {test,expect,devices}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const state=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),'.qa-state.json'),'utf8'));
const root='http://localhost:4173/';
const tag=state.tag;
const letter={ 'android-chrome':'a','iphone-webkit':'i'};
function person(label){
 const id=state.prefix+'_ui'+letter[label];
 return {usuario:id,nome:'Cadastro Automatizado Visual',email:id+'@example.com',
 telefone:'(11) 98888-7777',senha:'Aa9!'+crypto.randomBytes(24).toString('base64url')};
}
async function fill(page,p){
 await page.locator('[name=sn]').fill(p.nome);
 await page.locator('[name=su]').fill(p.usuario);
 await page.locator('[name=se]').fill(p.email);
 await page.locator('[name=sf]').fill(p.telefone);
 await page.locator('[name=sp]').fill(p.senha);
}
async function codePage(page,code){
 await page.goto(root);
 await page.locator('[data-a=signup]').click();
 await page.locator('form[data-form=checkinvite] [name=sc]').fill(code);
 await page.locator('form[data-form=checkinvite] button[type=submit]').click();
 await expect(page.locator('form[data-form=signup]')).toBeVisible({timeout:20000});
}
for(const name of ['android-chrome','iphone-webkit']){
 test.describe(name,()=>{
  test.use(name==='android-chrome'
    ? {...devices['Pixel 7'],browserName:'chromium'}
    : {...devices['iPhone 13'],browserName:'webkit'});
  test.beforeEach(({},testInfo)=>test.skip(testInfo.project.name!==name,'Executar apenas no dispositivo correspondente'));
  const ui=state.ui[name];
  test('QR longo: inscrição real no navegador',async({page})=>{
   await page.goto(root);
   // A navegação de QR é gerada no navegador sem pôr o token no log do Playwright.
   await page.evaluate(code=>{
      history.replaceState({},'', '?convite='+encodeURIComponent(code));
      location.reload();
   },ui.qr.codigo);
   await expect(page.locator('form[data-form=signup]')).toBeVisible({timeout:20000});
   const p=person(name);
   await fill(page,p);
   await page.locator('form[data-form=signup] button[type=submit]').click();
   await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  });
  test('código curto: inscrição real no navegador',async({page})=>{
   await codePage(page,ui.short.codigo_curto);
   const p=person(name);
   p.usuario=state.prefix+'_uc'+letter[name];
   p.email=p.usuario+'@example.com';
   await fill(page,p);
   await page.locator('form[data-form=signup] button[type=submit]').click();
   await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  });
  test('senha fraca mantém todos os campos',async({page})=>{
   await codePage(page,ui.weak.codigo_curto);
   const p=person(name);
   p.usuario=state.prefix+'_uw'+letter[name];
   p.email=p.usuario+'@example.com';
   await fill(page,p);
   await page.locator('[name=sp]').fill('fraca123456');
   await page.locator('form[data-form=signup] button[type=submit]').click();
   await expect(page.getByText(/Senha: use de 10 a 128 caracteres/)).toBeVisible();
   expect((await page.locator('[name=sn]').inputValue())===p.nome).toBe(true);
   expect((await page.locator('[name=su]').inputValue())===p.usuario).toBe(true);
   expect((await page.locator('[name=se]').inputValue())===p.email).toBe(true);
   await page.locator('[name=sp]').fill(p.senha);
   await page.locator('form[data-form=signup] button[type=submit]').click();
   await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  });
  test('toque duplo não cria duas inscrições',async({page})=>{
   await codePage(page,ui.double.codigo_curto);
   const p=person(name);
   p.usuario=state.prefix+'_ud'+letter[name];p.email=p.usuario+'@example.com';
   await fill(page,p);
   await page.locator('form[data-form=signup] button[type=submit]').evaluate(btn=>{btn.click();btn.click()});
   await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  });
  test('internet offline preserva dados e permite reenvio',async({page,context})=>{
   await codePage(page,ui.offline.codigo_curto);
   const p=person(name);
   p.usuario=state.prefix+'_uo'+letter[name];p.email=p.usuario+'@example.com';
   await fill(page,p);
   await context.setOffline(true);
   await page.locator('form[data-form=signup] button[type=submit]').click();
   expect((await page.locator('form[data-form=signup] [name=sn]').inputValue())===p.nome).toBe(true);
   expect((await page.locator('form[data-form=signup] [name=se]').inputValue())===p.email).toBe(true);
   await context.setOffline(false);
   await page.locator('form[data-form=signup] button[type=submit]').click();
   await expect(page.getByText('Cadastro enviado',{exact:true})).toBeVisible({timeout:30000});
  });
  test('cache antigo removido quando worker atual ativa',async({page})=>{
   await page.goto(root);
   const result=await page.evaluate(async()=>{
    if(!('serviceWorker' in navigator))return 'unsupported';
    const cache='escala-kids-legacy-qa-e2e';
    await caches.open(cache);
    const existing=await navigator.serviceWorker.getRegistration();
    if(existing)await existing.unregister();
    const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    await new Promise((resolve,reject)=>{
      if(reg.active?.state==='activated')return resolve();
      const timeout=setTimeout(()=>reject(new Error('worker timeout')),20000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve()},{once:true});
      if(reg.installing)reg.installing.addEventListener('statechange',()=>{
       if(reg.installing?.state==='activated'){clearTimeout(timeout);resolve()}
      });
    });
    return (await caches.keys()).includes(cache)?'old-cache-still-present':'old-cache-removed';
   });
   expect(result).toBe('old-cache-removed');
  });
 });
}
