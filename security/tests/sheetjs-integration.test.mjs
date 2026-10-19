import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const paths = ['excel', 'certificate', 'schedule'];

test('all spreadsheet tools load a pinned patched SheetJS browser build',()=>{
  for (const path of paths) {
    const html=readFileSync(new URL('../../'+path+'/index.html',import.meta.url),'utf8');
    assert.ok(html.includes('<script src="'+SHEETJS_URL+'"></script>'),path+' must use official pinned SheetJS URL');
    assert.doesNotMatch(html,/xlsx@0\.18\.5/);
  }
});

test('official SheetJS 0.20.3 script can load and round-trip a workbook',async()=>{
  const response=await fetch(SHEETJS_URL,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,'Official CDN should deliver the pinned distribution');
  const js=await response.text();
  const context=vm.createContext({});
  vm.runInContext(js,context,{timeout:30000});
  const XLSX=context.XLSX;
  assert.equal(XLSX?.version,'0.20.3');
  const sheet=XLSX.utils.aoa_to_sheet([['Nama','Nilai'],['Astakula',42]]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet,'Data');
  const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const reopened=XLSX.read(bytes,{type:'array'});
  const rows=XLSX.utils.sheet_to_json(reopened.Sheets.Data,{header:1});
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),[['Nama','Nilai'],['Astakula',42]]);
  const csv=XLSX.utils.sheet_to_csv(reopened.Sheets.Data);
  assert.match(csv,/Astakula,42/);
});
