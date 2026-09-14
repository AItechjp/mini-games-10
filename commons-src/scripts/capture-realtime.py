"""Capture allowlisted public source pages for a reproducible collector audit."""
import concurrent.futures, hashlib, json, pathlib, threading, time, urllib.request, urllib.parse
targets=json.loads(pathlib.Path('data/realtime-targets.json').read_text())
out=pathlib.Path('/tmp/commons-realtime-captures');out.mkdir(exist_ok=True)
urls=list(dict.fromkeys(t['url'] for t in targets));locks={urllib.parse.urlsplit(u).hostname:threading.Semaphore(2) for u in urls}
def get(url):
 key=hashlib.sha256(url.encode()).hexdigest();dest=out/(key+'.json')
 if dest.exists():return json.loads(dest.read_text())
 result={'url':url,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 try:
  with locks[urllib.parse.urlsplit(url).hostname]:
   req=urllib.request.Request(url,headers={'User-Agent':'CommonsEvidence/1.0 (+https://aitechd.com/commons/)','Accept':'text/html,application/json;q=0.9'})
   with urllib.request.urlopen(req,timeout=12) as r:
    raw=r.read(1_500_001)
    if len(raw)>1_500_000:raise ValueError('Page exceeds collection limit')
    result.update(status=r.status,finalUrl=r.url,html=raw.decode(r.headers.get_content_charset() or 'utf-8','replace'))
 except Exception as e:result['error']=str(e)
 dest.write_text(json.dumps(result,ensure_ascii=False))
 return result
with concurrent.futures.ThreadPoolExecutor(12) as executor:
 results=[]
 for r in executor.map(get,urls):
  results.append(r)
  if len(results)%50==0:print(json.dumps({'completed':len(results),'total':len(urls)},ensure_ascii=False),flush=True)
print(json.dumps({'total':len(results),'ok':sum(r.get('status')==200 for r in results),'sites':len({urllib.parse.urlsplit(r['url']).hostname for r in results if r.get('status')==200})}))
