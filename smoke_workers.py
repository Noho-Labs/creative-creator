import concurrent.futures
import os
import sys
import uuid
import json
import subprocess
import time

BASE = os.environ.get('SMOKE_BASE', 'http://localhost:3000')
CREATOR = os.environ.get('SMOKE_CREATOR', 'richard@noholabs.com')
RUN = uuid.uuid4().hex
A = f'a-{RUN}@noholabs.com'
B = f'b-{RUN}@noholabs.com'

def call(method, path, email=CREATOR, body=None, expected=200):
    args = ['curl', '-sS', '-X', method, BASE + path, '-H', 'x-dev-user-email: ' + email, '-w', '\n%{http_code}']
    if body is not None:
        args += ['-H', 'Content-Type: application/json', '--data', json.dumps(body)]
    output = subprocess.check_output(args, text=True)
    raw, status = output.rsplit('\n', 1)
    assert int(status) == expected, (method, path, status, raw)
    return json.loads(raw) if raw else None

def wait_complete(campaign, ids):
    for _ in range(60):
        rows = call('GET', f'/api/campaigns/{campaign}/creatives')['creatives']
        selected = [row for row in rows if row['id'] in ids]
        if len(selected) == len(ids) and all(row['status'] == 'complete' for row in selected):
            return selected
        time.sleep(0.5)
    raise AssertionError('generation did not complete')

campaign = call('POST', '/api/campaigns', body={'name': 'Review smoke campaign', 'brief': 'A bold, clean campaign for a fictional productivity tool.'}, expected=201)['id']
ids = []
for concept in ['Calm focus, bold typography', 'A brighter workday, warm colors']:
    ids.append(call('POST', f'/api/campaigns/{campaign}/creatives', body={'concept': concept, 'details': 'Portrait composition with a clear headline.'}, expected=201)['creative']['id'])
wait_complete(campaign, ids)
moved = call('POST', '/api/creatives/send-for-review', body={'ids': ids})['creatives']
assert len(moved) == 2
assert call('POST', '/api/creatives/send-for-review', body={'ids': ids})['creatives'] == []
print('1. Created campaign + 2 creatives; both complete and sent for review. Resend moved 0.')
first = call('GET', '/api/review', A)
assert first['remaining'] == 2
item1 = first['creative']['id']
call('POST', f'/api/review/{item1}', A, {'decision': 'approve', 'version': 1}, 201)
second = call('GET', '/api/review', A)
assert second['remaining'] == 1 and second['creative']['id'] != item1
item2 = second['creative']['id']
call('POST', f'/api/review/{item2}', A, {'decision': 'changes', 'note': '' , 'version': 1}, 400)
call('POST', f'/api/review/{item2}', A, {'decision': 'changes', 'note': 'Use a warmer background and larger headline.', 'version': 1}, 201)
empty = call('GET', '/api/review', A)
assert empty['creative'] is None and empty['remaining'] == 0
print('2. Reviewer a approved item 1, requested changes on item 2, then queue empty. Empty changes note -> 400.')
assert call('GET', '/api/review', B)['remaining'] == 2
print('3. Reviewer b still has both items (remaining=2).')
duplicate = call('POST', f'/api/review/{item1}', A, {'decision': 'approve', 'version': 1}, 409)
print('4. Duplicate review -> 409:', duplicate['error'])
call('POST', '/api/creatives/send-for-review', A, {'ids': ids}, 403)
call('POST', f'/api/creatives/{item1}/decision', A, {'action': 'approve'}, 403)
print('5. Non-creator send-for-review and creator decision -> 403.')
rows = call('GET', f'/api/campaigns/{campaign}/creatives')['creatives']
assert all(row['reviewStatus'] == 'in_review' for row in rows)
assert sum(row['reviewSummary']['counts']['changes'] for row in rows) == 1
call('POST', f'/api/creatives/{item2}/decision', body={'action': 'revise', 'version': 1, 'notes': 'Use a warmer background and larger headline.'})
rows = wait_complete(campaign, [item2])
assert rows[0]['version'] == 2 and rows[0]['reviewStatus'] == 'in_review'
again = call('GET', '/api/review', A)
assert again['creative']['id'] == item2 and again['creative']['version'] == 2 and again['remaining'] == 1
assert again['creative']['reviewSummary']['counts'] == {'approve': 0, 'deny': 0, 'changes': 0}
call('POST', f'/api/review/{item2}', A, {'decision': 'approve', 'version': 1}, 409)
print('6. Item 2 regenerated, in_review v2; reviewer a sees it again. Stale v1 -> 409; v2 counts reset.')
approved = call('POST', f'/api/creatives/{item1}/decision', body={'action': 'approve', 'version': 1})['creative']
assert approved['reviewStatus'] == 'approved' and approved['decidedBy'] == CREATOR and approved['decidedAt']
print('7. Creator approved item 1; decidedAt and decidedBy set.')
assert call('GET', '/api/review', B)['remaining'] == 1
response = subprocess.check_output(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code} %{redirect_url}', '-H', 'x-dev-user-email: ' + A, BASE + '/'], text=True)
assert response == '307 ' + BASE + '/review', response
assert subprocess.check_output(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '-H', 'x-dev-user-email: ' + A, BASE + f'/api/images/{item2}'], text=True) == '200'
print('Extra: reviewer home -> 307 /review; reviewer image -> 200; reviewer decisions did not finalize status.')
print('PASS: curl smoke complete')
print('Campaign board: ' + BASE + '/campaigns/' + campaign)
print('Review queue: ' + BASE + '/review')

def wait_status(id, status, timeout=40):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        rows = call('GET', f'/api/campaigns/{campaign}/creatives')['creatives']
        creative = next(row for row in rows if row['id'] == id)
        if creative['status'] == status:
            return creative
        time.sleep(0.5)
    raise AssertionError(('Timed out', status, creative))

def upload(path, png, expected=200, mime='image/png', kind=None):
    args = ['curl', '-sS', '-X', 'POST', BASE + path, '-H', 'x-dev-user-email: ' + CREATOR,
            '-F', f'file=@-;filename=synthetic.png;type={mime}', '-w', '\\n%{http_code}']
    if kind:
        args += ['-F', 'kind=' + kind]
    raw, status = subprocess.check_output(args, input=png).decode().rsplit(chr(10), 1)
    assert int(status) == expected, (path, status, raw)
    return json.loads(raw)

path = f'/api/creatives/{item2}/decision'
call('POST', path, body={'action': 'approve'}, expected=400)
call('POST', path, body={'action': 'approve', 'version': 0}, expected=400)
call('POST', path, body={'action': 'revise', 'version': 2, 'notes': ''}, expected=400)
for action in ['approve', 'reject', 'revise']:
    call('POST', path, body={'action': action, 'version': 1, 'notes': 'Warm colors'}, expected=409)
print('PASS: creator missing/invalid version and empty notes -> 400; stale approve/reject/revise -> 409')

revision = call('POST', path, body={'action': 'revise', 'version': 2, 'notes': 'Show a screenshot, the app icon and brand logo.'})['creative']
assert revision['version'] == 3 and revision['classifiedAt'] is None
parked = wait_status(item2, 'awaiting_screenshot')
assert parked['needsScreenshot'] and parked['needsAppIcon'] and parked['needsLogo']
png = subprocess.check_output(['curl', '-fsS', '-H', 'x-dev-user-email: ' + A, BASE + f'/api/images/{item2}'])
assert png.startswith(bytes([137, 80, 78, 71]))
for kind in ['icon', 'logo']:
    upload(f'/api/campaigns/{campaign}/assets', png, kind=kind)
    result = subprocess.check_output(['curl', '-fsS', '-H', 'x-dev-user-email: ' + CREATOR,
        BASE + f'/api/campaigns/{campaign}/assets/{kind}'])
    assert result == png
upload(f'/api/creatives/{item2}/screenshot', b'invalid image', expected=400, mime='text/plain')
upload(f'/api/creatives/{item2}/screenshot', png)
complete = wait_status(item2, 'complete')
assert complete['version'] == 3 and complete['screenshotPath']
call('POST', path, body={'action': 'approve', 'version': 3})
print('PASS: revision notes reclassify icon/logo/screenshot; R2 uploads round-trip; invalid upload -> 400; screenshot enqueues generation -> complete v3')

headers = subprocess.check_output(['curl', '-sSI', '-H', 'x-dev-user-email: ' + A, BASE + f'/api/images/{item2}'], text=True)
assert 'cache-control: private, no-store' in headers.lower()
assert subprocess.check_output(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '-H',
    'x-dev-user-email: ' + A, BASE + '/api/images/' + str(uuid.uuid4())], text=True) == '404'
print('PASS: R2 generated images retain private/no-store; unknown image -> 404')

race = call('POST', f'/api/campaigns/{campaign}/creatives', body={'concept': 'Clean typography'}, expected=201)['creative']['id']
wait_status(race, 'complete')
call('POST', '/api/creatives/send-for-review', body={'ids': [race]})
def submit_duplicate(_):
    args = ['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST', BASE + f'/api/review/{race}',
        '-H', 'Content-Type: application/json', '-H', 'x-dev-user-email: ' + A,
        '--data', json.dumps({'decision': 'approve', 'version': 1})]
    return subprocess.check_output(args, text=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    assert sorted(pool.map(submit_duplicate, range(2))) == ['201', '409']
def decide(action):
    args = ['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST', BASE + f'/api/creatives/{race}/decision',
        '-H', 'Content-Type: application/json', '-H', 'x-dev-user-email: ' + CREATOR,
        '--data', json.dumps({'action': action, 'version': 1, 'notes': 'Warmer colors'})]
    return subprocess.check_output(args, text=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    assert sorted(pool.map(decide, ['approve', 'revise'])) == ['200', '409']
print('PASS: concurrent duplicate reviews -> 201/409; concurrent creator approve vs revise -> 200/409')

if '--queue-errors' in sys.argv:
    assert BASE in ['http://localhost:3000', 'http://127.0.0.1:3000'], 'Local D1 fault injection only'
    broken = call('POST', f'/api/campaigns/{campaign}/creatives',
                  body={'concept': 'A screenshot of the dashboard'}, expected=201)['creative']['id']
    wait_status(broken, 'awaiting_screenshot')
    subprocess.check_call(['npx', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command',
        f"UPDATE creatives SET screenshot_path='missing-test-image.png', status='failed' WHERE id='{broken}'"],
        stdout=subprocess.DEVNULL)
    call('POST', f'/api/creatives/{broken}/retry')
    failed = wait_status(broken, 'failed', timeout=240)
    assert failed['error'] == 'Image not found'
    print('PASS: missing R2 asset retries through Queue consumer, then fails after four attempts')
    upload(f'/api/creatives/{broken}/screenshot', png)
    call('POST', f'/api/creatives/{broken}/retry')
    wait_status(broken, 'complete')
    print('PASS: retry API enqueues repaired creative -> complete')

final_race = wait_status(race, 'complete')
if final_race['reviewStatus'] == 'in_review':
    call('POST', f'/api/creatives/{race}/decision', body={'action': 'approve', 'version': final_race['version']})
if '--local-extras' in sys.argv:
    assert BASE in ['http://localhost:3000', 'http://127.0.0.1:3000'], 'Local D1 fixture injection only'
    def local_sql(statement):
        subprocess.check_call(['npx', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', statement], stdout=subprocess.DEVNULL)
    bulk = [str(uuid.uuid4()) for _ in range(101)]
    values = ','.join(f"('{id}','{campaign}','Bulk test','complete')" for id in bulk)
    local_sql('INSERT INTO creatives (id,campaign_id,concept,status) VALUES ' + values)
    moved = call('POST', '/api/creatives/send-for-review', body={'ids': bulk})['creatives']
    assert len(moved) == 101
    assert len(call('GET', f'/api/campaigns/{campaign}/creatives')['creatives']) >= 101
    local_sql(f"UPDATE creatives SET review_status='approved' WHERE campaign_id='{campaign}' AND review_status='in_review'")
    print('PASS: 101-id atomic send-for-review and DTO review summaries avoid D1 parameter limits')
    pending, orphan = str(uuid.uuid4()), str(uuid.uuid4())
    local_sql(f"INSERT INTO creatives (id,campaign_id,concept,status,started_at) VALUES ('{pending}','{campaign}','Recovered pending','pending',NULL),('{orphan}','{campaign}','Recovered orphan','generating','2000-01-01T00:00:00.000Z')")
    subprocess.check_call(['curl', '-fsS', BASE + '/__scheduled'], stdout=subprocess.DEVNULL)
    wait_status(pending, 'complete')
    wait_status(orphan, 'complete')
    print('PASS: scheduled handler recovers an unsent pending job and a stale generating job through Queue delivery')
print('PASS: Workers lifecycle, conditional D1 mutations, Queue generation, and R2 assets')
