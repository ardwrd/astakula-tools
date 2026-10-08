import test from "node:test";
import assert from "node:assert/strict";
import * as lib from "pdf-lib";
import {parsePageList,removePages,splitPages,imagesToPdf,addWatermark,addPageNumbers} from "../js/pdf-operations.mjs";
async function sample(n=4){const pdf=await lib.PDFDocument.create();for(let i=0;i<n;i++)pdf.addPage([300,400]);return pdf.save();}
test("page ranges validate bounds and support reverse",()=>{
  assert.deepEqual(parsePageList("1-3,4-2",4),[1,2,3,4,3,2]);
  assert.throws(()=>parsePageList("0",4),/outside/);
  assert.throws(()=>parsePageList("1,,2",4),/Invalid/);
});
test("remove preserves nonremoved pages",async()=>{
  const bytes=await sample();
  const out=await removePages(lib,bytes,"2,4,4");
  assert.equal(out.pages,2);
  assert.equal((await lib.PDFDocument.load(out.bytes)).getPageCount(),2);
  await assert.rejects(removePages(lib,bytes,"1-4"),/At least one/);
});
test("split creates independent PDFs",async()=>{
  const parts=await splitPages(lib,await sample(3));
  assert.deepEqual(parts.map(p=>p.name),["page-001.pdf","page-002.pdf","page-003.pdf"]);
  for(const p of parts)assert.equal((await lib.PDFDocument.load(p.bytes)).getPageCount(),1);
  await assert.rejects(splitPages(lib,await sample(3),2),/up to 2/);
});
test("watermark and page numbers create valid PDFs",async()=>{
  const w=await addWatermark(lib,await sample(2),"ASTAKULA",.25);
  assert.equal((await lib.PDFDocument.load(w.bytes)).getPageCount(),2);
  const n=await addPageNumbers(lib,await sample(3),"center");
  assert.equal((await lib.PDFDocument.load(n.bytes)).getPageCount(),3);
  await assert.rejects(addWatermark(lib,await sample(1),"©"),/basic English/);
});
test("reject non-images",async()=>{
  await assert.rejects(imagesToPdf(lib,[{bytes:new Uint8Array([1,2,3])}]),/PNG and JPEG/);
});

test("image conversion enforces aggregate memory limit",async()=>{
  const image=new Uint8Array(13*1024*1024);
  await assert.rejects(imagesToPdf(lib,Array.from({length:5},()=>({bytes:image}))),/60 MB/);
});
