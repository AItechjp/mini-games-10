"""Build the educational past-paper bank with preserved provenance and explicit omissions.
Question text: MOJ PDF text mirror. Answers: ShigyoBench (CC BY-NC 4.0).
This dataset is restricted to the free, ad-free educational page.
"""
import json,pathlib,re,unicodedata,collections,hashlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'sources'
OUT=ROOT/'assets'/'tanto';OUT.mkdir(parents=True,exist_ok=True)
norm=lambda t:unicodedata.normalize('NFKC',t)
raw=[json.loads(l) for l in (SRC/'shigyobench.jsonl').read_text().splitlines()]
old=[json.loads(l) for l in (SRC/'shigyo-old.jsonl').read_text().splitlines()]
W=json.loads((SRC/'wanted.json').read_text())
SUB={'憲法・行政法':'public','民法・商法・民事訴訟法':'civil','刑法・刑事訴訟法':'criminal','一般教養科目':'general','憲法':'憲法','民法':'民法','刑法':'刑法'}
subjects=['憲法','行政法','民法','商法','民事訴訟法','刑法','刑事訴訟法']
# Search tags are classifications, not claims that a tagged provision determines the answer.
topics={
'憲法':{'人権総論':['人権','公共の福祉','外国人','法人','私人間'],'平等':['平等','差別'],'思想・信教':['思想','良心','信教','政教分離','宗教'],'表現の自由':['表現','検閲','知る権利','報道'],'経済的自由':['職業','営業','財産権','居住','移転'],'社会権':['生存権','教育','労働基本権'],'選挙':['選挙','投票'],'国会':['国会','議員','立法','両院'],'内閣・行政':['内閣','行政権','総理大臣'],'裁判所':['裁判所','司法権','違憲','司法審査'],'財政・地方自治':['財政','予算','地方自治','条例'],'憲法改正':['憲法改正','天皇']},
'行政法':{'行政作用':['行政行為','行政処分','行政指導','裁量','委任命令'],'行政手続':['行政手続法','申請','不利益処分','聴聞'],'行政不服審査':['審査請求','行政不服審査'],'取消訴訟':['取消訴訟','処分性','原告適格','訴えの利益','取消しの訴え'],'行政事件訴訟':['義務付け','差止','差し止め','当事者訴訟','行政事件訴訟法'],'国家賠償・補償':['国家賠償','損失補償','営造物'],'地方自治・情報公開':['地方自治','条例','情報公開','個人情報']},
'民法':{'総則・意思表示':['意思表示','錯誤','詐欺','強迫','通謀','虚偽表示','制限行為能力','後見'],'代理':['代理','表見代理','無権代理'],'時効':['時効'],'物権・登記':['物権','登記','占有','所有権','共有','即時取得'],'担保物権':['抵当','質権','留置権','先取特権','譲渡担保'],'債権総論':['債権','債務不履行','履行不能','債権者代位','詐害行為','保証','相殺'],'契約':['契約','売買','賃貸借','請負','委任','贈与','消費貸借','解除'],'不法行為等':['不法行為','不当利得','事務管理'],'親族':['婚姻','離婚','親権','嫡出','養子','扶養'],'相続':['相続','遺言','遺留分']},
'商法':{'会社設立':['設立','発起人'],'株式':['株式','株主','自己株式'],'機関':['取締役','監査','代表取締役','指名委員会'],'株主総会':['株主総会','議決権','決議'],'資金調達':['募集株式','新株予約権','社債','払込'],'計算・剰余金':['剰余金','計算書類','資本金'],'組織再編':['合併','会社分割','株式交換','株式移転','事業譲渡'],'持分会社':['持分会社','合同会社','合名会社','合資会社'],'商行為・手形':['商行為','商人','商業登記','手形','小切手']},
'民事訴訟法':{'訴訟要件・管轄':['管轄','当事者能力','訴訟能力','訴えの利益'],'訴え・当事者':['提起','訴訟代理','共同訴訟','訴訟参加','反訴'],'審理原則':['弁論主義','処分権主義','自白','釈明','口頭弁論'],'証拠':['証拠','証明','証人','文書提出'],'判決・既判力':['判決','既判力','和解','認諾','放棄'],'上訴・再審':['控訴','上告','抗告','再審'],'特別手続':['少額訴訟','支払督促','手形訴訟']},
'刑法':{'構成要件・因果関係':['構成要件','因果関係','不作為'],'違法性':['正当防衛','緊急避難','正当行為','違法性'],'責任・錯誤':['故意','過失','錯誤','責任能力','心神'],'未遂・共犯':['未遂','共犯','共同正犯','教唆','幇助','間接正犯'],'生命・身体':['殺人','傷害','暴行','遺棄'],'自由・名誉':['逮捕','監禁','脅迫','名誉','住居侵入'],'財産犯':['窃盗','強盗','詐欺','恐喝','横領','背任','盗品'],'社会・国家法益':['放火','偽造','公務','賄賂','偽証'],'刑罰・罪数':['罪数','併合罪','観念的競合','刑の','執行猶予']},
'刑事訴訟法':{'捜査・逮捕勾留':['捜査','逮捕','勾留','取調べ'],'捜索差押え':['捜索','差押','令状','検証'],'公訴':['公訴','起訴','訴因'],'被告人・弁護人':['被告人','弁護人','黙秘','保釈'],'証拠能力':['証拠','違法収集','自白','補強'],'伝聞法則':['伝聞','供述書','供述調書'],'公判手続':['公判','裁判員','証人尋問','証拠開示'],'裁判・上訴':['判決','控訴','上告','再審','一事不再理']}}

def tidy(t):
 t=re.sub(r'^--- Page \d+ ---\s*$','',t,flags=re.M)
 t=re.sub(r'^\s*-\s*\d+\s*-\s*$','',t,flags=re.M)
 t=re.sub(r'^\s*[\[［](?:憲法|行政法|民法|商法|民事訴訟法|刑法|刑事訴訟法)[\]］]\s*$','',t,flags=re.M)
 lines=[l.strip() for l in t.splitlines() if l.strip()];out=[]
 for l in lines:
  new=re.match(r'^(?:〔|[ア-ン][.．]|[0-9０-９]+[.．]|教授[.．]|学生[.．]|[【\[])',l)
  if out and not new and not out[-1].endswith(('。','?','？','〕')):out[-1]+=l
  else:out.append(l)
 return '\n\n'.join(out).strip()

papers={}; paperlist=[]
for f in W:
 fp=SRC/f['pdf_url'].rsplit('/',1)[1].replace('.pdf','.txt')
 if not fp.exists():continue
 t=re.sub(r'\(cid:\d+\)','',fp.read_text());nt=norm(t)
 matches=list(re.finditer(r'^〔第\s*([0-9０-９]+)\s*問〕',t,re.M))
 seen={};subject=f['label'];block=SUB[f['label']];ex='preliminary' if f['exam']=='yobi' else 'bar'
 for i,m in enumerate(matches):
  n=int(norm(m.group(1)))
  if n in seen:continue
  if f['label'] in subjects:subject=f['label']
  elif block=='general':subject='一般教養'
  else:
   heads=list(re.finditer(r'^\s*[\[［]('+ '|'.join(subjects)+r')[\]］]\s*$',t[:m.start()],re.M))
   if heads:subject=heads[-1].group(1)
   else:subject=({'public':'憲法','civil':'民法','criminal':'刑法'}[block])
  end=matches[i+1].start() if i+1<len(matches) else len(t)
  txt=tidy(t[m.start():end]);page=list(re.finditer(r'--- Page (\d+) ---',t[:m.start()]))
  seen[n]={'text':txt,'subject':subject,'page':int(page[-1].group(1)) if page else 1}
 key=(ex,f['year'],block);papers[key]={'meta':f,'qs':seen}
 paperlist.append({'exam':ex,'year':f['year'],'block':block,'label':f['label'],'count':len(seen),'source':f['pdf_url'],'yearUrl':f['yearUrl']})

bank=[];excluded=[];matched=0
for r in raw:
 ex='preliminary' if r['exam_type']=='shihou_yobi' else 'bar'
 if r['exam_type'] not in ['shihou_yobi','shihou'] or ex=='bar' and r['year']<2015:continue
 block={'憲法行政法':'public','民法商法民事訴訟法':'civil','刑法刑事訴訟法':'criminal'}.get(r['subject'],r['subject'])
 paper=papers.get((ex,r['year'],block));n=r['question_number'];src=paper['qs'].get(n) if paper else None
 if not src:excluded.append({'id':r['id'],'reason':'対応する冊子本文を取得できない'});continue
 # Reject record number mismatches instead of silently assigning a neighboring answer.
 text=src['text'];a=norm(str(r['answer'])).strip();answer=re.findall(r'\d+',a)
 if not re.fullmatch(r'\d+(?:\s*,\s*\d+)*',a):excluded.append({'id':r['id'],'reason':'正答の形式を要確認'});continue
 # Ensure the record and booklet are the same question (OCR normalization only).
 def sig(v):return re.sub(r'[^\u3040-\u30ff\u3400-\u9fff]','',v)
 from difflib import SequenceMatcher
 similarity=SequenceMatcher(None,sig(text)[:400],sig(r['question'])[:400],autojunk=False).ratio()
 if similarity<.65:excluded.append({'id':r['id'],'reason':'本文と正答の対応を要確認','similarity':round(similarity,3)});continue
 nt=norm(text);pt=re.search(r'配点\s*[:：]\s*(\d+)',nt)
 if not pt:excluded.append({'id':r['id'],'reason':'配点を確認できない'});continue
 header=nt[:600]
 kind='single' if len(answer)==1 else ('set' if re.search(r'順\s*不\s*同|(?:二つ|2つ|二個|2個)\s*選',header) else 'vector')
 nums=[int(v) for v in re.findall(r'No\s*[.．]?\s*(\d+)',nt)]
 if nums and len(answer)>1 and len(answer)!=max(nums)-min(nums)+1:
  excluded.append({'id':r['id'],'reason':'解答欄数と正答数が不一致'});continue
 maximum=max([int(v) for v in re.findall(r'(?:^|\s)([1-9])[.．]',nt)] or [5])
 if kind=='vector':
  ranges=re.findall(r'1から([2-9])まで',header)
  maximum=max(map(int,ranges)) if ranges else (2 if all(x in ['1','2'] for x in answer) else maximum)
 maximum=max(maximum,max(map(int,answer)))
 if maximum>9:excluded.append({'id':r['id'],'reason':'解答選択肢を要確認'});continue
 tags=[k for k,terms in topics.get(src['subject'],{}).items() if any(w in text for w in terms)] or ['総合']
 record={'id':r['id'],'exam':ex,'year':r['year'],'subject':src['subject'],'block':block,'n':n,'text':text,'answer':answer,'kind':kind,'maxChoice':maximum,'points':int(pt.group(1)),'topics':tags,'source':paper['meta']['pdf_url'],'page':src['page'],'sourceStatus':'PDF本文と照合・正答は公開データ由来','needsPdf':bool(re.search(r'(次の図|下図|次の表|以下の表|図[123１２３]|【図】|[α-ω])',text)),'textHash':hashlib.sha256(text.encode()).hexdigest()}
 bank.append(record);matched+=1
# General knowledge: keep copyrighted readings and diagrams at their official source.
general={}
for r in old:
 if r.get('exam_type')!='shihou_yobi' or re.search(r'配\s*点',r['question']):continue
 paper=papers.get(('preliminary',r['year'],'general'));n=r['question_number']
 if not paper or n not in paper['qs']:continue
 key=(r['year'],n);a=norm(str(r['answer']))
 if not re.fullmatch(r'[1-5]',a):continue
 if key in general and general[key]['answer']!=[a]:excluded.append({'id':f'general-{key}','reason':'一般教養の正答データ重複不一致'});general.pop(key,None);continue
 src=paper['qs'][n]
 # PDF supplies the entire context, so we do not republish third-party excerpts.
 general[key]={'id':f'yobi-general-{r["year"]}-{n:03}','exam':'preliminary','year':r['year'],'subject':'一般教養','block':'general','n':n,'text':'公式冊子の第'+str(n)+'問を解いてください。図表・引用文・共通の文章は、下の公式PDFで確認できます。','answer':[a],'kind':'single','maxChoice':5,'points':3,'topics':['一般教養'],'source':paper['meta']['pdf_url'],'page':src['page'],'sourceStatus':'公式冊子を参照・正答は公開データ由来','needsPdf':True,'pdfOnly':True}
bank+=list(general.values())
bank.sort(key=lambda q:(-q['year'],q['exam'],subjects.index(q['subject']) if q['subject'] in subjects else 8,q['n']))
ids=[q['id'] for q in bank];assert len(ids)==len(set(ids))
coverage=[]
for p in paperlist:
 qs=[q for q in bank if q['exam']==p['exam'] and q['year']==p['year'] and q['block']==p['block']]
 coverage.append(dict(p,loaded=len(qs),missing=sorted(set(papers[(p['exam'],p['year'],p['block'])]['qs'])-{q['n'] for q in qs})))
meta={'version':'2026-09-11','created':'2026-09-10','license':'CC BY-NC 4.0','dataset':'https://huggingface.co/datasets/todo1111/shigyobench','datasetRevision':'eb4ca6a824aa428e80ecac38c30f290f1755e672','textMirror':'https://github.com/osanamikoji/bar-exam-data','count':len(bank),'legalCount':matched,'generalCount':len(general),'coverage':coverage,'excluded':excluded,'notes':['法律問題は法務省PDFのテキストと設問単位で照合。正答はShigyoBench収録値。','正答・現行法・解説の全問専門家監修は未実施。','一般教養は公式PDF参照方式。本文の転載・生成問題の追加は行わない。','部分点が未確認の設問は完全一致による練習点で採点。']}
(OUT/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,separators=(',',':')))
(OUT/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
(SRC/'bank-audit.json').write_text(json.dumps({'excluded':excluded,'coverage':coverage},ensure_ascii=False,indent=2))
print(json.dumps({'total':len(bank),'legal':matched,'general':len(general),'bySubject':dict(collections.Counter(q['subject'] for q in bank)),'kind':dict(collections.Counter(q['kind'] for q in bank)),'excluded':len(excluded),'incompletePapers':sum(bool(c['missing']) for c in coverage)},ensure_ascii=False))
