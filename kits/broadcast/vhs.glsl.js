// Adapted from Hermagotchi Television; see NOTICE.md and LICENSE.
// Noise is stateless within a fixed browser/GPU, not guaranteed cross-GPU identical.
export const vhsGLSL = `
float noiseAt(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
vec2 tapeUV(vec2 p) {
  float line=floor(p.y*uResolution.y*.5);
  float jitter=sin(p.y*37.+uTime*1.3)*.00065;
  float tracking=smoothstep(.94,.99,p.y)*(noiseAt(vec2(line,uFrame))-.5)*.016;
  p.x+=(jitter+tracking)*uIntensity;
  return p;
}
vec3 tapeColor(vec2 p,vec3 color) {
  float dropout=step(.9985,noiseAt(vec2(floor(p.y*uResolution.y*.5),floor(uFrame/3.))));
  color+=dropout*uIntensity*.15;
  float hum=exp(-pow((fract(p.y-uTime*.042)-.5)*19.,2.));
  color*=1.-hum*.08*uIntensity;
  float head=smoothstep(.958,.987,p.y);
  return mix(color,vec3(noiseAt(vec2(floor(p.x*uResolution.x*.24),uFrame))),head*.2*uIntensity);
}
vec3 channelStatic(vec2 p) {
  float n=noiseAt(floor(p*uResolution/3.)+vec2(uFrame*17.,uFrame*3.));
  float band=sin(p.y*130.+uFrame*2.)*.12;
  return vec3(clamp(n*.85+band,0.,1.));
}`;
