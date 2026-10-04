// Isolated browser review. Serves only the compiled frontend and synthetic GET responses.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import os from 'node:os';
const root = path.resolve('dist/YahwehRohi-Inventory/browser');
const out = path.resolve('output/ui-concepts');
const rows = Array.from({length:18},(_,i)=>({id:i+1,invoiceId:220000+i,customerId:i%6+1,customerName:['Ana López','Carlos Ruiz','María Torres','José Castro','Lucía Reyes','Pedro Flores'][i%6],customerPhone:'9999-1234',user:'Demo',quantity:2,productId:1,productName:'Producto de ejemplo',unitCost:20,salePrice:100,total:200,paidAmount:0,pendingAmount:200,utility:160,customerBalance:600,openCredits:3,paymentTypeId:2,saleStatusId:1,saleStatusName:'Activo',invoicePaymentMethod:'Sin abono',createdAt:'2026-06-01T10:00:00'}));
const server = http.createServer((req,res) => {
  if (req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') { res.writeHead(403); res.end('{}'); return; }
    const body = req.url === '/api/credits' ? {credits:rows} : req.url.includes('/api/credit-payments/customer/') ? {payments:[]} : req.url === '/api/invoices' ? { invoices: [] }
      : req.url === '/api/invoices/summary' ? { invoiceCount: 36, activeTotal: 50020, annulledCount: 1, creditTotal: 17100 }
      : req.url.includes('/details') ? { lines: [{ id:1, productName:'Arroz 5 lb', sku:'1001', quantity:2, salePrice:150, total:300 }, { id:2, productName:'Aceite vegetal', sku:'1002', quantity:3, salePrice:200, total:600 }, { id:3, productName:'Café molido', sku:'1003', quantity:2, salePrice:175, total:350 }] }
      : req.url.includes('/auth/users') ? { users: [{id:1, usuario:'demo', nombre:'Demo'}] }
      : { products:[], users:[], customers:[], invoices:[], offers:[], records:[], data:[], alerts:[], alert:{shouldAlert:false, products:[], dropPercent:0}, nextInvoiceNumber:1087 };
    res.end(JSON.stringify(body)); return;
  }
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(fs.readFileSync(file));
});
await new Promise((resolve,reject) => { server.once('error', reject); server.listen(0,'127.0.0.1',resolve); });
const profile = fs.mkdtempSync(path.join(os.tmpdir(),'yr-invoice-check-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless','--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {stdio:['ignore','ignore','pipe']});
let endpoint = ''; chrome.stderr.on('data', chunk => { const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/); if(match) endpoint=match[1]; });
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
let ws;
try {
  for(let i=0; !endpoint && i<100; i++) await sleep(100);
  assert.ok(endpoint, 'Chrome must start');
  const pages = await (await fetch(endpoint.replace('ws:','http:').replace(/\/devtools.*/, '/json/list'))).json();
  ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let id=0; const pending = new Map(); const errors=[];
  ws.addEventListener('message',e=>{ const m=JSON.parse(e.data); if(m.id){ pending.get(m.id)?.(m); pending.delete(m.id); } if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const call = (method,params={}) => new Promise((resolve,reject)=>{ const n=++id; const timer=setTimeout(()=>reject(Error('Timeout '+method)),15000); pending.set(n,m=>{clearTimeout(timer); m.error ? reject(Error(JSON.stringify(m.error))) : resolve(m.result);}); ws.send(JSON.stringify({id:n,method,params})); });
  const evaluate = async expression => { const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await sleep(200); };
  const select = async (selector,value) => { await evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(200); };
  const screenshot = async name => { const {data}=await call('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64')); };
  const size = async (width,height)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(250);};
  await call('Runtime.enable'); await size(1600,1100);
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port}); await sleep(1500);
  await evaluate(`localStorage.setItem('yahweh-rohi-session-user',JSON.stringify({id:1,usuario:'demo',nombre:'Demo',rol:'admin'}));localStorage.setItem('yahweh-rohi-sidebar-collapsed','1')`);
  await call('Page.reload'); await sleep(2300);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Creditos').click()`); await sleep(1500);
  assert.equal(await evaluate(`document.querySelectorAll('.cp-client').length`),6);
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
  assert.equal(await evaluate(`document.querySelectorAll('.cp-invoice').length`),3);
  await screenshot('creditos-clientes-implementado-escritorio');
  await click('.cp-primary');
  assert.equal(await evaluate(`!!document.querySelector('.credit-payment-modal')`),true);
  await evaluate(`document.querySelector('.customer-modal-backdrop').click()`); await sleep(200);
  await evaluate(`[...document.querySelectorAll('.cp-client')].find(e=>e.textContent.includes('Carlos Ruiz')).click()`);await sleep(200);
  assert.ok((await evaluate(`document.querySelector('.cp-identity').textContent`)).includes('Carlos Ruiz'));
  await evaluate(`(()=>{const e=document.querySelector('.cp-field input');e.value='no existe';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(200);
  assert.equal(await evaluate(`document.querySelectorAll('.cp-client').length`),0);
  await evaluate(`(()=>{const e=document.querySelector('.cp-field input');e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(200);
  await size(390,844);
  await screenshot('creditos-clientes-implementado-movil');
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'Mobile overflow');
  await evaluate(`document.querySelector('.cp-dossier').scrollIntoView()`);
  await screenshot('creditos-clientes-implementado-movil-ficha');
  assert.deepEqual(errors,[]);
  console.log('PASS: client list, selection, invoices, preparation modal, search, desktop and mobile without page overflow or runtime errors. Synthetic GET data only.');
} finally { ws?.close(); chrome.kill(); server.close(); }
