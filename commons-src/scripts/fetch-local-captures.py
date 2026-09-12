"""Recapture the documented release inputs into a temporary directory.

This does not discover new stores or advance the release's coverage claims.
Re-enumerate every source index and review changed formats before publishing.
Raw permit files may contain applicant fields: never commit or serve captures.
"""
import concurrent.futures,gzip,json,pathlib,sys,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
target=pathlib.Path(sys.argv[1]).resolve()
if target.is_relative_to(root.parent):raise SystemExit('Choose a capture directory outside the repository.')
target.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'data/local-source-manifest.json').read_text())
def fetch(row):
 try:
  request=urllib.request.Request(row['url'],headers={'User-Agent':'AITECH-LocalDirectory/1.0 (public business information)','Accept-Encoding':'gzip'})
  with urllib.request.urlopen(request,timeout=200 if 'overpass.' in row['url'] else 45) as response:data=response.read()
  if data[:2]==b'\x1f\x8b':data=gzip.decompress(data)
  (target/row['name']).write_bytes(data)
  return {'name':row['name'],'ok':True,'bytes':len(data)}
 except Exception as error:return {'name':row['name'],'ok':False,'error':str(error)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:report=list(pool.map(fetch,manifest['files']))
(target/'fetch-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(target/'tasks.json').write_bytes((root/'data/local-detail-urls.json').read_bytes())
failed=[r['name'] for r in report if not r['ok']]
print(json.dumps({'captured':len(report)-len(failed),'failed':failed},ensure_ascii=False))
if failed:raise SystemExit(1)
