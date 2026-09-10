"""Build required-subject essay records from Ministry of Justice source PDFs.

Input: pdftotext -layout output named H23-purpose.txt ... R07-purpose.txt,
purpose-urls.txt and the original question catalog. No model answers are generated.
"""
import json, pathlib, re, sys, hashlib
BASE=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(__file__).resolve().parents[1]/'assets/ronbun';OUT.mkdir(parents=True,exist_ok=True)
SUBJECTS=['憲法','行政法','民法','商法','民事訴訟法','刑法','刑事訴訟法','民事実務基礎','刑事実務基礎']
alias={s:s for s in SUBJECTS[:7]}
alias.update({'民事':'民事実務基礎','刑事':'刑事実務基礎','法律実務基礎科目（民事）':'民事実務基礎','法律実務基礎科目（刑事）':'刑事実務基礎','法律実務基礎科目(民事)':'民事実務基礎','法律実務基礎科目(刑事)':'刑事実務基礎'})
ignored=['一般教養科目','倒産法','租税法','経済法','知的財産法','労働法','環境法','国際関係法（公法系）','国際関係法（私法系）']
urls={line.split('|')[0].split('_')[0]:line.split('|')[1] for line in (BASE/'purpose-urls.txt').read_text().strip().splitlines()}
catalog=json.loads((BASE/'catalog.json').read_text())
def tidy(s):
 s=s.replace('\x0c','\n\n').replace('\u3000',' ')
 s=re.sub(r'(?m)^\s*[-－]\s*\d+\s*[-－]\s*$','',s)
 return re.sub(r'\n{3,}','\n\n','\n'.join(x.rstrip() for x in s.splitlines())).strip()
bank=[];audit=[]
for p in sorted(BASE.glob('*-purpose.txt')):
 key=p.name.split('-')[0];year=int(key[1:])+(1988 if key[0]=='H' else 2018);text=p.read_text()
 heads=[]
 for m in re.finditer(r'[［\[]([^\]］]{1,40})[］\]]',text):
  name=re.sub(r'\s','',m.group(1))
  if name in alias or name in ignored:heads.append((m.start(),m.end(),name))
 heads.append((len(text),len(text),'END'))
 found=[]
 for (start,end,name),(next_start,_,_) in zip(heads,heads[1:]):
  if name not in alias:continue
  subject=alias[name];found.append(subject);chunk=text[end:next_start]
  parts=re.split(r'[（(]\s*出\s*題\s*(?:の\s*)?趣\s*旨\s*[）)]',chunk,maxsplit=1)
  if len(parts)!=2:raise ValueError((key,subject,'missing purpose marker'))
  question,purpose=map(tidy,parts)
  if len(question)<180 or len(purpose)<80:raise ValueError((key,subject,len(question),len(purpose)))
  group=next((f for f in catalog if f['year']==year and (subject in f['label'] or subject.endswith('実務基礎') and '実務基礎' in f['label'])),None)
  source_page=text[:start].count('\x0c')+1; purpose_start=end+len(parts[0]);purpose_page=text[:purpose_start].count('\x0c')+1
  bank.append(dict(id=f'yobi-{year}-{SUBJECTS.index(subject)+1:02}',year=year,era=('平成'+str(year-1988) if year<2019 else '令和'+str(year-2018)),subject=subject,text=question,purpose=purpose,pdf=urls[key],sourcePage=source_page,purposePage=purpose_page,questionPdf=group['pdf_url'] if group else urls[key],minutes=90 if subject.endswith('実務基礎') else 70,layoutNote=bool(re.search(r'図面|図表|別紙|見取図|防犯カメラ|別図|登記記録|建物図|登記事項',question))))
  audit.append(dict(id=bank[-1]['id'],source=urls[key],questionChars=len(question),purposeChars=len(purpose),sourcePage=source_page,purposePage=purpose_page))
 if sorted(found)!=sorted(SUBJECTS):raise ValueError((key,'subject coverage',found))
bank.sort(key=lambda q:(-q['year'],SUBJECTS.index(q['subject'])))
assert len(bank)==135 and len({q['id'] for q in bank})==135
(OUT/'papers.json').write_text(json.dumps(bank,ensure_ascii=False,separators=(',',':'))+'\n')
(OUT/'sources.json').write_text(json.dumps({'checked':'2026-09-10','years':[2011,2025],'subjects':SUBJECTS,'papers':len(bank),'sourceType':'法務省公表の問題・出題趣旨から本文を抽出。図表・別紙は原本PDFで確認。','questionMirror':'https://github.com/osanamikoji/bar-exam-data','purposeMirror':'https://github.com/atsushi-kk/mock-exam-generator-test/tree/main/ソース/過去問/_pdf','documents':[{'year':int(k[1:])+(1988 if k[0]=='H' else 2018),'url':v,'sha256':hashlib.sha256((BASE/(k+'-purpose.pdf')).read_bytes()).hexdigest()} for k,v in urls.items()],'audit':audit},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'papers':len(bank),'subjects':SUBJECTS,'years':[2011,2025],'purposeChars':sum(len(x['purpose']) for x in bank),'questionChars':sum(len(x['text']) for x in bank)},ensure_ascii=False))
