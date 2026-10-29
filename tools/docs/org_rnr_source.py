"""CG-ORG-RNR 단방향 갱신 — 회사 Vault `Org Chart and R&R.md` 의 고정 블록 → 운영 HTML #ai-organization section.

  python tools/docs/org_rnr_source.py preview --out <html> [--receipt <json>] [--fixture <note.md>] [--target <html>]
  python tools/docs/org_rnr_source.py apply --target-sha256 <hex> [--source-sha256 <hex>] [--receipt <json>] [--target <html>]

source: Vault ID·절대 루트·상대 노트를 고정한 Obsidian CLI 읽기만 쓴다. 실패하면 다른 Vault·파일시스템으로 우회하지 않는다.
        --fixture 는 오프라인 미리보기 전용(영수증 source 에 fixture 로 표시)이며 apply 에서는 거부한다. source 는 절대 쓰지 않는다.
block : 노트 안 BEGIN/END 표식 한 쌍 사이 Markdown. #ai-organization 의 자식(#ai-role-register 등)은 이 한 블록에만 있다.
preview: 효력 전에도 후보 HTML(--out)을 만든다. target 은 읽기만 한다.
apply : target 은 이 checkout 정본 또는 상설 root 정본(APPLY_TARGETS)만. 노트 frontmatter 가 source_of_truth: true ·
        status: active · source_scope: ai-organization · 과거/현재의 timezone 포함 ISO effective_at 일 때, --target-sha256 이
        현재 target 과 같을 때만 쓴다.
          최초 이관(--source-sha256 없음): 렌더 결과가 현재 section 과 의미·링크·ID 동등해야 한다(내용 손실 차단).
          정본 편집 반영(--source-sha256): PM 이 preview 영수증으로 검토한 노트 SHA 와 지금 읽은 노트가 같아야 한다.
        쓰기 직전 source(CLI 재읽기)·target 을 다시 읽어 바뀌었으면 실패한다. 결과가 같으면 쓰지 않는다.
출력  : --out/--receipt 는 target·APPLY_TARGETS·fixture·서로·Vault 내부와 같은 파일(별칭 포함)이면 쓰기 전에 거부한다.
범위  : <section class="paper" id="ai-organization"> 여는 태그 뒤부터 첫 </section> 앞까지의 byte 만 바꾼다.
종료 코드: 0 성공 · 1 검증 실패(target 무수정) · 2 사용법/경로 오류(아무것도 쓰지 않음)
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString
from markdown_it import MarkdownIt

OBSIDIAN = 'C:/Users/pc_77/AppData/Local/Programs/Obsidian/Obsidian.com'
VAULT_ID = '613e72a275ee9be3'
VAULT_ROOT = 'E:/Toolkit/Mirror/CJ Library/CHANGJO GAMES'
NOTE = 'Org Chart and R&R.md'
DOC = {'document_id': 'CG-ORG-RNR', 'vault_id': VAULT_ID, 'owner': 'Mercury'}
BEGIN, END = '<!-- CG-ORG-RNR:ai-organization:begin -->', '<!-- CG-ORG-RNR:ai-organization:end -->'
TARGET = Path(__file__).resolve().parents[2] / 'docs/creat2ve/CHANGJO_GAMES_ORG_RNR.html'
APPLY_TARGETS = (TARGET, Path('C:/Users/pc_77/orca/Digit-Duel/docs/creat2ve/CHANGJO_GAMES_ORG_RNR.html'))  # 테스트만 임시 사본으로 바꿔 끼운다
SCOPE = 'ai-organization'
TITLE = '<title>CHANGJO GAMES Org Chart and R&amp;R</title>'
OPEN = '<section class="paper" id="ai-organization">'
# 노트에서는 실제 기존 정본(운영 HTML 절대 경로)을 가리키고, 보고서로 만들 때만 같은 문서 앵커로 환원한다.
REPORT_URI = 'file:///C:/Users/pc_77/orca/Digit-Duel/docs/creat2ve/CHANGJO_GAMES_ORG_RNR.html#'
CHILDREN = ['ai-role-register', 'ai-development', 'ai-audio', 'ai-qa-tech',
            'ai-business-support', 'ai-specialist-tools', 'ai-rollout', 'ai-sources']
FORBIDDEN = re.compile(r'<\s*/?\s*(?:section|script|iframe|object|embed|style|link|meta|base)\b|\son[a-z]+\s*=|javascript:', re.I)
MD = MarkdownIt('commonmark').enable('table')
_valid_link = MD.validateLink
MD.validateLink = lambda url: url.startswith(REPORT_URI) or _valid_link(url)  # file: 은 운영 HTML 정본 URI 만 허용


def _tok(tag=None, attrs=(), before='', after=''):
    """Markdown 이 만든 token 에만 운영 HTML 템플릿(class·감싸기·b)을 입힌다. 블록의 raw HTML 은 그대로 둔다."""
    def rule(self, tokens, idx, options, env):
        t = tokens[idx]
        t.tag = tag or t.tag
        for k, v in attrs:
            t.attrSet(k, v)
        return before + self.renderToken(tokens, idx, options, env) + after
    return rule


for _name, _rule in {'table_open': _tok(attrs=[('class', 't')], before='<div class="tbl-wrap">'),
                     'table_close': _tok(after='</div>'), 'th_open': _tok(attrs=[('scope', 'col')]),
                     'strong_open': _tok('b'), 'strong_close': _tok('b'),
                     'ordered_list_open': _tok(attrs=[('class', 'contract-list')])}.items():
    MD.add_render_rule(_name, _rule)


class Fail(Exception):
    pass


def sha(b):
    return hashlib.sha256(b).hexdigest()


def obsidian(*args):
    try:
        p = subprocess.run([OBSIDIAN, 'vault=' + VAULT_ID, *args], capture_output=True, text=True, encoding='utf-8', timeout=20)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise Fail(f'Obsidian CLI 실패: {type(e).__name__}')
    if p.returncode or not p.stdout.strip() or p.stdout.lstrip().startswith('Error'):
        raise Fail(f'Obsidian CLI 실패: rc={p.returncode} {(p.stderr or p.stdout).strip()[:200]}')
    return p.stdout


def read_source(fixture):
    if fixture:
        return Path(fixture).read_text(encoding='utf-8')
    root = obsidian('vault', 'info=path').strip().replace('\\', '/').rstrip('/')
    if root != VAULT_ROOT:
        raise Fail(f'Vault 루트 불일치: {root!r}')
    return obsidian('read', 'path=' + NOTE)


def parse_note(text):
    text = text.replace('\r\n', '\n')
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    if not m:
        raise Fail('frontmatter 없음')
    pairs = [(k.strip(), v.strip()) for k, v in (l.split(':', 1) for l in m[1].split('\n') if ':' in l)]
    fm = dict(pairs)
    if len(fm) != len(pairs):
        raise Fail('frontmatter 중복 키')
    for k, v in DOC.items():
        if fm.get(k) != v:
            raise Fail(f'frontmatter {k} 불일치: {fm.get(k)!r}')
    if not fm.get('status') or fm.get('source_of_truth') not in ('true', 'false') or 'effective_at' not in fm:
        raise Fail('효력 상태 불명: status/source_of_truth/effective_at')
    if text.count('CG-ORG-RNR:ai-organization:') != 2 or text.count(BEGIN) != 1 or text.count(END) != 1:
        raise Fail('source block 표식이 정확히 한 쌍이 아님')
    i, j = text.index(BEGIN) + len(BEGIN), text.index(END)
    if i > j or not text[i:j].strip():
        raise Fail('source block 순서/내용 깨짐')
    return fm, text[i:j].strip('\n')


def render(block):
    html = MD.render(block)
    if 'href="#' in html:
        raise Fail('노트 안 맨 #앵커 금지: 운영 HTML 절대 URI(REPORT_URI)로 가리킨다')
    html = html.replace('href="' + REPORT_URI, 'href="#')
    return '\n' + html.rstrip('\n')


def split_target(path):
    if path.name != 'CHANGJO_GAMES_ORG_RNR.html':
        raise Fail(f'target 문서 아님: {path.name}')
    data = path.read_bytes()
    html = data.decode('utf-8')
    if html.count(TITLE) != 1 or html.count(OPEN) != 1 or html.count('id="ai-organization"') != 1:
        raise Fail('target 문서/parent section 식별 실패')
    a = html.index(OPEN) + len(OPEN)
    b = html.find('</section>', a)
    if b < 0 or '<section' in html[a:b]:
        raise Fail('parent section 경계 불명')
    return data, html[:a], html[a:b], html[b:]


def check_fragment(frag, outside_ids):
    if FORBIDDEN.search(frag):
        raise Fail('허용하지 않는 태그/속성')
    for t in ('details', 'div', 'figure', 'table'):
        if len(re.findall(rf'<{t}\b', frag, re.I)) != len(re.findall(rf'</{t}>', frag, re.I)):
            raise Fail(f'<{t}> 열고 닫힘 불일치')
    soup = BeautifulSoup(frag, 'html.parser')
    ids = Counter(t['id'] for t in soup.find_all(id=True))
    dup = sorted(k for k, n in ids.items() if n > 1 or k in outside_ids)
    if dup:
        raise Fail(f'중복 ID: {dup}')
    missing = [k for k in ['ai-org-chart', *CHILDREN] if k not in ids]
    if missing:
        raise Fail(f'필수 ID 누락: {missing}')
    dangling = sorted({a['href'][1:] for a in soup.select('a[href^="#"]')} - set(ids) - outside_ids)
    if dangling:
        raise Fail(f'target 에 없는 앵커: {dangling}')
    if len(soup.select('figure[data-figure="organization"] svg')) != 1:
        raise Fail('조직 도식 누락/중복')
    for k in CHILDREN:
        el = soup.find(id=k)
        body = el.find('div', class_='fold-body')
        if el.name != 'details' or not el.summary or not body or not body.get_text(strip=True):
            raise Fail(f'{k} 내용 누락')


def _t(e):
    return ' '.join(e.get_text(' ').split())


def facts(html):
    s = BeautifulSoup(html, 'html.parser')
    own_text = lambda e: any(isinstance(c, NavigableString) and not isinstance(c, Comment) and c.strip() for c in e.children)
    return {
        'text': Counter(_t(e) for e in s.find_all(True) if own_text(e)),
        'table_rows': Counter(' | '.join(_t(c) for c in tr.find_all(['th', 'td'])) for tr in s.find_all('tr')),
        'links': Counter(f"{a.get('href')} {_t(a)}" for a in s.find_all('a')),
        'ids': Counter(e['id'] for e in s.find_all(id=True)),
        'pre': Counter(e.get_text() for e in s.find_all('pre')),
        'folds': Counter(f"{d.get('id', '')} {_t(d.summary) if d.summary else ''}" for d in s.find_all('details')),
    }


def canon(html):
    """태그·속성·텍스트 순서. 태그 사이 공백만 무시한다(pre 안은 그대로)."""
    out = []

    def walk(n, pre):
        for c in n.children:
            if isinstance(c, Comment):
                continue
            if isinstance(c, NavigableString):
                s = str(c) if pre else ' '.join(c.split())
                if s:
                    out.append(s)
            else:
                out.append((c.name, sorted((k, ' '.join(v) if isinstance(v, list) else v) for k, v in c.attrs.items())))
                walk(c, pre or c.name == 'pre')
                out.append('/' + c.name)
    walk(BeautifulSoup(html, 'html.parser'), False)
    return out


def coverage(old, new):
    fo, fn = facts(old), facts(new)
    r = {k: {'old': sum(fo[k].values()), 'new': sum(fn[k].values()),
             'missing': sorted((fo[k] - fn[k]).elements()), 'added': sorted((fn[k] - fo[k]).elements())} for k in fo}
    r['structure_equal'] = canon(old) == canon(new)
    return r


def check_effective(fm):
    if fm['source_of_truth'] != 'true' or fm['status'] != 'active' or fm.get('source_scope') != SCOPE:
        raise Fail(f'효력 조건 불충족: source_of_truth=true · status=active · source_scope={SCOPE} 필요')
    try:
        t = datetime.fromisoformat(fm['effective_at'])
    except ValueError:
        raise Fail(f"effective_at 무효: {fm['effective_at']!r}")
    if t.tzinfo is None or t > datetime.now(timezone.utc):
        raise Fail(f"effective_at 은 timezone 포함 과거/현재 시각이어야 함: {fm['effective_at']!r}")


def same(a, b):
    """hard link·심볼릭 링크·정션·대소문자 별칭까지 같은 파일인지."""
    try:
        return os.path.samefile(a, b)
    except OSError:
        return os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b))


def in_vault(p):
    root = os.path.normcase(os.path.realpath(VAULT_ROOT))
    try:
        return os.path.commonpath([root, os.path.normcase(os.path.realpath(p))]) == root
    except ValueError:  # 다른 드라이브
        return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('mode', choices=['preview', 'apply'])
    ap.add_argument('--target', type=Path, default=TARGET)
    ap.add_argument('--out', type=Path)
    ap.add_argument('--fixture', type=Path)
    ap.add_argument('--target-sha256')
    ap.add_argument('--source-sha256')
    ap.add_argument('--receipt', type=Path)
    a = ap.parse_args(argv)
    if a.mode == 'preview' and (not a.out or a.target_sha256 or a.source_sha256):
        ap.error('preview 는 --out 필요, SHA 지정은 apply 전용')
    if a.mode == 'apply' and (a.fixture or a.out or not a.target_sha256):
        ap.error('apply 는 --fixture/--out 없이 --target-sha256 필요')
    if a.mode == 'apply':  # 별칭(hard/symlink)을 os.replace 하면 정본 대신 별칭이 바뀐다 — 정확한 경로만, 이후 정본 Path 로 고정
        key = lambda p: os.path.normcase(os.path.abspath(p))
        fixed = next((t for t in APPLY_TARGETS if key(t) == key(a.target)), None)
        if fixed is None or os.path.islink(fixed):
            ap.error(f'apply target 은 이 checkout 정본 또는 상설 root 정본의 정확한 경로만(별칭·symlink 거부): {a.target}')
        a.target = Path(fixed)
    outs = [p for p in (a.out, a.receipt) if p]
    if len(outs) == 2 and same(*outs):
        ap.error('--out 과 --receipt 가 같은 파일')
    for p in outs:
        if in_vault(p) or any(same(p, g) for g in (a.target, *APPLY_TARGETS, *([a.fixture] if a.fixture else []))):
            ap.error(f'출력 경로 거부(target·정본·fixture·Vault): {p}')
    r = {'mode': a.mode, 'target': str(a.target.resolve()),
         'source': f'fixture:{a.fixture.resolve()}' if a.fixture else f'obsidian-cli vault={VAULT_ID} root={VAULT_ROOT} path={NOTE}'}
    try:
        src = read_source(a.fixture)
        fm, block = parse_note(src)
        data, pre, old, post = split_target(a.target)
        new = render(block)
        check_fragment(new, set(re.findall(r'\sid="([^"]+)"', pre + post)))
        out = (pre + new + post).encode('utf-8')
        r.update(frontmatter={k: fm.get(k) for k in ('document_id', 'vault_id', 'owner', 'status', 'source_scope', 'source_of_truth', 'effective_at')},
                 source_sha256=sha(src.encode('utf-8')), block_sha256=sha(block.encode('utf-8')),
                 target_sha256_before=sha(data), candidate_sha256=sha(out), changed=out != data, coverage=coverage(old, new))
        if a.mode == 'preview':
            a.out.write_bytes(out)
        else:
            r['apply_kind'] = 'edit' if a.source_sha256 else 'migration'
            check_effective(fm)
            if sha(data) != a.target_sha256.lower():
                raise Fail('target SHA-256 불일치')
            if a.source_sha256:
                if r['source_sha256'] != a.source_sha256.lower():
                    raise Fail('source SHA-256 불일치: preview 로 검토한 노트가 아님')
            elif not r['coverage']['structure_equal']:
                raise Fail('최초 이관은 현재 section 과 의미·링크·ID 동등해야 함 (검토한 편집 반영은 --source-sha256)')
            if out != data:
                if read_source(None) != src:
                    raise Fail('source 가 읽는 중 바뀜')
                if a.target.read_bytes() != data:
                    raise Fail('target 이 읽는 중 바뀜')
                # ponytail: 마지막 재읽기와 replace 사이 창은 남는다. 동시 편집자가 생기면 파일 잠금으로 올린다.
                fd, tmp = tempfile.mkstemp(prefix=a.target.name + '.', suffix='.tmp', dir=a.target.parent)  # 이번 실행 전용(O_EXCL)
                try:
                    with os.fdopen(fd, 'wb') as f:
                        f.write(out)
                    os.replace(tmp, a.target)
                finally:
                    if os.path.exists(tmp):
                        os.unlink(tmp)
        r['result'], code = 'ok', 0
    except Fail as e:
        r['result'], code = f'fail: {e}', 1
    if a.receipt:
        a.receipt.write_text(json.dumps(r, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    cov = r.get('coverage', {})
    print(json.dumps({'result': r['result'], 'changed': r.get('changed'), 'structure_equal': cov.get('structure_equal')}, ensure_ascii=False))
    return code


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.exit(main())
