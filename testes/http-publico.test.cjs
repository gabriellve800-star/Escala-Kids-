'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const endpoint=process.env.ESCALA_FUNCTION_URL;
const origin='https://gabriellve800-star.github.io';
if(!endpoint) test('HTTP real: configurar ESCALA_FUNCTION_URL',{skip:true},()=>{});
else {
 async function call(body, opts={}){
  const options={method:opts.method||'POST',headers:{Origin:opts.origin||origin,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)};
  if(options.method==='POST') options.body=typeof body==='string'?body:JSON.stringify(body);
  const res=await fetch(endpoint,options);
  let json={};try{json=await res.json()}catch{}
  return {status:res.status,json};
 }
 test('check_invite com código inexistente retorna 400',async()=>{
  const r=await call({action:'check_invite',codigo:'ZZZ-999'});
  assert.equal(r.status,400);
  assert.equal(typeof r.json.error,'string');
 });
 test('origem proibida retorna 403',async()=>{
  const r=await call({action:'check_invite',codigo:'ZZZ-999'},{origin:'https://qa-origem-nao-autorizada.invalid'});
  assert.equal(r.status,403);
 });
 test('JSON malformado retorna 400',async()=>{assert.equal((await call('{')).status,400)});
 test('GET retorna 405',async()=>{assert.equal((await call('',{method:'GET'})).status,405)});
}
