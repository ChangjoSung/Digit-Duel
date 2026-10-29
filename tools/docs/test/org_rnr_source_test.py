"""org_rnr_source.py 회귀 — python -I tools/docs/test/org_rnr_source_test.py

실제 운영 HTML 의 임시 사본에만 쓴다. Obsidian CLI 는 subprocess.run 을, apply 허용 target 은 APPLY_TARGETS 를 테스트에서만
임시 사본으로 바꿔 끼운다 — 실제 Vault 읽기·실제 정본 apply 검증이 아니다.
양성: preview(효력 전) · 최초 이관 apply(원본 동등) · 검토된 편집 apply(--source-sha256) 반영, 선택 영역 밖 byte·ID·승인 모델 값 보존,
      반복 실행 무변경.
음성: 잘못된 Vault/노트/target/효력 상태·ID 누락/중복·내용 손실·깨진 block·timeout·source/target 동시 변경·출력 경로 충돌
      → 실패 + target·source(fixture)·기존 사용자 임시 파일 무수정.
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


def fake(reads, root=None, timeout=False, on_second_read=None):
    n = {'read': 0}

    def run(cmd, **kw):
        assert cmd[0] == m.OBSIDIAN and cmd[1] == 'vault=' + m.VAULT_ID and kw.get('timeout'), cmd
        if timeout:
            raise subprocess.TimeoutExpired(cmd, kw['timeout'])
        if cmd[2:] == ['vault', 'info=path']:
            out = root or m.VAULT_ROOT
        else:
            assert cmd[2:] == ['read', 'path=' + m.NOTE], cmd  # 읽기 외 CLI 명령(쓰기)은 없다
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

check(sha(REAL.read_bytes()) == REAL_SHA and not list(REAL.parent.glob(REAL.name + '*.tmp')), '실제 운영 HTML 무접촉')
print(f'PASS {ok}')
