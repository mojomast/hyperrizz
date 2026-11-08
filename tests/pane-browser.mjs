import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
import puppeteer from 'puppeteer-core';

const [data, project, chrome, python='python3'] = process.argv.slice(2);
if(!chrome)throw Error('Usage: npm run test:pane -- DATA_DIR PROJECT_ID CHROME [PYTHON]');
const root=process.cwd(),bundle=path.join(data,'pane-test.js'),port=18596,key='isolated-pane-test';
await build({entryPoints:['tests/ui/app.js'],bundle:true,format:'esm',outfile:bundle,
  alias:{'@hermes/plugin-sdk':path.join(root,'tests/ui/sdk-harness.js')},define:{'process.env.NODE_ENV':'"production"'}});
const server=spawn(python,['tests/pane_server.py',data,bundle,key,String(port)],{cwd:root,
  env:{PATH:process.env.PATH,HOME:data,LANG:'C.UTF-8'},stdio:['ignore','pipe','pipe']});
let logs='';server.stderr.on('data',d=>logs+=d);server.stdout.on('data',d=>logs+=d);
let browser,page;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,logs);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/plugins/hyperrizz/state`)).status,401);
  const api=async(p,body)=>{
    const response=await fetch(`http://127.0.0.1:${port}/api/plugins/hyperrizz${p}`,{headers:{'X-Test-Key':key,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
    return response.json();
  };
  assert.ok((await api('/action',{tool:'hyperrizz_review',args:{op:'open',project,session_id:'test-chat'}})).ok);
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage',...(process.getuid?.()===0?['--no-sandbox']:[])]});
  page=await browser.newPage();await page.setViewport({width:1100,height:1100,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
  await page.waitForSelector('iframe');
  await page.waitForFunction(()=>document.querySelector('iframe')?.src.startsWith('data:text/html'),{timeout:30000});
  await page.locator('button[aria-label="Play preview"]').click();
  await page.waitForSelector('button[aria-label="Pause preview"]',{timeout:15000});
  await page.locator('button[aria-label="Pause preview"]').click();
  await page.$eval('input[aria-label="Playhead"]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'48');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.type('textarea[aria-label="Frame feedback"]','Let this beat breathe; make the title warmer.');
  await page.locator('button[aria-label="Iterate with Hermes"]').click();
  await page.waitForFunction(()=>window.submitted?.text.includes('Let this beat breathe'));
  const submitted=await page.evaluate(()=>window.submitted);
  assert.equal(submitted.session,'test-chat');assert.ok(submitted.text.includes(project));
  const notes=await api(`/project/${project}`);
  assert.ok(notes.notes.some(n=>n.text==='Let this beat breathe; make the title warmer.'));
  await page.screenshot({path:path.join(data,'pane-review.png'),fullPage:true});
  await page.evaluate(()=>window.switchSession('different-chat'));
  await page.waitForFunction(()=>document.body.innerText.includes('Start with a conversation.'));
  assert.equal(await page.$('iframe'),null,'A different chat must not inherit this project');
  await page.evaluate(()=>window.switchSession('test-chat'));
  await page.waitForSelector('iframe');
  await page.waitForFunction(()=>!document.querySelector('button[aria-label="Play preview"]')?.disabled);
  await page.$eval('input[aria-label="Playhead"]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'648');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.body.innerText.includes('10.80s'));
  await page.screenshot({path:path.join(data,'pane-replay.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(data,'pane-test.json'),JSON.stringify({ok:true,host:'SDK harness with real REST backend',feedback:submitted,sessionIsolation:true,unauthenticatedRejected:true,errors},null,2));
  console.log('PASS: actual player + pane controls + durable frame feedback + addressed composer submission + session isolation + authenticated routes');
}catch(e){if(page){console.error(await page.evaluate(()=>({text:document.body.innerText,calls:window.calls})));await page.screenshot({path:path.join(data,'pane-failure.png'),fullPage:true});}console.error(logs);throw e;}
finally{if(browser)await browser.close();server.kill('SIGTERM');}
