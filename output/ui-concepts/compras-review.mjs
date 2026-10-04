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
    const body = req.url === '/api/suppliers' ? {suppliers:[{id:1,nombre:'Distribuidora Norte'}]} : req.url === '/api/purchases' ? {purchases:[{id:1,purchaseType:'Efectivo',productId:1,productName:'Arroz',quantity:12,unitCost:80,total:960,userId:1,userName:'Demo',createdAt:new Date().toISOString(),paymentTypeId:1,supplierId:1,supplierName:'Distribuidora Norte',supplierPhone:null,supplierAddress:null,statusId:1,statusName:'Activo',invoiceNumber:'001-4587'}]} : req.url === '/api/credits' ? {credits:rows} : req.url.includes('/api/credit-payments/customer/') ? {payments:[]} : req.url === '/api/invoices' ? { invoices: [] }
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
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Compras').click()`); await sleep(1500);
  assert.equal(await evaluate(`!!document.querySelector('.pw-receipt')`),true);
  assert.equal(await evaluate(`document.querySelectorAll('.pw-metric').length`),3);
  assert.ok((await evaluate(`document.querySelector('.pw-metric').textContent`)).includes('1'));
  await click('.pw-summary-toggle');
  assert.equal(await evaluate(`document.querySelector('.pw-summary').hidden`),true);
  await click('.pw-summary-toggle');
  assert.ok(await evaluate(`document.querySelectorAll('.pw-summary svg').length === 3`));
  await click('.pw-pending summary');
  assert.equal(await evaluate(`document.querySelector('.pw-pending').open`),false);
  await click('.pw-pending summary');
  const navigation = await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.pw-top-actions button')];const boxes=buttons.map(b=>b.getBoundingClientRect());return {iconOnly:[...document.querySelectorAll('.pw-view-icons button')].every(b=>b.textContent.trim()==='' && b.getAttribute('aria-label')),verticalSpread:Math.max(...boxes.map(b=>b.top+b.height/2))-Math.min(...boxes.map(b=>b.top+b.height/2)),summaryShown:!document.querySelector('.pw-summary').hidden}})()`);
  assert.equal(navigation.iconOnly,true);
  assert.ok(navigation.verticalSpread<2,'View icons aligned with register button');
  assert.equal(navigation.summaryShown,true);
  console.log('Header and summary:',navigation);
  await click('.pw-recent .pw-draft');
  assert.equal(await evaluate(`!!document.querySelector('.pw-record-detail')`),true);
  assert.ok((await evaluate(`document.querySelector('.pw-record-detail').textContent`)).includes('001-4587'));
  assert.equal(await evaluate(`document.querySelectorAll('.pw-detail-table tbody tr').length`),1);
  await screenshot('compras-detalle-ingresado');
  await click('.pw-record-detail button[aria-label="Cerrar detalle"]');
  assert.equal(await evaluate(`document.querySelectorAll('.pw-payment-field button').length`),3);
  await screenshot('compras-recepcion-implementada');
  await evaluate(`document.querySelector('.pw-fields .purchase-invoice-field input').value='F-DEMO';document.querySelector('.pw-fields .purchase-invoice-field input').dispatchEvent(new Event('input',{bubbles:true}))`);await sleep(100);
  await evaluate(`[...document.querySelectorAll('.pw-fields button')].find(b=>b.textContent.trim()==='Guardar para después').click()`);await sleep(200);
  assert.equal(await evaluate(`document.querySelectorAll('.pw-pending .pw-draft').length`),1);
  await evaluate(`document.querySelector('.pw-view-icons button[aria-label="Seguimiento por proveedor"]').click()`);await sleep(200);
  assert.equal(await evaluate(`document.querySelectorAll('.pw-column').length`),3);
  assert.equal(await evaluate(`document.querySelectorAll('.pw-column .pw-draft').length`),1);
  await screenshot('compras-seguimiento-implementado');
  await click('.pw-column .pw-draft');
  assert.equal(await evaluate(`document.querySelector('.purchase-invoice-field input').value`),'F-DEMO');
  await size(390,844);await screenshot('compras-recepcion-movil');
  console.log(await evaluate(`[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,20)`));
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'Mobile overflow');
  assert.deepEqual(errors,[]);
  console.log('PASS: receipt default, local save, board stages, resume, mobile, no runtime errors. Synthetic GET only.');
} finally { ws?.close(); chrome.kill(); server.close(); }
