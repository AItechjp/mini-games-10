"""Exercise the deployed owner API. Requires an existing authorized test session.

Outputs only verification results and the exact disposable room IDs to remove.
Never prints credentials or pre-existing room content.
"""
import json, os, urllib.request, urllib.error, uuid

BASE = os.environ['COMMONS_API_URL'].rstrip('/')
KEY = os.environ['COMMONS_PUBLISHABLE_KEY']
TOKEN = os.environ['COMMONS_TEST_ACCESS_TOKEN']
rooms = []
checks = []

def call(path, data=None, authenticated=True, origin='https://aitechd.com'):
    headers = {'apikey': KEY, 'Content-Type': 'application/json', 'Origin': origin, 'x-region':'ap-southeast-2'}
    if authenticated: headers['Authorization'] = 'Bearer ' + TOKEN
    request = urllib.request.Request(BASE + path, headers=headers,
        data=None if data is None else json.dumps(data).encode(),
        method='GET' if data is None else 'POST')
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())

def check(value, label):
    assert value, label
    checks.append(label)

try:
    check(call('/account', authenticated=False)[0] == 401, 'unauthenticated access blocked')
    check(call('/account', origin='https://example.com')[0] == 403, 'foreign origin blocked')
    check(call('/account')[0] == 200, 'verified owner accepted')
    for tool in ['chat', 'whiteboard']:
        payload = {'tool': tool, 'title': 'AITECH domain migration verification', 'name': 'Verification', 'requestId': str(uuid.uuid4())}
        status, created = call('/rooms', payload)
        check(status == 201, tool + ' create: ' + str(status))
        room = created['id']; rooms.append(room)
        print(json.dumps({'created_test_room': room}), flush=True)
        check(call('/rooms', payload)[1]['id'] == room, tool + ' idempotent creation')
        path = '/rooms/' + room
        kind = 'message' if tool == 'chat' else 'text'
        body = {'text': '移管確認\n日本語の保存'}
        if tool == 'whiteboard': body.update(x=30, y=40, w=480, fontSize=28, color='#24354e')
        item = {'op':'add', 'id':'migration-check', 'kind':kind, 'epoch':0, 'body':body}
        check(call(path, item)[0] == 200, tool + ' add')
        status, data = call(path + '?format=2')
        saved = next(i for i in data['items'] if i['id'] == item['id'])
        check(saved['body'] == body, tool + ' exact content persisted')
        edit = {'op':'edit', 'id':item['id'], 'revision':saved['revision'], 'epoch':0, 'body':{**body, 'text':'編集後の内容'}}
        check(call(path, edit)[0] == 200, tool + ' edit')
        check(call(path, {**edit, 'body':{**body, 'text':'古い更新'}})[0] == 409, tool + ' stale edit protected')
        status, data = call(path + '?format=2')
        check(call(path + '?format=2&since=' + str(data['room']['updated']))[1].get('unchanged'), tool + ' conditional polling')
        if tool == 'whiteboard':
            check(call(path, {'op':'clear_canvas','id':'clear-check','revision':data['room']['canvas_revision']})[0] == 200, 'canvas clear')
            cleared = call(path + '?format=2')[1]
            check(not cleared['items'] and cleared['canvasUndo']['id'] == 'clear-check', 'clear snapshot preserved')
            check(call(path, {**item, 'id':'obsolete'})[0] == 409, 'old canvas epoch rejected')
            check(call(path, {'op':'restore_canvas','id':'clear-check'})[0] == 200, 'canvas clear undo')
            restored = call(path + '?format=2')[1]
            check(restored['items'][0]['body']['text'] == '編集後の内容', 'undo restores exact content')
        else:
            check(call(path, {'op':'delete','id':item['id'],'revision':saved['revision']+1})[0] == 200, 'chat deletion')
    print(json.dumps({'passed':True,'checks':checks,'test_room_ids':rooms}, ensure_ascii=False))
except Exception as error:
    print(json.dumps({'passed':False,'error':str(error),'checks':checks,'test_room_ids':rooms}, ensure_ascii=False))
    raise SystemExit(1)
