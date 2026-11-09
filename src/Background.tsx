import { useEffect, useRef } from "react";

// Slow monochrome smoke with a vignette and film grain, drawn on one full-screen triangle.
const FRAGMENT = `
precision highp float;
uniform vec2 r;
uniform float t;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = (gl_FragCoord.xy - 0.5 * r) / min(r.x, r.y) * 0.9;
  p += 0.316 * vec2(sin(t * 0.31), cos(t * 0.23));
  // Warp the plane, then cut it into broad ribbons.
  vec2 w = vec2(fbm(p + 3.1), fbm(p + vec2(5.2, 1.3)));
  float n = fbm(p * 0.8 + 2.4 * w + t * 0.03);
  float ribbon = 0.5 + 0.5 * sin(n * 14.0);
  float v = smoothstep(0.42, 1.0, ribbon);
  float lum = 0.36 * v;
  lum *= 1.0 - 0.61 * smoothstep(0.35, 1.0, length(uv - 0.5) * 1.41421356);
  // Grain scales with brightness, so the ribbons dissolve into stipple at their edges and black stays black.
  lum += (hash(gl_FragCoord.xy + 7.0) - 0.5) * (0.02 + 1.3 * lum);
  vec3 col = vec3(lum);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
const VERTEX = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";

export function Background({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", { antialias: false });
    if (!canvas || !gl) return; // no WebGL: the plain black body shows through
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const uSize = gl.getUniformLocation(program, "r");
    const uTime = gl.getUniformLocation(program, "t");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      frame = still ? 0 : requestAnimationFrame(draw);
      if (document.hidden || now - last < 33) return; // 30 fps is plenty for a slow drift
      last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uSize, w, h);
      gl.uniform1f(uTime, ((now - start) / 1000) * 0.594);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} aria-hidden className={className} style={{ display: "block", width: "100%", height: "100%" }} />;
}
