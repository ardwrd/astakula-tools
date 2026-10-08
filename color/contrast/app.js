(() => {
    const $=(s)=>document.querySelector(s);
    const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
    const els={
        fgPicker:$('#foregroundPicker'),fgHex:$('#foregroundHex'),bgPicker:$('#backgroundPicker'),bgHex:$('#backgroundHex'),
        swap:$('#swapButton'),copyFg:$('#copyForeground'),copyBg:$('#copyBackground'),ratio:$('#ratioValue'),summary:$('#ratioSummary'),
        compliance:$('#complianceGrid'),suggestionBox:$('#suggestionBox'),suggestionText:$('#suggestionText'),suggestionSwatch:$('#suggestionSwatch'),
        applySuggestion:$('#applySuggestionButton'),preview:$('#previewCanvas'),fgRgb:$('#foregroundRgb'),bgRgb:$('#backgroundRgb'),
        fgLum:$('#foregroundLum'),bgLum:$('#backgroundLum')
    };
    let suggestion=null;

    function normalizeHex(value){
        const v=String(value).trim();
        if(/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
        if(/^[0-9a-f]{6}$/i.test(v)) return '#'+v.toUpperCase();
        return null;
    }
    function hexToRgb(hex){
        const h=normalizeHex(hex); if(!h) return null;
        const n=parseInt(h.slice(1),16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
    }
    function rgbToHex(rgb){
        const p=(v)=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0').toUpperCase();
        return '#'+p(rgb.r)+p(rgb.g)+p(rgb.b);
    }
    function toLinear(v){v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
    function luminance(hex){const c=hexToRgb(hex);return .2126*toLinear(c.r)+.7152*toLinear(c.g)+.0722*toLinear(c.b)}
    function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    function mix(a,b,t){const A=hexToRgb(a),B=hexToRgb(b);return rgbToHex({r:A.r+(B.r-A.r)*t,g:A.g+(B.g-A.g)*t,b:A.b+(B.b-A.b)*t})}
    function summaryFor(r){if(r>=21-.01)return'Maximum black/white contrast';if(r>=7)return'Excellent for normal text';if(r>=4.5)return'Passes AA normal text';if(r>=3)return'Passes large text / non-text threshold';return'Insufficient for WCAG text contrast'}
    function nearestAccessibleForeground(fg,bg,target){
        if(ratio(fg,bg)>=target) return null;
        const candidates=['#000000','#FFFFFF'];
        let best=null;
        for(const endpoint of candidates){
            if(ratio(endpoint,bg)<target) continue;
            let lo=0,hi=1,found=endpoint;
            for(let i=0;i<28;i++){
                const mid=(lo+hi)/2;
                const c=mix(fg,endpoint,mid);
                if(ratio(c,bg)>=target){found=c;hi=mid}else lo=mid;
            }
            if(!best||colorDelta(fg,found)<colorDelta(fg,best))best=found;
        }
        return best;
    }
    function colorDelta(a,b){
        const A=hexToRgb(a),B=hexToRgb(b);return Math.hypot(A.r-B.r,A.g-B.g,A.b-B.b);
    }
    function card(label,threshold,r,kind){
        const pass=r>=threshold;
        return '<article class="compliance-card '+(pass?'pass':'fail')+'"><span>'+label+'</span><strong>'+(pass?'PASS':'FAIL')+'</strong><span>'+kind+' · '+threshold.toFixed(1)+':1 minimum</span></article>';
    }
    function render(){
        const fg=normalizeHex(els.fgHex.value),bg=normalizeHex(els.bgHex.value);
        if(!fg||!bg)return;
        els.fgHex.value=fg;els.bgHex.value=bg;els.fgPicker.value=fg;els.bgPicker.value=bg;
        const r=ratio(fg,bg);
        els.ratio.textContent=r.toFixed(2)+' : 1';els.summary.textContent=summaryFor(r);
        els.compliance.innerHTML=[
            card('AA normal text',4.5,r,'WCAG text'),
            card('AA large text',3,r,'WCAG text'),
            card('AAA normal text',7,r,'Enhanced text'),
            card('AAA large text',4.5,r,'Enhanced text'),
            card('Non-text UI',3,r,'Components / graphics')
        ].join('');
        els.preview.style.background=bg;els.preview.style.color=fg;
        const F=hexToRgb(fg),B=hexToRgb(bg);
        els.fgRgb.textContent='rgb('+F.r+', '+F.g+', '+F.b+')';els.bgRgb.textContent='rgb('+B.r+', '+B.g+', '+B.b+')';
        els.fgLum.textContent=luminance(fg).toFixed(4);els.bgLum.textContent=luminance(bg).toFixed(4);
        suggestion=nearestAccessibleForeground(fg,bg,4.5);
        if(suggestion){
            const sr=ratio(suggestion,bg);
            els.suggestionText.textContent=suggestion+' · '+sr.toFixed(2)+' : 1';
            els.suggestionSwatch.style.background=suggestion;
            els.suggestionBox.classList.remove('hidden');
        }else{
            els.suggestionBox.classList.add('hidden');
        }
        syncUrl(fg,bg);
    }
    function syncUrl(fg,bg){
        const url=new URL(location.href);url.searchParams.set('fg',fg.slice(1));url.searchParams.set('bg',bg.slice(1));
        history.replaceState(null,'',url);
    }
    function applyFromUrl(){
        const q=new URLSearchParams(location.search);
        const fg=normalizeHex(q.get('fg')||''),bg=normalizeHex(q.get('bg')||'');
        if(fg){els.fgHex.value=fg;els.fgPicker.value=fg}
        if(bg){els.bgHex.value=bg;els.bgPicker.value=bg}
    }
    async function copy(text){try{await navigator.clipboard.writeText(text)}catch{}}
    function bindPair(picker,input){
        picker.addEventListener('input',()=>{input.value=picker.value.toUpperCase();render()});
        input.addEventListener('input',()=>{const v=normalizeHex(input.value);if(v){picker.value=v;render()}});
        input.addEventListener('change',()=>{const v=normalizeHex(input.value);if(v){input.value=v;render()}else render()});
    }
    bindPair(els.fgPicker,els.fgHex);bindPair(els.bgPicker,els.bgHex);
    els.swap.addEventListener('click',()=>{const fg=els.fgHex.value;els.fgHex.value=els.bgHex.value;els.bgHex.value=fg;render()});
    els.copyFg.addEventListener('click',()=>copy(els.fgHex.value));els.copyBg.addEventListener('click',()=>copy(els.bgHex.value));
    document.querySelectorAll('[data-fg][data-bg]').forEach(btn=>btn.addEventListener('click',()=>{els.fgHex.value=btn.dataset.fg;els.bgHex.value=btn.dataset.bg;render()}));
    els.applySuggestion.addEventListener('click',()=>{if(!suggestion)return;els.fgHex.value=suggestion;render()});
    applyFromUrl();render();
})();