#!/usr/bin/env python3
"""Rebuild the readable constitution textbook from the canonical curriculum."""
import json, html
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'commons/constitution'
data = json.loads((out/'content.json').read_text())
by_id = {}
leaves = []
def index(n, path=()):
    by_id[n['id']] = n
    if not n.get('children'):
        leaves.append((n, path))
    for c in n.get('children', []):
        index(c, path+(n['title'],))
index(data['root'])
chapters = [by_id[i] for i in data['chapters']]
e=lambda s:html.escape(str(s),quote=True)
def link(url,title):return f'<a href="{e(url)}" target="_blank" rel="noopener">{e(title)}</a>'
def items(title,values):return '<h4>'+e(title)+'</h4><ul>'+''.join('<li>'+e(s)+'</li>' for s in values)+'</ul>'
body='<h1>憲法マインドマップ・全範囲テキスト</h1><p>予備試験の短答・論文を学ぶための独自教材。'+str(len(leaves))+'論点。作成・資料確認日：2026年9月19日。</p><p>規範の暗記と、事実への当てはめの訓練を組み合わせてください。主要論点を体系化した教材であり、合格や完全な網羅を保証するものではありません。</p>'
body+='<nav><h2>目次</h2><ol>'+''.join(f'<li><a href="#{e(c["id"])}">{e(c["title"])}</a></li>' for c in chapters)+'</ol></nav>'
for c in chapters:
    body+=f'<section><h2 id="{e(c["id"])}">{e(c["title"])}</h2><p>{e(c["summary"])}</p>'
    def render(n,path,depth):
        global body
        if n.get('children'):
            if n is not c:body+=f'<h3>{e(n["title"])}</h3><p class="muted">{e(n.get("summary",""))}</p>'
            for k in n['children']:render(k,path+[n['title']],depth+1)
        else:
            body+=f'<article id="{e(n["id"])}"><p class="path">{e(" › ".join(path))}</p><h3>{e(n["title"])}</h3><p>{e(" / ".join(n.get("articles",[])))}</p><p class="summary">{e(n["summary"])}</p><h4>理解する規範</h4><p>{e(n["rule"])}</p>'
            for title,key in [('短答で押さえる','short'),('論文で使う','essay'),('混同しない','pitfalls')]:body+=items(title,n[key])
            if n.get('cases'):
                body+='<h4>判例と射程</h4>'
                for case in n['cases']:
                    body+=f'<div class="case"><strong>{e(case["name"])} {e(case.get("date",""))}</strong><p>{e(case["holding"])}</p>'+ (link(case['url'],'判例の出典') if case.get('url') else '')+'</div>'
            body+='<h4>想起チェック</h4><p>'+e(n['check']['q'])+'</p><details><summary>答え</summary><p>'+e(n['check']['a'])+'</p></details><h4>条文・確認資料</h4><ul>'+''.join('<li>'+link(s['url'],s['title'])+'</li>' for s in n['sources'])+'</ul><p>'+link('./#'+n['id'],'マップでこの論点を開く')+'</p></article>'
    render(c,[],0)
    body+='</section>'
page='''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>憲法・全範囲テキスト｜予備試験｜コモンズ</title><meta name="description" content="憲法マインドマップの全論点を一括で読めるテキスト版。条文、規範、短答、論文、判例、想起チェック。"><link rel="icon" href="/commons/favicon.svg"><link rel="canonical" href="https://aitechd.com/commons/constitution/textbook.html"><style>body{font:16px/1.9 system-ui,sans-serif;color:#203b33;background:#f7f8f3;margin:0}main{max-width:900px;margin:auto;padding:28px 24px;background:#fff}a{color:#146b51;overflow-wrap:anywhere}header{padding:16px 24px;background:#183c36;color:white}header a{color:white}h1{font-size:1.8rem}h2{margin-top:60px;border-bottom:2px solid #658968;padding:12px 0;font-size:1.5rem}h3{font-size:1.2rem}h4{margin-bottom:8px;font-size:1rem}article{padding:20px 0;border-bottom:1px solid #d7dfd2;scroll-margin-top:20px}.path,.muted{font-size:.875rem;color:#647568}.summary{border-left:3px solid #8aa466;background:#f2f6ec;padding:14px}.case{padding:12px;border-left:2px solid #d7e2cc;margin:10px 0}details{background:#f1f6eb;padding:12px}summary{cursor:pointer}@media print{body,main{background:white;font-size:10pt}main{max-width:none;padding:0}header{display:none}h2{break-before:page}h3,h4{break-after:avoid}details{background:none}details::details-content{display:block} @page{size:A4;margin:17mm}}</style></head><body><header><a href="./">← 憲法マインドマップ</a>　 /　<a href="/commons/">コモンズ</a></header><main>'''+body+'</main></body></html>'
(out/'textbook.html').write_text(page)
print(f"Built textbook: {len(leaves)} topics")
