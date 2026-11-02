"""org_rnr_source.py 회귀 — python -I tools/docs/test/org_rnr_source_test.py

실제 운영 HTML 의 임시 사본에만 쓴다. Obsidian CLI 는 subprocess.run 을, apply 허용 target 은 APPLY_TARGETS 를 테스트에서만
임시 사본으로 바꿔 끼운다 — 실제 Vault 읽기·실제 정본 apply 검증이 아니다.
양성: preview(효력 전) · 최초 이관 apply(원본 동등) · 검토된 편집 apply(--source-sha256) 반영, 선택 영역 밖 byte·ID·승인 모델 값 보존,
      반복 실행 무변경.
음성: 잘못된 Vault/노트/target/효력 상태·ID 누락/중복·내용 손실·깨진 block·timeout·source/target 동시 변경·출력 경로 충돌
      → 실패 + target·source(fixture)·기존 사용자 임시 파일 무수정.
--scope project-operations: 같은 원장 사본의 #ai-organization 밖 top-level section 12개만 한 번에 교체(밖 byte 동일), 잘못된 scope/
      owner/ID·블록 중복/누락/순서/섹션 간 이동·viewBox 대소문자·결정 이력 삭제/숨김/순서/링크 변조/위험한 새 행·stale·CLI 실패 시
      Vault 파일 우회·Vault 안/별칭(Windows 확장 경로·hard link·부서 노트) 출력·fixture 를 거부한다.
"""
import hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('org_rnr_source', HERE.parent / 'org_rnr_source.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
REPO = HERE.parents[2]
REAL = REPO / 'docs/creat2ve/CHANGJO_GAMES_ORG_RNR.html'
MODELS = REPO / 'docs/creat2ve/worker-models.json'
REAL_RUN = subprocess.run
sha = lambda b: hashlib.sha256(b).hexdigest()
REAL_SHA = sha(REAL.read_bytes())
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PILOT = {'document_id': 'CG-ORG-RNR', 'vault_id': m.VAULT_ID, 'owner': 'Mercury', 'status': 'pilot-review',
         'source_of_truth': 'false', 'effective_at': ''}
EFFECTIVE = {**PILOT, 'status': 'active', 'source_scope': 'ai-organization', 'source_of_truth': 'true',
             'effective_at': '2026-10-29T00:00:00+09:00'}


def block(tag='v1', drop=None, empty=None, extra=''):
    o = ['## 전체 AI 조직도와 확장 배치', '', f'<p class="lead">fixture {tag}</p>',
         '<h3 id="ai-org-chart">전체 조직도</h3><figure class="visual" data-figure="organization"><svg viewBox="0 0 9 9"><title>t</title></svg></figure>',
         '', f'근거는 [기존 실행표]({m.REPORT_URI}runtime)를 따른다.', '']
    for k in m.CHILDREN:
        if k != drop:
            rows = '' if k == empty else f'| 항목 | 값 |\n| --- | --- |\n| {k} | {tag} |'
            o += [f'<details class="fold" id="{k}"><summary>{k}</summary><div class="fold-body">', '', rows, '', '</div></details>', '']
    return '\n'.join(o) + extra


def note(fm=EFFECTIVE, body=None, begin=m.BEGIN, end=m.END, fm_extra=''):
    head = '---\n' + ''.join(f'{k}: {v}\n' for k, v in fm.items()) + fm_extra + '---\n# Org Chart and R&R\n\n'
    return head + begin + '\n' + (block() if body is None else body) + '\n' + end + '\n'


def fake(reads, root=None, timeout=False, on_second_read=None, note=m.NOTE):
    n = {'read': 0}

    def run(cmd, **kw):
        assert cmd[0] == m.OBSIDIAN and cmd[1] == 'vault=' + m.VAULT_ID and kw.get('timeout'), cmd
        if timeout:
            raise subprocess.TimeoutExpired(cmd, kw['timeout'])
        if cmd[2:] == ['vault', 'info=path']:
            out = root or m.VAULT_ROOT
        else:
            assert cmd[2:] == ['read', 'path=' + note], cmd  # 읽기 외 CLI 명령(쓰기)은 없다
            n['read'] += 1
            if n['read'] == 2 and on_second_read:
                on_second_read()
            out = reads[min(n['read'], len(reads)) - 1]
        return subprocess.CompletedProcess(cmd, 0, out, '')
    return run


def call(args, reads=(), **kw):
    m.subprocess.run = fake(list(reads), **kw)
    try:
        return m.main([str(a) for a in args])
    except SystemExit as e:
        return e.code
    finally:
        m.subprocess.run = REAL_RUN


ok = 0


def check(cond, what):
    global ok
    if not cond:
        raise SystemExit(f'FAIL: {what}')
    ok += 1


with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    T = d / 'CHANGJO_GAMES_ORG_RNR.html'
    shutil.copyfile(REAL, T)
    m.APPLY_TARGETS = (T,)
    orig = T.read_bytes()
    _, pre, old, post = m.split_target(T)
    PRE, POST = pre.encode(), post.encode()
    models_sha = sha(MODELS.read_bytes())
    user_tmp = d / (T.name + '.tmp')
    user_tmp.write_bytes(b'user temp')
    migration = note(body=old.strip('\n').replace('href="#runtime"', f'href="{m.REPORT_URI}runtime"'))
    apply = lambda *src: ['apply', '--target', T, '--target-sha256', sha(T.read_bytes()),
                          *(['--source-sha256', sha(src[0].encode())] if src else [])]

    # ── 양성: 효력 전 preview 는 후보만 만든다 ──
    out = d / 'preview.html'
    check(call(['preview', '--target', T, '--out', out], [note(PILOT)]) == 0, 'preview(효력 전) 성공')
    check(T.read_bytes() == orig and b'fixture v1' in out.read_bytes(), 'preview 는 target 무수정·후보 반영')
    fx = d / 'note.md'
    fx.write_text(note(PILOT), encoding='utf-8')
    fx_bytes = fx.read_bytes()
    check(call(['preview', '--target', T, '--out', d / 'p2.html', '--fixture', fx], timeout=True) == 0, 'fixture preview 는 CLI 미호출')
    check(call(['apply', '--target', T, '--target-sha256', sha(orig), '--fixture', fx]) == 2, 'apply --fixture 거부(2)')

    # ── 음성: 출력 경로·target 경계 → 종료 2, 아무것도 쓰지 않음 ──
    alias = d / 'alias.html'
    os.link(T, alias)
    other = d / 'other' / T.name
    other.parent.mkdir()
    shutil.copyfile(REAL, other)
    vault = d / 'vault'
    vault.mkdir()
    rc = d / 'r.json'
    path_negatives = {
        '다른 checkout 사본 apply': ['apply', '--target', other, '--target-sha256', sha(orig)],
        'apply --receipt=target': apply(note()) + ['--receipt', T],
        'preview --out=target 별칭(hard link)': ['preview', '--target', T, '--out', alias],
        'preview --receipt=target': ['preview', '--target', T, '--out', out, '--receipt', T],
        'preview --out=--receipt': ['preview', '--target', T, '--out', rc, '--receipt', rc],
        'preview --out=fixture(source)': ['preview', '--target', T, '--out', fx, '--fixture', fx],
        'preview Vault 내부 출력': ['preview', '--target', T, '--out', vault / 'x.html'],
        'preview fixture=Vault 내부(파일시스템 우회)': ['preview', '--target', T, '--out', out, '--fixture', vault / 'x.md'],
        'preview --out Windows 확장 경로 Vault 내부': ['preview', '--target', T, '--out', Path('\\\\?\\' + str(vault / 'x.html'))],
    }
    real_vault = m.VAULT_ROOT
    m.VAULT_ROOT = str(vault)  # 잘못돼도 실제 Vault 가 아닌 임시 폴더에 쓰이게
    for why, args in path_negatives.items():
        check(call(args, [note()]) == 2 and T.read_bytes() == orig and other.read_bytes() == orig and fx.read_bytes() == fx_bytes, why)
    check(not rc.exists() and not any(vault.iterdir()), '거부된 출력 경로에 쓰기 없음')
    m.VAULT_ROOT = real_vault

    # ── apply target 별칭: 허용 정본의 정확한 경로만. 별칭을 os.replace 하면 정본 대신 별칭이 바뀐다 ──
    alias_apply = lambda p: ['apply', '--target', p, '--target-sha256', sha(orig)]
    check(call(alias_apply(alias), [migration]) == 2 and T.read_bytes() == orig and alias.read_bytes() == orig
          and os.path.samefile(alias, T) and user_tmp.read_bytes() == b'user temp', 'apply --target hard link 별칭 거부')
    sym = d / 'sym.html'
    try:
        os.symlink(T, sym)
    except OSError as e:
        print(f'SKIP symlink 별칭 2건: 이 환경에서 symlink 생성 불가(설정·권한 변경 안 함) — {e}')
    else:
        check(call(alias_apply(sym), [migration]) == 2 and T.read_bytes() == orig and sym.is_symlink(), 'apply --target symlink 별칭 거부')
        m.APPLY_TARGETS = (sym,)
        check(call(alias_apply(sym), [migration]) == 2 and T.read_bytes() == orig and sym.is_symlink(), '정본 leaf 가 symlink 이면 거부')
        m.APPLY_TARGETS = (T,)

    # ── 음성: 검증 실패 → 종료 1, target 무수정 ──
    fm = lambda **kv: {**EFFECTIVE, **kv}
    no = lambda k: {x: v for x, v in EFFECTIVE.items() if x != k}
    loss = migration.replace('기존 6개 ID는 보존한다. ', '', 1)
    negatives = {  # (apply 인자 source, CLI 읽기 결과들, 추가 옵션)
        '효력 전(pilot) apply': (note(PILOT), {}),
        'source_of_truth=true 지만 status=pilot-review': (note(fm(status='pilot-review')), {}),
        'source_scope 없음': (note(no('source_scope')), {}),
        'source_scope 회사 전체로 확대': (note(fm(source_scope='company')), {}),
        'effective_at null': (note(fm(effective_at='null')), {}),
        'effective_at 빈 값': (note(fm(effective_at='')), {}),
        'effective_at timezone 없음': (note(fm(effective_at='2026-10-29T00:00:00')), {}),
        'effective_at 미래': (note(fm(effective_at='2099-01-01T00:00:00+09:00')), {}),
        'effective_at 무효': (note(fm(effective_at='soon')), {}),
        'frontmatter 중복 키(마지막 값만 보면 통과)': (note(fm(status='pilot-review'), fm_extra='status: active\n'), {}),
        '잘못된 Vault 루트': (note(), dict(root='E:/Toolkit/Mirror/CJ Library/CJ Library')),
        '잘못된 vault_id': (note(fm(vault_id='e513c031d697ec24')), {}),
        '잘못된 노트 document_id': (note(fm(document_id='DD-PM-ENTRY')), {}),
        '잘못된 owner': (note(fm(owner='Mars')), {}),
        '상태 불명(status 없음)': (note(no('status')), {}),
        '상태 불명(source_of_truth)': (note(fm(source_of_truth='maybe')), {}),
        '중복 block': (note() + m.BEGIN + '\nx\n' + m.END + '\n', {}),
        '깨진 block(END 없음)': (note(end=''), {}),
        '깨진 block(details 미닫힘)': (note(body=block().replace('</div></details>', '', 1)), {}),
        '필수 ID 누락': (note(body=block(drop='ai-audio')), {}),
        '내용 손실(빈 하위 절)': (note(body=block(empty='ai-sources')), {}),
        '하위 ID 중복': (note(body=block(extra='\n\n<p id="ai-rollout">사본</p>')), {}),
        '영역 밖 ID 충돌': (note(body=block(extra='\n\n<p id="team">x</p>')), {}),
        '노트 안 맨 #앵커': (note(body=block().replace(m.REPORT_URI, '#')), {}),
        'target 에 없는 앵커': (note(body=block().replace(m.REPORT_URI + 'runtime', m.REPORT_URI + 'nope')), {}),
        '허용 안 된 태그': (note(body=block(extra='\n\n<script>x</script>')), {}),
        '조직 노트 안 다른 scope 표식': (note(body=block(extra='\n\n<!-- DD-PM-ENTRY:current:begin -->')), {}),
        '조직 SVG viewBox 소문자화': (note(body=block().replace('viewBox=', 'viewbox=')), {}),
    }
    for why, (src, kw) in negatives.items():
        check(call(apply(src), [src], **kw) == 1 and T.read_bytes() == orig, why)
    check(call(apply(), timeout=True) == 1 and T.read_bytes() == orig, 'CLI timeout')
    check(call(apply(), [loss]) == 1 and T.read_bytes() == orig, '최초 이관 문장 1개 손실 차단')
    check(call(apply(), [note()]) == 1 and T.read_bytes() == orig, '최초 이관에 검토 안 된 편집 차단')
    check(call(apply(note(body=block('v0'))), [note()]) == 1 and T.read_bytes() == orig, '검토한 source SHA 와 다른 노트')
    check(call(['apply', '--target', T, '--target-sha256', '0' * 64], [migration]) == 1 and T.read_bytes() == orig, '잘못된 target SHA')
    check(call(apply(note()), [note(), note(body=block('v2'))]) == 1 and T.read_bytes() == orig, 'source 동시 변경')
    bumped = orig + b'\n'
    check(call(apply(note()), [note()], on_second_read=lambda: T.write_bytes(bumped)) == 1 and T.read_bytes() == bumped, 'target 동시 변경 → 덮어쓰지 않음')
    T.write_bytes(orig)

    # ── 양성: 최초 이관(원본 동등) ──
    check(call(apply() + ['--receipt', rc], [migration]) == 0, '최초 이관 apply 성공')
    mig = T.read_bytes()
    r = json.loads(rc.read_text(encoding='utf-8'))
    check(r['apply_kind'] == 'migration' and r['coverage']['structure_equal'], '최초 이관 의미·링크·ID 동등')
    check(mig.startswith(PRE) and mig.endswith(POST) and b'href="#runtime"' in mig, '최초 이관 영역 밖 byte 보존·#runtime 환원')

    # ── 양성: 검토된 편집 반영 · 영역 밖 보존 ──
    check(call(apply(note()) + ['--receipt', rc], [note()]) == 0, '검토된 편집 apply 성공')
    new = T.read_bytes()
    check(new != mig and b'fixture v1' in new and b'href="#runtime"' in new and m.REPORT_URI.encode() not in new, '실제 수정·#runtime 환원 반영')
    check(new.startswith(PRE) and new.endswith(POST), '선택 영역 밖 byte 보존')
    ids = re.findall(rb'\sid="([^"]+)"', new)
    check(len(ids) == len(set(ids)) and set(re.findall(rb'\sid="([^"]+)"', PRE + POST)) <= set(ids), 'ID 유일·영역 밖 ID 보존')
    for s in (b'gpt-6.1-sol / xhigh', b'claude-opus-5-5 / high', b'gpt-6-astra / medium', b'gpt-6-luna / xhigh'):
        check(new.count(s) == orig.count(s) > 0, f'승인 모델 값 보존 {s!r}')
    check(sha(MODELS.read_bytes()) == models_sha, 'worker-models.json 무수정')
    check(json.loads(rc.read_text(encoding='utf-8'))['changed'] is True, '영수증 changed')

    # ── 반복 실행 무변경 ──
    st = T.stat().st_mtime_ns
    check(call(apply(note()) + ['--receipt', rc], [note()]) == 0 and T.read_bytes() == new and T.stat().st_mtime_ns == st, '반복 apply 무변경·무쓰기')
    check(json.loads(rc.read_text(encoding='utf-8'))['changed'] is False, '반복 영수증 changed=false')

    # ── source·기존 임시 파일 보존, 이번 실행 임시 파일 잔존 없음 ──
    check(fx.read_bytes() == fx_bytes, 'fixture source 무수정')
    check(user_tmp.read_bytes() == b'user temp', '기존 사용자 .tmp 보존')
    check(not list(d.glob(T.name + '.*.tmp')), '이번 실행 임시 파일 정리')

# ── --scope project-operations: 새 원장 사본·새 임시 Vault 에서만 ──
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    (d / 'p').mkdir()
    P = d / 'p' / 'CHANGJO_GAMES_ORG_RNR.html'
    shutil.copyfile(REAL, P)
    m.APPLY_TARGETS = (P,)
    PSC = m.SCOPES['project-operations']
    SIDS = [sid for sid, _ in PSC['sections']]
    porig = P.read_bytes()
    _, *pparts = m.split_target(P, PSC['sections'])
    POUT, POLD = pparts[0::2], dict(zip(SIDS, pparts[1::2]))
    pvault = d / 'vault'
    (pvault / 'Projects').mkdir(parents=True)
    vnote = pvault / PSC['note']
    P_STAGED = {'document_id': 'DD-PM-ENTRY', 'vault_id': m.VAULT_ID, 'owner': 'Mercury', 'final_editor': 'Mercury', 'status': 'staged',
                'source_scope': 'project-operations', 'source_of_truth': 'false', 'effective_at': ''}
    P_ACTIVE = {**P_STAGED, 'status': 'active', 'source_of_truth': 'true', 'effective_at': '2026-10-29T00:00:00+09:00'}
    RAW = {k: v.strip('\n').replace('href="#', 'href="' + m.REPORT_URI) for k, v in POLD.items()}  # 최초 이관: 현재 HTML 을 raw 블록으로

    def pnote(fm=P_ACTIVE, order=SIDS, fm_extra='', extra='', **blocks):
        o = '---\n' + ''.join(f'{k}: {v}\n' for k, v in fm.items()) + fm_extra + '---\n# Digit Duel · PM 진입\n\n안내는 그대로.\n'
        for sid in order:
            o += f'\n<!-- DD-PM-ENTRY:{sid}:begin -->\n{blocks.get(sid, RAW[sid])}\n<!-- DD-PM-ENTRY:{sid}:end -->\n'
        return o + extra

    pcall = lambda args, reads=(), **kw: call([*args, '--scope', 'project-operations'], reads, note=PSC['note'], **kw)
    papply = lambda *src: ['apply', '--target', P, '--target-sha256', sha(P.read_bytes()),
                           *(['--source-sha256', sha(src[0].encode())] if src else [])]
    outside = lambda b: list(m.split_target(b, PSC['sections'])[1::2])
    prc = d / 'pr.json'
    read_rc = lambda: json.loads(prc.read_text(encoding='utf-8'))

    # 양성: staged preview — 세 section 밖 byte 동일·섹션별 구조 동등
    pout = d / 'out' / P.name
    pout.parent.mkdir()
    check(pcall(['preview', '--target', P, '--out', pout, '--receipt', prc], [pnote(P_STAGED)]) == 0 and P.read_bytes() == porig, 'project preview(staged) 성공·target 무수정')
    r = read_rc()
    check(len(SIDS) == 12 and outside(pout) == POUT and r['coverage']['sections'] == dict.fromkeys(SIDS, True) and r['history_check'] == 'ok'
          and r['scope'] == 'project-operations' and set(r['block_sha256']) == set(SIDS), 'project preview 밖 byte 동일·12 섹션 구조 동등')
    check(re.findall(rb'<svg\b[^>]*>', pout.read_bytes()) == re.findall(rb'<svg\b[^>]*>', porig) and porig.count(b' viewBox=') == 6
          and re.findall(rb'\sid="([^"]+)"', pout.read_bytes()) == re.findall(rb'\sid="([^"]+)"', porig), 'project preview SVG 여는 태그·viewBox·ID 순서 원문 동일')

    # 음성: 경로 → 2
    real_vault, m.VAULT_ROOT = m.VAULT_ROOT, str(pvault)
    vnote.write_text(pnote(), encoding='utf-8')
    pfx = d / 'pnote.md'
    pfx.write_text(pnote(P_STAGED), encoding='utf-8')
    hard = d / 'hard.md'
    os.link(vnote, hard)
    depts = {n: pvault / n for n in ('Projects/Digit Duel/CLIENT_TOOLING/Client and Tools.md', 'Projects/Digit Duel/PLAN/Singleplayer Draft.md')}
    for n, f in depts.items():  # 새 부서 노트와 Vault 밖 hard link 별칭
        f.parent.mkdir(parents=True)
        f.write_bytes(b'dept ' + n.encode())
    os.link(depts['Projects/Digit Duel/CLIENT_TOOLING/Client and Tools.md'], d / 'dept.html')
    os.link(depts['Projects/Digit Duel/PLAN/Singleplayer Draft.md'], d / 'draft.json')
    ext = lambda q: Path('\\\\?\\' + str(q))
    pv = lambda fx: ['preview', '--target', P, '--out', d / 'x.html', '--fixture', fx]
    xp = lambda **o: ['preview', '--target', P, '--out', o.get('out', d / 'x.html'), *(['--receipt', o['rc']] if 'rc' in o else [])]
    vault_bytes = lambda: sorted((str(f), f.read_bytes()) for f in pvault.rglob('*') if f.is_file())
    vb = vault_bytes()
    pathneg = {'project apply --fixture': [*papply(), '--fixture', pfx], 'project fixture=Vault 노트': pv(vnote),
               'project fixture=Vault 노트 hard link 별칭': pv(hard), 'project fixture=Windows 확장 경로 Vault 노트': pv(ext(vnote)),
               'project --out=target': ['preview', '--target', P, '--out', P],
               'project --out Vault 내부': xp(out=pvault / 'x.html'),
               'project --out Attachments 하위(아직 없는 폴더)': xp(out=pvault / 'Projects/Digit Duel/Attachments/x.png'),
               'project --out Windows 확장 경로=Vault 노트(P1 재현)': xp(out=ext(vnote)),
               'project --receipt Windows 확장 경로=Vault 노트(P1 재현)': xp(rc=ext(vnote)),
               'project --out Windows 확장 경로 Vault 내부 새 파일': xp(out=ext(pvault / 'new.html')),
               'project --out 부서 노트(CLIENT_TOOLING) 외부 hard link': xp(out=d / 'dept.html'),
               'project --receipt Singleplayer Draft 외부 hard link': xp(rc=d / 'draft.json'),
               'project --out Windows 확장 경로=부서 노트 hard link': xp(out=ext(d / 'dept.html'))}
    unc = Path('\\\\localhost\\' + str(pvault)[0] + '$' + str(pvault)[2:])
    if unc.exists():
        pathneg['project --out UNC 관리 공유=Vault 노트'] = xp(out=unc / PSC['note'])
    else:
        print(f'SKIP UNC 관리 공유 별칭 1건: {unc} 접근 불가(설정·권한 변경 안 함)')
    for why, args in pathneg.items():
        check(pcall(args, [pnote()]) == 2 and P.read_bytes() == porig and not (d / 'x.html').exists() and vault_bytes() == vb, why)
    check(call(['preview', '--target', P, '--out', d / 'x.html', '--scope', 'company']) == 2, '알 수 없는 scope 거부')
    psym = d / 'sym.md'
    try:
        os.symlink(vnote, psym)
    except OSError as e:
        print(f'SKIP project fixture symlink 별칭 1건: symlink 생성 불가 — {e}')
    else:
        check(pcall(pv(psym), [pnote()]) == 2 and P.read_bytes() == porig, 'project fixture symlink→Vault 거부')
    # CLI 실패 시 같은 경로의 Vault 파일이 있어도 파일시스템으로 읽지 않는다
    check(pcall(papply(), timeout=True) == 1 and P.read_bytes() == porig, 'project CLI timeout → Vault 파일 우회 없음')
    m.VAULT_ROOT = real_vault

    # 음성: 검증 실패 → 1, target 무수정
    pfm = lambda **kv: {**P_ACTIVE, **kv}
    pno = lambda k: {x: v for x, v in P_ACTIVE.items() if x != k}
    mk = pnote
    head, tail = RAW['current'].rsplit('\n<details class="fold"><summary>출시', 1)
    moved = mk(current=head, team='<details class="fold"><summary>출시' + tail + '\n' + RAW['team'])  # 섹션 경계를 넘은 이동
    drop_row = re.sub(r'<tr><td>2026-10-28</td><td><b>Mercury의 직책 PD → PM</b>.*?</tr>\n', '', RAW['decisions'], count=1, flags=re.S)
    assert drop_row != RAW['decisions']
    pneg = {
        'project staged apply': (pnote(P_STAGED), {}),
        'project source_of_truth=true·status=staged': (mk(fm=pfm(status='staged')), {}),
        'project source_scope=ai-organization': (mk(fm=pfm(source_scope='ai-organization')), {}),
        'project source_scope 없음': (mk(fm=pno('source_scope')), {}),
        'project owner 잘못': (mk(fm=pfm(owner='Mars')), {}),
        'project final_editor 없음': (mk(fm=pno('final_editor')), {}),
        'project final_editor 잘못': (mk(fm=pfm(final_editor='Saturn')), {}),
        'project document_id=CG-ORG-RNR': (mk(fm=pfm(document_id='CG-ORG-RNR')), {}),
        'project vault_id 잘못': (mk(fm=pfm(vault_id='e513c031d697ec24')), {}),
        'project frontmatter 중복 키': (mk(fm=pfm(source_of_truth='false'), fm_extra='source_of_truth: true\n'), {}),
        'project effective_at 미래': (mk(fm=pfm(effective_at='2099-01-01T00:00:00+09:00')), {}),
        '잘못된 Vault 루트': (mk(), dict(root='E:/Toolkit/Mirror/CJ Library/CJ Library')),
        '블록 누락(decisions)': (mk(order=[k for k in SIDS if k != 'decisions']), {}),
        '블록 중복': (mk(extra='\n<!-- DD-PM-ENTRY:work:begin -->\nx\n<!-- DD-PM-ENTRY:work:end -->\n'), {}),
        '블록 순서 뒤바뀜': (mk(order=[SIDS[1], SIDS[0], *SIDS[2:]]), {}),
        '조직 영역 블록 주입(ai-organization)': (mk(extra='\n<!-- DD-PM-ENTRY:ai-organization:begin -->\nx\n<!-- DD-PM-ENTRY:ai-organization:end -->\n'), {}),
        'SVG viewBox 소문자화': (mk(**{'qa-policy': RAW['qa-policy'].replace('viewBox=', 'viewbox=')}), {}),
        'SVG 제거': (mk(**{'qa-policy': re.sub(r'<svg\b.*?</svg>', '', RAW['qa-policy'], flags=re.S)}), {}),
        '다른 scope 표식(조직 블록)': (mk(extra='\n' + m.BEGIN + '\nx\n' + m.END + '\n'), {}),
        '깨진 블록(END 없음)': (mk().replace('<!-- DD-PM-ENTRY:work:end -->', ''), {}),
        '고정 ID 를 다른 섹션으로 이동': (mk(current=RAW['current'].replace('id="next-actions"', ''), work=RAW['work'] + '\n\n<p id="next-actions">x</p>'), {}),
        '고정 ID 삭제': (mk(work=RAW['work'].replace(' id="migration-status"', '')), {}),
        '블록 사이 중복 ID': (mk(decisions=RAW['decisions'] + '\n\n<p id="next-work-list">x</p>'), {}),
        '영역 밖 ID 충돌': (mk(decisions=RAW['decisions'] + '\n\n<p id="team">x</p>'), {}),
        '빈 내용 블록': (mk(decisions='<div class="x"></div>'), {}),
        '노트 안 맨 #앵커': (mk(work=POLD['work'].strip('\n')), {}),
        '허용 안 된 태그': (mk(decisions=RAW['decisions'] + '\n\n<script>x</script>'), {}),
    }
    for why, (src, kw) in pneg.items():
        check(pcall(papply(src), [src], **kw) == 1 and P.read_bytes() == porig, why)
    check(pcall(papply() + ['--receipt', prc], [moved]) == 1 and P.read_bytes() == porig, '최초 이관: 섹션 간 내용 이동 차단')
    r = read_rc()
    check(r['coverage']['text']['missing'] == [] and r['coverage']['sections'] == {**dict.fromkeys(SIDS, True), 'current': False, 'team': False},
          '섹션 간 이동은 합친 사실로는 안 보이고 섹션별 비교로 잡힘')
    check(pcall(papply(), [mk(work=RAW['work'].replace('승인 대기로 표시하지 않음.', '', 1))]) == 1 and P.read_bytes() == porig, '최초 이관 문장 손실 차단')
    check(pcall(papply(), [mk(work=RAW['work'] + '\n\n추가 문단')]) == 1 and P.read_bytes() == porig, '최초 이관에 검토 안 된 편집 차단')
    check(pcall(papply(mk(decisions=drop_row)) + ['--receipt', prc], [mk(decisions=drop_row)]) == 1 and P.read_bytes() == porig
          and read_rc()['history_check'] == '기존 행 삭제', '검토된 편집이어도 결정 이력 행 삭제 차단')
    # 결정 이력: 기존 DOM 불변 + tbody 맨 앞 안전한 새 행만(검토된 편집 경로, source SHA 일치에서도)
    D = RAW['decisions']
    new_row = '<tr><td>2026-10-30</td><td>fixture 결정</td><td>추가만</td></tr>'
    swapped = re.sub(r'(<tbody>)(<tr>.*?</tr>)(\n?)(<tr>.*?</tr>)', r'\1\4\3\2', D, count=1, flags=re.S)
    assert D.count('<tr>') >= 20 and swapped != D
    hist = {
        '기존 tr 전부 hidden(Saturn P2 재현)': D.replace('<tr>', '<tr hidden>'),
        '기존 tr 하나 style 숨김': D.replace('<tr>', '<tr style="display:none">', 2),
        '표 조상 hidden': D.replace('<table class="t">', '<table class="t" hidden>', 1),
        '접힘 조상 hidden': D.replace('<details class="fold">', '<details class="fold" hidden>', 1),
        '기존 링크 변조': D.replace(m.REPORT_URI + 'evidence', m.REPORT_URI + 'migration', 1),
        '기존 행 순서 바꿈': swapped,
        '새 행을 끝에 추가': D.replace('</tbody>', new_row + '</tbody>', 1),
        '새 행 hidden': D.replace('<tbody>', '<tbody><tr hidden><td>x</td></tr>', 1),
        '새 행 style': D.replace('<tbody>', '<tbody><tr style="display:none"><td>x</td></tr>', 1),
        '새 행 aria-hidden': D.replace('<tbody>', '<tbody><tr><td aria-hidden="true">x</td></tr>', 1),
        '새 행 class(CSS 숨김 경로)': D.replace('<tbody>', '<tbody><tr class="x"><td>x</td></tr>', 1),
        '새 행 span': D.replace('<tbody>', '<tbody><tr><td><span>x</span></td></tr>', 1),
    }
    for why, dec in hist.items():
        src = mk(decisions=dec)
        check(pcall(papply(src) + ['--receipt', prc], [src]) == 1 and P.read_bytes() == porig and read_rc()['history_check'] != 'ok', f'결정 이력: {why}')
    check(pcall(papply(mk(work=RAW['work'] + '\n\nv0')), [mk()]) == 1 and P.read_bytes() == porig, 'project 검토한 source SHA 와 다른 노트(stale)')
    check(pcall(['apply', '--target', P, '--target-sha256', sha(porig + b'x')], [mk()]) == 1 and P.read_bytes() == porig, 'project 잘못된 target SHA(stale)')
    edit = mk(work=RAW['work'] + '\n\n편집 v1')
    check(pcall(papply(edit), [edit, mk(work=RAW['work'] + '\n\n편집 v2')]) == 1 and P.read_bytes() == porig, 'project source 동시 변경')
    pbump = porig + b'\n'
    check(pcall(papply(edit), [edit], on_second_read=lambda: P.write_bytes(pbump)) == 1 and P.read_bytes() == pbump, 'project target 동시 변경 → 덮어쓰지 않음')
    P.write_bytes(porig)

    # 양성: 최초 이관(원본 동등) → 검토된 편집(결정 행 추가) → 반복 무변경
    check(pcall(papply() + ['--receipt', prc], [mk()]) == 0, 'project 최초 이관 apply 성공')
    r = read_rc()
    pmig = P.read_bytes()
    check(r['apply_kind'] == 'migration' and r['coverage']['structure_equal'] and outside(P) == POUT, 'project 최초 이관 구조 동등·밖 byte 동일')
    edited = mk(work=RAW['work'].replace('1차 정리 완료', '2차 정리 완료', 1), decisions=RAW['decisions'].replace('<tbody>', '<tbody>' + new_row, 1))
    check(pcall(papply(edited) + ['--receipt', prc], [edited]) == 0, 'project 검토된 편집 apply 성공')
    pnew = P.read_bytes()
    check(pnew != pmig and '2차 정리 완료'.encode() in pnew and new_row.encode() in pnew and outside(P) == POUT
          and read_rc()['history_check'] == 'ok', 'project 편집 반영·결정 행 앞 추가(안전한 prepend) 허용·밖 byte 동일')
    pids = re.findall(rb'\sid="([^"]+)"', pnew)
    check(len(pids) == len(set(pids)) and set(re.findall(rb'\sid="([^"]+)"', porig)) <= set(pids), 'project ID 유일·기존 ID 보존')
    st = P.stat().st_mtime_ns
    check(pcall(papply(edited) + ['--receipt', prc], [edited]) == 0 and P.read_bytes() == pnew and P.stat().st_mtime_ns == st
          and read_rc()['changed'] is False, 'project 반복 apply 무변경·무쓰기')
    check(not list(P.parent.glob(P.name + '.*.tmp')) and pfx.read_text(encoding='utf-8') == pnote(P_STAGED), 'project 임시 파일 정리·fixture 무수정')

check(sha(REAL.read_bytes()) == REAL_SHA and not list(REAL.parent.glob(REAL.name + '*.tmp')), '실제 운영 HTML 무접촉')
print(f'PASS {ok}')
