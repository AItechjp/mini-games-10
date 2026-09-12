"""Assemble attributed local-business facts from captured public source responses.

python -m pip install beautifulsoup4
python scripts/assemble-local.py /path/to/captures
Source captures are temporary; only business names, locations, hours and source
links are published. Applicant names, home addresses and other license-holder
fields must never be exported. Unsupported schedules remain unknown.
"""
import csv,datetime,hashlib,io,json,math,pathlib,re,sys,unicodedata,zipfile,xml.etree.ElementTree as ET
from collections import Counter
from bs4 import BeautifulSoup

ROOT=pathlib.Path(__file__).resolve().parents[1]
CAP=pathlib.Path(sys.argv[1])
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
TODAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()
STORES=[];SOURCES=[]
DAYS={'月':'Mo','火':'Tu','水':'We','木':'Th','金':'Fr','土':'Sa','日':'Su'}
def norm(s):return unicodedata.normalize('NFKC',str(s or '')).replace('\u3000',' ').strip()
def clean(s):return re.sub(r'\s+',' ',norm(s)).strip()
def soup(path):return BeautifulSoup(path.read_text(),'html.parser')
def city_of(address):
 a=re.sub(r'^(岐阜県|愛知県)','',clean(address))
 m=re.match(r'(?:[^市町村]+郡)?([^0-9\s]+?[市町村])',a)
 return m[1] if m else ''
def uid(s):return hashlib.sha256(s.encode()).hexdigest()[:18]
def store(name,address,cats,url,source,typ='official',**kw):
 address=re.sub(r'〒[\d-]+\s*','',clean(address))
 address=re.sub(r'^(岐阜県|愛知県)\1',r'\1',address)
 pref=next((x for x in ['岐阜県','愛知県'] if address.startswith(x)),kw.pop('prefecture',''))
 if pref not in ['岐阜県','愛知県'] or not name:return
 entry={'id':typ+'-'+uid(url+'|'+name+'|'+address),'name':clean(name),'prefecture':pref,'city':city_of(address),'address':address,'categories':cats,'hours':'','phone':'','website':url if typ=='official' else '', 'sourceUrl':url,'sourceName':source,'sourceType':typ,'checkedAt':NOW}
 entry.update(kw);STORES.append(entry)
def source(name,url,before,complete=True,note=''):
 SOURCES.append({'name':name,'url':url,'count':len(STORES)-before,'complete':complete,'note':note})
def ranges(value):
 text=norm(value).replace('午前','AM').replace('午後','PM').replace('翌日','翌').replace('翌朝','翌')
 text=re.sub(r'(\d{1,2})時(?:(\d{1,2})分?)?',lambda m:m[1]+':'+(m[2] or '00').zfill(2),text)
 text=text.replace('〜','~').replace('～','~').replace('−','-').replace('－','-')
 def tm(part,h,m):
  h=int(h);m=int(m);h=h+12 if part=='PM' and h<12 else 0 if part=='AM' and h==12 else h
  return f'{h:02}:{m:02}' if h<=48 and m<60 else None
 result=[]
 for m in re.finditer(r'(AM|PM)?\s*(\d{1,2}):(\d{2})\s*[-~ー]\s*(翌)?\s*(AM|PM)?\s*(\d{1,2}):(\d{2})',text,re.I):
  start=tm((m[1] or '').upper(),m[2],m[3]);end=tm((m[5] or '').upper(),m[6],m[7])
  if start and end:result.append(start+'-'+end)
 return result
def closed_rule(text):
 text=norm(text).replace('曜日','').replace('曜','').replace('毎週','').replace('毎','').replace('・',',').replace('と',',').replace('、',',')
 if text in ['', 'なし','無休','年中無休','定休日なし']:return []
 if re.search('不定|祝|翌|年末|季節|場合|休館|月末',text):return None
 text=text.replace('定休日','').strip()
 out=[]
 for part in [x.strip() for x in text.split(',') if x.strip()]:
  if part in DAYS:out.append(DAYS[part]+' off')
  elif m:=re.fullmatch(r'第([1-5])([月火水木金土日])',part):out.append(DAYS[m[2]]+'['+m[1]+'] off')
  elif m:=re.fullmatch(r'([月火水木金土日])[~〜-]([月火水木金土日])',part):out.append(DAYS[m[1]]+'-'+DAYS[m[2]]+' off')
  else:return None
 return out
def hours_expr(raw,closed=''):
 text=norm(raw);rule=closed_rule(closed)
 if rule is None:return ''
 # Structured weekday lines are reliable even when the provider has no text
 # summary. Never copy the page's cached "open now" badge.
 lines=text.splitlines();weekday=[]
 for line in lines:
  m=re.match(r'^\s*([月火水木金土日])曜日\s*[:：]\s*(.*)',line)
  if not m:continue
  body=m[2];hours=ranges(body)
  value='off' if re.search('定休|休業|休館',body) else '00:00-24:00' if re.search(r'24\s*時間',body) else ','.join(hours)
  if not value:return ''
  weekday.append(DAYS[m[1]]+' '+value)
 if len(weekday)==7:return '; '.join(weekday)
 if weekday:return ''
 # Simple all-day schedules and simple Sunday overrides.
 if re.search(r'24\s*時間|24/7',text) and not ranges(text):return '; '.join(['24/7']+rule)
 rs=ranges(text)
 if not rs:return ''
 sunday=re.search(r'日曜(?:日)?のみ(?:朝)?\s*(\d{1,2}):(\d{2})\s*開店',text)
 if len(rs)==1 and sunday and not re.search('土|祝|季節|夏|冬',text):return '; '.join([rs[0],f'Su {int(sunday[1]):02}:{sunday[2]}-'+rs[0].split('-')[1]]+rule)
 if len(rs)==2 and re.search('日曜.*のみ',text) and not re.search('土|祝|月曜|火曜|水曜|木曜|金曜',text):return '; '.join([rs[0],'Su '+rs[1]]+rule)
 if len(rs)==1 and not re.search(r'平日|土日|祝日|[月火水木金土日]曜|月[〜~\-]|金[〜~\-]|季節|夏|冬|貸切|予約|要相談',text):return '; '.join(rs+rule)
 return ''

# Administrative polygons keep bounding-box imports strictly inside two prefs.
bound=json.loads((CAP/'boundaries.html').read_text())['features']
polys=[]
for f in bound:
 if f['properties'].get('nam_ja') not in ['岐阜県','愛知県']:continue
 for polygon in ([f['geometry']['coordinates']] if f['geometry']['type']=='Polygon' else f['geometry']['coordinates']):polys.append((f['properties']['nam_ja'],polygon))
def in_ring(x,y,ring):
 inside=False;j=len(ring)-1
 for i,(xi,yi) in enumerate(ring):
  xj,yj=ring[j]
  if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:inside=not inside
  j=i
 return inside
def prefecture(x,y):
 for pref,poly in polys:
  if in_ring(x,y,poly[0]) and not any(in_ring(x,y,hole) for hole in poly[1:]):return pref
 return ''

before=len(STORES);osm={};osm_dates=[]
for name in ['overpass-gifu','aichi-bbox-baths','aichi-bbox-fish','aichi-super-west']:
 path=CAP/(name+'.html')
 if not path.exists():continue
 data=json.loads(path.read_text());assert not data.get('remark'),f'Incomplete Overpass response: {name}'
 osm_dates.append(data.get('osm3s',{}).get('timestamp_osm_base',''))
 for f in data['elements']:osm[f"{f['type']}/{f['id']}"]=f
for ident,f in osm.items():
 t=f.get('tags',{});p=f.get('center',f)
 if 'lat' not in p or 'lon' not in p:continue
 pref=prefecture(p['lon'],p['lat'])
 if not pref or any(t.get(k)=='yes' for k in ['disused','abandoned','demolished']):continue
 cats=[]
 if t.get('shop')=='supermarket':cats.append('supermarkets')
 if t.get('shop') in ['seafood','fish','fishmonger']:cats.append('fishmongers')
 if t.get('amenity') in ['public_bath','bathhouse']:cats.append('sento')
 if t.get('leisure')=='sauna' or t.get('sauna')=='yes':cats.append('saunas')
 if not cats:continue
 addr=t.get('addr:full') or ''.join(dict.fromkeys(t.get(k,'') for k in ['addr:province','addr:state','addr:city','addr:suburb','addr:quarter','addr:neighbourhood','addr:street','addr:block_number','addr:housenumber'] if t.get(k)))
 if addr and not addr.startswith(pref):addr=pref+addr
 website=t.get('website') or t.get('contact:website','')
 if website and not website.startswith(('https://','http://')):website='https://'+website
 store(t.get('name:ja') or t.get('name') or '名称未登録',addr,cats,'https://www.openstreetmap.org/'+ident,'OpenStreetMap','osm',id='osm-'+ident,prefecture=pref,lat=p['lat'],lon=p['lon'],hours=t.get('opening_hours:sauna') or t.get('opening_hours',''),phone=t.get('phone') or t.get('contact:phone',''),website=website,access=t.get('access',''),scope='facility',note=t.get('opening_hours:description',''))
source('OpenStreetMap（2県の対象登録情報）','https://www.openstreetmap.org/',before,len(osm_dates)==4,'岐阜の行政区域と愛知全域を含む範囲を検索し、県境の外を除外。地図自体の未登録店舗あり。地図データ日時：'+', '.join(sorted(set(d[:10] for d in osm_dates if d)))+'。ODbL 1.0。')

# All result pages, including facilities with missing hours. Do not import
# images, reviews, usernames, temperatures or engagement metrics.
for region,last in [('gifu',15),('aichi',23)]:
 before=len(STORES);seen=set();pages=0
 for i in range(1,last+1):
  path=CAP/(f'sauna-{region}'+('' if i==1 else '-'+str(i))+'.html')
  if not path.exists():continue
  text=path.read_text();m=re.search(r'window\.__MAP_DATA\s*=\s*(\[.*?\]);',text)
  if not m:continue
  pages+=1;doc=BeautifulSoup(text,'html.parser');inactive=set()
  for card in doc.select('.p-saunaItem'):
   a=card.select_one('a[href]');tag=card.select_one('.p-saunaItemName_tags')
   if a and tag and re.search('閉店|閉館|休業中|休館中',tag.get_text()):
    match=re.search(r'/saunas/(\d+)',a['href'])
    if match:inactive.add(int(match[1]))
  for f in json.loads(m[1]):
   if f['id'] in seen or f['id'] in inactive:continue
   seen.add(f['id'])
   if f.get('prefecture') not in ['岐阜県','愛知県']:continue
   if f.get('open_at') and f['open_at'][:10]>TODAY:continue
   cats=['saunas']
   if f.get('facility_type') in ['sento','saunaspa']:cats.append('sento')
   raw=f.get('business_hours','');closed=f.get('regular_holiday_text','');hours=hours_expr(raw,closed)
   notes=[];access=''
   if f.get('require_booking'):notes.append('予約が必要');access='private'
   if f.get('facility_type') in ['gym','golf']:notes.append('会員・施設利用者向け');access='members'
   if f.get('guest_type') not in ['one_day_visit',None,'']:notes.append('宿泊・施設利用などの条件を確認');access='customers'
   if f.get('facility_type') in ['hotel','lovehotel','privatecottage'] and f.get('guest_type')!='one_day_visit':notes.append('宿泊・客室利用などの条件を確認');access='customers'
   if f.get('is_male_available') and not f.get('is_female_available'):notes.append('男性利用向け')
   if not f.get('is_male_available') and f.get('is_female_available'):notes.append('女性利用向け')
   if f.get('not_has_permanent_sauna'):notes.append('常設サウナなし・設置日を確認');access='private'
   store(f['name'],f['prefecture']+f.get('address1','')+f.get('address2','')+f.get('address3',''),cats,f"https://sauna-ikitai.com/saunas/{f['id']}",'サウナイキタイ（利用者登録情報）','directory',id='sauna-ikitai-'+str(f['id']),lat=f.get('geolat'),lon=f.get('geolong'),city=f.get('address1',''),hours=hours,hoursText=clean(raw)[:230] if raw else '',note=' / '.join(notes),access=access,scope='facility')
 source('サウナイキタイ '+('岐阜県' if region=='gifu' else '愛知県'),f'https://sauna-ikitai.com/{region}',before,pages==last,f'公開一覧の{pages}ページを取得。閉店・休業表記と開業前を除外。ジム・宿泊施設・予約制を含み、一般利用の条件は区別。')

# Official chain pages.
before=len(STORES)
valor=CAP/'valor-all.json'
if valor.exists():
 daycodes={'MONDAY':'Mo','TUESDAY':'Tu','WEDNESDAY':'We','THURSDAY':'Th','FRIDAY':'Fr','SATURDAY':'Sa','SUNDAY':'Su'}
 for row in json.loads(valor.read_text())['shops']:
  if not row['address'].startswith(('岐阜県','愛知県')) or row.get('businessStatus')!='OPEN':continue
  if row.get('openingDate') and row['openingDate'][:10]>TODAY:continue
  week=[]
  for item in row.get('businessHours',[]):
   if item['name'] not in daycodes:continue
   week.append(daycodes[item['name']]+' '+(item['openTime'][:5]+'-'+item['closeTime'][:5] if item.get('openTime') and item.get('closeTime') else 'off'))
  exceptions={}
  for item in row.get('specialHours',[]):
   if not item.get('startDate') or not item.get('endDate'):continue
   start=datetime.date.fromisoformat(item['startDate'][:10]);end=datetime.date.fromisoformat(item['endDate'][:10])
   if (end-start).days>366:continue
   value='off' if item.get('isClosed') else item['openTime'][:5]+'-'+item['closeTime'][:5] if item.get('openTime') and item.get('closeTime') else 'unknown'
   while start<=end:exceptions[start.isoformat()]=value;start+=datetime.timedelta(days=1)
  url=row.get('inputUrl','')
  if isinstance(url,dict):url=url.get('url') or url.get('text') or ''
  if not url.startswith('http'):url='https://stores.valor.jp'+('/' if not url.startswith('/') else '')+url
  store(row['nameKanji'],row['address'],['supermarkets'],url,'バロー公式',hours='; '.join(week) if len(week)==7 else '',phone=row.get('phoneNumber',''),lat=float(row['latitude']),lon=float(row['longitude']),exceptions=exceptions)
source('バロー公式店舗一覧（岐阜・愛知）','https://stores.valor.jp/',before,True,'岐阜69・愛知61の公式掲載件数と照合し、開業前を除外。曜日別営業時間と日付指定の特別営業時間を収録。')
before=len(STORES)
for path in sorted(CAP.glob('aoki-*.html')):
 if not re.fullmatch(r'aoki-\d+\.html',path.name):continue
 s=soup(path);text=clean(s.get_text(' ',strip=True));name=clean(s.title.get_text().split('｜')[0])
 m=re.search(r'住所\s*〒[0-9-]+\s*(.*?)\s*電話番号\s*([0-9-]+)\s*営業時間\s*(.*?)(?:\s*サービス|\s*テナント|\s*トップ|$)',text)
 if m:store('アオキスーパー '+name,'愛知県'+m[1],['supermarkets'],'https://www.aokisuper.co.jp/shop/detail/?id='+path.stem.split('-')[1],'アオキスーパー公式',hours=hours_expr(m[3]),hoursText=m[3],phone=m[2])
source('アオキスーパー公式店舗一覧','https://www.aokisuper.co.jp/shop/',before,len(STORES)-before==50,'公式一覧50店舗の詳細から住所・営業時間を取得。')
before=len(STORES)
tasks=json.loads((CAP/'tasks.json').read_text())
for path in sorted(CAP.glob('feel-*.html')):
 if not re.fullmatch(r'feel-\d+\.html',path.name):continue
 s=soup(path);text=clean(s.get_text(' ',strip=True));name=s.title.get_text().split('|')[0].strip()
 m=re.search(r'営業時間\s*(.*?)\s*住\s*所\s*[:：]\s*(.*?)\s*(?:地図を見る\s*)?電話番号\s*[:：]\s*([0-9-]+)',text)
 if m:store('フィール '+name,'愛知県'+m[2],['supermarkets'],tasks[path.stem],'フィール公式',hours=hours_expr(m[1]),hoursText=m[1],phone=m[3])
source('フィール公式店舗一覧（愛知）','https://feel-corp.jp/store/',before,len(STORES)-before==len([k for k in tasks if re.fullmatch('feel-\\d+',k)]),'一覧の静岡県を除いた全リンクを照合。')

before=len(STORES)
for item in soup(CAP/'yamanaka.html').select('.list_shop > li'):
 a=item.select_one('a[title]');text=clean(item.get_text(' ',strip=True))
 if not a or '花専門店' in text:continue
 address=re.search(r'住所:\s*〒[\d-]+\s*(.*?)\s*TEL:',text);tel=re.search(r'TEL:\s*([\d-]+)',text);h=re.search(r'営業時間\s*(.*)',text)
 if not address:continue
 addr=address[1]
 if addr.startswith(('三重県','静岡県')):continue
 if not addr.startswith(('岐阜県','愛知県')):addr='愛知県'+addr
 raw=h[1] if h else '';expr=hours_expr(raw)
 if re.search('日曜は9:30開店',raw) and ranges(raw):expr=ranges(raw)[0]+'; Su 09:30-'+ranges(raw)[0].split('-')[1]
 if re.search('土日祝日は9:30開店',raw) and ranges(raw):expr=ranges(raw)[0]+'; Sa,Su,PH 09:30-'+ranges(raw)[0].split('-')[1]
 store('ヤマナカ '+a.get_text(' ',strip=True),addr,['supermarkets'],a['href'],'ヤマナカ公式',hours=expr,hoursText=raw,phone=tel[1] if tel else '')
source('ヤマナカ・フランテ公式一覧','https://www.super-yamanaka.co.jp/shop/',before,True,'公式一覧の対象2県店舗を収録。日曜開店時間を区別。')
before=len(STORES)
for item in soup(CAP/'tachiya.html').select('.item'):
 title=item.select_one('.item-title');loc=item.select_one('.location');clock=item.select_one('.clock');cal=item.select_one('.calendar');tel=item.select_one('a[href^="tel:"]')
 if not title or not loc:continue
 addr=clean(loc.parent.get_text()).replace('所在地','');raw=clean(clock.parent.get_text()).replace('営業時間','') if clock else '';closed=clean(cal.parent.get_text()).replace('定休日','') if cal else ''
 store(re.sub(r'^\d+\s*','',title.get_text(strip=True)),addr,['supermarkets'],'https://tachiya.co.jp/store/','タチヤ公式',hours=hours_expr(raw,closed),hoursText=raw+' / 定休日 '+closed,phone=tel.get_text(strip=True) if tel else '')
source('タチヤ公式店舗一覧','https://tachiya.co.jp/store/',before,True,'一覧の対象2県全店舗を収録。水曜等の定休日を反映。')

# Official Kanesue/Felna list cards include branch-specific hours and addresses.
before=len(STORES)
for path in CAP.glob('kanesue-page-*.html'):
 s=soup(path)
 for a in s.select('a[href]'):
  if not re.search(r'/store/[^/?]+/?$',a['href']):continue
  text=clean(a.get_text(' ',strip=True));m=re.search(r'^(.*?)\s+(\d.*?)(岐阜県|愛知県)(.*?)\s*店舗詳細',text)
  if not m:continue
  # Do not label announced future openings as operating stores.
  future=re.search(r'(202\d)年(\d+)月(\d+)日オープン',text)
  if future and '%04d-%02d-%02d'%tuple(map(int,future.groups()))>TODAY:continue
  store(('フェルナ ' if 'felna' in path.name else 'カネスエ ')+m[1],m[3]+m[4],['supermarkets'],a['href'],'カネスエ・フェルナ公式',hours=hours_expr(m[2]),hoursText=m[2])
source('カネスエ・フェルナ公式（岐阜・愛知）','https://kanesue.co.jp/store/',before,True,'県・ブランド別の全10ページを取得。開店予定日が未来の店舗は除外。')

before=len(STORES)
for path in CAP.glob('gyomu-*.html'):
 if not re.fullmatch(r'gyomu-\d+\.html',path.name):continue
 s=soup(path);text=clean(s.get_text(' ',strip=True))
 m=re.search(r'住所\s*〒[\d-]+\s*(.*?)\s*TEL\s*([\d-]+).*?営業時間\s*(.*?)\s*駐車場',text)
 if not m:continue
 name=s.title.get_text().split(' - ')[0]
 store(name,m[1],['supermarkets'],'https://www.gyomusuper.jp/shop/detail.php?sh_id='+path.stem.split('-')[1],'業務スーパー公式',hours=hours_expr(m[3]),hoursText=m[3],phone=m[2])
source('業務スーパー公式（岐阜・愛知）','https://www.gyomusuper.jp/shop/',before,len(STORES)-before==42,'公式掲載の岐阜8・愛知34店舗の詳細ページを照合。')

# Preserve every relevant published seafood permit, but never imply that a
# permit proves today's operation or public retail access.
before=len(STORES);permit_seen=set()
for path in CAP.glob('gifu-csv-*.html'):
 raw=path.read_bytes()
 try:text=raw.decode('utf-8-sig')
 except UnicodeDecodeError:text=raw.decode('cp932')
 for row in csv.DictReader(io.StringIO(text)):
  if '魚介類販売' not in row.get('許可業種名',''):continue
  name=clean(row.get('屋号(漢字)','')+' '+row.get('屋号２(漢字)',''));addr=clean(row.get('営業所住所',''))
  if not name or not addr:continue
  key=norm(name+addr)
  if key in permit_seen:continue
  permit_seen.add(key)
  if not addr.startswith('岐阜県'):addr='岐阜県'+addr
  store(name,addr,['fishmongers'],'https://gifu-opendata.pref.gifu.lg.jp/dataset/c11222-058','岐阜県 食品営業許可施設情報','registry',note='鮮魚販売の許可施設。スーパー内売場を含みます。現在の営業・一般向け小売は要確認。',phone=row.get('営業所電話番号',''))
source('岐阜県 魚介類販売業の公開許可情報','https://gifu-opendata.pref.gifu.lg.jp/dataset/c11222-058',before,True,'2026年3月末全施設と4〜7月の新規情報。岐阜市・移動営業等は対象外。許可の取得は営業中の証明ではありません。CC BY 2.0。')

def csv_rows(path):
 raw=path.read_bytes()
 try:text=raw.decode('utf-8-sig')
 except UnicodeDecodeError:text=raw.decode('cp932')
 return csv.DictReader(io.StringIO(text))
def xlsx_rows(path):
 # Resolve actual cell references so blank cells never shift personal fields
 # into facility fields. Only the named public business columns below export.
 ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 with zipfile.ZipFile(path) as z:
  shared=[''.join(t.text or '' for t in si.findall('.//m:t',ns)) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
  rows=[]
  for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('m:sheetData/m:row',ns):
   values={}
   for c in row.findall('m:c',ns):
    key=re.sub(r'\d','',c.get('r',''));v=c.find('m:v',ns);value=v.text if v is not None else ''
    values[key]=shared[int(value)] if c.get('t')=='s' and value else value
   rows.append(values)
  header=rows[0]
  return [{name:row.get(col,'') for col,name in header.items()} for row in rows[1:]]
for city in ['toyota','okazaki','nagoya']:
 before=len(STORES);seen=set();meta=json.loads((CAP/(city+'-licenses.json')).read_text())['result']
 for path in CAP.glob(city+'-registry-*'):
  for row in (xlsx_rows(path) if path.suffix=='.xlsx' else csv_rows(path)):
   kind=row.get('営業の種類') or row.get('業種','')
   if '魚介類販売' not in kind or row.get('廃業年月日'):continue
   name=row.get('施設の名称') or row.get('施設名称') or row.get('営業所名称','')
   addr=row.get('施設所在地') or row.get('所在地_連結表記') or row.get('営業所所在地','')
   phone=row.get('施設電話番号') or row.get('営業所\r\n電話番号') or row.get('営業所\\r\\n電話番号','')
   if not name or not addr:continue
   if not addr.startswith('愛知県'):addr='愛知県'+addr
   key=clean(name+addr)
   if key in seen:continue
   seen.add(key)
   store(name,addr,['fishmongers'],'https://data.bodik.jp/dataset/'+meta['name'],{'toyota':'豊田市','okazaki':'岡崎市','nagoya':'名古屋市'}[city]+' 食品営業許可施設情報','registry',phone=phone,note='鮮魚販売の許可施設。スーパー内売場を含みます。現在の営業・一般向け小売は要確認。')
 source({'toyota':'豊田市','okazaki':'岡崎市','nagoya':'名古屋市'}[city]+' 魚介類販売業の公開許可情報','https://data.bodik.jp/dataset/'+meta['name'],before,True,('2026年8月末の全施設。' if city=='toyota' else '公開されている全施設CSV。' if city=='okazaki' else '2025年8月〜2026年7月の新規許可のみ。既存全店舗の台帳ではありません。')+'許可の取得は営業中の証明ではありません。CC BY 4.0。')

# Reviewed official bath schedules: weekly patterns plus explicit exceptions.
before=len(STORES)
for row in json.loads((ROOT/'data/local-aichi-bath-records.json').read_text()):
 if '休業中' in row['name']:continue
 hours=hours_expr(row['hoursText'],row['closed'])
 overrides={'小田井温泉':'16:00-22:30; Tu off; We[2,4] off','白山温泉':'15:00-24:00; Su 08:00-12:00,15:00-24:00; We off','炭の湯':'16:00-23:00; Sa,Su,PH 06:30-09:30,16:00-23:00','富美の湯':'15:30-23:00; Su 08:00-12:00,15:30-23:00; Mo off','八千代湯':'14:00-24:00; Su 09:00-24:00; Mo off','比良温泉':'15:30-23:30; Sa,Su,PH 15:00-23:30; Fr off','萩の湯':'14:30-00:30; Su 08:00-24:00; We off','川澄湯（かわすみゆ）':'16:00-22:00; Mo off; Tu[4] off','柴田温泉':'15:30-23:30; Su off; Mo[2,4] off','ぽかぽか温泉新守山乃湯':'11:00-24:00; Su 08:00-24:00; Tu[3] off','春日井温泉':'13:30-24:00; Sa,Su,PH 10:00-24:00','清水温泉':'16:00-21:30; Tu off; Sa[4] off','石巻湯':'15:00-23:00; Sa off; Fr[2,4] off'}
 hours=overrides.get(row['name'],hours)
 store(re.sub(r'（.*?）','',row['name']),row['address'],['sento'],row['sourceUrl'],'愛知県公衆浴場組合公式',hours=hours,hoursText=row['hoursText']+' / 定休日 '+row['closed'])
source('愛知県公衆浴場組合公式 全5ページ','https://aichi1010.jp/page/list/',before,True,'一覧49件のうち休業中表記1件を除く48件を収録。未対応の複雑な定休日は要確認。')

# Additional reviewed store facts assembled from each official shop page.
extra=ROOT/'data/local-official-extra.json'
if extra.exists():
 for row in json.loads(extra.read_text()):
  before=len(STORES);store(**row);source(row['source'],row['url'],before,True,'店舗・施設公式の営業案内を確認。')

# Prefer official hours; deduplicate conservatively using exact normalized name
# within a prefecture, or near coordinates and a shared distinctive name.
def namekey(value):
 value=re.sub(r'[\s・（）()\-]|スーパーマーケット|株式会社|有限会社|合同会社','',norm(value)).lower()
 for brand in ['バロー','フィール','ヤマナカ','カネスエ','フェルナ']:
  value=value.replace(brand+brand,brand)
 return value
def addresskey(value):return re.sub(r'[\s\-‐ー−]|丁目|番地|番|号','',norm(value))
priority={'official':0,'directory':1,'osm':2,'registry':3}
merged=[]
for s in sorted(STORES,key=lambda r:priority[r['sourceType']]):
 nk=namekey(s['name']);match=None
 for candidate in merged:
  if candidate['prefecture']!=s['prefecture']:continue
  same_name=nk==namekey(candidate['name']) and len(nk)>2 and s['name']!='名称未登録'
  same_address=bool(s['address']) and addresskey(s['address'])==addresskey(candidate['address'])
  same_phone=bool(s['phone']) and len(re.sub(r'\D','',s['phone']))>=9 and re.sub(r'\D','',s['phone'])==re.sub(r'\D','',candidate['phone'])
  near=False
  if s.get('lat') and candidate.get('lat'):
   near=abs(float(s['lat'])-float(candidate['lat']))<.002 and abs(float(s['lon'])-float(candidate['lon']))<.002
  if same_name and (same_address or near or same_phone or ((not s['address'] or not candidate['address']) and s['city'] and s['city']==candidate['city'])):match=candidate;break
 if not match:merged.append(s);continue
 match['categories']=list(dict.fromkeys(match['categories']+s['categories']))
 if 'saunas' in match['categories']:match.setdefault('scope','facility')
 if s['sourceUrl']!=match['sourceUrl'] and all(x['url']!=s['sourceUrl'] for x in match.get('otherSources',[])):match.setdefault('otherSources',[]).append({'name':s['sourceName'],'url':s['sourceUrl']})
 for key in ['lat','lon','phone','website','city','address']:
  if not match.get(key) and s.get(key):match[key]=s[key]
 # An official schedule may replace a directory schedule. Missing official
 # hours never borrow unreviewed hours from another source without attribution.

assert len({r['id'] for r in merged})==len(merged),'Duplicate published IDs'
assert all(r['prefecture'] in ['岐阜県','愛知県'] for r in merged)
assert all(r['sourceUrl'].startswith('https://') for r in merged)
merged.sort(key=lambda r:(r['prefecture'],r['city'],r['name']))
output={'updatedAt':NOW,'stores':merged,'sources':SOURCES,'coverageNote':'公式店舗一覧・温浴施設の公開登録情報・OpenStreetMap・岐阜県と愛知県内3市の鮮魚販売許可情報を照合しています。未登録店舗、掲載に同意していない店舗、最新の開閉店には収録漏れがあります。'}
(ROOT/'public/local-data.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'stores':len(merged),'categories':Counter(k for r in merged for k in r['categories']),'withHours':sum(bool(r['hours']) for r in merged),'sources':len(SOURCES)},ensure_ascii=False))
