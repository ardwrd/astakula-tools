/** Browser-side PDF transformations. No network calls. */
export function parsePageList(input, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("PDF has no pages.");
  const value = String(input ?? "").trim();
  if (!value) throw new Error("Enter a page number or range.");
  const pages = [];
  for (const item of value.split(",")) {
    const token = item.trim();
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Invalid page expression: " + (token || "(empty)") + ".");
    const a = Number(match[1]), b = match[2] ? Number(match[2]) : a;
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 1 || b < 1 || a > count || b > count)
      throw new Error("Range " + token + " is outside this " + count + "-page document.");
    const step = a <= b ? 1 : -1;
    for (let page = a; step > 0 ? page <= b : page >= b; page += step) {
      pages.push(page);
      if (pages.length > count * 2) throw new Error("Too many page references.");
    }
  }
  return pages;
}

async function readPdf(lib, bytes) {
  if (!lib?.PDFDocument) throw new Error("PDF library unavailable.");
  let pdf;
  try { pdf = await lib.PDFDocument.load(bytes, {updateMetadata:false}); }
  catch (error) {
    if (/password|encrypt/i.test(String(error?.message))) throw new Error("Encrypted PDFs are not supported.");
    throw new Error("Could not read this PDF.");
  }
  if (!pdf.getPageCount()) throw new Error("PDF has no pages.");
  return pdf;
}

export async function removePages(lib, bytes, expression) {
  const pdf = await readPdf(lib, bytes);
  const selected = new Set(parsePageList(expression, pdf.getPageCount()));
  if (selected.size === pdf.getPageCount()) throw new Error("At least one page must remain.");
  [...selected].sort((a,b)=>b-a).forEach(n=>pdf.removePage(n-1));
  return {bytes:await pdf.save({useObjectStreams:true}),pages:pdf.getPageCount()};
}

export async function splitPages(lib, bytes, maxPages=40) {
  const source = await readPdf(lib, bytes), count = source.getPageCount();
  if (count > maxPages) throw new Error("Split supports up to " + maxPages + " pages per run.");
  const results=[];
  for(let i=0;i<count;i++){
    const pdf=await lib.PDFDocument.create();
    const [page]=await pdf.copyPages(source,[i]);pdf.addPage(page);
    results.push({name:"page-"+String(i+1).padStart(3,"0")+".pdf",bytes:await pdf.save({useObjectStreams:true})});
  }
  return results;
}

function kindOfImage(bytes) {
  const b=new Uint8Array(bytes);
  if(b.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)) return "png";
  if(b.length>=3 && b[0]===255 && b[1]===216 && b[2]===255) return "jpg";
  return null;
}

export async function imagesToPdf(lib, images) {
  if(!Array.isArray(images)||!images.length||images.length>12) throw new Error("Choose 1 to 12 images.");
  if (images.reduce((sum, image) => sum + (image.bytes?.byteLength || 0), 0) > 60 * 1024 * 1024)
    throw new Error("Images must total 60 MB or less.");
  const pdf=await lib.PDFDocument.create();
  for(const image of images){
    if(!image.bytes || image.bytes.byteLength>15*1024*1024) throw new Error("Each image must be at most 15 MB.");
    const kind=kindOfImage(image.bytes);
    if(!kind) throw new Error("Only valid PNG and JPEG images are supported.");
    let embedded;
    try{embedded=kind==="png"?await pdf.embedPng(image.bytes):await pdf.embedJpg(image.bytes);}
    catch{throw new Error("Cannot decode this PNG or JPEG image.");}
    const portrait=embedded.height>=embedded.width;
    const width=portrait?595.28:841.89, height=portrait?841.89:595.28;
    const scale=Math.min((width-48)/embedded.width,(height-48)/embedded.height);
    const w=embedded.width*scale,h=embedded.height*scale;
    pdf.addPage([width,height]).drawImage(embedded,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
  }
  return {bytes:await pdf.save({useObjectStreams:true}),pages:pdf.getPageCount()};
}

export async function addWatermark(lib,bytes,value,opacity=0.25){
  const text=String(value??"").trim();
  if(!text||text.length>60) throw new Error("Enter 1 to 60 watermark characters.");
  if(!/^[\x20-\x7E]+$/.test(text)) throw new Error("Watermark supports basic English letters, numbers, and punctuation.");
  if(!Number.isFinite(opacity)||opacity<0.1||opacity>0.7) throw new Error("Invalid watermark opacity.");
  const pdf=await readPdf(lib,bytes),font=await pdf.embedFont(lib.StandardFonts.HelveticaBold);
  for(const page of pdf.getPages()){
    const {width,height}=page.getSize();
    const size=Math.min(48,Math.max(14,Math.min(width,height)*0.6/text.length));
    const tw=font.widthOfTextAtSize(text,size);
    page.drawText(text,{x:Math.max(10,(width-tw)/2),y:height/2,
      font,size,color:lib.rgb(0.33,0.34,0.37),opacity});
  }
  return {bytes:await pdf.save({useObjectStreams:true}),pages:pdf.getPageCount()};
}

export async function addPageNumbers(lib,bytes,position="right"){
  if(!["right","center"].includes(position)) throw new Error("Invalid page number position.");
  const pdf=await readPdf(lib,bytes),font=await pdf.embedFont(lib.StandardFonts.Helvetica);
  const pages=pdf.getPages();
  pages.forEach((page,index)=>{
    const label=String(index+1)+" / "+String(pages.length);
    const width=font.widthOfTextAtSize(label,11);
    const x=position==="center"?(page.getWidth()-width)/2:page.getWidth()-width-24;
    page.drawText(label,{x:Math.max(12,x),y:20,size:11,font,color:lib.rgb(.25,.25,.25)});
  });
  return {bytes:await pdf.save({useObjectStreams:true}),pages:pages.length};
}
