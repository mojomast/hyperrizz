import {vhsGLSL} from './vhs.glsl.js';
import {clamp} from './timing.js';

// One current-frame texture. No framebuffer history or accumulated simulation.
export function createCRT(canvas, source, {fps = 60, seed = 1996} = {}) {
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(seed)) throw Error('Invalid CRT clock/seed');
  const gl = canvas.getContext('webgl2', {alpha: false, antialias: false, preserveDrawingBuffer: true});
  if (!gl) throw Error('Broadcast treatment requires WebGL2; no silent fallback.');
  const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
  const fragment = `#version 300 es
precision highp float;
in vec2 uv; out vec4 outColor;
uniform sampler2D screenTexture;
uniform vec2 uResolution;
uniform float uTime,uFrame,uIntensity,uSeed,uStatic,uCollapse;
${vhsGLSL}
void main(){
  vec3 black=vec3(.006,.005,.009);
  if(uCollapse>=1.){outColor=vec4(black,1.);return;}
  if(uIntensity<=0. && uStatic<=0. && uCollapse<=0.){outColor=texture(screenTexture,uv);return;}
  vec2 p=uv*2.-1.;
  float halfHeight=max(.002,1.-smoothstep(0.,.83,uCollapse));
  float halfWidth=1.-smoothstep(.82,1.,uCollapse);
  if(abs(p.y)>halfHeight || abs(p.x)>halfWidth){outColor=vec4(black,1.);return;}
  if(uCollapse>.84){outColor=vec4(vec3(.97,.96,.87)*(1.-smoothstep(.97,1.,uCollapse)),1.);return;}
  p.y/=halfHeight;
  vec2 q=p*(1.+.043*uIntensity*vec2(p.y*p.y,p.x*p.x));
  vec2 st=tapeUV(q*.5+.5);
  if(any(lessThan(st,vec2(0.)))||any(greaterThan(st,vec2(1.)))){outColor=vec4(black,1.);return;}
  vec2 px=1./uResolution;
  float bleed=1.5*uIntensity;
  vec3 c=vec3(texture(screenTexture,st+vec2(px.x*bleed,0.)).r,texture(screenTexture,st).g,texture(screenTexture,st-vec2(px.x*bleed,0.)).b);
  vec3 glow=texture(screenTexture,st+px*vec2(3.,0.)).rgb+texture(screenTexture,st-px*vec2(3.,0.)).rgb;
  glow+=texture(screenTexture,st+px*vec2(0.,3.)).rgb+texture(screenTexture,st-px*vec2(0.,3.)).rgb;
  c+=max(glow*.25-.52,0.)*.24*uIntensity;
  c=mix(c,texture(screenTexture,st-vec2(.004,0.)).rgb,.035*uIntensity);
  c*=1.-.16*uIntensity*(.5+.5*sin(st.y*uResolution.y*3.14159265));
  float cell=mod(floor(gl_FragCoord.x),3.);
  vec3 phosphor=cell<1.?vec3(1.,.83,.83):(cell<2.?vec3(.83,1.,.83):vec3(.83,.83,1.));
  c*=mix(vec3(1.),phosphor,.28*uIntensity);
  c=tapeColor(st,c);
  c=mix(c,channelStatic(st),uStatic);
  c*=1.-.21*uIntensity*pow(length(p)*.68,3.);
  c+=.008*uIntensity;
  outColor=vec4(c,1.);
}`;
  const shaders = [];
  let program, buffer, texture, disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
  };
  const compile = (kind, code) => {
    const shader = gl.createShader(kind); shaders.push(shader);
    gl.shaderSource(shader, code); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'screenTexture'), 0);
    const uniforms = Object.fromEntries(['uResolution','uTime','uFrame','uIntensity','uSeed','uStatic','uCollapse'].map(k => [k, gl.getUniformLocation(program, k)]));
    return {
      draw({frame, intensity = 0.7, burst = 0, collapse = 0}) {
        if (disposed || gl.isContextLost()) throw Error('CRT context is unavailable');
        if (!Number.isInteger(frame) || frame < 0 || ![intensity, burst, collapse].every(Number.isFinite)) throw Error('Invalid CRT frame/controls');
        gl.useProgram(program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.uniform2f(uniforms.uResolution, source.width, source.height);
        gl.uniform1f(uniforms.uFrame, frame); gl.uniform1f(uniforms.uTime, frame / fps);
        gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uIntensity, clamp(intensity));
        gl.uniform1f(uniforms.uStatic, clamp(burst)); gl.uniform1f(uniforms.uCollapse, clamp(collapse));
        gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.finish();
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
