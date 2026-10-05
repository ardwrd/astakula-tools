(() => {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const state = { image: null, imageUrl: null, candidates: [], base: '#64145C', mode: 'brand', palette: [] };

    const els = {
        imageInput: $('#imageInput'), dropZone: $('#dropZone'), imagePreviewWrap: $('#imagePreviewWrap'), imagePreview: $('#imagePreview'), imageName: $('#imageName'), imageMeta: $('#imageMeta'), imageState: $('#imageState'), extractCount: $('#extractCount'), sampleQuality: $('#sampleQuality'), extractButton: $('#extractButton'), clearImageButton: $('#clearImageButton'), manualColor: $('#manualColor'), manualHex: $('#manualHex'), useColorButton: $('#useColorButton'), randomBaseButton: $('#randomBaseButton'), statusBox: $('#statusBox'), candidateSection: $('#candidateSection'), candidateGrid: $('#candidateGrid'), baseSwatch: $('#baseSwatch'), baseHex: $('#baseHex'), baseOklch: $('#baseOklch'), paletteGrid: $('#paletteGrid'), tonalScale: $('#tonalScale'), scoreGrid: $('#scoreGrid'), contrastList: $('#contrastList'), lightPreview: $('#lightPreview'), darkPreview: $('#darkPreview'), copyCssButton: $('#copyCssButton'), downloadJsonButton: $('#downloadJsonButton'), downloadPngButton: $('#downloadPngButton')
    };

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const wrapHue = (h) => ((h % 360) + 360) % 360;
    const hex2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
    const rgbToHex = ({r,g,b}) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    const hexToRgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null; const n = parseInt(m[1],16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; };
    const srgbToLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const linearToSrgb = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - 0.055);

    function rgbToOklab(rgb) {
        const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
        const l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b;
        const m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b;
        const s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b;
        const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
        return { L: 0.2104542553*l_ + 0.793617785*m_ - 0.0040720468*s_, a: 1.9779984951*l_ - 2.428592205*m_ + 0.4505937099*s_, b: 0.0259040371*l_ + 0.7827717662*m_ - 0.808675766*s_ };
    }
    function oklabToRgbRaw({L,a,b}) {
        const l_ = L + 0.3963377774*a + 0.2158037573*b;
        const m_ = L - 0.1055613458*a - 0.0638541728*b;
        const s_ = L - 0.0894841775*a - 1.291485548*b;
        const l = l_**3, m = m_**3, s = s_**3;
        return { r: linearToSrgb(4.0767416621*l - 3.3077115913*m + 0.2309699292*s), g: linearToSrgb(-1.2684380046*l + 2.6097574011*m - 0.3413193965*s), b: linearToSrgb(-0.0041960863*l - 0.7034186147*m + 1.707614701*s) };
    }
    function oklabToOklch(lab) { const C = Math.hypot(lab.a, lab.b); return { L: lab.L, C, h: C < 1e-7 ? 0 : wrapHue(Math.atan2(lab.b,lab.a)*180/Math.PI) }; }
    function oklchToOklab({L,C,h}) { const rad = h*Math.PI/180; return { L, a:C*Math.cos(rad), b:C*Math.sin(rad) }; }
    function inGamut(rgb) { return rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255; }
    function oklchToRgbGamut(color) { let c = {...color}; let rgb = oklabToRgbRaw(oklchToOklab(c)); for (let i=0; i<32 && !inGamut(rgb); i++) { c.C *= .92; rgb = oklabToRgbRaw(oklchToOklab(c)); } return { r:clamp(rgb.r,0,255), g:clamp(rgb.g,0,255), b:clamp(rgb.b,0,255) }; }
    function hexToOklch(hex) { return oklabToOklch(rgbToOklab(hexToRgb(hex))); }
    function oklchToHex(color) { return rgbToHex(oklchToRgbGamut(color)); }
    function formatOklch(color) { return `oklch(${(color.L*100).toFixed(1)}% ${color.C.toFixed(3)} ${Math.round(color.h)})`; }
    function colorDistance(hexA, hexB) { const a = rgbToOklab(hexToRgb(hexA)), b = rgbToOklab(hexToRgb(hexB)); return Math.hypot(a.L-b.L,a.a-b.a,a.b-b.b); }

    function relativeLuminance(hex) { const c = hexToRgb(hex); const f = (v) => { v/=255; return v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
    function contrastRatio(a,b) { const l1=relativeLuminance(a), l2=relativeLuminance(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
    function bestText(bg, target=4.5) { const black='#111318', white='#FFFFFF'; const cb=contrastRatio(black,bg), cw=contrastRatio(white,bg); if (cb>=target || cw>=target) return cb>=cw?black:white; return cb>=cw?black:white; }

    function normalizeHex(value) { const v = value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase(); if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`; return null; }
    function setStatus(message, kind='neutral') { els.statusBox.textContent=message; els.statusBox.className=`status-box is-${kind}`; }
    function setBase(hex, message='Base color updated.') { const normalized=normalizeHex(hex); if(!normalized){ setStatus('Enter a valid six-digit HEX color, for example #64145C.','error'); return; } state.base=normalized; els.manualColor.value=normalized; els.manualHex.value=normalized; renderAll(); setStatus(message,'success'); }

    function roleColor(role, hex, description) { const oklch=hexToOklch(hex); return { role, hex, oklch, description }; }
    function fromBase(deltaHue=0, L=null, CScale=1) { const b=hexToOklch(state.base); return oklchToHex({L:L ?? b.L,C:b.C*CScale,h:wrapHue(b.h+deltaHue)}); }
    function neutral(lightness, chroma=.012) { const b=hexToOklch(state.base); return oklchToHex({L:lightness,C:Math.min(chroma,b.C*.18),h:b.h}); }

    function generatePalette(mode) {
        const b=hexToOklch(state.base); const primary=state.base;
        if (mode==='extracted' && state.candidates.length) return state.candidates.slice(0,8).map((c,i)=>roleColor(i===0?'Primary':`Extracted ${i+1}`,c.hex,'Representative source-image color'));
        if (mode==='monochromatic') return [0.92,0.80,0.68,b.L,0.48,0.34].map((L,i)=>roleColor(i===3?'Primary':`Tone ${i+1}`,oklchToHex({L,C:b.C*(i===0?.45:i===5?.65:1),h:b.h}),'Same hue with structured lightness'));
        if (mode==='analogous') return [roleColor('Primary',primary,'Base color'),roleColor('Secondary',fromBase(-30,null,.9),'Analogous −30°'),roleColor('Supporting',fromBase(30,null,.9),'Analogous +30°'),roleColor('Background',neutral(.97),'Near-neutral background'),roleColor('Text',neutral(.20),'High-contrast text neutral')];
        if (mode==='complementary') return [roleColor('Primary',primary,'Base color'),roleColor('Accent',fromBase(180,null,.92),'Complementary hue'),roleColor('Soft',fromBase(180,.88,.38),'Soft complementary support'),roleColor('Background',neutral(.97),'Near-neutral background'),roleColor('Text',neutral(.20),'High-contrast text neutral')];
        if (mode==='split') return [roleColor('Primary',primary,'Base color'),roleColor('Accent A',fromBase(150,null,.88),'Split complement −30°'),roleColor('Accent B',fromBase(210,null,.88),'Split complement +30°'),roleColor('Background',neutral(.97),'Near-neutral background'),roleColor('Text',neutral(.20),'High-contrast text neutral')];
        if (mode==='triadic') return [roleColor('Primary',primary,'Base color'),roleColor('Secondary',fromBase(120,null,.88),'Triadic +120°'),roleColor('Accent',fromBase(240,null,.88),'Triadic +240°'),roleColor('Background',neutral(.97),'Near-neutral background'),roleColor('Text',neutral(.20),'High-contrast text neutral')];
        if (mode==='ui') {
            const bg=neutral(.975,.008), surface='#FFFFFF', text=neutral(.19,.012), muted=neutral(.43,.010), secondary=fromBase(35,clamp(b.L+.05,.45,.72),.72), accent=fromBase(180,clamp(b.L+.08,.50,.76),.82);
            return [roleColor('Primary',primary,'Main interactive/brand color'),roleColor('Secondary',secondary,'Secondary emphasis'),roleColor('Accent',accent,'Contrasting accent'),roleColor('Background',bg,'Page background'),roleColor('Surface',surface,'Raised surface'),roleColor('Text',text,'Primary text'),roleColor('Muted Text',muted,'Secondary text')];
        }
        const secondary=fromBase(32,clamp(b.L+.05,.42,.76),.78); const accent=fromBase(180,clamp(b.L+.08,.48,.78),.88); const bg=neutral(.97,.009); const text=neutral(.20,.012);
        return [roleColor('Primary',primary,'Base brand color'),roleColor('Secondary',secondary,'Nearby supporting hue'),roleColor('Accent',accent,'Suggested complementary accent'),roleColor('Background',bg,'Near-neutral background'),roleColor('Text',text,'High-contrast text neutral')];
    }

    function renderPalette() {
        state.palette=generatePalette(state.mode); const b=hexToOklch(state.base); els.baseSwatch.style.background=state.base; els.baseHex.textContent=state.base; els.baseOklch.textContent=formatOklch(b);
        els.paletteGrid.innerHTML=state.palette.map((c,i)=>`<article class="palette-card"><div class="palette-swatch" style="background:${c.hex};color:${bestText(c.hex)}"><span class="palette-role">${c.role}</span></div><div class="palette-meta"><strong>${c.hex}</strong><span>${formatOklch(c.oklch)}</span><span>${c.description}</span><button class="palette-copy" type="button" data-copy="${c.hex}" data-index="${i}">Copy HEX</button></div></article>`).join('');
        $$('.palette-copy').forEach(btn=>btn.addEventListener('click',()=>copyText(btn.dataset.copy,'HEX copied.')));
    }

    function renderTonalScale() { const b=hexToOklch(state.base); const stops=[['50',.97,.20],['100',.93,.34],['200',.86,.55],['300',.77,.75],['400',.68,.90],['500',.60,1],['600',.52,.98],['700',.44,.90],['800',.36,.78],['900',.28,.65],['950',.20,.52]]; els.tonalScale.innerHTML=stops.map(([label,L,c])=>{ const hex=oklchToHex({L,C:b.C*c,h:b.h}); return `<div class="tone"><div class="tone-swatch" style="background:${hex}"></div><div class="tone-copy"><strong>${label}</strong><span>${hex}</span></div></div>`; }).join(''); }

    function getRole(name, fallback) { return state.palette.find(c=>c.role===name)?.hex || fallback; }
    function contrastRows() { const bg=getRole('Background','#FFFFFF'), surface=getRole('Surface','#FFFFFF'), text=getRole('Text',bestText(bg)), muted=getRole('Muted Text',neutral(.42)), primary=getRole('Primary',state.base), accent=getRole('Accent',state.palette[2]?.hex||state.base); return [['Text','Background',text,bg],['Text','Surface',text,surface],['Muted Text','Background',muted,bg],['Primary','Background',primary,bg],['Accent','Background',accent,bg]]; }
    function renderContrast() { els.contrastList.innerHTML=contrastRows().map(([a,b,fg,bg])=>{ const r=contrastRatio(fg,bg); const aa=r>=4.5, aaa=r>=7, large=r>=3; const label=aaa?'AAA':aa?'AA':large?'Large text AA':'Fail'; return `<div class="contrast-row"><div class="contrast-pair"><span class="contrast-mini"><i style="background:${fg}"></i><i style="background:${bg}"></i></span><div><strong>${a} → ${b}</strong><span>${fg} on ${bg}</span></div></div><div class="contrast-result"><strong>${r.toFixed(2)} : 1</strong><span class="${aa?'pass':large?'pass':'fail'}">${label}</span></div></div>`; }).join(''); }

    function circularHueDistance(a,b) { const d=Math.abs(a-b)%360; return Math.min(d,360-d); }
    function computeScores() { const colors=state.palette.map(c=>c.hex); let pairs=0,sum=0; for(let i=0;i<colors.length;i++) for(let j=i+1;j<colors.length;j++){ sum+=Math.min(1,colorDistance(colors[i],colors[j])/.18); pairs++; } const distinct=Math.round(100*(pairs?sum/pairs:1)); const rows=contrastRows(); const accessible=Math.round(100*rows.filter(([, ,fg,bg])=>contrastRatio(fg,bg)>=4.5).length/rows.length); const chromatic=state.palette.map(c=>c.oklch).filter(c=>c.C>.035); let hsum=0,hpairs=0; for(let i=0;i<chromatic.length;i++) for(let j=i+1;j<chromatic.length;j++){ hsum+=Math.min(1,circularHueDistance(chromatic[i].h,chromatic[j].h)/90); hpairs++; } const hue=Math.round(100*(hpairs?hsum/hpairs:.75)); const hasBg=state.palette.some(c=>/Background|Surface/i.test(c.role)), hasText=state.palette.some(c=>/Text/i.test(c.role)); const neutral=Math.round((hasBg?50:20)+(hasText?50:20)); return [['Distinctness',distinct],['Text accessibility',accessible],['Hue separation',hue],['Neutral support',neutral]]; }
    function renderScores() { els.scoreGrid.innerHTML=computeScores().map(([label,score])=>`<div class="score-card"><span>${label}</span><strong>${score} / 100</strong><div class="score-meter"><i style="width:${score}%"></i></div></div>`).join(''); }

    function buildPreview(dark=false) { const primary=getRole('Primary',state.base), accent=getRole('Accent',state.palette[2]?.hex||primary); let bg,surface,text,muted; if(dark){ const b=hexToOklch(state.base); bg=oklchToHex({L:.14,C:.012,h:b.h}); surface=oklchToHex({L:.20,C:.014,h:b.h}); text='#F7F4ED'; muted='#B4AFA7'; } else { bg=getRole('Background','#F8F6F7'); surface=getRole('Surface','#FFFFFF'); text=getRole('Text',bestText(bg)); muted=getRole('Muted Text','#615B60'); } const buttonText=bestText(primary); return `<span class="preview-label">${dark?'Dark':'Light'} preview</span><div class="preview-card" style="background:${surface};color:${text};border-color:${text}"><h3>Interface headline</h3><p style="color:${muted}">Use roles consistently: primary for action, accent for emphasis, and neutral colors for readable content.</p><div class="preview-actions"><button style="background:${primary};color:${buttonText};border-color:${text}">Primary action</button><button style="background:${accent};color:${bestText(accent)};border-color:${text}">Accent</button></div></div>`; }
    function renderPreviews() { const lightBg=getRole('Background','#F8F6F7'); els.lightPreview.style.background=lightBg; els.lightPreview.style.color=getRole('Text',bestText(lightBg)); els.lightPreview.innerHTML=buildPreview(false); const b=hexToOklch(state.base); const darkBg=oklchToHex({L:.14,C:.012,h:b.h}); els.darkPreview.style.background=darkBg; els.darkPreview.style.color='#F7F4ED'; els.darkPreview.innerHTML=buildPreview(true); }
    function renderAll() { renderPalette(); renderTonalScale(); renderContrast(); renderScores(); renderPreviews(); }

    function downloadBlob(blob,name) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
    async function copyText(text,message) { try { await navigator.clipboard.writeText(text); setStatus(message,'success'); } catch { setStatus('Clipboard access was blocked by the browser.','error'); } }
    function cssExport() { return `:root {\n${state.palette.map(c=>`  --color-${c.role.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}: ${c.hex};`).join('\n')}\n}`; }
    function jsonExport() { return JSON.stringify({generator:'Astakula Tools Color Palette Generator',mode:state.mode,base:state.base,palette:state.palette.map(c=>({role:c.role,hex:c.hex,oklch:formatOklch(c.oklch),description:c.description})),tonalScale:[50,100,200,300,400,500,600,700,800,900,950]},null,2); }
    function pngExport() { const colors=state.palette; const w=1200,h=220+colors.length*115; const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.fillStyle='#F7F4ED'; ctx.fillRect(0,0,w,h); ctx.fillStyle='#111318'; ctx.font='900 42px Arial'; ctx.fillText('Astakula Color Palette',50,70); ctx.font='600 22px Arial'; ctx.fillText(`${state.mode.toUpperCase()} · ${state.base}`,50,110); colors.forEach((c,i)=>{ const y=160+i*115; ctx.fillStyle=c.hex; ctx.fillRect(50,y,220,82); ctx.strokeStyle='#111318'; ctx.lineWidth=3; ctx.strokeRect(50,y,220,82); ctx.fillStyle='#111318'; ctx.font='900 24px Arial'; ctx.fillText(c.role,300,y+32); ctx.font='600 20px monospace'; ctx.fillText(c.hex,300,y+63); ctx.font='500 16px Arial'; ctx.fillText(c.description,520,y+48); }); canvas.toBlob(blob=>blob&&downloadBlob(blob,'astakula-color-palette.png'),'image/png'); }

    async function loadImageFile(file) { if(!file || !file.type.startsWith('image/')){ setStatus('Choose a supported image file.','error'); return; } if(state.imageUrl) URL.revokeObjectURL(state.imageUrl); state.image=file; state.imageUrl=URL.createObjectURL(file); els.imagePreview.src=state.imageUrl; els.imageName.textContent=file.name; els.imageMeta.textContent=`${(file.size/1024/1024).toFixed(2)} MB · ${file.type.replace('image/','').toUpperCase()}`; els.imagePreviewWrap.classList.remove('hidden'); els.imageState.textContent='Ready'; els.extractButton.disabled=false; els.clearImageButton.disabled=false; setStatus('Image ready. Extract representative colors when you are ready.','success'); }
    function clearImage() { if(state.imageUrl) URL.revokeObjectURL(state.imageUrl); state.image=null; state.imageUrl=null; state.candidates=[]; els.imageInput.value=''; els.imagePreview.removeAttribute('src'); els.imagePreviewWrap.classList.add('hidden'); els.imageState.textContent='Optional'; els.extractButton.disabled=true; els.clearImageButton.disabled=true; els.candidateSection.classList.add('hidden'); setStatus('Image cleared. You can start from a HEX color instead.','neutral'); }

    function samplePixels(img, quality) { const max=quality==='fine'?220:quality==='fast'?110:160; const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)); const w=Math.max(1,Math.round(img.naturalWidth*scale)), h=Math.max(1,Math.round(img.naturalHeight*scale)); const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0,w,h); const data=ctx.getImageData(0,0,w,h).data; const step=quality==='fine'?4:quality==='fast'?16:8; const pixels=[]; for(let i=0;i<data.length;i+=4*step){ if(data[i+3]<180) continue; const rgb={r:data[i],g:data[i+1],b:data[i+2]}; const lab=rgbToOklab(rgb); if(lab.L<.03||lab.L>.985) continue; pixels.push({rgb,lab}); } return pixels; }
    function extractColors(pixels,k) { if(!pixels.length) return []; const seeds=[]; seeds.push(pixels[Math.floor(pixels.length/3)].lab); while(seeds.length<k){ let best=null,bestD=-1; const stride=Math.max(1,Math.floor(pixels.length/1200)); for(let i=0;i<pixels.length;i+=stride){ const p=pixels[i].lab; const d=Math.min(...seeds.map(s=>Math.hypot(p.L-s.L,p.a-s.a,p.b-s.b))); if(d>bestD){bestD=d;best=p;} } seeds.push({...best}); }
        let centers=seeds.map(s=>({...s})), counts=[]; for(let iter=0;iter<10;iter++){ const groups=centers.map(()=>({L:0,a:0,b:0,n:0})); for(const px of pixels){ let bi=0,bd=Infinity; centers.forEach((c,i)=>{ const d=(px.lab.L-c.L)**2+(px.lab.a-c.a)**2+(px.lab.b-c.b)**2; if(d<bd){bd=d;bi=i;} }); const g=groups[bi]; g.L+=px.lab.L; g.a+=px.lab.a; g.b+=px.lab.b; g.n++; } centers=groups.map((g,i)=>g.n?{L:g.L/g.n,a:g.a/g.n,b:g.b/g.n}:centers[i]); counts=groups.map(g=>g.n); }
        let out=centers.map((lab,i)=>({hex:rgbToHex(oklabToRgbRaw(lab)),count:counts[i]||0,lab})).sort((a,b)=>b.count-a.count); const merged=[]; for(const c of out){ if(merged.every(m=>colorDistance(m.hex,c.hex)>.055)) merged.push(c); } return merged.slice(0,k); }
    async function extractFromImage() { if(!state.image) return; setStatus('Analyzing image colors…','working'); els.extractButton.disabled=true; await new Promise(r=>setTimeout(r,20)); try { const img=new Image(); img.src=state.imageUrl; await img.decode(); const pixels=samplePixels(img,els.sampleQuality.value); state.candidates=extractColors(pixels,Number(els.extractCount.value)); if(!state.candidates.length) throw new Error('No representative colors found'); const maxCount=Math.max(...state.candidates.map(c=>c.count)); state.candidates.forEach(c=>c.share=c.count/maxCount); state.base=state.candidates[0].hex; renderCandidates(); renderAll(); els.candidateSection.classList.remove('hidden'); setStatus(`${state.candidates.length} perceptually distinct color candidates extracted.`,`success`); } catch(err){ console.error(err); setStatus('The browser could not extract colors from this image. Try another image format.','error'); } finally { els.extractButton.disabled=false; } }
    function renderCandidates() { els.candidateGrid.innerHTML=state.candidates.map((c,i)=>`<button class="candidate-card ${c.hex===state.base?'is-active':''}" type="button" data-hex="${c.hex}"><span class="candidate-swatch" style="background:${c.hex}"></span><span class="candidate-copy"><strong>${c.hex}</strong><span>${i===0?'Highest sampled share':'Distinct extracted candidate'}</span></span></button>`).join(''); $$('.candidate-card').forEach(card=>card.addEventListener('click',()=>{ state.base=card.dataset.hex; els.manualColor.value=state.base; els.manualHex.value=state.base; renderCandidates(); renderAll(); setStatus(`${state.base} selected as the palette base.`,`success`); })); }

    els.imageInput.addEventListener('change',e=>loadImageFile(e.target.files[0]));
    ['dragenter','dragover'].forEach(type=>els.dropZone.addEventListener(type,e=>{e.preventDefault();els.dropZone.classList.add('is-dragging');})); ['dragleave','drop'].forEach(type=>els.dropZone.addEventListener(type,e=>{e.preventDefault();els.dropZone.classList.remove('is-dragging');})); els.dropZone.addEventListener('drop',e=>loadImageFile(e.dataTransfer.files[0])); els.dropZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();els.imageInput.click();}});
    els.extractButton.addEventListener('click',extractFromImage); els.clearImageButton.addEventListener('click',clearImage);
    els.manualColor.addEventListener('input',()=>{ els.manualHex.value=els.manualColor.value.toUpperCase(); }); els.manualHex.addEventListener('input',()=>{ const h=normalizeHex(els.manualHex.value); if(h) els.manualColor.value=h; }); els.useColorButton.addEventListener('click',()=>setBase(els.manualHex.value));
    els.randomBaseButton.addEventListener('click',()=>{ const examples=['#64145C','#0F6B78','#C04A2D','#3157A4','#7A5B21','#2F7B4A','#8A3F69']; setBase(examples[Math.floor(Math.random()*examples.length)],'Example base color loaded.'); });
    $$('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>{ state.mode=btn.dataset.mode; $$('.mode-tab').forEach(b=>b.classList.toggle('is-active',b===btn)); renderAll(); setStatus(`${btn.textContent} palette generated from ${state.base}.`,'success'); }));
    els.copyCssButton.addEventListener('click',()=>copyText(cssExport(),'CSS variables copied.')); els.downloadJsonButton.addEventListener('click',()=>downloadBlob(new Blob([jsonExport()],{type:'application/json'}),'astakula-color-palette.json')); els.downloadPngButton.addEventListener('click',pngExport);

    renderAll();
})();
