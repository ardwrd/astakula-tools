(() => {
    const $=(s)=>document.querySelector(s),$$=(s)=>Array.from(document.querySelectorAll(s));
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    const wrapHue=(h)=>((h%360)+360)%360;
    let nextId=1;
    const state={type:'linear',interpolation:'srgb',angle:90,conicAngle:0,radialShape:'ellipse',radialPosition:'center',stops:[
        {id:nextId++,color:'#64145C',position:0},
        {id:nextId++,color:'#4D7CFF',position:50},
        {id:nextId++,color:'#FFD23F',position:100}
    ]};
    const els={
        type:$('#gradientType'),interpolation:$('#interpolation'),linearControls:$('#linearControls'),radialControls:$('#radialControls'),conicControls:$('#conicControls'),
        angle:$('#angleRange'),angleOutput:$('#angleOutput'),conic:$('#conicRange'),conicOutput:$('#conicOutput'),shape:$('#radialShape'),radialPosition:$('#radialPosition'),
        reverse:$('#reverseButton'),distribute:$('#distributeButton'),randomize:$('#randomizeButton'),preview:$('#gradientPreview'),previewMeta:$('#previewMeta'),
        cssCode:$('#cssCode'),copyCss:$('#copyCssButton'),downloadPng:$('#downloadPngButton'),addStop:$('#addStopButton'),stopCount:$('#stopCount'),stopList:$('#stopList'),
        nativeCode:$('#nativeCode'),fallbackCode:$('#fallbackCode'),copyNative:$('#copyNativeButton'),copyFallback:$('#copyFallbackButton')
    };
    function normalizeHex(v){v=String(v).trim();if(/^#[0-9a-f]{6}$/i.test(v))return v.toUpperCase();if(/^[0-9a-f]{6}$/i.test(v))return '#'+v.toUpperCase();return null}
    function hexToRgb(hex){const h=normalizeHex(hex),n=parseInt(h.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
    function toHex(v){return Math.round(clamp(v,0,255)).toString(16).padStart(2,'0').toUpperCase()}
    function rgbToHex(c){return '#'+toHex(c.r)+toHex(c.g)+toHex(c.b)}
    function srgbToLinear(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
    function linearToSrgb(v){return 255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055)}
    function rgbToOklab(rgb){
        const r=srgbToLinear(rgb.r),g=srgbToLinear(rgb.g),b=srgbToLinear(rgb.b);
        const l=.4122214708*r+.5363325363*g+.0514459929*b,m=.2119034982*r+.6806995451*g+.1073969566*b,s=.0883024619*r+.2817188376*g+.6299787005*b;
        const L=Math.cbrt(l),M=Math.cbrt(m),S=Math.cbrt(s);
        return{L:.2104542553*L+.793617785*M-.0040720468*S,a:1.9779984951*L-2.428592205*M+.4505937099*S,b:.0259040371*L+.7827717662*M-.808675766*S}
    }
    function oklabToRgbRaw(c){
        const L=c.L+.3963377774*c.a+.2158037573*c.b,M=c.L-.1055613458*c.a-.0638541728*c.b,S=c.L-.0894841775*c.a-1.291485548*c.b;
        const l=L**3,m=M**3,s=S**3;
        return{r:linearToSrgb(4.0767416621*l-3.3077115913*m+.2309699292*s),g:linearToSrgb(-1.2684380046*l+2.6097574011*m-.3413193965*s),b:linearToSrgb(-.0041960863*l-.7034186147*m+1.707614701*s)}
    }
    function labToLch(c){const C=Math.hypot(c.a,c.b);return{L:c.L,C,h:C<1e-8?0:wrapHue(Math.atan2(c.b,c.a)*180/Math.PI)}}
    function lchToLab(c){const r=c.h*Math.PI/180;return{L:c.L,a:c.C*Math.cos(r),b:c.C*Math.sin(r)}}
    function inGamut(c){return c.r>=0&&c.r<=255&&c.g>=0&&c.g<=255&&c.b>=0&&c.b<=255}
    function lchToRgb(c){const x={...c};let rgb=oklabToRgbRaw(lchToLab(x));for(let i=0;i<36&&!inGamut(rgb);i++){x.C*=.92;rgb=oklabToRgbRaw(lchToLab(x))}return{r:clamp(rgb.r,0,255),g:clamp(rgb.g,0,255),b:clamp(rgb.b,0,255)}}
    function interpolate(a,b,t,space){
        if(space==='srgb'){const A=hexToRgb(a),B=hexToRgb(b);return rgbToHex({r:A.r+(B.r-A.r)*t,g:A.g+(B.g-A.g)*t,b:A.b+(B.b-A.b)*t})}
        const A=labToLch(rgbToOklab(hexToRgb(a))),B=labToLch(rgbToOklab(hexToRgb(b)));
        let dh=((B.h-A.h+540)%360)-180;
        return rgbToHex(lchToRgb({L:A.L+(B.L-A.L)*t,C:A.C+(B.C-A.C)*t,h:wrapHue(A.h+dh*t)}))
    }
    function sortedStops(){return state.stops.slice().sort((a,b)=>a.position-b.position)}
    function colorAt(percent){
        const s=sortedStops(),p=clamp(percent,0,100);
        if(p<=s[0].position)return s[0].color;if(p>=s[s.length-1].position)return s[s.length-1].color;
        for(let i=0;i<s.length-1;i++){const a=s[i],b=s[i+1];if(p>=a.position&&p<=b.position){const t=(p-a.position)/Math.max(.0001,b.position-a.position);return interpolate(a.color,b.color,t,state.interpolation)}}
        return s[s.length-1].color
    }
    function stopString(stops){return stops.map(s=>s.color+' '+Number(s.position.toFixed(2))+'%').join(', ')}
    function nativeGradient(){
        const method=state.interpolation==='oklch'?' in oklch':'';
        const stops=stopString(sortedStops());
        if(state.type==='radial')return 'radial-gradient('+state.radialShape+' at '+state.radialPosition+method+', '+stops+')';
        if(state.type==='conic')return 'conic-gradient(from '+state.conicAngle+'deg'+method+', '+stops+')';
        return 'linear-gradient('+state.angle+'deg'+method+', '+stops+')'
    }
    function sampledStops(){
        if(state.interpolation==='srgb')return sortedStops();
        const count=17,out=[];for(let i=0;i<count;i++){const p=i/(count-1)*100;out.push({color:colorAt(p),position:p})}return out
    }
    function fallbackGradient(){
        const stops=stopString(sampledStops());
        if(state.type==='radial')return 'radial-gradient('+state.radialShape+' at '+state.radialPosition+', '+stops+')';
        if(state.type==='conic')return 'conic-gradient(from '+state.conicAngle+'deg, '+stops+')';
        return 'linear-gradient('+state.angle+'deg, '+stops+')'
    }
    function renderPreview(){
        const native=nativeGradient(),fallback=fallbackGradient();
        els.preview.style.background=fallback;
        els.cssCode.textContent='background: '+native+';';
        els.nativeCode.textContent='background: '+native+';';
        els.fallbackCode.textContent='background: '+fallback+';';
        const meta=state.type.charAt(0).toUpperCase()+state.type.slice(1)+(state.type==='linear'?' · '+state.angle+'°':state.type==='conic'?' · '+state.conicAngle+'°':' · '+state.radialShape)+' · '+state.interpolation.toUpperCase();
        els.previewMeta.textContent=meta
    }
    function renderControls(){
        els.linearControls.classList.toggle('hidden',state.type!=='linear');els.radialControls.classList.toggle('hidden',state.type!=='radial');els.conicControls.classList.toggle('hidden',state.type!=='conic');
        els.angleOutput.textContent=state.angle+'°';els.conicOutput.textContent=state.conicAngle+'°';els.stopCount.textContent=state.stops.length+' stop'+(state.stops.length===1?'':'s')
    }
    function renderStops(){
        els.stopList.innerHTML=state.stops.map((s,i)=>'<div class="stop-row" data-id="'+s.id+'">'+
            '<input class="stop-color" type="color" value="'+s.color+'" data-index="'+i+'" aria-label="Stop '+(i+1)+' color">'+
            '<input class="brut-input stop-hex" type="text" value="'+s.color+'" maxlength="7" data-index="'+i+'" spellcheck="false" aria-label="Stop '+(i+1)+' HEX">'+
            '<div class="position-wrap"><input class="stop-range" type="range" min="0" max="100" step="1" value="'+s.position+'" data-index="'+i+'"><input class="brut-input stop-position" type="number" min="0" max="100" step="1" value="'+s.position+'" data-index="'+i+'" aria-label="Stop '+(i+1)+' position"></div>'+
            '<span class="stop-position-label">'+s.position+'%</span>'+
            '<div class="stop-actions"><button class="move-up" type="button" data-index="'+i+'" '+(i===0?'disabled':'')+'>↑</button><button class="move-down" type="button" data-index="'+i+'" '+(i===state.stops.length-1?'disabled':'')+'>↓</button><button class="remove-stop" type="button" data-index="'+i+'" '+(state.stops.length<=2?'disabled':'')+'>×</button></div></div>').join('');
        $$('.stop-color').forEach(el=>el.addEventListener('input',()=>updateColor(+el.dataset.index,el.value)));
        $$('.stop-hex').forEach(el=>{el.addEventListener('input',()=>{const v=normalizeHex(el.value);if(v)updateColor(+el.dataset.index,v,false)});el.addEventListener('change',()=>{const v=normalizeHex(el.value);if(v)updateColor(+el.dataset.index,v);else renderAll()})});
        $$('.stop-range').forEach(el=>el.addEventListener('input',()=>updatePosition(+el.dataset.index,+el.value)));
        $$('.stop-position').forEach(el=>el.addEventListener('input',()=>updatePosition(+el.dataset.index,+el.value)));
        $$('.move-up').forEach(el=>el.addEventListener('click',()=>moveStop(+el.dataset.index,-1)));$$('.move-down').forEach(el=>el.addEventListener('click',()=>moveStop(+el.dataset.index,1)));$$('.remove-stop').forEach(el=>el.addEventListener('click',()=>removeStop(+el.dataset.index)))
    }
    function renderAll(){renderControls();renderStops();renderPreview();syncUrl()}
    function updateColor(i,value,full=true){const v=normalizeHex(value);if(!v)return;state.stops[i].color=v;if(full)renderAll();else renderPreview()}
    function updatePosition(i,value){state.stops[i].position=clamp(Math.round(value),0,100);renderAll()}
    function moveStop(i,d){const t=i+d;if(t<0||t>=state.stops.length)return;[state.stops[i],state.stops[t]]=[state.stops[t],state.stops[i]];renderAll()}
    function removeStop(i){if(state.stops.length<=2)return;state.stops.splice(i,1);renderAll()}
    function addStop(){
        if(state.stops.length>=10)return;
        const s=sortedStops();let best={gap:-1,pos:50};
        for(let i=0;i<s.length-1;i++){const gap=s[i+1].position-s[i].position;if(gap>best.gap)best={gap,pos:(s[i].position+s[i+1].position)/2}}
        state.stops.push({id:nextId++,color:colorAt(best.pos),position:Math.round(best.pos)});renderAll()
    }
    function distribute(){state.stops.sort((a,b)=>a.position-b.position);state.stops.forEach((s,i)=>s.position=Math.round(i/(state.stops.length-1)*100));renderAll()}
    function reverse(){state.stops=state.stops.map(s=>({...s,position:100-s.position})).reverse();renderAll()}
    function randomHex(){return rgbToHex({r:40+Math.random()*190,g:40+Math.random()*190,b:40+Math.random()*190})}
    function randomize(){state.stops.forEach(s=>s.color=randomHex());renderAll()}
    async function copy(text){try{await navigator.clipboard.writeText(text)}catch{}}
    function syncUrl(){
        const u=new URL(location.href);
        u.searchParams.set('type',state.type);
        u.searchParams.set('space',state.interpolation);
        u.searchParams.set('angle',state.type==='conic'?state.conicAngle:state.angle);
        if(state.type==='radial'){u.searchParams.set('shape',state.radialShape);u.searchParams.set('position',state.radialPosition)}else{u.searchParams.delete('shape');u.searchParams.delete('position')}
        u.searchParams.set('stops',sortedStops().map(s=>s.color.slice(1)+'-'+s.position).join('_'));
        history.replaceState(null,'',u)
    }
    function loadUrl(){
        const q=new URLSearchParams(location.search),type=q.get('type'),space=q.get('space'),angle=Number(q.get('angle'));
        if(['linear','radial','conic'].includes(type))state.type=type;
        if(['srgb','oklch'].includes(space))state.interpolation=space;
        if(Number.isFinite(angle)){if(state.type==='conic')state.conicAngle=clamp(angle,0,360);else state.angle=clamp(angle,0,360)}
        const shape=q.get('shape'),position=q.get('position');
        if(['circle','ellipse'].includes(shape))state.radialShape=shape;
        if(['center','top','right','bottom','left','top left','top right','bottom left','bottom right'].includes(position))state.radialPosition=position;
        const raw=q.get('stops');if(raw){const parsed=raw.split('_').map(part=>{const m=/^([0-9a-f]{6})-(\d{1,3})$/i.exec(part);return m?{id:nextId++,color:'#'+m[1].toUpperCase(),position:clamp(+m[2],0,100)}:null}).filter(Boolean);if(parsed.length>=2&&parsed.length<=10)state.stops=parsed}
        els.type.value=state.type;els.interpolation.value=state.interpolation;els.angle.value=state.angle;els.conic.value=state.conicAngle;els.shape.value=state.radialShape;els.radialPosition.value=state.radialPosition
    }
    function downloadPng(){
        const w=1200,h=675,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),img=ctx.createImageData(w,h),data=img.data;
        const rad=state.angle*Math.PI/180,dx=Math.sin(rad),dy=-Math.cos(rad);
        for(let y=0;y<h;y++){for(let x=0;x<w;x++){let p=0;
            if(state.type==='linear'){const nx=x/(w-1)-.5,ny=y/(h-1)-.5;p=((nx*dx+ny*dy)/Math.max(Math.abs(dx)+Math.abs(dy),.001)+.5)*100}
            else if(state.type==='radial'){
                const posMap={'center':[.5,.5],'top':[.5,0],'right':[1,.5],'bottom':[.5,1],'left':[0,.5],'top left':[0,0],'top right':[1,0],'bottom left':[0,1],'bottom right':[1,1]};
                const pos=posMap[state.radialPosition]||posMap.center,cx=pos[0],cy=pos[1],nx=x/(w-1)-cx,ny=y/(h-1)-cy;
                const sx=state.radialShape==='circle'?Math.min(w,h)/w:1,sy=state.radialShape==='circle'?Math.min(w,h)/h:1;
                p=Math.min(100,Math.hypot(nx/(.5*sx),ny/(.5*sy))*100)
            }
            else{const nx=x-w/2,ny=y-h/2;let deg=(Math.atan2(nx,-ny)*180/Math.PI-state.conicAngle+360)%360;p=deg/360*100}
            const rgb=hexToRgb(colorAt(p)),i=(y*w+x)*4;data[i]=rgb.r;data[i+1]=rgb.g;data[i+2]=rgb.b;data[i+3]=255
        }}
        ctx.putImageData(img,0,0);c.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='astakula-gradient.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')
    }
    els.type.addEventListener('change',()=>{state.type=els.type.value;renderAll()});els.interpolation.addEventListener('change',()=>{state.interpolation=els.interpolation.value;renderAll()});
    els.angle.addEventListener('input',()=>{state.angle=+els.angle.value;renderAll()});els.conic.addEventListener('input',()=>{state.conicAngle=+els.conic.value;renderAll()});
    els.shape.addEventListener('change',()=>{state.radialShape=els.shape.value;renderAll()});els.radialPosition.addEventListener('change',()=>{state.radialPosition=els.radialPosition.value;renderAll()});
    els.reverse.addEventListener('click',reverse);els.distribute.addEventListener('click',distribute);els.randomize.addEventListener('click',randomize);els.addStop.addEventListener('click',addStop);
    els.copyCss.addEventListener('click',()=>copy('background: '+nativeGradient()+';'));els.copyNative.addEventListener('click',()=>copy('background: '+nativeGradient()+';'));els.copyFallback.addEventListener('click',()=>copy('background: '+fallbackGradient()+';'));els.downloadPng.addEventListener('click',downloadPng);
    loadUrl();renderAll()
})();