// Transparent SDK transport harness: actual plugin bundle + actual backend,
// simulated host session/composer. This is not a claim of Electron/LLM acceptance.
import React,{useState,useEffect,forwardRef} from 'react';
const listeners=new Set();
const atom={get:()=>window.testSession||'test-chat',subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
export const host={state:{focusedSessionId:atom},composer:{
  submit:(session,text)=>{window.submitted={session,text};return true;},
  insertText:async(session,text)=>{window.inserted={session,text};return true;}
}};
export function useValue(value){const [v,set]=useState(value.get());useEffect(()=>value.subscribe(()=>set(value.get())),[value]);return v;}
export const SandboxedFrame=forwardRef((props,ref)=>React.createElement('iframe',{ref,src:props.src,title:props.title,sandbox:'allow-scripts',referrerPolicy:'no-referrer',style:props.style}));
export function captureGatewayFileDownload(){return async(path,name)=>{window.download={path,name};};}
export function switchSession(id){window.testSession=id;for(const fn of listeners)fn();}
