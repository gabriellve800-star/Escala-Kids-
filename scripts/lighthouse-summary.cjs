'use strict';
// Reports only public unauthenticated login page, not private dashboards.
const fs=require('node:fs'),path=require('node:path');
const folder=path.resolve(__dirname,'../artifacts');
const base=JSON.parse(fs.readFileSync(path.join(folder,'lighthouse-main.json'),'utf8'));
const next=JSON.parse(fs.readFileSync(path.join(folder,'lighthouse-v125.json'),'utf8'));
const keys=[['first-contentful-paint','FCP','ms'],['largest-contentful-paint','LCP','ms'],
  ['total-blocking-time','TBT','ms'],['cumulative-layout-shift','CLS',''],
  ['speed-index','Speed Index','ms']];
function fmt(value,unit){
  if(value==null||!Number.isFinite(value))return 'n/a';
  return unit==='ms'?Math.round(value)+' ms':value.toFixed(3);
}
const lines=[
  '### Lighthouse mobile — página pública de login, localhost',
  '',
  '| Medida | main | v1.2.5 | Diferença |',
  '|---|---:|---:|---:|',
];
const perf=v=>Math.round((v.categories.performance?.score??0)*100);
lines.push('| Performance | '+perf(base)+' | '+perf(next)+' | '+(perf(next)-perf(base))+' pts |');
for(const [key,name,unit] of keys){
  const b=base.audits[key]?.numericValue, n=next.audits[key]?.numericValue;
  lines.push('| '+name+' | '+fmt(b,unit)+' | '+fmt(n,unit)+' | '+
    (typeof b==='number'&&typeof n==='number'?fmt(n-b,unit):'n/a')+' |');
}
lines.push('', '> Escopo: execução local sem login; não representa métricas autenticadas de navegação, agenda ou Supabase em produção. Uma única amostra não é medição robusta.','');
const report=lines.join('\n');
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
