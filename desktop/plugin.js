import React, {useEffect, useRef, useState} from 'react';
import {host, useValue, SandboxedFrame, captureGatewayFileDownload} from '@hermes/plugin-sdk';

const h = React.createElement;
const C = {bg:'#111317',panel:'#191d23',line:'#303640',text:'#f4f0e8',muted:'#9fa8b7',accent:'#e8b968'};
const button = {border:`1px solid ${C.line}`,background:C.panel,color:C.text,borderRadius:8,padding:'8px 12px',cursor:'pointer',font:'inherit'};
const field = {...button,width:'100%',boxSizing:'border-box',textAlign:'left'};
const row = {display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'};
const errorText = error => error?.message || String(error);
const checked = value => { if(!value?.ok) throw Error(value?.error || 'Hyperrizz backend unavailable'); return value; };

function StudioView({ctx, project, onError, reconnect}) {
  const [image, setImage] = useState(null), [state, setState] = useState('Connecting to Studio…');
  const lastMove = useRef(0);
  const queue = useRef(Promise.resolve()), active = useRef(true), surface = useRef(null), url = useRef(null);
  useEffect(() => {
    active.current=true;
    let timer;
    async function refresh() {
      try {
        const value = checked(await ctx.rest(`/studio/${project}/frame`,{method:'POST',body:{},timeoutMs:20000}));
        if(!active.current)return;
        const bytes=Uint8Array.from(atob(value.image),c=>c.charCodeAt(0));
        const next=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
        if(url.current)URL.revokeObjectURL(url.current);url.current=next;setImage(next);setState('Live editor · input connected');
      } catch(e) { if(active.current){setState(errorText(e));onError(e);} }
      if(active.current)timer=setTimeout(refresh,180);
    }
    refresh();
    return()=>{active.current=false;clearTimeout(timer);if(url.current)URL.revokeObjectURL(url.current);};
  },[ctx,project]);
  function input(body) {
    queue.current=queue.current.then(()=>ctx.rest(`/studio/${project}/input`,{method:'POST',body})).then(checked).catch(e=>{if(active.current)onError(e);});
  }
  function pointer(e,action) {
    if(action==='move'&&!e.buttons)return;
    if(action==='move'&&performance.now()-lastMove.current<65)return;
    if(action==='move')lastMove.current=performance.now();
    e.preventDefault();surface.current.focus();
    const rect=e.currentTarget.getBoundingClientRect();
    if(action==='down')e.currentTarget.setPointerCapture(e.pointerId);
    input({kind:'pointer',action,x:Math.max(0,Math.min(1280,(e.clientX-rect.left)/rect.width*1280)),y:Math.max(0,Math.min(800,(e.clientY-rect.top)/rect.height*800)),button:e.button===2?'right':'left'});
  }
  return h('section',{},h('div',{style:row},h('p',{style:{color:C.muted,fontSize:12,flex:1}},state),h('button',{style:button,onClick:reconnect},'Reconnect')),
    h('div',{ref:surface,tabIndex:0,role:'application','aria-label':'Interactive HyperFrames Studio',style:{outline:`1px solid ${C.line}`,borderRadius:8,overflow:'hidden'},
      onKeyDown:e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')return;e.preventDefault();input({kind:'key',action:'down',key:e.key});},
      onKeyUp:e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')return;e.preventDefault();input({kind:'key',action:'up',key:e.key});},
      onPaste:e=>{e.preventDefault();input({kind:'text',text:e.clipboardData.getData('text').slice(0,4000)});},onBlur:()=>input({kind:'release'}),
      onWheel:e=>{input({kind:'wheel',x:e.deltaX,y:e.deltaY});},onContextMenu:e=>e.preventDefault()},
      image?h('img',{src:image,alt:'Live HyperFrames Studio',draggable:false,style:{display:'block',width:'100%',aspectRatio:'1280/800',touchAction:'none'},
        onPointerDown:e=>pointer(e,'down'),onPointerUp:e=>pointer(e,'up'),onPointerMove:e=>pointer(e,'move')}):h('div',{style:{padding:40}},'Starting the real editor…')),
    h('p',{style:{color:C.muted,fontSize:12}},'Click, drag, type or paste into Studio. Sound plays in Review. Keep your edits before switching back.'));
}

function Pane({ctx}) {
  const session = useValue(host.state.focusedSessionId);
  const [projects,setProjects]=useState([]),[id,setId]=useState(null),[project,setProject]=useState(null);
  const [preview,setPreview]=useState(null),[loading,setLoading]=useState(''),[error,setError]=useState('');
  const [time,setTime]=useState(0),[paused,setPaused]=useState(true),[note,setNote]=useState(''),[mode,setMode]=useState('review');
  const [busy,setBusy]=useState(false),[chosenRevision,setChosenRevision]=useState(null),[toast,setToast]=useState('');
  const [reviewSettings,setReviewSettings]=useState(null),[runtimeReady,setRuntimeReady]=useState(false);
  const frame = useRef(null), generation=useRef(0),lastTime=useRef(0),seekOnReady=useRef(null),previewHTML=useRef(null);
  const selectionVersion=useRef(0),drafts=useRef(new Map()),noteOwner=useRef(''),noteValue=useRef(note);
  noteValue.current=note;
  lastTime.current=time;
  const revision=chosenRevision||project?.revision;
  const settings=reviewSettings&&reviewSettings.project===id&&reviewSettings.revision===revision?reviewSettings.settings:project?.settings;
  const fps=settings?.fps||30, frames=settings?.scenes?.reduce((n,s)=>n+s.frames,0)||1;
  const currentFrame=Math.min(frames-1,Math.max(0,Math.round(time*fps)));
  const api=async(path,opts)=>checked(await ctx.rest(path,opts));
  const act=async(tool,args)=>api('/action',{method:'POST',body:{tool,args},timeoutMs:60000});
  const fail=e=>setError(errorText(e));
  const command=(type,rest={})=>frame.current?.contentWindow?.postMessage({channel:'hyperrizz-review',type,...rest},'*');

  useEffect(()=>{
    const key=`${session}:${id}`;
    if(noteOwner.current)drafts.current.set(noteOwner.current,noteValue.current);
    noteOwner.current=key;setNote(drafts.current.get(key)||'');
  },[session,id]);

  useEffect(()=>{
    let live=true,timer;
    setId(null);setProject(null);setPreview(null);setMode('review');setChosenRevision(null);setError('');
    async function refresh(){
      const version=selectionVersion.current;
      try{
        const state=await api(`/state?session=${encodeURIComponent(session||'')}`);
        if(!live)return;setProjects(state.projects);
        if(state.selected&&version===selectionVersion.current){setId(state.selected);const p=await api(`/project/${state.selected}`);if(live&&version===selectionVersion.current)setProject(p);}
      }catch(e){if(live)fail(e);}
      if(live)timer=setTimeout(refresh,1800);
    }
    refresh();return()=>{live=false;clearTimeout(timer);};
  },[session,ctx]);

  useEffect(()=>{
    if(!id||!revision||mode!=='review')return;
    const gen=++generation.current;setLoading('Loading live composition…');setError('');setPreview(null);setRuntimeReady(false);previewHTML.current=null;seekOnReady.current=lastTime.current;
    let disposed=false;
    (async()=>{
      const info=await api(`/preview/${id}/${revision}`),parts=[];
      if(disposed)return;setReviewSettings({project:id,revision,settings:info.settings});
      for(let i=0;i<Math.ceil(info.bytes/info.chunk_bytes);i++){
        const part=await api(`/preview/${id}/${revision}/${i}`);
        if(disposed||gen!==generation.current)return;
        parts.push(Uint8Array.from(atob(part.data),c=>c.charCodeAt(0)));
        setLoading(`Loading live composition · ${Math.min(100,Math.round((i+1)*info.chunk_bytes/info.bytes*100))}%`);
      }
      const bytes=new Uint8Array(info.bytes);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
      // SandboxedFrame supports data documents on both native Desktop and Webapp.
      const html=new TextDecoder().decode(bytes);
      if(!disposed){previewHTML.current=html;setPreview('data:text/html;charset=utf-8,'+encodeURIComponent(info.shell));setLoading('');}
    })().catch(e=>{if(!disposed){fail(e);setLoading('');}});
    return()=>{disposed=true;};
  },[ctx,id,revision,mode]);

  useEffect(()=>{
    function message(e){
      if(e.source!==frame.current?.contentWindow)return;
      if(e.data?.channel==='hyperrizz-bootstrap'&&e.data.type==='ready'){
        if(previewHTML.current)e.source.postMessage({channel:'hyperrizz-bootstrap',html:previewHTML.current},'*');return;
      }
      if(e.data?.channel!=='hyperrizz-review')return;
      if(e.data.type==='state'){
        if(seekOnReady.current!==null){if(e.data.ready){const t=seekOnReady.current;seekOnReady.current=null;command('seek',{time:Math.min(t,Math.max(0,e.data.duration-.001))});setRuntimeReady(true);}return;}
        if(Number.isFinite(e.data.time))setTime(e.data.time);setPaused(!!e.data.paused);
      }
      if(e.data.type==='error')setError(e.data.message);
    }
    window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
  },[]);

  async function action(fn){setBusy(true);setError('');try{await fn();}catch(e){fail(e);}finally{setBusy(false);}}
  async function bind(next){
    if(!session)throw Error('Open a Hermes conversation before choosing a film.');
    selectionVersion.current++;
    await act('hyperrizz_review',{op:'open',project:next,session_id:session});
    setId(next);setProject(await api(`/project/${next}`));setChosenRevision(null);setMode('review');setTime(0);
  }
  async function feedback(send){
    if(!note.trim())return;
    const captured={project:id,revision,frame:currentFrame,text:note,session};
    const saved=await act('hyperrizz_review',{op:'note',...captured});
    setNote('');setToast(`Note saved at ${time.toFixed(2)}s`);
    if(send){
      const prompt=`Revise Hyperrizz project ${captured.project}, revision ${captured.revision}, frame ${captured.frame} (${(captured.frame/fps).toFixed(3)}s). Review note ${saved.note_id}: ${captured.text}\nRead the current source and feedback, make the edit, rebuild the live preview, and resolve the note after checking the result.`;
      if(!host.composer.submit(captured.session,prompt))setToast('Note saved. Open this conversation and ask Hermes to review the pending Hyperrizz notes.');
      else setToast('Sent to Hermes · the preview updates after the next successful build');
    }
  }
  const openNotes=project?.notes?.filter(n=>!n.resolved)||[];
  return h('div',{style:{height:'100%',overflow:'auto',background:C.bg,color:C.text,fontFamily:'system-ui,sans-serif',fontSize:13,padding:16,boxSizing:'border-box'}},
    h('header',{style:{...row,justifyContent:'space-between',marginBottom:16}},
      h('div',{},h('div',{style:{fontSize:11,letterSpacing:3,color:C.accent,fontWeight:700}},'HYPERRIZZ'),h('h2',{style:{fontSize:21,letterSpacing:-.6,margin:'5px 0'}},'Your film. In motion.')),
      h('span',{style:{color:C.muted,fontSize:11}},'LIVE PROJECT')),
    h('div',{style:row},h('select',{'aria-label':'Project',value:id||'',style:{...field,flex:1,width:'auto'},onChange:e=>action(()=>bind(e.target.value))},
      h('option',{value:''},'Choose a project'),...projects.map(p=>h('option',{key:p.id,value:p.id},p.title))),
      h('button',{style:button,disabled:busy||!session,onClick:()=>action(async()=>{const p=await act('hyperrizz_project',{op:'create',title:'New film',template:'starter'});await bind(p.project);})},'New film')),
    error&&h('div',{role:'alert',style:{marginTop:12,padding:12,border:'1px solid #865258',background:'#2a1e24',borderRadius:8}},error),
    !project?h('section',{style:{padding:'48px 10px',textAlign:'center'}},h('div',{style:{color:C.accent,fontSize:36}},'↗'),
      h('h3',{},'Start with a conversation.'),h('p',{style:{color:C.muted,lineHeight:1.7}},'Tell Hermes what you want to make. It handles the direction, scenes, motion and checks. Your live film appears here before an MP4 is rendered.'),
      h('button',{style:{...button,borderColor:C.accent},disabled:!session,onClick:()=>host.composer.insertText(session,'Use Hyperrizz to make a film about ',{mode:'block'})},'Describe your film')):
    h(React.Fragment,{},
      h('div',{style:{...row,justifyContent:'space-between',margin:'16px 0 10px'}},
        h('span',{style:{color:C.muted,fontSize:12}},`r${revision||0} · ${project.settings.width} × ${project.settings.height} · ${fps} fps${project.dirty?' · source changed':''}`),
        h('div',{style:row},h('button',{style:{...button,color:mode==='review'?C.accent:C.text},disabled:busy||mode==='review',onClick:()=>action(async()=>{await act('hyperrizz_review',{op:'close_editor',project:id});setProject(await api(`/project/${id}`));setMode('review');setChosenRevision(null);})},mode==='studio'?'Keep edits & review':'Review'),
          h('button',{style:button,disabled:busy||!!project.active_job||mode==='studio',onClick:()=>action(async()=>{command('pause');await act('hyperrizz_review',{op:'editor',project:id});setMode('studio');})},'Full editor ↗'))),
      mode==='studio'?h(StudioView,{ctx,project:id,onError:fail,reconnect:()=>action(()=>act('hyperrizz_review',{op:'editor',project:id}))}):h('div',{style:{aspectRatio:`${settings.width}/${settings.height}`,background:'#080a0d',border:`1px solid ${C.line}`,borderRadius:12,overflow:'hidden',position:'relative'}},
        preview?h(SandboxedFrame,{ref:frame,src:preview,title:`${project.title} live composition`,style:{width:'100%',height:'100%',border:0}}):
          h('div',{role:'status',style:{position:'absolute',inset:0,display:'grid',placeContent:'center',color:C.muted}},loading||project.active_job?.stage||'Preparing your first preview…')),
      mode==='review'&&h('div',{style:{...row,margin:'10px 0'}},
        h('button',{style:button,disabled:!runtimeReady,'aria-label':paused?'Play preview':'Pause preview',onClick:()=>command(paused?'play':'pause')},paused?'▶ Play':'Ⅱ Pause'),
        h('button',{style:button,disabled:!preview,'aria-label':'Previous frame',onClick:()=>command('seek',{time:Math.max(0,currentFrame-1)/fps})},'−1f'),
        h('input',{type:'range','aria-label':'Playhead',min:0,max:frames-1,step:1,value:currentFrame,style:{flex:1,minWidth:70,accentColor:C.accent},onChange:e=>{setTime(Number(e.target.value)/fps);command('seek',{time:Number(e.target.value)/fps});}}),
        h('span',{style:{fontFamily:'monospace',fontSize:12}},`${time.toFixed(2)}s`),
        h('button',{style:button,disabled:!preview,'aria-label':'Next frame',onClick:()=>command('seek',{time:Math.min(frames-1,currentFrame+1)/fps})},'+1f')),
      project.active_job&&h('div',{role:'status',style:{...row,padding:12,background:C.panel,borderRadius:8}},
        h('span',{style:{flex:1}},`◌ ${project.active_job.stage}`),h('button',{style:button,onClick:()=>action(()=>act('hyperrizz_produce',{op:'cancel',job:project.active_job.id}))},'Cancel')),
      !project.active_job&&project.jobs?.[0]?.status==='failed'&&h('div',{role:'alert',style:{padding:12,color:'#eeaca2'}},`Last job failed: ${project.jobs[0].stage}. The previous preview is still available.`),
      mode==='review'&&h('section',{style:{marginTop:18}},
        h('div',{style:{...row,justifyContent:'space-between',marginBottom:8}},h('strong',{},'Shape the next cut'),h('span',{style:{fontSize:11,color:C.muted}},`FRAME ${currentFrame} · r${revision||0}`)),
        h('textarea',{'aria-label':'Frame feedback',placeholder:'“Hold this title longer.” “Try a warmer palette.” “Make this transition quieter.”',value:note,maxLength:4000,rows:3,style:{...field,resize:'vertical',lineHeight:1.6},onChange:e=>setNote(e.target.value)}),
        h('div',{style:{...row,marginTop:8}},h('button',{'aria-label':'Iterate with Hermes',style:{...button,background:C.accent,color:'#191512',fontWeight:650},disabled:busy||!note.trim()||!revision||!session,onClick:()=>action(()=>feedback(true))},'Iterate with Hermes ↗'),
          h('button',{style:button,disabled:busy||!note.trim()||!revision,onClick:()=>action(()=>feedback(false))},'Save note'),
          h('span',{role:'status',style:{color:C.muted,fontSize:11}},toast))),
      openNotes.length>0&&h('details',{style:{marginTop:14}},h('summary',{style:{cursor:'pointer',color:C.muted}},`${openNotes.length} open review note${openNotes.length===1?'':'s'}`),
        ...openNotes.map(n=>h('div',{key:n.id,style:{padding:10,borderBottom:`1px solid ${C.line}`}},h('button',{style:{...button,fontSize:11},onClick:()=>{setChosenRevision(n.revision);setTime(n.frame/fps);command('seek',{time:n.frame/fps});}},`r${n.revision} · ${(n.frame/fps).toFixed(2)}s`),h('p',{},n.text)))),
      h('footer',{style:{...row,marginTop:22,paddingTop:14,borderTop:`1px solid ${C.line}`}},
        h('select',{'aria-label':'Revision',value:chosenRevision||'',style:{...button,maxWidth:140},onChange:e=>setChosenRevision(Number(e.target.value)||null)},h('option',{value:''},'Latest revision'),...(project.revisions||[]).map(r=>h('option',{key:r.number,value:r.number},`r${r.number} · ${r.kind}`))),
        h('button',{style:button,disabled:busy||!!project.active_job||mode==='studio',onClick:()=>action(()=>act('hyperrizz_produce',{op:'build',project:id}))},'Rebuild'),
        chosenRevision&&chosenRevision!==project.revision&&h('button',{style:button,disabled:busy||!!project.active_job||mode==='studio',onClick:()=>action(async()=>{await act('hyperrizz_project',{op:'restore',project:id,revision:chosenRevision});setProject(await api(`/project/${id}`));setChosenRevision(null);})},'Make this current'),
        h('button',{style:{...button,marginLeft:'auto',borderColor:C.accent},disabled:busy||!!project.active_job||project.dirty||!revision||mode==='studio'||!!(chosenRevision&&chosenRevision!==project.revision),onClick:()=>action(()=>act('hyperrizz_produce',{op:'render',project:id}))},'Render MP4'),
        project.export&&h('button',{style:button,onClick:()=>action(async()=>{const save=captureGatewayFileDownload();const file=await api(`/export/${id}`);await save(file.path,file.name);})},project.export.current?'Download MP4':'Download prior MP4')),
      h('p',{style:{color:C.muted,fontSize:11,lineHeight:1.5}},mode==='studio'?'Full Studio edits are preserved as their own revision. Hermes reconciles them before rebuilding source.':'Live HTML / canvas / audio. Rendering is only needed for delivery.')));
}

export default {id:'hyperrizz',name:'Hyperrizz',register(ctx){
  ctx.register({id:'review',area:'panes',title:'Hyperrizz',data:{placement:'right',width:'600px'},render:()=>h(Pane,{ctx})});
}};
