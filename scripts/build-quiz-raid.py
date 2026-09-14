"""Build 500 original legal drills and 500 IT drills with per-question provenance.
Uses our own study cards and e-Gov statutory text, never the NC past-paper bank.
"""
import json, pathlib, random, re, collections, math
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'quiz-raid'; rng=random.Random(9142026); bank=[]
lawids={'憲法':'321CONSTITUTION','民法':'129AC0000000089','刑法':'140AC0000000045','商法':'417AC0000000086','民事訴訟法':'408AC0000000109','刑事訴訟法':'323AC0000000131','行政法':'337AC0000000139'}
def add(domain,category,kind,q,correct,wrong,explanation,source,label,level=1):
    opts=list(dict.fromkeys([str(correct)]+[str(x) for x in wrong if str(x)!=str(correct)]))[:4]
    assert len(opts)==4,(q,opts)
    rng.shuffle(opts)
    bank.append(dict(id=f'{domain}-{sum(x["domain"]==domain for x in bank)+1:04}',domain=domain,category=category,kind=kind,level=level,question=q,options=opts,correct=opts.index(str(correct)),explanation=explanation,source=source,sourceLabel=label))
def source_for(card):
    b=card['basis']
    for name,lid in [('日本国憲法','321CONSTITUTION'),('行政手続法','405AC0000000088'),('行政不服審査法','426AC0000000068'),('国家賠償法','322AC0000000125'),('行政事件訴訟法','337AC0000000139'),('会社法','417AC0000000086'),('民事訴訟法','408AC0000000109'),('刑事訴訟法','323AC0000000131'),('民法','129AC0000000089'),('刑法','140AC0000000045')]:
        if b.startswith(name):return 'https://laws.e-gov.go.jp/law/'+lid
    return 'https://www.courts.go.jp/'
s=(ROOT/'yobi-complete-data.js').read_text(); old=json.loads(s[s.index('{'):].rstrip(';\n '))
cards=[c for c in old['cards'] if c['subject']!='一般教養']
# Titles describe the rule, not the answer to a factual case. Conceal the title
# when it occurs in a definition so a question cannot directly reveal its answer.
for c in cards:
    if c['id']=='adm18':c={**c,'title':'不服申立ての自由選択'}
    definition=c['statement'].replace(c['title'],'〔この制度〕')
    alternatives=[x['title'] for x in cards if x['subject']==c['subject'] and x['title']!=c['title']]
    rng.shuffle(alternatives)
    add('law',c['subject'],'制度',f'次の説明に最もよく対応する制度・原則は？\n{definition}',c['title'],alternatives,c['statement'],source_for(c),c['basis'],1)
for c in old['scenarios']:
    if c['subject']=='一般教養':continue
    add('law',c['subject'],'事例',c['question'],c['options'][c['correct']],[v for i,v in enumerate(c['options']) if i!=c['correct']],c['explanation'],source_for(c),c['basis'],2)
groups=[
 ['国会','内閣','裁判所','地方公共団体','国民','天皇'],
 ['最高裁判所','高等裁判所','地方裁判所','簡易裁判所','家庭裁判所'],
 ['裁判官','検察官','弁護人','被告人','被疑者','司法警察員'],
 ['原告','被告','当事者','第三者','代理人','本人'],
 ['債権者','債務者','保証人','所有者','占有者','抵当権者'],
 ['善意','悪意','故意','過失','重大な過失','正当な理由'],
 ['無効','取消し','解除','撤回','承認','追認'],
 ['訴え','請求','申立て','届出','通知','催告'],
 ['棄却','却下','免除','減軽','停止','取消し'],
 ['損害賠償','不当利得','債務不履行','事務管理','不法行為'],
 ['所有権','占有権','抵当権','留置権','先取特権','質権'],
 ['書面','口頭','電磁的記録','登記','引渡し'],
 ['株主総会','取締役会','監査役','取締役','株主','代表取締役'],
 ['公共の福祉','信義','公の秩序','善良の風俗','基本的人権'],
 ['証拠','自白','供述','証言','鑑定','書証'],
 ['逮捕','勾留','保釈','捜索','差押え','押収'],
 ['遺言','相続','贈与','売買','賃貸借','委任','請負'],
 ['弁済','相殺','免除','更改','混同'],
 ['過半数','三分の二','三分の一','四分の三'],
 ['一年','二年','三年','五年','十年','二十年'],
 ['一月','二月','三月','六月','二週間','一週間'],
 ['権利','義務','権限','責任','利益'],
 ['定款','規則','法律','条例','命令'],
 ['合意','同意','承諾','意思表示','意思'],
 ['判決','決定','命令','和解','調停'],
 ['公訴','告訴','告発','上告','控訴','抗告'],
 ['正犯','従犯','共犯','教唆','幇助'],
 ['不動産','動産','財物','土地','建物'],
 ['婚姻','離婚','親権','扶養','養子縁組'],
 ['請求権','取消権','代理権','議決権','形成権'],
 ['差止め','義務付け','執行停止','取消訴訟'],
]
arts=json.loads((ROOT/'assets/ronbun/articles.json').read_text())['articles']
needed=500-len(bank); candidates=[]
for key,a in arts.items():
    # Avoid excerpts that depend on unshown numbered items or paragraph references.
    paras=[p.strip() for p in a['text'].split('\n') if 20<=len(p.strip())<=185 and not re.search(r'次の|次に掲げる|前項|前条|次項|各号|同項|第一項|第二項|第三項|次条',p) and not re.match(r'^[一二三四五六七八九十]+ ',p.strip())]
    found=[]
    for para in paras:
        matches=[]
        for gi,grp in enumerate(groups):
            for term in grp:
                if term in para and para.count(term)==1:
                    # Do not blank a substring inside a longer legal expression.
                    if any(term!=t and term in t and t in para for t in grp):continue
                    matches.append((len(term),gi,term))
        matches.sort(reverse=True)
        for _,gi,term in matches[:2]:
            found.append((key,a,para,gi,term))
    # Round-robin across provisions favors legal breadth over repeated sentences.
    if found:candidates.append(found)
rng.shuffle(candidates); chosen=[]; used=set()
for rank in range(4):
    for found in candidates:
        if rank>=len(found):continue
        item=found[rank]; key,a,para,gi,term=item
        if para in used:continue
        used.add(para);chosen.append(item)
        if len(chosen)==needed:break
    if len(chosen)==needed:break
assert len(chosen)==needed,('not enough statutory drills',len(chosen),needed)
for key,a,para,gi,term in chosen:
    category={'会社法':'商法','行政手続法':'行政法','行政事件訴訟法':'行政法','国家賠償法':'行政法','民事保全法':'民事訴訟法','民事執行法':'民事訴訟法','弁護士法':'司法制度'}.get(a['name'],a['name'])
    others=[x for x in groups[gi] if x!=term];rng.shuffle(others)
    add('law',category,'条文',f'{a["name"]}{a["article"]}の空欄に入る語句は？\n「{para.replace(term,"〔　？　〕") }」',term,others,'空欄は「'+term+'」。\n'+para,a['url'],a['name']+a['article']+'（2026-09-10取得）',2)
assert len(bank)==500
refs={
 '情報基礎':('https://www.ipa.go.jp/shiken/syllabus/gaiyou.html','IPA 出題範囲／情報の表現'),
 'ハードウェア':('https://www.ipa.go.jp/shiken/syllabus/gaiyou.html','IPA 出題範囲／コンピュータ構成'),
 'ネットワーク':('https://www.ipa.go.jp/shiken/syllabus/gaiyou.html','参考：IPA 出題範囲／ネットワーク'),
 'セキュリティ':('https://csrc.nist.gov/glossary','参考：NIST セキュリティ用語集'),
 'データベース':('https://www.postgresql.org/docs/current/tutorial.html','PostgreSQL 公式チュートリアル'),
 'アルゴリズム':('https://www.ipa.go.jp/shiken/syllabus/gaiyou.html','IPA 出題範囲／アルゴリズム'),
 'Web・開発':('https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide','MDN / JavaScript ガイド'),
 'AI・データ分析':('https://developers.google.com/machine-learning/crash-course','Google Machine Learning Crash Course'),
 '運用・マネジメント':('https://www.ipa.go.jp/shiken/syllabus/gaiyou.html','IPA 出題範囲／マネジメント'),
}
rows=[line.split('|') for line in (OUT/'it-concepts.txt').read_text().splitlines() if line.strip()]
for cat,term,definition in rows:
    distractors=[r[1] for r in rows if r[0]==cat and r[1]!=term];rng.shuffle(distractors)
    ref,label=refs[cat]
    if term in ['SQLインジェクション','クロスサイトスクリプティング（XSS）','CSRF','プリペアドステートメント']:
        ref,label='https://www.ipa.go.jp/security/vuln/websecurity/about.html','IPA 安全なウェブサイトの作り方'
    if term=='IPv6':ref,label='https://www.rfc-editor.org/rfc/rfc8200.html','IETF RFC 8200 / IPv6'
    if cat=='ネットワーク' and term in ['HTTP','HTTPS','TLS','WebSocket','CDN','ロードバランサ']:
        ref,label='https://developer.mozilla.org/ja/docs/Web/HTTP','MDN / HTTP'
    if cat=='Web・開発' and term in ['Git','コミット（Git）','ブランチ','マージ','コンフリクト']:
        ref,label='https://git-scm.com/book/ja/v2','Pro Git 公式書籍'
    add('it',cat,'用語','この説明に当てはまるIT用語は？\n'+definition,term,distractors,term+'：'+definition,ref,label)

def numeric(cat,kind,q,ans,exp,unit='',opts=None):
    ref,label=refs[cat]
    if opts is None:
        # Deterministic, distinct distractors with no rounding-equivalent answers.
        vals=[ans+1,ans-1,ans+2,ans*2,ans+10]
        opts=[str(v)+unit for v in vals if v>=0]
    add('it',cat,kind,q,str(ans)+unit,opts,exp,ref,label,2)
target=1000-len(bank)
for idx in range(target):
    kind=idx%20;n=idx//20+1
    if kind==0:
        v=n*7+5;numeric('情報基礎','2進数',f'2進数 {v:b} を10進数で表すと？',v,f'各桁を右から2の0乗、1乗、2乗…として合計します。{v:b}₂ = {v}₁₀。')
    elif kind==1:
        v=n*9+11;numeric('情報基礎','16進数',f'16進数 {v:X} を10進数で表すと？',v,f'各桁を16の累乗で重み付けします。{v:X}₁₆ = {v}₁₀。')
    elif kind==2:
        bits=n*3+6;numeric('情報基礎','データ量',f'{bits}バイトは何ビット？（1バイト＝8ビット）',bits*8,f'{bits} × 8 = {bits*8}ビット。','ビット')
    elif kind==3:
        v=n+3;numeric('ネットワーク','転送時間',f'{v*12}MBのファイルを24Mbpsで送る。通信の付加情報を無視すると何秒？（1MB＝10⁶バイト）',v*4,f'{v*12} × 8 ÷ 24 = {v*4}秒。バイトをビットへ変換してから速度で割ります。','秒')
    elif kind==4:
        a=n+2;b=n+4;numeric('アルゴリズム','繰り返し',f'外側のループを{a}回、毎回その内側のループを{b}回実行する。内側の処理の合計回数は？',a*b,f'{a} × {b} = {a*b}回。','回')
    elif kind==5:
        v=n+4;numeric('アルゴリズム','合計',f'変数sumを0にし、iを1から{v}まで1ずつ増やしてsumに加える。最後のsumは？',v*(v+1)//2,f'1から{v}までの合計は {v} × {v+1} ÷ 2 = {v*(v+1)//2}。')
    elif kind==6:
        a=n+3;b=n%5+2;numeric('Web・開発','コード',f'JavaScript: ({a} * {b}) % 7 の値は？',a*b%7,f'{a} × {b} = {a*b}。これを7で割った余りが {a*b%7} です。')
    elif kind==7:
        a=n+7;vals=[a,a+4,a+7,a+11,a+19];numeric('AI・データ分析','中央値',f'データ {vals[3]}, {vals[0]}, {vals[4]}, {vals[1]}, {vals[2]} の中央値は？',a+7,f'小さい順に {", ".join(map(str,vals))}。中央の3番目は{a+7}です。')
    elif kind==8:
        a=n*4+30;numeric('AI・データ分析','適合率',f'陽性と予測した100件のうち、実際に陽性だったのは{a}件。適合率は？',a,'適合率＝真陽性÷陽性と予測した全件数。本問は分母が100なので、そのまま百分率になります。','%')
    elif kind==9:
        count=n+5;numeric('データベース','SQL集計',f'表に{count}行あり、列scoreのNULLが2行ある。SELECT COUNT(score) の結果は？',count-2,f'COUNT(列名)はNULLを数えません。{count} − 2 = {count-2}。COUNT(*)なら全{count}行を数えます。')
    elif kind==10:
        c=n*5+10;numeric('データベース','条件',f'表のscore列には{c}, {c+10}, {c+20}, {c+30}, NULLがある。WHERE score >= {c+20} に当てはまる行数は？',2,f'{c+20}と{c+30}の2行。NULLとの通常の比較は真にならないので選ばれません。','行')
    elif kind==11:
        a=n+1;numeric('アルゴリズム','スタック',f'空のスタックに{a}、{a+2}、{a+5}の順でpushした後、1回popした。次のpopで取り出す値は？',a+2,f'LIFOなので最初に{a+5}、次に{a+2}が取り出されます。')
    elif kind==12:
        a=n*2;numeric('アルゴリズム','キュー',f'空のキューに{a}、{a+3}、{a+8}の順で追加し、1回取り出した。次に取り出す値は？',a+3,f'FIFOなので最初に{a}、次に{a+3}が取り出されます。')
    elif kind==13:
        bits=n+3;numeric('情報基礎','ビット表現',f'符号なし{bits}ビット整数が表せる最大値は？',2**bits-1,f'0を含む2^{bits}通りなので、最大値は2^{bits} − 1 = {2**bits-1}。')
    elif kind==14:
        a=2*n+1;b=3*n+2;numeric('運用・マネジメント','作業計画',f'作業A（{a}日）の終了後、B（{b}日）とC（{b+4}日）を並行実行し、両方の完了後にD（2日）を行う。最短完了日数は？',a+b+6,f'A→C→Dが最長経路。{a} + {b+4} + 2 = {a+b+6}日。','日')
    elif kind==15:
        p=n*4+30;numeric('運用・マネジメント','稼働率',f'100時間の観測で、稼働していたのは{p}時間。観測期間の稼働率は？',p,f'稼働率 = 稼働時間 ÷ 観測時間 × 100 = {p} ÷ 100 × 100 = {p}%。','%')
    elif kind==16:
        a=n*4+5;numeric('Web・開発','コード',f'JavaScript: const a = [{a}, {a+3}, {a+6}]; a.push({a+9}); a.shift(); a[1] の値は？',a+6,f'追加後に先頭を削除すると [{a+3}, {a+6}, {a+9}]。添字1は2番目の{a+6}です。')
    elif kind==17:
        a=n+1;numeric('Web・開発','コード',f'JavaScript: [{a}, {a+1}, {a+2}].map(x => x * 2).reduce((s, x) => s + x, 0) の値は？',6*a+6,f'2倍した各値を合計します。{2*a} + {2*(a+1)} + {2*(a+2)} = {6*a+6}。')
    elif kind==18:
        v=n+3;numeric('情報基礎','画像容量',f'{v*10}×{v*10}ピクセル、1ピクセル24ビットの画像。ヘッダーと圧縮を無視した容量は？',v*v*300,f'{v*10} × {v*10} × 24 ÷ 8 = {v*v*300}バイト。','バイト')
    else:
        count=n+3;numeric('データベース','結合',f'A表が{count}行、B表が3行。WHERE条件なしのCROSS JOINは何行になる？',count*3,f'すべての行の組合せなので {count} × 3 = {count*3}行。','行')
assert len(bank)==1000
assert len({q['id'] for q in bank})==1000
assert len({q['question'] for q in bank})==1000
for q in bank:
    assert len(q['options'])==4 and len(set(q['options']))==4
    assert q['source'].startswith('https://') and q['explanation']
counts={d:dict(collections.Counter(q['category'] for q in bank if q['domain']==d)) for d in ['law','it']}
notes={'law':'オリジナル制度・事例問題と2026-09-10取得のe-Gov条文に基づく穴埋め。','it':'用語問題と、数値の異なる計算・コード演習を含むオリジナル問題。'}
for domain in ['law','it']:
    questions=[q for q in bank if q['domain']==domain]
    assert len(questions)==500
    target=ROOT/f'{domain}-quiz';target.mkdir(exist_ok=True)
    result={'version':'2026-09-14.split1','domain':domain,'count':500,'counts':counts[domain],'notes':notes[domain],'questions':questions}
    (target/'questions.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'count':len(bank),'categories':counts,'kinds':dict(collections.Counter(q['kind'] for q in bank))},ensure_ascii=False))
