"""Fetch public source documents for the noncommercial study page; never generate questions."""
import json,pathlib,urllib.request,urllib.parse,concurrent.futures,re,sys
BASE=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[2]/'sources'
D=json.loads((BASE/'manifest.json').read_text()); wanted=[]
for ex,ys in D.items():
 for y in ys:
  year=int(y['year_id'].split('_')[1])+(2018 if y['year_id'].startswith('reiwa') else 1988)
  if year>2025 or ex=='honshiken' and year<2015:continue
  labels=['憲法・行政法','民法・商法・民事訴訟法','刑法・刑事訴訟法','一般教養科目'] if ex=='yobi' else ['憲法','民法','刑法']
  seen=set()
  for f in y['files']:
   if f['page_type']=='mondai' and f['label'] in labels and f['label'] not in seen:
    seen.add(f['label']);wanted.append(dict(f,exam=ex,year=year,yearUrl=y['url']))
(BASE/'wanted.json').write_text(json.dumps(wanted,ensure_ascii=False,indent=2))
def fetch(f):
 name=f['pdf_url'].rsplit('/',1)[1].replace('.pdf','.txt');path=BASE/name
 if path.exists():return True
 u='https://raw.githubusercontent.com/osanamikoji/bar-exam-data/HEAD/'+urllib.parse.quote(f['local_path'].replace('.pdf','.txt'))
 for attempt in range(2):
  try:
   path.write_bytes(urllib.request.urlopen(u,timeout=25).read());return True
  except Exception as e:
   if attempt:print('FAIL',f['exam'],f['year'],f['label'],str(e),flush=True);return False
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool: r=list(pool.map(fetch,wanted))
print('source texts',sum(r),'/',len(r),flush=True)
