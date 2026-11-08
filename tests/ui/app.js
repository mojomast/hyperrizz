import React from 'react';
import {createRoot} from 'react-dom/client';
import plugin from '../../desktop/plugin.js';
import {switchSession} from './sdk-harness.js';
window.switchSession=switchSession;
window.calls=[];
const ctx={register:contribution=>createRoot(document.getElementById('pane')).render(contribution.render()),
  rest:async(path,opts={})=>{
    window.calls.push(path);
    const response=await fetch('/api/plugins/hyperrizz'+path,{method:opts.method||'GET',headers:{'Content-Type':'application/json','X-Test-Key':window.testKey},...(opts.body?{body:JSON.stringify(opts.body)}:{})});
    if(!response.ok)throw Error(`Backend HTTP ${response.status}`);
    return response.json();
  }};
plugin.register(ctx);
