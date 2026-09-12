import {createRequire} from 'node:module';
import {mkdtempSync,realpathSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),esbuild=createRequire(realpathSync('node_modules/wrangler/package.json'))('esbuild');
const temporary=mkdtempSync(join(tmpdir(),'commons-openings-'));
try{
  for(const name of ['openings','opening-feeds','opening-seeds'])await esbuild.build({entryPoints:['lib/'+name+'.ts'],outfile:join(temporary,name+'.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const {windowFor,addMonths,monthsInRange,extractOpeningDate,inWindow,deduplicate}=require(join(temporary,'openings.cjs'));
  const {parseFeed,parseWordpress,articleToOpening,openingFeeds,saunaArchives,archiveUrl,collectOpenings}=require(join(temporary,'opening-feeds.cjs'));
  const {openingSeeds}=require(join(temporary,'opening-seeds.cjs'));
  assert.deepEqual(windowFor(new Date('2026-09-12T14:59:59Z')),{start:'2026-09-12',end:'2026-09-26'});
  assert.deepEqual(windowFor(new Date('2026-09-12T15:00:00Z')),{start:'2026-09-13',end:'2026-09-27'});
  assert.deepEqual(windowFor(new Date('2026-12-25T01:00:00Z')),{start:'2026-12-25',end:'2027-01-08'});
  assert.equal(inWindow({...openingSeeds[0],openingDate:'2026-09-26'},'2026-09-12','2026-09-26'),true);
  assert.equal(inWindow({...openingSeeds[0],openingDate:'2026-09-27'},'2026-09-12','2026-09-26'),false);
  assert.deepEqual(windowFor(new Date('2026-09-12T01:00:00Z'),'sauna'),{start:'2026-07-12',end:'2026-11-12'});
  assert.deepEqual(windowFor(new Date('2026-12-31T01:00:00Z'),'sauna'),{start:'2026-10-31',end:'2027-02-28'});
  assert.deepEqual(windowFor(new Date('2026-09-12T15:00:00Z'),'sauna'),{start:'2026-07-13',end:'2026-11-13'});
  assert.equal(addMonths('2024-12-31',2),'2025-02-28');
  assert.equal(addMonths('2024-04-30',-2),'2024-02-29');
  assert.deepEqual(monthsInRange('2026-11-12','2027-03-12'),['2026-11','2026-12','2027-01','2027-02','2027-03']);
  assert.equal(extractOpeningDate('サウナ「テスト」が1月5日オープン','','2026-11-20T00:00:00Z'),'2027-01-05');
  assert.equal(extractOpeningDate('サウナ「テスト」が12月20日オープン','','2027-01-05T00:00:00Z'),'2026-12-20');
  const pub='2026-09-01T00:00:00Z';
  assert.equal(extractOpeningDate('カフェ「テスト」がオープン','公開日 2026年9月1日',pub),null);
  assert.equal(extractOpeningDate('カフェ「テスト」が2026年9月18日（金）オープン','',pub),'2026-09-18');
  assert.equal(extractOpeningDate('9／18オープン「テスト」','',pub),'2026-09-18');
  assert.equal(extractOpeningDate('サウナ「テスト」','2026年2月30日オープン',pub),null);
  assert.equal(extractOpeningDate('サウナ「テスト」','2026年9月18日オープン。9月20日オープン。',pub),null);
  assert.equal(extractOpeningDate('「テスト」が1月5日オープン','','2026-12-20T00:00:00Z'),'2027-01-05');
  assert.equal(extractOpeningDate('「テスト」が9月18日オープン','','2025-09-01T00:00:00Z'),'2025-09-18');
  assert.equal(extractOpeningDate('「テスト」が2026年9月18日オープン','9月10日から延期になりました。',pub),'2026-09-18');
  assert.equal(extractOpeningDate('サウナ「テスト」が10月2日誕生','2026年8月3日プレオープン。プレオープン日：2026年8月3日',pub),'2026-10-02');
  const feed=openingFeeds[0];
  const candidate={title:'ラーメン「テスト」がオープン',url:'https://jouhou.nagoya/test/',body:'愛知県名古屋市に2026年9月18日（金）オープンします。',publishedAt:pub};
  assert.equal(articleToOpening(candidate,feed,new Date('2026-09-12')).openingDate,'2026-09-18');
  assert.equal(articleToOpening(candidate,feed,new Date('2026-09-12')).kind,'ramen');
  for(const label of ['カフェ','居酒屋','寿司','うどん'])assert.equal(articleToOpening({...candidate,title:label+'「テスト」がオープン'},feed,new Date('2026-09-12')),null);
  assert.equal(articleToOpening({...candidate,title:'カフェ「テスト」がオープン',body:candidate.body+'ラーメンも提供。'},feed,new Date('2026-09-12')),null);
  for(const label of ['つけ麺','油そば','まぜそば','中華そば'])assert.equal(articleToOpening({...candidate,title:label+'「テスト」がオープン'},feed,new Date('2026-09-12')).kind,'ramen');
  for(const date of ['2026-07-12','2026-07-19','2026-11-12'])assert.equal(articleToOpening({...candidate,title:'サウナ「テスト」がオープン',body:date.replace('-','年').replace('-','月')+'日開業'},feed,new Date('2026-09-12')).openingDate,date);
  for(const date of ['2026-07-11','2026-11-13'])assert.equal(articleToOpening({...candidate,title:'サウナ「テスト」がオープン',body:date.replace('-','年').replace('-','月')+'日開業'},feed,new Date('2026-09-12')),null);
  assert.equal(new URL(archiveUrl(saunaArchives[0],new Date('2026-09-12'),2)).searchParams.get('after'),'2026-05-12T00:00:00');
  const wp=parseWordpress(JSON.stringify([{title:{rendered:'サウナ「過去の店」が7月19日開業'},content:{rendered:'<p>所在地：岐阜県郡上市 開業日：2026年7月19日</p>'},date:'2026-08-18T12:00:00',link:'https://furosauna.com/example/'}]));
  assert.equal(articleToOpening(wp[0],saunaArchives[1],new Date('2026-09-12')).openingDate,'2026-07-19');

  assert.equal(articleToOpening({...candidate,title:'「テスト」で期間限定イベント開催'},feed,new Date('2026-09-12')),null);
  assert.equal(articleToOpening({...candidate,title:'ラーメン「A」「B」がオープン'},feed,new Date('2026-09-12')),null);
  assert.equal(articleToOpening({...candidate,body:'2025年9月18日オープン',publishedAt:'2025-09-01'},feed,new Date('2026-09-12')),null);
  assert.equal(parseFeed('<rss><channel><item><title><![CDATA[カフェ「テスト」]]></title><link>https://jouhou.nagoya/test/?utm_source=rss</link><description><![CDATA[<p>9月18日オープン</p>]]></description><pubDate>Tue, 01 Sep 2026 00:00:00 +0000</pubDate></item></channel></rss>')[0].url,'https://jouhou.nagoya/test/');
  const old={...openingSeeds[0],openingDate:'2026-09-17',checkedAt:'2026-09-10T00:00:00Z'},updated={...old,openingDate:'2026-09-20',checkedAt:'2026-09-12T00:00:00Z'};
  assert.equal(deduplicate([old,updated])[0].openingDate,'2026-09-20');
  if(process.argv[2]){
    const sampleNames=['nagoya','gifu','yurunago','pr','sauna'];let accepted=[];
    openingFeeds.forEach((source,i)=>{const articles=parseFeed(readFileSync(join(process.argv[2],sampleNames[i]+'.xml'),'utf8'));accepted.push(...articles.map(a=>articleToOpening(a,source,new Date('2026-09-12T03:50:00Z'))).filter(Boolean))});
    const originalFetch=globalThis.fetch,calls=[];
    globalThis.fetch=async input=>{
      const url=new URL(input.toString());calls.push(url.toString());
      const feedIndex=openingFeeds.findIndex(f=>f.url===url.toString());
      if(feedIndex>=0)return new Response(readFileSync(join(process.argv[2],sampleNames[feedIndex]+'.xml'),'utf8'));
      if(url.pathname==='/wp-json/wp/v2/posts'){
        const page=Number(url.searchParams.get('page')??1),name=url.hostname+(page===1?'':'-'+page)+'.json';
        return new Response(readFileSync(join(process.argv[2],name),'utf8'),{headers:{'X-WP-TotalPages':url.hostname==='furosauna.com'?'5':'4'}});
      }
      const files={'https://www.kairikiya.co.jp/':'kairikiya-home.html','https://www.kairikiya.co.jp/news/7065':'kairikiya.html','https://supersauna.jp/teaser/':'supersauna.html','https://lo.saunas-saunas.com/monnaka/':'saunas-lo-monnaka.html','https://saunabrosweb.jp/minakami200/2026/09/08/':'minakami-sauna.html'};
      if(files[url.toString()])return new Response(readFileSync(join(process.argv[2],files[url.toString()]),'utf8'));
      throw new Error('Unmapped fixture '+url.toString());
    };
    try{
      const result=await collectOpenings({records:openingSeeds,sources:[],updatedAt:null},new Date('2026-09-12T04:30:00Z'));
      assert(result.records.some(r=>r.name==='然-zen-'&&r.openingDate==='2026-07-19'));
      assert(result.records.some(r=>r.name==='sora-to-ma'&&r.openingDate==='2026-10-02'));
      assert(result.records.some(r=>r.name==='ラーメン魁力屋 足立六町店'&&r.status==='scheduled'));
      assert(result.sources.find(s=>s.name==='ラーメン魁力屋 公式').articles>0);
      assert.equal(result.records.filter(r=>r.name==='スーパーサウナ一宮').length,1);
      assert(result.records.every(r=>r.kind==='sauna'||r.kind==='ramen'));
      assert(calls.some(url=>url.includes('page=5')));
      console.log(JSON.stringify({collectedRecords:result.records.length,sourceFailures:result.sources.filter(s=>!s.ok).map(s=>s.name),localSaunas:result.records.filter(r=>r.kind==='sauna'&&['岐阜県','愛知県'].includes(r.prefecture)).length}));
    }finally{globalThis.fetch=originalFetch}

  }
  console.log('Ramen-only filtering, sauna past/future calendar months, archive extraction, midnight/year rollover, uncertain dates and deduplication passed.');
}finally{rmSync(temporary,{recursive:true,force:true})}
