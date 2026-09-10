"""Cross-check answer numbers against the MOJ PDF answer tables (pdfplumber)."""
import json,pathlib,re,unicodedata,sys,pdfplumber
ROOT=pathlib.Path(__file__).resolve().parents[1];SRC=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'sources';OUT=ROOT/'assets/tanto'
B=json.loads((OUT/'bank.json').read_text());M=json.loads((OUT/'manifest.json').read_text());verified=0;corrections=[];missing=[]
for f in json.loads((SRC/'answer-sources.json').read_text()):
 year=2024 if 'reiwa_06' in f['local_path'] else 2023;byNo={};notes={}
 with pdfplumber.open(SRC/f['pdf_url'].rsplit('/',1)[1]) as pdf:
  for p in pdf.pages:
   for table in p.extract_tables():
    for row in table[1:]:
     for offset in [0,5]:
      if len(row)<offset+5:continue
      number,answer,note=row[offset+1],row[offset+2],row[offset+4]
      if number and number.isdigit() and answer and answer.isdigit():byNo[int(number)]=answer
      if number and number.isdigit() and note:notes[int(number)]=note
 for q in B:
  if q['exam']!='bar' or q['year']!=year or q['subject']!=f['label']:continue
  text=unicodedata.normalize('NFKC',q['text']);nums=re.findall(r'No\s*[.．]?\s*(\d+)',text)
  if not nums:missing.append(q['id']);continue
  start=int(nums[0]);official=[byNo.get(n) for n in range(start,start+len(q['answer']))]
  if not all(official):missing.append(q['id']);continue
  if q['kind']=='set':official.sort()
  current=sorted(q['answer']) if q['kind']=='set' else q['answer']
  if current!=official:corrections.append({'id':q['id'],'before':q['answer'],'after':official});q['answer']=official
  q['answerSource']=f['pdf_url'];q['sourceStatus']='公式問題・正答PDFと照合';q['answerSlots']=list(range(start,start+len(q['answer'])))
  for n in q['answerSlots']:
   note=notes.get(n,'');m=re.search(r'(\d+)問正解で\s*部分点(\d+)点',note)
   if m:q['partial']={m.group(1):int(m.group(2))}
  verified+=1
M['officialAnswerVerified']=verified;M['answerCorrections']=corrections;M['gradingNotes']=[{'exam':'bar','year':2023,'block':'刑法','note':'第6問は公式に受験者全員を正答として取り扱う問題。通常演習から除外。このサイトの収録分の練習点は当該4点を含まない。','source':'https://www.moj.go.jp/content/001400805.pdf'}]
(OUT/'bank.json').write_text(json.dumps(B,ensure_ascii=False,separators=(',',':')));(OUT/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
print(json.dumps({'verified':verified,'corrections':corrections,'missing':missing},ensure_ascii=False))
