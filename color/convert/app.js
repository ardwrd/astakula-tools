(() => {
    const $=(s)=>document.querySelector(s),$$=(s)=>Array.from(document.querySelectorAll(s));
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    const wrapHue=(h)=>((h%360)+360)%360;
    const els={
        picker:$('#colorPicker'),hex:$('#hexInput'),paste:$('#pasteInput'),apply:$('#applyPasteButton'),status:$('#statusBox'),heroSwatch:$('#heroSwatch'),heroHex:$('#heroHex'),
        conversionGrid:$('#conversionGrid'),contrastCards:$('#contrastCards'),metricGrid:$('#metricGrid'),scaleGrid:$('#scaleGrid'),contrastLink:$('#openContrastLink'),
        cssHex:$('#cssHex'),cssRgb:$('#cssRgb'),cssHsl:$('#cssHsl'),cssOklch:$('#cssOklch')
    };
    let current='#64145C';

    function normalizeHex(value){
        let v=String(value).trim();
        if(/^#[0-9a-f]{3}$/i.test(v))v='#'+v.slice(1).split('').map(c=>c+c).join('');
        if(/^#[0-9a-f]{6}$/i.test(v))return v.toUpperCase();
        if(/^[0-9a-f]{6}$/i.test(v))return '#'+v.toUpperCase();
        return null
    }
    const hex2=v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0').toUpperCase();
    const rgbToHex=c=>'#'+hex2(c.r)+hex2(c.g)+hex2(c.b);
    function hexToRgb(hex){const h=normalizeHex(hex),n=parseInt(h.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
    function rgbToHsl(rgb){
        let r=rgb.r/255,g=rgb.g/255,b=rgb.b/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2,d=max-min;
        if(d){s=d/(1-Math.abs(2*l-1));if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}
        return{h:wrapHue(h),s:s*100,l:l*100}
    }
    function hslToRgb(hsl){
        let h=wrapHue(hsl.h),s=clamp(hsl.s,0,100)/100,l=clamp(hsl.l,0,100)/100,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r=0,g=0,b=0;
        if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
        return{r:(r+m)*255,g:(g+m)*255,b:(b+m)*255}
    }
    function rgbToHsv(rgb){
        const r=rgb.r/255,g=rgb.g/255,b=rgb.b/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;
        if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}
        return{h:wrapHue(h),s:max===0?0:d/max*100,v:max*100}
    }
    function rgbToCmyk(rgb){
        const r=rgb.r/255,g=rgb.g/255,b=rgb.b/255,k=1-Math.max(r,g,b);if(k>=.999999)return{c:0,m:0,y:0,k:100};
        return{c:(1-r-k)/(1-k)*100,m:(1-g-k)/(1-k)*100,y:(1-b-k)/(1-k)*100,k:k*100}
    }
    const toLinear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
    const linearToSrgb=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
    function rgbToXyz(rgb){
        const r=toLinear(rgb.r),g=toLinear(rgb.g),b=toLinear(rgb.b);
        return{x:(.4124564*r+.3575761*g+.1804375*b)*100,y:(.2126729*r+.7151522*g+.072175*b)*100,z:(.0193339*r+.119192*g+.9503041*b)*100}
    }
    function xyzToRgb(xyz){
        const x=xyz.x/100,y=xyz.y/100,z=xyz.z/100;
        return{r:linearToSrgb(3.2404542*x-1.5371385*y-.4985314*z),g:linearToSrgb(-.969266*x+1.8760108*y+.041556*z),b:linearToSrgb(.0556434*x-.2040259*y+1.0572252*z)}
    }
    function rgbToOklab(rgb){
        const r=toLinear(rgb.r),g=toLinear(rgb.g),b=toLinear(rgb.b);
        const l=.4122214708*r+.5363325363*g+.0514459929*b,m=.2119034982*r+.6806995451*g+.1073969566*b,s=.0883024619*r+.2817188376*g+.6299787005*b;
        const L=Math.cbrt(l),M=Math.cbrt(m),S=Math.cbrt(s);
        return{L:.2104542553*L+.793617785*M-.0040720468*S,a:1.9779984951*L-2.428592205*M+.4505937099*S,b:.0259040371*L+.7827717662*M-.808675766*S}
    }
    function oklabToRgbRaw(c){
        const L=c.L+.3963377774*c.a+.2158037573*c.b,M=c.L-.1055613458*c.a-.0638541728*c.b,S=c.L-.0894841775*c.a-1.291485548*c.b,l=L**3,m=M**3,s=S**3;
        return{r:linearToSrgb(4.0767416621*l-3.3077115913*m+.2309699292*s),g:linearToSrgb(-1.2684380046*l+2.6097574011*m-.3413193965*s),b:linearToSrgb(-.0041960863*l-.7034186147*m+1.707614701*s)}
    }
    function labToLch(c){const C=Math.hypot(c.a,c.b);return{L:c.L,C,h:C<1e-8?0:wrapHue(Math.atan2(c.b,c.a)*180/Math.PI)}}
    function lchToLab(c){const r=c.h*Math.PI/180;return{L:c.L,a:c.C*Math.cos(r),b:c.C*Math.sin(r)}}
    function inGamut(c){return c.r>=0&&c.r<=255&&c.g>=0&&c.g<=255&&c.b>=0&&c.b<=255}
    function lchToRgb(c){const x={...c};let rgb=oklabToRgbRaw(lchToLab(x));for(let i=0;i<36&&!inGamut(rgb);i++){x.C*=.92;rgb=oklabToRgbRaw(lchToLab(x))}return{r:clamp(rgb.r,0,255),g:clamp(rgb.g,0,255),b:clamp(rgb.b,0,255)}}
    function luminance(hex){const c=hexToRgb(hex);return .2126*toLinear(c.r)+.7152*toLinear(c.g)+.0722*toLinear(c.b)}
    function ratio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    function bestText(bg){return ratio('#111318',bg)>=ratio('#FFFFFF',bg)?'#111318':'#FFFFFF'}
    function fmt(n,d=1){return Number(n).toFixed(d).replace(/\.0$/,'')}

    function parseColor(value){
        const raw=String(value).trim();let hex=normalizeHex(raw);if(hex)return hex;
        let m=raw.match(/^rgb\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)$/i);
        if(m)return rgbToHex({r:+m[1],g:+m[2],b:+m[3]});
        m=raw.match(/^hsl\(\s*([\d.+-]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)$/i);
        if(m)return rgbToHex(hslToRgb({h:+m[1],s:+m[2],l:+m[3]}));
        m=raw.match(/^oklab\(\s*([\d.]+)%?\s+([\d.+-]+)\s+([\d.+-]+)\s*\)$/i);
        if(m){const L=raw.includes('%')?+m[1]/100:+m[1];return rgbToHex(oklabToRgbRaw({L,a:+m[2],b:+m[3]}))}
        m=raw.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.+-]+)(?:deg)?\s*\)$/i);
        if(m){const L=raw.includes('%')?+m[1]/100:+m[1];return rgbToHex(lchToRgb({L,C:+m[2],h:+m[3]}))}
        return null
    }

    function setColor(value,message){
        const hex=parseColor(value);if(!hex){setStatus('Unsupported color value. Use HEX, rgb(), hsl(), oklab(), or oklch().','error');return false}
        current=hex;els.hex.value=hex;els.picker.value=hex;render();setStatus(message||'Color updated.','success');return true
    }
    function setStatus(msg,type){els.status.textContent=msg;els.status.className='status-box'+(type?' is-'+type:'')}
    function conversions(){
        const rgb=hexToRgb(current),hsl=rgbToHsl(rgb),hsv=rgbToHsv(rgb),cmyk=rgbToCmyk(rgb),xyz=rgbToXyz(rgb),lab=rgbToOklab(rgb),lch=labToLch(lab);
        return{rgb,hsl,hsv,cmyk,xyz,lab,lch}
    }
    function conversionCard(label,value,note,key){
        return '<article class="conversion-card"><div class="conversion-card-head"><strong>'+label+'</strong><button class="brut-btn brut-btn--sm copy-value" type="button" data-key="'+key+'">Copy</button></div><span class="conversion-value">'+value+'</span><p>'+note+'</p></article>'
    }
    function renderConversions(data){
        const values={
            hex:current,
            rgb:'rgb('+Math.round(data.rgb.r)+', '+Math.round(data.rgb.g)+', '+Math.round(data.rgb.b)+')',
            hsl:'hsl('+fmt(data.hsl.h)+' '+fmt(data.hsl.s)+'% '+fmt(data.hsl.l)+'%)',
            hsv:'hsv('+fmt(data.hsv.h)+'°, '+fmt(data.hsv.s)+'%, '+fmt(data.hsv.v)+'%)',
            cmyk:'cmyk('+fmt(data.cmyk.c)+'%, '+fmt(data.cmyk.m)+'%, '+fmt(data.cmyk.y)+'%, '+fmt(data.cmyk.k)+'%)',
            xyz:'XYZ D65('+fmt(data.xyz.x,2)+', '+fmt(data.xyz.y,2)+', '+fmt(data.xyz.z,2)+')',
            oklab:'oklab('+fmt(data.lab.L*100,2)+'% '+fmt(data.lab.a,4)+' '+fmt(data.lab.b,4)+')',
            oklch:'oklch('+fmt(data.lch.L*100,2)+'% '+fmt(data.lch.C,4)+' '+fmt(data.lch.h,2)+')'
        };
        els.conversionGrid.innerHTML=
            conversionCard('HEX',values.hex,'sRGB hexadecimal notation.','hex')+
            conversionCard('RGB',values.rgb,'8-bit sRGB channels.','rgb')+
            conversionCard('HSL',values.hsl,'Hue, saturation, and HSL lightness.','hsl')+
            conversionCard('HSV / HSB',values.hsv,'Hue, saturation, and value / brightness.','hsv')+
            conversionCard('CMYK',values.cmyk,'Simple arithmetic approximation from sRGB; not ICC/profile-managed print conversion.','cmyk')+
            conversionCard('XYZ D65',values.xyz,'CIE XYZ tristimulus values using D65.','xyz')+
            conversionCard('Oklab',values.oklab,'Perceptual lightness with a/b opponent axes.','oklab')+
            conversionCard('OKLCH',values.oklch,'Polar Oklab: lightness, chroma, hue.','oklch');
        $$('.copy-value').forEach(b=>b.addEventListener('click',()=>copy(values[b.dataset.key])));
        return values
    }
    function renderInspector(data){
        const black=ratio(current,'#111318'),white=ratio(current,'#FFFFFF'),best=bestText(current);
        const contrastCard=(name,color,r)=>'<article class="contrast-card" style="background:'+color+';color:'+bestText(color)+'"><span>'+name+'</span><strong>'+r.toFixed(2)+' : 1</strong><small>'+(r>=7?'AAA normal':r>=4.5?'AA normal':r>=3?'Large text AA':'Fails text AA')+'</small></article>';
        els.contrastCards.innerHTML=contrastCard('Against ink','#111318',black)+contrastCard('Against white','#FFFFFF',white);
        els.contrastLink.href='../contrast/?fg='+best.slice(1)+'&bg='+current.slice(1);
        const lum=luminance(current),lch=data.lch,saturation=data.hsl.s;
        let family='Neutral';if(lch.C>.03){const h=lch.h;family=h<15||h>=345?'Red':h<45?'Orange':h<70?'Yellow':h<165?'Green':h<205?'Cyan':h<260?'Blue':h<300?'Purple':'Magenta'}
        const temp=(lch.C<.03)?'Neutral':(lch.h<90||lch.h>=300?'Warm':'Cool');
        els.metricGrid.innerHTML=[
            ['Relative luminance',lum.toFixed(4)],
            ['Best text',best],
            ['Hue family',family],
            ['Hue temperature (heuristic)',temp],
            ['OKLCH chroma',lch.C.toFixed(4)],
            ['HSL saturation',fmt(saturation)+'%'],
            ['Luminance band (heuristic)',lum>.45?'Light':'Dark'],
            ['sRGB gamut','Inside']
        ].map(x=>'<article class="metric-card"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>').join('')
    }
    function renderScale(data){
        const stops=[['50',.97,.18],['100',.93,.32],['200',.86,.52],['300',.77,.72],['400',.68,.88],['500',.60,1],['600',.52,.96],['700',.44,.88],['800',.36,.76],['900',.28,.62],['950',.20,.50]];
        els.scaleGrid.innerHTML=stops.map(s=>{const h=rgbToHex(lchToRgb({L:s[1],C:data.lch.C*s[2],h:data.lch.h}));return'<article class="scale-stop"><div class="scale-swatch" style="background:'+h+'"></div><div class="scale-copy"><strong>'+s[0]+'</strong><span>'+h+'</span></div></article>'}).join('')
    }
    function renderCss(values){
        els.cssHex.textContent='color: '+values.hex+';';els.cssRgb.textContent='color: '+values.rgb+';';els.cssHsl.textContent='color: '+values.hsl+';';els.cssOklch.textContent='color: '+values.oklch+';';
        $$('[data-copy-format]').forEach(b=>b.onclick=()=>copy(({hex:'color: '+values.hex+';',rgb:'color: '+values.rgb+';',hsl:'color: '+values.hsl+';',oklch:'color: '+values.oklch+';'})[b.dataset.copyFormat]))
    }
    function render(){
        const data=conversions(),text=bestText(current);
        els.heroSwatch.style.background=current;els.heroSwatch.style.color=text;els.heroHex.textContent=current;
        const values=renderConversions(data);renderInspector(data);renderScale(data);renderCss(values);
        const url=new URL(location.href);url.searchParams.set('color',current.slice(1));history.replaceState(null,'',url)
    }
    async function copy(text){try{await navigator.clipboard.writeText(text);setStatus('Copied '+text+'.','success')}catch{setStatus('Clipboard access was blocked by the browser.','error')}}
    els.picker.addEventListener('input',()=>setColor(els.picker.value));
    els.hex.addEventListener('input',()=>{const v=normalizeHex(els.hex.value);if(v){current=v;els.picker.value=v;render()}});
    els.hex.addEventListener('change',()=>{if(!setColor(els.hex.value))els.hex.value=current});
    els.paste.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();els.apply.click()}});
    els.apply.addEventListener('click',()=>{if(setColor(els.paste.value,'Pasted color converted.'))els.paste.value=''});
    $$('.quick-presets button').forEach(b=>b.addEventListener('click',()=>setColor(b.dataset.color,b.textContent+' preset loaded.')));
    const initial=new URLSearchParams(location.search).get('color');if(initial)setColor(initial);else render()
})();