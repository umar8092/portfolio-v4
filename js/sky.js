// The sky: a terminal-ceiling dome where every catalog app is a gold star and every case study is a constellation.
// One WebGL canvas behind the page; crisp text and logos live in a DOM layer positioned from the 3D scene.
import * as THREE from "three";

// hex colours go straight to the shaders as sRGB, the way they are written in the CSS
THREE.ColorManagement.enabled = false;

const R = 100, D2R = Math.PI / 180, TAU = Math.PI * 2;
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));
const rng = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const dirLL = (lon, lat, out = new THREE.Vector3()) => out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));

export const PALETTES = {
  night: { top: "#17494F", bottom: "#061A1F", grid: "#E2B663", gridA: .12, bandA: .5, dim: "#03151A", noise: .17,
    star: "#F0CB7F", core: "#FFF8E6", line: "#E2B663", hi: "#FFF3D0", dust: "#BFDAD5", additive: true },
  day: { top: "#F4F8F6", bottom: "#D2E0DD", grid: "#0D2D33", gridA: .09, bandA: .42, dim: "#EBF1EF", noise: .09,
    star: "#163C42", core: "#8E5C0F", line: "#8E5C0F", hi: "#D0912A", dust: "#5E7776", additive: false }
};

const NOISE = `
float h3(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`;

// eight-point star: four long rays, four short, a bright core; optional atlas ring
const STAR_FRAG = `
uniform vec3 uStar, uCore; uniform float uRing;
varying float vA, vFoc, vRing;
void main(){
  vec2 u=gl_PointCoord-.5; float d=length(u); float a=atan(u.y,u.x);
  float r=.13+.31*pow(abs(cos(2.*a)),24.)+.13*pow(abs(cos(2.*a+1.5708)),24.);
  float s=1.-smoothstep(r-.035,r+.02,d);
  float core=exp(-d*d*150.);
  float rr=max(vFoc,vRing*uRing);
  float ring=rr*(1.-smoothstep(.012,.032,abs(d-.43)));
  float al=(max(s,core)+ring)*vA;
  if(al<.012) discard;
  gl_FragColor=vec4(mix(uStar,uCore,core),clamp(al,0.,1.));
}`;

export function createSky({ canvas, ui, top, catalog, projects, logo, reduced = false, coarse = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const DPR = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 600);
  let pal = PALETTES.night;
  const col = h => new THREE.Color(h);

  // ---------- the painted dome ----------
  const bandAxis = new THREE.Vector3(0, Math.cos(14 * D2R), Math.sin(14 * D2R)).normalize();
  const BAND_LAT = 31 * D2R;
  const domeU = {
    uTop: { value: col(pal.top) }, uBottom: { value: col(pal.bottom) }, uGrid: { value: col(pal.grid) }, uDimCol: { value: col(pal.dim) },
    uGridA: { value: pal.gridA }, uBandA: { value: pal.bandA }, uDim: { value: 0 }, uReveal: { value: reduced ? 1 : 0 }, uNoise: { value: pal.noise },
    uAxis: { value: bandAxis }, uBand: { value: Math.sin(BAND_LAT) }
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 96, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, uniforms: domeU,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP;
      uniform vec3 uTop,uBottom,uGrid,uDimCol,uAxis; uniform float uGridA,uBandA,uDim,uReveal,uNoise,uBand;
      ${NOISE}
      void main(){
        vec3 p=normalize(vP); float lat=asin(clamp(p.y,-1.,1.)), lon=atan(p.z,p.x);
        vec3 sky=mix(uBottom,uTop,smoothstep(-.3,.95,p.y));
        float pl=n3(p*6.)*.5+n3(p*17.)*.3+n3(p*47.)*.2; sky*=1.+(pl-.5)*uNoise;
        float gl=lon/0.261799, gt=lat/0.261799;
        float wl=fwidth(gl), wt=fwidth(gt);
        float fl=abs(fract(gl)-.5), ft=abs(fract(gt)-.5);
        float lonL=smoothstep(.5-wl*1.25,.5,fl)*smoothstep(1.32,1.12,abs(lat));
        float latL=smoothstep(.5-wt*1.25,.5,ft);
        float grid=max(lonL,latL);
        float e=dot(p,uAxis), we=fwidth(e)*1.4;
        float band=(1.-smoothstep(0.,we,abs(e-(uBand+.112))))+(1.-smoothstep(0.,we,abs(e-(uBand-.112))));
        float z=acos(clamp(p.y,-1.,1.)), front=uReveal*2.;
        float rv=1.-smoothstep(front-.22,front,z);
        vec3 c=mix(sky,uGrid,clamp(grid*uGridA+band*uBandA,0.,1.)*rv);
        c=mix(c,uDimCol,uDim);
        gl_FragColor=vec4(c,1.);
      }`
  }));
  dome.renderOrder = 0; scene.add(dome);

  // ---------- star dust ----------
  const r0 = rng(11), DN = coarse ? 1300 : 2200, dpos = new Float32Array(DN * 3), dsz = new Float32Array(DN);
  for (let i = 0; i < DN; i++) {
    const u = r0() * 1.2 - .2, th = r0() * TAU, s = Math.sqrt(1 - u * u);
    dpos.set([s * Math.cos(th) * R * 1.4, u * R * 1.4, s * Math.sin(th) * R * 1.4], i * 3); dsz[i] = .9 + r0() * 1.5;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(dpos, 3)); dg.setAttribute("aSize", new THREE.BufferAttribute(dsz, 1));
  const dustU = { uPR: { value: DPR }, uReveal: domeU.uReveal, uA: { value: 1 }, uCol: { value: col(pal.dust) } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dustU, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute float aSize; uniform float uPR,uReveal; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        float z=acos(clamp(normalize(position).y,-1.,1.)); vA=1.-smoothstep(uReveal*2.-.22,uReveal*2.,z);
        gl_PointSize=aSize*uPR; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA;
      void main(){ float d=length(gl_PointCoord-.5); float a=(1.-smoothstep(.15,.5,d))*.55*vA*uA; if(a<.01) discard; gl_FragColor=vec4(uCol,a); }` }));
  dust.renderOrder = 1; scene.add(dust);

  // ---------- catalog: every app is a star, categories are open clusters ----------
  const cats = catalog.map((c, ci) => ({ name: c.cat, ci, n: c.apps.length }));
  const bySize = [...cats].sort((a, b) => b.n - a.n);
  const low = bySize.slice(0, 11), high = bySize.slice(11);
  low.forEach((c, i) => { c.lon = (i / low.length) * TAU + .15; c.lat = 9 * D2R; });
  high.forEach((c, i) => { c.lon = ((i + .5) / high.length) * TAU + .15; c.lat = 61 * D2R; });
  const apps = [];
  const r1 = rng(29), GOLD = Math.PI * (3 - Math.sqrt(5));
  const tmpE = new THREE.Vector3(), tmpN = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function tangentAt(c, e, n) { e.crossVectors(up, c).normalize(); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); n.crossVectors(c, e).normalize(); }
  cats.forEach(c => {
    const center = dirLL(c.lon, c.lat); c.dir = center.clone();
    tangentAt(center, tmpE, tmpN);
    const rad = (1.4 + 1.05 * Math.sqrt(c.n)) * D2R;
    catalog[c.ci].apps.forEach((name, i) => {
      const rr = rad * Math.sqrt((i + .5) / c.n) * (.85 + r1() * .3), th = i * GOLD + r1() * .6;
      const d = center.clone().addScaledVector(tmpE, Math.tan(rr * Math.cos(th))).addScaledVector(tmpN, Math.tan(rr * Math.sin(th))).normalize();
      const has = !!logo[key(name)];
      apps.push({ name, cat: c.name, ci: c.ci, dir: d, size: (has ? 17 : 11) + r1() * 5, has });
    });
  });
  const AN = apps.length, ap = new Float32Array(AN * 3), asz = new Float32Array(AN), aseed = new Float32Array(AN);
  const ahov = new Float32Array(AN), afoc = new Float32Array(AN), ahl = new Float32Array(AN);
  apps.forEach((a, i) => { ap.set([a.dir.x * R, a.dir.y * R, a.dir.z * R], i * 3); asz[i] = a.size; aseed[i] = r1(); });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(ap, 3));
  sg.setAttribute("aSize", new THREE.BufferAttribute(asz, 1)); sg.setAttribute("aSeed", new THREE.BufferAttribute(aseed, 1));
  sg.setAttribute("aHov", new THREE.BufferAttribute(ahov, 1)); sg.setAttribute("aFoc", new THREE.BufferAttribute(afoc, 1)); sg.setAttribute("aHl", new THREE.BufferAttribute(ahl, 1));
  const starU = { uPR: { value: DPR }, uT: { value: 0 }, uCat: { value: 1 }, uReveal: domeU.uReveal, uAny: { value: 0 }, uScale: { value: 1 },
    uStar: { value: col(pal.star) }, uCore: { value: col(pal.core) }, uRing: { value: 0 } };
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: starU, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute float aSize,aSeed,aHov,aFoc,aHl; uniform float uPR,uT,uCat,uReveal,uAny,uScale;
      varying float vA,vFoc,vRing;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        float z=acos(clamp(normalize(position).y,-1.,1.)); float rv=1.-smoothstep(uReveal*2.-.2,uReveal*2.,z);
        float tw=.8+.2*sin(uT*(.9+aSeed*1.3)+aSeed*40.);
        float lit=max(aFoc,aHl); float other=mix(1.,.32,uAny*(1.-lit));
        vA=rv*uCat*tw*other*(1.+aHov*.4); vFoc=aFoc; vRing=0.;
        gl_PointSize=aSize*uScale*uPR*(1.+aHov*.85+aFoc*1.5+aHl*.3); }`,
    fragmentShader: STAR_FRAG }));
  stars.renderOrder = 2; scene.add(stars);

  // ---------- constellations: one per case study, set along the gold band like a zodiac ----------
  const LK = Object.keys(logo).filter(k => k.length >= 4).sort((a, b) => b.length - a.length);
  const logoFor = name => { const k = LK.find(x => key(name).startsWith(x)); return k ? logo[k] : null; };
  const bu = new THREE.Vector3().crossVectors(bandAxis, new THREE.Vector3(1, 0, 0)).normalize();
  const bw = new THREE.Vector3().crossVectors(bandAxis, bu).normalize();
  const cons = projects.map((p, k) => {
    // columns of nodes; case studies with tracks become one row per track
    const cols = p.flow ? p.flow.map(c => ({ label: c.label || "", arrow: c.arrow || "", nodes: c.nodes.map(n => ({ name: n[0], sub: n[1] || "", kind: n[2] || "" })) }))
      : p.tracks[0].steps.map((s, si) => ({ label: "", nodes: p.tracks.map(t => ({ name: t.steps[si][0], sub: t.steps[si][1] || "", kind: t.steps[si][2] || "" })) }));
    const phi = (k / projects.length) * TAU + .32;
    const center = bu.clone().multiplyScalar(Math.cos(phi) * Math.cos(BAND_LAT)).addScaledVector(bw, Math.sin(phi) * Math.cos(BAND_LAT)).addScaledVector(bandAxis, Math.sin(BAND_LAT)).normalize();
    const e = new THREE.Vector3().crossVectors(bandAxis, center).normalize(), n = new THREE.Vector3().crossVectors(center, e).normalize();
    const rj = rng(101 + k * 7), nc = cols.length;
    const nodes = [];
    cols.forEach((c, ci) => c.nodes.forEach((nd, ri) => {
      const dx = (ci - (nc - 1) / 2) * 6.2 * D2R + (rj() - .5) * 1.6 * D2R;
      const dy = (ri - (c.nodes.length - 1) / 2) * 4.4 * D2R + Math.sin(ci * 1.9 + k) * 1.2 * D2R + (rj() - .5) * 1.2 * D2R;
      const d = center.clone().addScaledVector(e, Math.tan(dx)).addScaledVector(n, Math.tan(dy)).normalize();
      nodes.push({ ...nd, ci, ri, sky: d.multiplyScalar(R * .985), pos: new THREE.Vector3(), lg: logoFor(nd.name), t: 0 });
    }));
    nodes.forEach(nd => nd.pos.copy(nd.sky));
    const segs = [];
    for (let ci = 0; ci < nc - 1; ci++) {
      const A = nodes.filter(x => x.ci === ci), B = nodes.filter(x => x.ci === ci + 1);
      if (p.tracks) A.forEach(a => { const b = B.find(x => x.ri === a.ri); if (b) segs.push([a, b, ci, 0]); });
      else A.forEach(a => B.forEach(b => segs.push([a, b, ci, (cols[ci + 1].arrow || cols[ci].arrow) ? 1 : 0])));
    }
    return { p, k, cols, nodes, segs, center, e, n, draw: reduced ? nc : 0, drawTo: nc, alpha: 1, t: 0, tTo: 0 };
  });

  // fat lines with travelling pulses, drawn in screen space so they stay crisp at any width
  const LINE_V = `attribute vec3 aB; attribute float aSide,aEnd,aOrder,aBi; uniform vec2 uHalf; uniform float uWidth;
    varying float vSide,vEnd,vOrder,vBi;
    void main(){ vec4 a=projectionMatrix*viewMatrix*vec4(position,1.), b=projectionMatrix*viewMatrix*vec4(aB,1.);
      vSide=aSide; vEnd=aEnd; vOrder=aOrder; vBi=aBi;
      if(a.w<.05||b.w<.05){ gl_Position=vec4(3.,3.,3.,1.); return; }
      vec2 sa=a.xy/a.w*uHalf, sb=b.xy/b.w*uHalf, d=sb-sa; float L=length(d); d=L>1e-4?d/L:vec2(1.,0.);
      vec4 c=mix(a,b,aEnd); c.xy+=vec2(-d.y,d.x)*aSide*uWidth*.5/uHalf*c.w; gl_Position=c; }`;
  const LINE_F = `uniform vec3 uCol,uHi; uniform float uAlpha,uT,uDraw,uPulse;
    varying float vSide,vEnd,vOrder,vBi;
    void main(){ float prog=uDraw-vOrder; if(prog<=0.||vEnd>prog) discard;
      float edge=1.-smoothstep(.3,1.,abs(vSide));
      float ph=fract(uT*.42-vOrder*.33);
      float p1=exp(-pow((vEnd-ph)*8.,2.)), p2=vBi*exp(-pow(((1.-vEnd)-ph)*8.,2.));
      float pu=clamp((p1+p2)*uPulse,0.,1.);
      gl_FragColor=vec4(mix(uCol,uHi,pu),edge*uAlpha*(.72+.5*pu)); }`;
  cons.forEach(c => {
    const S = c.segs.length, g = new THREE.BufferGeometry();
    const A = new Float32Array(S * 12), B = new Float32Array(S * 12), side = new Float32Array(S * 4), end = new Float32Array(S * 4), ord = new Float32Array(S * 4), bi = new Float32Array(S * 4), idx = [];
    c.segs.forEach(([, , ci, b2], s) => { for (let v = 0; v < 4; v++) { side[s * 4 + v] = v % 2 ? 1 : -1; end[s * 4 + v] = v < 2 ? 0 : 1; ord[s * 4 + v] = ci; bi[s * 4 + v] = b2; }
      idx.push(s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 2, s * 4 + 1, s * 4 + 3); });
    g.setAttribute("position", new THREE.BufferAttribute(A, 3)); g.setAttribute("aB", new THREE.BufferAttribute(B, 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1)); g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    g.setAttribute("aOrder", new THREE.BufferAttribute(ord, 1)); g.setAttribute("aBi", new THREE.BufferAttribute(bi, 1)); g.setIndex(idx);
    c.lineU = { uHalf: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 1.3 }, uCol: { value: col(pal.line) }, uHi: { value: col(pal.hi) },
      uAlpha: { value: 1 }, uT: { value: 0 }, uDraw: { value: c.draw }, uPulse: { value: reduced ? 0 : 1 } };
    c.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: c.lineU, vertexShader: LINE_V, fragmentShader: LINE_F, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false }));
    c.mesh.frustumCulled = false; c.mesh.renderOrder = 3; scene.add(c.mesh);
    c.writeLines = () => { const A = g.attributes.position.array, B = g.attributes.aB.array;
      c.segs.forEach(([a, b], s) => { for (let v = 0; v < 4; v++) { A.set([a.pos.x, a.pos.y, a.pos.z], (s * 4 + v) * 3); B.set([b.pos.x, b.pos.y, b.pos.z], (s * 4 + v) * 3); } });
      g.attributes.position.needsUpdate = true; g.attributes.aB.needsUpdate = true; };
    c.writeLines();
  });
  // node stars (one buffer for every constellation)
  const allNodes = cons.flatMap(c => c.nodes.map(n => (n.c = c, n)));
  const NN = allNodes.length, np = new Float32Array(NN * 3), na = new Float32Array(NN), ns = new Float32Array(NN);
  allNodes.forEach((n, i) => { ns[i] = n.kind === "end" ? 26 : 21; });
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.BufferAttribute(np, 3)); ng.setAttribute("aA", new THREE.BufferAttribute(na, 1)); ng.setAttribute("aSize", new THREE.BufferAttribute(ns, 1));
  const nodeU = { uPR: { value: DPR }, uScale: { value: 1 }, uStar: { value: col(pal.star) }, uCore: { value: col(pal.core) }, uRing: { value: 1 } };
  const nodePts = new THREE.Points(ng, new THREE.ShaderMaterial({ uniforms: nodeU, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute float aA,aSize; uniform float uPR,uScale; varying float vA,vFoc,vRing;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; vA=aA; vFoc=0.; vRing=1.; gl_PointSize=aSize*uScale*uPR; }`,
    fragmentShader: STAR_FRAG }));
  nodePts.frustumCulled = false; nodePts.renderOrder = 4; scene.add(nodePts);

  // ---------- DOM layer ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; ui.appendChild(e); return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  cons.forEach(c => { c.label = el("button", "c-name", esc(c.p.title)); c.label.type = "button"; c.label.tabIndex = -1;
    c.label.addEventListener("click", () => api.onPick && api.onPick(c.p.id)); });
  const topEl = (cls) => { const e = document.createElement("div"); e.className = cls; (top || ui).appendChild(e); return e; };
  const tip = topEl("tip"), focusTag = topEl("tip"), demoTag = topEl("tip");
  let tagsOn = true, demoOn = false, demoI = -1, demoLeft = 0, demoK = 0;
  let glyphFor = () => "";

  // ---------- camera director ----------
  const view = { yaw: 0, pitch: .5, fov: 0, dim: 0, cat: 1, cons: 1, drift: reduced ? 0 : .012 };
  let driftOff = 0, dragYaw = 0, dragPitch = 0, vYaw = 0, vPitch = 0, interactive = false, dragging = null;
  const lookDir = new THREE.Vector3();
  let W = 1, H = 1;
  function resize() {
    W = innerWidth; H = innerHeight; renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const s = clamp(Math.min(W, H * 1.3) / 1100, .72, 1.15);
    starU.uScale.value = s; nodeU.uScale.value = s;
    cons.forEach(c => c.lineU.uHalf.value.set(W / 2, H / 2));
  }
  addEventListener("resize", resize); resize();
  const baseFov = () => (W / H < .75 ? 78 : W / H < 1.1 ? 68 : 60);

  // yaw/pitch that puts a direction at a given point of the screen (ndc), corrected for drift and drag
  function frame(dir, ax = 0, ay = 0) {
    const lon = Math.atan2(dir.z, dir.x), lat = Math.asin(clamp(dir.y / dir.length(), -1, 1));
    const vf = baseFov() * D2R, hf = 2 * Math.atan(Math.tan(vf / 2) * W / H);
    const pitch = clamp(lat - Math.atan(ay * Math.tan(vf / 2)), .06, 1.5);
    const yaw = lon - Math.atan(ax * Math.tan(hf / 2)) / Math.max(Math.cos(pitch), .3);
    return { yaw: view.yaw + wrapPi(yaw - driftOff - dragYaw - view.yaw), pitch };
  }

  // ---------- pointer: hover names, drag to look around ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9);
  let mx = -1, my = -1, hoverI = -1, hoverOn = !coarse;
  addEventListener("pointermove", e => {
    mx = e.clientX; my = e.clientY; mouse.set(mx / W * 2 - 1, -(my / H) * 2 + 1);
    if (dragging) { const dx = e.clientX - dragging[0], dy = e.clientY - dragging[1]; dragging = [e.clientX, e.clientY];
      vYaw = -dx * .0024 * (camera.fov / 60); vPitch = dy * .0024 * (camera.fov / 60); dragYaw += vYaw; dragPitch += vPitch; }
  }, { passive: true });
  addEventListener("pointerdown", e => {
    if (!interactive || e.pointerType !== "mouse" || e.button !== 0) return;
    if (e.target.closest("a,button,input,textarea,select,summary,label,p,h1,h2,h3,li,dd,dt,.plate,.legend,[role=listbox]")) return;
    dragging = [e.clientX, e.clientY]; document.documentElement.classList.add("dragging");
  });
  addEventListener("pointerup", () => { dragging = null; document.documentElement.classList.remove("dragging"); });
  addEventListener("blur", () => { dragging = null; });

  function pick() {
    if (!hoverOn || dragging || view.cat < .6 || mx < 0) { setHover(-1); return; }
    const t = document.elementFromPoint(mx, my);
    if (t && t !== canvas && t.closest("a,button,input,.plate,.legend,.copy h1,.copy p,.cta,.nav")) { setHover(-1); return; }
    ray.params.Points.threshold = R * (13 / H) * camera.fov * D2R;
    ray.setFromCamera(mouse, camera);
    const h = ray.intersectObject(stars); setHover(h.length ? h[0].index : -1);
  }
  function setHover(i) {
    if (i === hoverI) { if (i >= 0) placeTip(); return; }
    if (hoverI >= 0) ahov[hoverI] = 0; if (i >= 0) ahov[i] = 1; sg.attributes.aHov.needsUpdate = true; hoverI = i;
    if (i < 0) { tip.style.opacity = 0; canvas.style.cursor = ""; return; }
    const a = apps[i], lg = logo[key(a.name)];
    tip.innerHTML = `${lg ? `<span class="logo-tile"><img src="${lg}" alt=""></span>` : ""}<span>${esc(a.name)}<small>${esc(a.cat)}</small></span>`;
    tip.style.opacity = 1; placeTip();
  }
  function placeTip() { tip.style.transform = `translate(${Math.min(mx + 16, W - tip.offsetWidth - 12)}px,${my - tip.offsetHeight / 2}px)`; }

  // ---------- focus: search result or category ----------
  let focusI = -1, focusCat = -1, focusK = 0;
  function clearFocus() {
    if (focusI >= 0) afoc[focusI] = 0; focusI = -1; focusCat = -1; ahl.fill(0);
    sg.attributes.aFoc.needsUpdate = true; sg.attributes.aHl.needsUpdate = true; starU.uAny.value = 0; focusTag.style.opacity = 0;
  }
  function findApp(name) { const k = key(name); return apps.findIndex(a => key(a.name) === k); }
  function focusApp(name) {
    const i = findApp(name); if (i < 0) return null;
    clearFocus(); focusI = i; afoc[i] = 1; sg.attributes.aFoc.needsUpdate = true; starU.uAny.value = 1;
    const a = apps[i], lg = logo[key(a.name)];
    focusTag.innerHTML = `${lg ? `<span class="logo-tile"><img src="${lg}" alt=""></span>` : ""}<span>${esc(a.name)}<small>${esc(a.cat)}</small></span>`;
    focusK = 0;
    return { app: a, dir: a.dir };
  }
  function focusCategory(ci) {
    clearFocus(); if (ci == null || ci < 0) return null;
    focusCat = ci; apps.forEach((a, i) => { ahl[i] = a.ci === ci ? 1 : 0; }); sg.attributes.aHl.needsUpdate = true; starU.uAny.value = 1;
    return cats[ci];
  }

  // ---------- the focal moment: a constellation leaves the sky and becomes its pipeline ----------
  let stageEl = null, active = null, layout = null, onColumn = null;
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  function layoutFor(c, w, h) {
    const nc = c.cols.length, maxRows = Math.max(...c.cols.map(x => x.nodes.length));
    const narrow = w < 560, pos = new Map(), lanes = [];
    if (!narrow) {
      const padX = Math.min(84, w * .1), top = 54, gapY = Math.min(c.p.tracks ? 124 : 100, (h - top - 40) / Math.max(maxRows, 1));
      const midY = top + (h - top - 20) / 2;
      let minY = Infinity;
      c.cols.forEach((col, ci) => {
        const x = padX + (nc > 1 ? (w - padX * 2) * ci / (nc - 1) : (w - padX * 2) / 2);
        col.nodes.forEach((nd, ri) => { const y = midY + (ri - (col.nodes.length - 1) / 2) * gapY; minY = Math.min(minY, y); pos.set(ci + ":" + ri, [x, y]); });
      });
      if (c.p.tracks) c.p.tracks.forEach((t, ti) => lanes.push({ text: t.name, x: padX - 59, y: midY + (ti - (c.p.tracks.length - 1) / 2) * gapY - 52, align: "left" }));
      else c.cols.forEach((col, ci) => col.label && lanes.push({ text: col.label, x: pos.get(ci + ":0")[0], y: Math.max(8, minY - 66), align: "center" }));
    } else {
      const top = 34, bot = 30, per = 3;
      const bands = c.cols.map(col => Math.ceil(col.nodes.length / per));
      const unit = (h - top - bot) / bands.reduce((s, b) => s + b, 0);
      let y = top;
      c.cols.forEach((col, ci) => {
        col.nodes.forEach((nd, ri) => {
          const row = Math.floor(ri / per), inRow = Math.min(per, col.nodes.length - row * per), k = ri % per;
          pos.set(ci + ":" + ri, [w / 2 + (k - (inRow - 1) / 2) * Math.min(108, w / per), y + unit * (row + .5)]);
        });
        y += unit * bands[ci];
      });
    }
    return { pos, lanes, narrow };
  }
  function neededHeight(id, w) {
    const c = cons.find(x => x.p.id === id); if (!c) return 460;
    const maxRows = Math.max(...c.cols.map(x => x.nodes.length));
    if (w >= 560) return Math.max(460, 46 + maxRows * (c.p.tracks ? 124 : 100) + 40);
    const bands = c.cols.reduce((s, col) => s + Math.ceil(col.nodes.length / 3), 0);
    return 34 + bands * 104 + 30;
  }
  function showProject(id) {
    const c = cons.find(x => x.p.id === id); if (!c) return;
    if (active && active !== c) { active.tTo = 0; active.domOut(); }
    active = c; c.tTo = 1; c.draw = 0; c.drawK = undefined; c.drawStart = performance.now() + (reduced ? -1e6 : 600);
    buildDom(c); layout = null;
  }
  function hideProject() { if (active) { active.tTo = 0; active.domOut(); } active = null; }
  function buildDom(c) {
    c.domOut && c.domOut();
    const made = [];
    c.nodes.forEach(nd => {
      const kind = nd.kind === "end" ? " end" : nd.kind === "core" ? " core" : nd.kind === "ai" ? " ai" : "";
      const face = nd.lg ? `<span class="face logo-tile"><img src="${nd.lg}" alt=""></span>` : `<span class="face">${glyphFor(nd.name)}</span>`;
      nd.dom = el("div", "node" + kind, `${face}<b>${esc(nd.name)}</b>`); nd.w = 0;
      made.push(nd.dom);
    });
    c.laneEls = [];
    c.domOut = () => { made.forEach(m => { m.style.opacity = 0; setTimeout(() => m.remove(), 450); }); c.laneEls.forEach(m => { m.style.opacity = 0; setTimeout(() => m.remove(), 450); }); c.laneEls = []; c.domOut = null; };
  }
  function stageRect() { if (!stageEl) return null; const r = stageEl.getBoundingClientRect(); return r.width > 0 ? r : null; }
  function screenToWorld(x, y, out) { // a point on the screen, placed in front of the dome
    v4.set(x / W * 2 - 1, -(y / H) * 2 + 1, .5).unproject(camera).normalize();
    return out.copy(v4).multiplyScalar(R * .6);
  }

  // ---------- theme ----------
  function setTheme(name) {
    pal = PALETTES[name] || PALETTES.night;
    domeU.uTop.value.set(pal.top); domeU.uBottom.value.set(pal.bottom); domeU.uGrid.value.set(pal.grid); domeU.uDimCol.value.set(pal.dim);
    domeU.uGridA.value = pal.gridA; domeU.uBandA.value = pal.bandA; domeU.uNoise.value = pal.noise;
    dustU.uCol.value.set(pal.dust);
    [starU, nodeU].forEach(u => { u.uStar.value.set(pal.star); u.uCore.value.set(pal.core); });
    cons.forEach(c => { c.lineU.uCol.value.set(pal.line); c.lineU.uHi.value.set(pal.hi); });
    const blend = pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    [stars, nodePts, dust, ...cons.map(c => c.mesh)].forEach(o => { o.material.blending = blend; o.material.needsUpdate = true; });
  }

  // ---------- frame loop ----------
  let last = performance.now(), running = true, raf = 0, t0 = performance.now();
  const revealStart = performance.now() + 150;
  function frameLoop(now) {
    raf = requestAnimationFrame(frameLoop);
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const t = (now - t0) / 1000;
    if (!reduced && domeU.uReveal.value < 1) domeU.uReveal.value = clamp((now - revealStart) / 2600, 0, 1);

    // camera
    driftOff += view.drift * dt;
    if (!dragging) { dragYaw += vYaw; dragPitch += vPitch; vYaw *= .92; vPitch *= .92;
      if (!interactive) { dragYaw *= .96; dragPitch *= .96; } }
    const pitch = clamp(view.pitch + dragPitch, .04, 1.52);
    if (dragging || interactive) dragPitch = pitch - view.pitch;
    const yaw = view.yaw + driftOff + dragYaw;
    const fov = view.fov || baseFov();
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.lookAt(dirLL(yaw, pitch, lookDir));
    camera.updateMatrixWorld();
    domeU.uDim.value = view.dim; starU.uCat.value = view.cat; starU.uT.value = t; dustU.uA.value = .35 + .65 * view.cat;

    // constellations
    const sr = active ? stageRect() : null;
    if (active && sr) { if (!layout || layout.w !== sr.width || layout.h !== sr.height) { layout = layoutFor(active, sr.width, sr.height); layout.w = sr.width; layout.h = sr.height; rebuildLanes(active); } }
    let ni = 0;
    cons.forEach(c => {
      const moving = c.tTo !== c.t || c === active;
      if (c.t !== c.tTo) c.t = reduced ? c.tTo : clamp(c.t + (c.tTo > c.t ? dt / 1.5 : -dt / 1.1), 0, 1);
      const isActive = c === active;
      const reveal = domeU.uReveal.value;
      // draw progress: constellations ink themselves in, the active one column by column
      if (isActive && sr) {
        const k = reduced ? c.cols.length : clamp((now - c.drawStart) / 700, 0, c.cols.length);
        if (Math.floor(k) !== Math.floor(c.drawK || -1) && onColumn) onColumn(c.p.id, Math.min(Math.floor(k), c.cols.length - 1));
        c.drawK = k; c.lineU.uDraw.value = k;
      } else {
        const target = reveal >= 1 ? c.cols.length : clamp((reveal * 2.1 - .35 - c.k * .03) * c.cols.length, 0, c.cols.length);
        c.lineU.uDraw.value = Math.max(target, reduced ? c.cols.length : 0);
      }
      const baseA = isActive ? 1 : view.cons;
      c.alpha += ((c.t > 0 ? Math.max(baseA, c.t) : baseA) - c.alpha) * Math.min(1, dt * 5);
      c.lineU.uAlpha.value = c.alpha * (pal.additive ? 1 : .85);
      c.lineU.uWidth.value = 1.6 + c.t * 1.2;
      c.lineU.uT.value = t;
      c.nodes.forEach(nd => {
        if (c.t > 0 && sr && layout && isActive) {
          const p = layout.pos.get(nd.ci + ":" + nd.ri); screenToWorld(sr.left + p[0], sr.top + p[1], v3);
          const local = easeInOut(clamp(c.t * 1.25 - nd.ci * .06, 0, 1));
          (nd.lastT || (nd.lastT = new THREE.Vector3())).copy(v3);
          nd.pos.copy(nd.sky).lerp(v3, local); nd.screen = [sr.left + p[0], sr.top + p[1]]; nd.local = local;
        } else if (c.t > 0 && nd.local) {
          const local = easeInOut(clamp(c.t, 0, 1)); nd.pos.copy(nd.sky).lerp(nd.lastT || nd.sky, local); nd.local = local;
        } else { nd.pos.copy(nd.sky); nd.local = 0; }
        np.set([nd.pos.x, nd.pos.y, nd.pos.z], ni * 3);
        const zz = acosY(nd.sky); const rv = 1 - smooth(reveal * 2 - .2, reveal * 2, zz);
        na[ni] = c.alpha * rv * (isActive ? 1 - clamp((nd.local - .82) * 6, 0, 1) : 1);
        ni++;
        if (nd.dom) {
          const show = isActive && nd.local > .8;
          if (show) { if (!nd.w) { nd.w = nd.dom.offsetWidth; nd.fh = nd.dom.querySelector(".face").offsetHeight; }
            nd.dom.style.opacity = 1;
            nd.dom.style.transform = `translate(${Math.round(nd.screen[0] - nd.w / 2)}px,${Math.round(nd.screen[1] - nd.fh / 2)}px)`; }
          else nd.dom.style.opacity = 0;
        }
      });
      if (moving || c.dirty !== false) { c.writeLines(); c.dirty = moving; }
      // constellation name
      const show = !isActive && c.alpha > .72 && reveal > .6;
      let placed = false;
      if (show) {
        const top = c.nodes.reduce((m, nd) => (nd.sky.y > m.sky.y ? nd : m), c.nodes[0]);
        v3.copy(c.center).multiplyScalar(R); const s = project(v3);
        const ts = project(v4.copy(top.sky));
        if (s && ts && s[0] > -80 && s[0] < W + 80 && s[1] > 40 && s[1] < H - 20) {
          if (!c.lw) c.lw = c.label.offsetWidth;
          c.label.style.transform = `translate(${Math.round(s[0] - c.lw / 2)}px,${Math.round(Math.min(ts[1], s[1]) - 62)}px)`;
          c.label.style.opacity = clamp((c.alpha - .72) / .2, 0, 1); c.label.classList.toggle("live", interactive && c.alpha > .85); placed = true;
        }
      }
      if (!placed) { c.label.style.opacity = 0; c.label.classList.remove("live"); }
    });
    ng.attributes.position.needsUpdate = true; ng.attributes.aA.needsUpdate = true;
    if (active && active.laneEls && sr) active.laneEls.forEach(l => { if (!l.w) l.w = l.offsetWidth;
      l.style.opacity = active.t > .85 ? 1 : 0;
      l.style.transform = `translate(${Math.round(sr.left + +l.dataset.x - (l.dataset.align === "center" ? l.w / 2 : 0))}px,${Math.round(sr.top + +l.dataset.y)}px)`; });

    // focus tag follows its star
    if (focusI >= 0) {
      const s = project(v3.copy(apps[focusI].dir).multiplyScalar(R));
      focusK = Math.min(1, focusK + dt * 1.5);
      if (s && tagsOn) { focusTag.style.opacity = focusK > .5 ? 1 : 0; focusTag.style.transform = `translate(${Math.round(Math.min(s[0] + 26, W - focusTag.offsetWidth - 12))}px,${Math.round(s[1] - focusTag.offsetHeight / 2)}px)`; }
      else focusTag.style.opacity = 0;
    }
    // demo: while the search sits idle, stars on the open side of the sky light up with their names
    if (demoOn && focusI < 0 && focusCat < 0 && !reduced && tagsOn) {
      demoLeft -= dt;
      if (demoLeft <= 0) { endDemo(); demoLeft = 2.9; const pool = [];
        apps.forEach((a, i) => { if (!a.has) return; const s = project(v3.copy(a.dir).multiplyScalar(R)); if (s && s[0] > W * .58 && s[0] < W * .9 && s[1] > H * .2 && s[1] < H * .8) pool.push(i); });
        if (pool.length) { demoI = pool[Math.floor(Math.random() * pool.length)]; ahov[demoI] = 1; sg.attributes.aHov.needsUpdate = true; demoK = 0;
          const a = apps[demoI], lg = logo[key(a.name)];
          demoTag.innerHTML = `${lg ? `<span class="logo-tile"><img src="${lg}" alt=""></span>` : ""}<span>${esc(a.name)}<small>${esc(a.cat)}</small></span>`; demoTag.w = 0; } }
      if (demoI >= 0) { const s = project(v3.copy(apps[demoI].dir).multiplyScalar(R)); demoK += dt;
        if (!s || s[0] < W * .55) { endDemo(); demoLeft = Math.min(demoLeft, .6); }
        else { if (!demoTag.w) { demoTag.w = demoTag.offsetWidth; demoTag.h = demoTag.offsetHeight; }
          demoTag.style.opacity = demoK > .25 && demoLeft > .4 ? 1 : 0;
          demoTag.style.transform = `translate(${Math.round(Math.min(s[0] + 24, W - demoTag.w - 12))}px,${Math.round(s[1] - demoTag.h / 2)}px)`; } }
    } else if (demoI >= 0) endDemo();
    if (!tagsOn) focusTag.style.opacity = 0;
    pick();
    renderer.render(scene, camera);
  }
  function endDemo() { if (demoI >= 0 && demoI !== hoverI) { ahov[demoI] = 0; sg.attributes.aHov.needsUpdate = true; } demoI = -1; demoTag.style.opacity = 0; }
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const acosY = v => Math.acos(clamp(v.y / v.length(), -1, 1));
  function project(w) { // null when the point is behind the camera or outside the depth range
    if (w.dot(lookDir) <= .08 * w.length()) return null;
    v3.copy(w).project(camera); if (v3.z > 1 || v3.z < -1) return null; return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  function rebuildLanes(c) {
    c.laneEls.forEach(l => l.remove()); c.laneEls = [];
    if (!layout || layout.narrow) return;
    const sr = stageRect(); if (!sr) return;
    layout.lanes.forEach(L => { const e = el("div", "lane", esc(L.text)); e.dataset.x = L.x; e.dataset.y = L.y; e.dataset.align = L.align; c.laneEls.push(e); });
  }

  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frameLoop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  raf = requestAnimationFrame(frameLoop);

  const api = {
    renderer, scene, camera,
    view, apps, cats, cons, frame, resize, setTheme, focusApp, focusCategory, clearFocus, showProject, hideProject,
    get driftOff() { return driftOff; },
    constellationDir: id => { const c = cons.find(x => x.p.id === id); return c ? c.center.clone() : null; },
    setStage: e => { stageEl = e; layout = null; },
    setInteractive: on => { interactive = on; if (!on) { dragging = null; } },
    setGlyphs: fn => { glyphFor = fn; },
    setDemo: on => { demoOn = on; demoLeft = 2.2; if (!on) endDemo(); },
    showTags: on => { tagsOn = on; },
    onColumn: fn => { onColumn = fn; },
    onPick: null,
    baseFov,
    isActive: () => !!active,
    neededHeight
  };
  return api;
}
