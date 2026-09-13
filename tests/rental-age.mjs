import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ages,validateRental,rentalSearches} from '../commons/search/search-core.mjs';
import {parseRentalAge,parseRentals} from '../supabase/functions/commons-search/parsers.mjs';
const stations=[{id:'test',prefecture:'gifu',name:'新鵜沼',code:'12345',lines:{test:'6789012345'}}];
const base={prefecture:'gifu',station:'test',walk:'10',layouts:['1K']};
for(const age of ['',...ages]){
  const query={...base,age};assert.equal(validateRental(query,stations),'');
  assert.equal(new URL(rentalSearches(query,stations)[0].url).searchParams.get('cn'),age||'9999999');
}
assert.match(validateRental({...base,age:'-1'},stations),/築年数/);
assert.equal(validateRental(base,stations),'');
assert.deepEqual(parseRentalAge('新築 2階建'),{ageYears:0,ageLabel:'新築',isNew:true});
assert.equal(parseRentalAge('築５年 10階建').ageYears,5);
assert.equal(parseRentalAge('築5年6ヶ月').ageYears,5.5);
assert.equal(parseRentalAge('築1年未満').isNew,false);
assert.equal(parseRentalAge('建築中 2階建').ageYears,null);
function building(id,age){return `<div class="cassetteitem"><div class="cassetteitem_content-title">物件${id}</div><li class="cassetteitem_detail-col1">岐阜県各務原市</li><li class="cassetteitem_detail-col3"><div>${age}</div><div>10階建</div></li><div class="cassetteitem_detail-text">名鉄/新鵜沼駅 歩10分</div><tr class="js-cassette_link"><input name="bc" value="${id}"><span class="cassetteitem_madori">1K</span><span class="cassetteitem_other-emphasis">5万円</span><a href="/chintai/jnc_${id}/" class="js-cassette_link_href">詳細</a></tr></div>`;}
const html=['新築','築5年','築6年','不明','築1年未満','築5年6ヶ月'].map((age,i)=>building(i+1,age)).join('');
const parse=age=>parseRentals(html,{...base,age},stations[0]).items;
assert.equal(parse('').length,6);
assert.equal(parse('')[3].ageLabel,'築年数不明');
assert.deepEqual(parse('0').map(x=>x.id),['1']);
assert.deepEqual(parse('5').map(x=>x.id),['1','2','5']);
assert.equal(parseRentals(html,{...base,age:'5',walk:'5'},stations[0]).items.length,0);
assert.equal(parseRentals(html,{...base,age:'5',layouts:['2K']},stations[0]).items.length,0);
assert.equal(readFileSync(new URL('../commons/search/search-core.mjs',import.meta.url),'utf8'),readFileSync(new URL('../supabase/functions/commons-search/search-core.mjs',import.meta.url),'utf8'));
console.log('Rental age: validation, source links, new/unknown ages, boundaries and combined filters passed.');
