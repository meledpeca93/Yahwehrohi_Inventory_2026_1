// Isolated browser review. Serves only the compiled frontend and synthetic GET responses.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import os from 'node:os';
const root = path.resolve('dist/YahwehRohi-Inventory/browser');
const out = path.resolve('output/ui-concepts');
const rows = Array.from({ length: 36 }, (_, i) => ({ invoiceId: 1086-i, customerName: ['María López', 'Carlos Reyes', 'Consumidor final', 'Rosa Mejía'][i%4], customerPhone: '9999-1234', itemCount: 7, userName: i%2 ? 'Luis' : 'Ana', total: 1250+i*10, subtotal: 1250+i*10, createdAt: new Date(2026,8,25,14-Math.floor(i/6),32-i%6).toISOString(), paymentTypeId: i%3+1, paymentTypeName: ['Efectivo','Crédito','Transferencia'][i%3], statusName: i===3 ? 'Anulado' : 'Cerrado', linesCount: 3, annulledLines: i===3 ? 3 : 0 }));
const server = http.createServer((req,res) => {
  if (req.url.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET') { res.writeHead(403); res.end('{}'); return; }
    const body = req.url === '/api/invoices' ? { invoices: rows }
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
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Facturas').click()`); await sleep(1200);
  await evaluate(`(()=>{const s=document.querySelector('.dashboard-actions app-date-picker input');s.value='2026-09-25';s.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(300);
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-select-button').length`),10);
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'Desktop page overflow');
  await click('.invoice-select-button'); await sleep(300);
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-preview-lines li').length`),3);
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-trend-card .chart-expand-button').length`),0);
  const toolbar = await evaluate(`(()=>{const controls=[...document.querySelectorAll('.invoice-filter-bar select,.invoice-filter-bar .yr-row-density button')];const ys=controls.map(e=>e.getBoundingClientRect().top);const pager=document.querySelector('.invoices-table-card .yr-inventory-pagination');const nav=pager.querySelector('nav').getBoundingClientRect();const box=pager.getBoundingClientRect();return {filterSpread:Math.max(...ys)-Math.min(...ys),pagerOffset:Math.abs((nav.left+nav.width/2)-(box.left+box.width/2)),analysisHeight:document.querySelector('.invoice-analysis-strip').getBoundingClientRect().height,collapseText:document.querySelector('.invoices-table-card .invoice-section-toggle').textContent.trim()}})()`);
  console.log('Toolbar diagnostics',toolbar,await evaluate(`[...document.querySelectorAll('.invoice-filter-bar select,.invoice-filter-bar .yr-row-density button')].map(e=>({tag:e.tagName,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}))`));
  await screenshot('facturas-controles-revision');
  assert.ok(toolbar.filterSpread < 2, 'Filter controls share one row');
  assert.ok(toolbar.pagerOffset < 2, 'Pagination is centered');
  assert.ok(toolbar.analysisHeight < 215, 'Analysis stays compact');
  assert.equal(toolbar.collapseText, '');
  console.log('Toolbar',toolbar);
  await screenshot('facturas-implementado-escritorio');
  await click('.invoice-preview-secondary'); assert.equal(await evaluate(`!!document.querySelector('.invoice-detail-modal')`),true);
  await click('.invoice-detail-close-button'); await click('.yr-summary-toggle');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.invoice-analysis-strip')).display`),'none');
  await click('.yr-summary-toggle'); await select('.inventory-pagination select','25');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-select-button').length`),25);
  await select('.invoice-grouping-control select','payment');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-day-group-row').length`),1);
  await click('.invoice-day-group-row button');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-payment-group-row').length`),3);
  await select('.invoice-grouping-control select','none'); await select('.inventory-pagination select','10');
  await click('.invoice-monthly-sales-card .invoice-section-toggle');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-monthly-sales-table tbody tr').length`),10);
  await click('.invoice-monthly-sales-card [aria-label="Última página"]');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-monthly-sales-table tbody tr').length`),2);
  await select('.invoice-month-count-select select','3');
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-monthly-sales-table tbody tr').length`),3);
  assert.equal(await evaluate(`document.querySelector('.invoice-monthly-sales-card nav strong').textContent.trim()`),'1 / 1');
  await click('.invoice-monthly-toolbar [aria-label="Filas amplias"]');
  assert.equal(await evaluate(`document.querySelector('.invoice-monthly-sales-wrap').dataset.density`),'spacious');
  await evaluate(`document.querySelector('.invoice-monthly-sales-card').scrollIntoView()`);
  await screenshot('facturas-mensual-controles');
  await size(390,844); await evaluate('window.scrollTo(0,0)');
  const mobile = await evaluate(`({width:document.documentElement.scrollWidth,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,tableWidth:document.querySelector('.invoice-master-wrap').clientWidth,tableScroll:document.querySelector('.invoice-master-wrap').scrollWidth,contain:getComputedStyle(document.querySelector('.invoice-master-wrap')).contain})`);
  console.log('Mobile',mobile); await screenshot('facturas-implementado-movil');
  assert.equal(mobile.overflow,false,'Mobile page overflow');
  await evaluate(`document.querySelector('.invoice-preview-panel').scrollIntoView()`); await screenshot('facturas-implementado-movil-detalle');
  await evaluate(`(()=>{const s=document.querySelector('.invoice-search-input input');s.value='ninguno';s.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(200);
  assert.equal(await evaluate(`!!document.querySelector('.invoice-preview-panel')`),false);
  assert.equal(await evaluate(`document.querySelectorAll('.invoice-select-button').length`),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile, preview, full detail, icon collapse, aligned filters, centered pagination, compact chart, monthly pagination/density, grouping, empty search; no runtime errors.');
} finally { ws?.close(); chrome.kill(); server.close(); }
