import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const section = (from,to) => {
  const start=source.indexOf(from),end=source.indexOf(to,start);
  assert.ok(start>=0 && end>start,'Missing function '+from);
  return source.slice(start,end);
};
const esc = vm.runInNewContext(section('function esc(v)','function syncInputs')+'\nesc');

function stubElement(){return {innerHTML:'',querySelectorAll(){return []}}}
function makeContext({employees=[],shifts=[],projects=[]}={}) {
  const els={employeeList:stubElement(),shiftList:stubElement(),scheduleWrap:stubElement(),historyList:stubElement()};
  const state={month:'2026-10',employees,shifts,schedule:{},warnings:[],rules:{maxConsecutive:6,maxNight:2}};
  const ctx=vm.createContext({state,els,esc,
    datesInMonth:()=>['2026-10-01'],dateInfo:()=>({day:1,weekday:'Thu',isWeekend:false}),
    requestFor:()=>null,employeeStats:()=>({work:0,off:1,requested:0,hours:0,byShift:{}}),
    dbGetAll:async()=>projects,monthLabel:()=> 'October 2026',
    confirm:()=>false
  });
  return {ctx,els};
}
const id='sample"><img src=x onerror=alert(1)>';

test('HTML attribute escaping handles imported ID delimiters',()=>{
  assert.equal(esc(id),'sample&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});

test('employee action attributes cannot break out through imported IDs',()=>{
  const {ctx,els}=makeContext({employees:[{id,name:'Sample',role:'Tester',requests:[]}]});
  vm.runInContext(section('function renderEmployees()','function renderShifts()')+'\nrenderEmployees()',ctx);
  assert.ok(els.employeeList.innerHTML.includes('data-request="'+esc(id)+'"'));
  assert.ok(els.employeeList.innerHTML.includes('data-remove-employee="'+esc(id)+'"'));
  assert.doesNotMatch(els.employeeList.innerHTML,/<img/);
});

test('shift control attributes cannot break out through imported IDs',()=>{
  const {ctx,els}=makeContext({shifts:[{id,name:'Shift',start:'07:00',end:'15:00',minStaff:1}]});
  vm.runInContext(section('function renderShifts()','function employeeStats(')+'\nrenderShifts()',ctx);
  assert.ok(els.shiftList.innerHTML.includes('data-shift-id="'+esc(id)+'"'));
  assert.ok(els.shiftList.innerHTML.includes('data-remove-shift="'+esc(id)+'"'));
  assert.doesNotMatch(els.shiftList.innerHTML,/<img/);
});

test('schedule assignment controls escape employee IDs',()=>{
  const {ctx,els}=makeContext({employees:[{id,name:'Sample',role:'Tester',requests:[]}]});
  vm.runInContext(section('function renderSchedule()','function validateSchedule()')+'\nrenderSchedule()',ctx);
  assert.ok(els.scheduleWrap.innerHTML.includes('data-emp="'+esc(id)+'"'));
  assert.doesNotMatch(els.scheduleWrap.innerHTML,/<img/);
});

test('history controls escape project IDs from local storage',async()=>{
  const projects=[{id,month:'2026-10',employees:[],updatedAt:'2026-10-19T10:00:00Z'}];
  const {ctx,els}=makeContext({projects});
  await vm.runInContext(section('async function renderHistory()','async function switchMonth(')+'\nrenderHistory()',ctx);
  for(const selector of ['data-open-project','data-copy-project','data-delete-project']){
    assert.ok(els.historyList.innerHTML.includes(selector+'="'+esc(id)+'"'));
  }
  assert.doesNotMatch(els.historyList.innerHTML,/<img/);
});
