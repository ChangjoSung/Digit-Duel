r"""CG-ORG-RNR 단방향 갱신 — 회사 Vault `Org Chart and R&R.md` 의 고정 블록 → 운영 HTML #ai-organization section.

  python tools/docs/org_rnr_source.py preview --out <html> [--receipt <json>] [--fixture <note.md>] [--target <html>] [--scope <s>]
  python tools/docs/org_rnr_source.py apply --target-sha256 <hex> [--source-sha256 <hex>] [--receipt <json>] [--target <html>] [--scope <s>]

scope : 기본 ai-organization(위 노트 → #ai-organization). project-operations 는 명시할 때만: 같은 Vault `Projects/Digit Duel.md`
        (DD-PM-ENTRY · final_editor Mercury · source_scope project-operations)의 블록 12개 → #ai-organization 을 뺀 나머지 top-level
        paper section 12개를 한 번의 원자 저장으로 바꾼다. 블록은 섹션 순서대로 각 한 쌍, 고정 ID·SVG 는 제 섹션 블록에만.
        #decisions 는 기존 DOM(구조·속성·링크·표시 상태·조상) 그대로에 안전한 새 행을 tbody 맨 앞에 추가하는 것만 허용.

source: Vault ID·절대 루트·상대 노트를 고정한 Obsidian CLI 읽기만 쓴다. 실패하면 다른 Vault·파일시스템으로 우회하지 않는다.
        --fixture 는 오프라인 미리보기 전용(영수증 source 에 fixture 로 표시)이며 apply 에서는 거부한다. source 는 절대 쓰지 않는다.
        Vault 안 파일(별칭 포함)은 fixture 로 받지 않는다 — CLI 대신 파일시스템으로 Vault 를 읽는 우회가 되므로.
block : 노트 안 BEGIN/END 표식 한 쌍 사이 Markdown. #ai-organization 의 자식(#ai-role-register 등)은 이 한 블록에만 있다.
preview: 효력 전에도 후보 HTML(--out)을 만든다. target 은 읽기만 한다.
apply : target 은 이 checkout 정본 또는 상설 root 정본(APPLY_TARGETS)만. 노트 frontmatter 가 source_of_truth: true ·
        status: active · source_scope: <scope> · 과거/현재의 timezone 포함 ISO effective_at 일 때, --target-sha256 이
        현재 target 과 같을 때만 쓴다.
          최초 이관(--source-sha256 없음): 렌더 결과가 현재 section 과 의미·링크·ID 동등해야 한다(내용 손실 차단).
          정본 편집 반영(--source-sha256): PM 이 preview 영수증으로 검토한 노트 SHA 와 지금 읽은 노트가 같아야 한다.
        쓰기 직전 source(CLI 재읽기)·target 을 다시 읽어 바뀌었으면 실패한다. 결과가 같으면 쓰지 않는다.
출력  : --out/--receipt 는 target·APPLY_TARGETS·fixture·서로·Vault 내부·VAULT_NOTES 와 같은 파일이면 쓰기 전에 거부한다.
        별칭: hard link·symlink·정션·대소문자·\\?\·\\?\UNC\·UNC 공유 경로. fixture 도 Vault 내부·VAULT_NOTES 별칭이면 거부.
범위  : 각 parent <section …id="…"> 여는 태그 뒤부터 첫 </section> 앞까지의 byte 만 바꾼다. 나머지 byte 는 그대로.
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
# 회사 Vault 원본 노트 전체(승인 department-manifest 10개 FileTree). 출력·fixture 가 이 파일들의 별칭이면 거부한다.
# 데이터 읽기는 SCOPES 의 두 노트 CLI 만. 첨부(Attachments 하위)는 in_vault 가 Vault 전체로 막는다.
VAULT_NOTES = (NOTE, 'Projects/Digit Duel.md', 'Projects/Digit Duel/PLAN/Rules.md', 'Projects/Digit Duel/PLAN/UI UX.md',
               'Projects/Digit Duel/PLAN/Decision Log.md', 'Projects/Digit Duel/PLAN/Singleplayer Draft.md',
               'Projects/Digit Duel/ART/Art Specification.md',
               'Projects/Digit Duel/CLIENT_TOOLING/Client and Tools.md', 'Projects/Digit Duel/SERVER/Server Operations.md',
               'Projects/Digit Duel/QA/QA.md')
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


def _tok(tag=None, attrs=(), before='', after=''):
    """Markdown 이 만든 token 에만 운영 HTML 템플릿(class·감싸기·b)을 입힌다. 블록의 raw HTML 은 그대로 둔다."""
    def rule(self, tokens, idx, options, env):
        t = tokens[idx]
        t.tag = tag or t.tag
        for k, v in attrs:
            t.attrSet(k, v)
        return before + self.renderToken(tokens, idx, options, env) + after
    return rule


def _md(th_scope):
    md = MarkdownIt('commonmark').enable('table')
    valid = md.validateLink
    md.validateLink = lambda url: url.startswith(REPORT_URI) or valid(url)  # file: 은 운영 HTML 정본 URI 만 허용
    rules = {'table_open': _tok(attrs=[('class', 't')], before='<div class="tbl-wrap">'), 'table_close': _tok(after='</div>'),
             'strong_open': _tok('b'), 'strong_close': _tok('b'), 'ordered_list_open': _tok(attrs=[('class', 'contract-list')])}
    if th_scope:
        rules['th_open'] = _tok(attrs=[('scope', 'col')])
    for name, rule in rules.items():
        md.add_render_rule(name, rule)
    return md


MD = _md(True)
# scope → 노트·frontmatter 고정값·교체할 parent section(id, 여는 태그)·섹션별 필수 ID·renderer. 블록 표식은 <!-- {document_id}:{id}:begin|end -->.
SCOPES = {
    SCOPE: {'note': NOTE, 'doc': DOC, 'sections': [(SCOPE, OPEN)], 'required': {SCOPE: ['ai-org-chart', *CHILDREN]}, 'md': MD},
    'project-operations': {
        'note': 'Projects/Digit Duel.md',
        'doc': {'document_id': 'DD-PM-ENTRY', 'vault_id': VAULT_ID, 'owner': 'Mercury', 'final_editor': 'Mercury',
                'source_scope': 'project-operations'},
        'sections': [('current', '<section class="paper cover" id="current">'),
                     *((k, f'<section class="paper" id="{k}">') for k in ('team', 'work', 'github-rr', 'authority', 'qa-policy', 'handoff',
                                                                          'doc-policy', 'obsidian-transition', 'evidence', 'decisions', 'migration'))],
        'required': {'current': ['next-actions'], 'team': ['runtime'], 'work': ['next-work-list', 'cj-followup-20261028', 'migration-status'],
                     'github-rr': ['fig-responsibility-title', 'fig-responsibility-desc', 'github-current-rr', 'github-role-identification',
                                   'github-evidence', 'github-proposed-rr', 'github-workflow'],
                     'authority': [], 'qa-policy': ['fig-qa-title', 'fig-qa-desc'], 'handoff': ['fig-intake-title', 'fig-intake-desc', 'pm-auto-entry'],
                     'doc-policy': [], 'obsidian-transition': ['fig-migration-title', 'fig-migration-desc', 'obsidian-scope', 'obsidian-source-of-truth',
                                                               'fig-sources-title', 'fig-sources-desc', 'obsidian-tree', 'obsidian-doc-rr',
                                                               'obsidian-note-contract', 'obsidian-disposition', 'obsidian-pm-runbook', 'obsidian-acceptance'],
                     'evidence': [], 'decisions': [],
                     'migration': ['result-html', 'result-cleanup', 'result-role', 'result-entry', 'result-validation', 'result-preservation']},
        'svgs': {'github-rr': 1, 'qa-policy': 1, 'handoff': 1, 'obsidian-transition': 2},
        'history': 'decisions',  # 기존 이력 DOM 불변 + 새 행 앞에 추가만
        'md': _md(False),  # 대부분 표 머리에 scope 가 없다 — scope 있는 표는 raw HTML 로 둔다(최초 이관 구조 동등)
    },
}


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


def read_source(fixture, note=NOTE):
    if fixture:
        return Path(fixture).read_text(encoding='utf-8')
    root = obsidian('vault', 'info=path').strip().replace('\\', '/').rstrip('/')
    if root != VAULT_ROOT:
        raise Fail(f'Vault 루트 불일치: {root!r}')
    return obsidian('read', 'path=' + note)


def parse_note(text, sc=SCOPES[SCOPE]):
    text = text.replace('\r\n', '\n')
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    if not m:
        raise Fail('frontmatter 없음')
    pairs = [(k.strip(), v.strip()) for k, v in (l.split(':', 1) for l in m[1].split('\n') if ':' in l)]
    fm = dict(pairs)
    if len(fm) != len(pairs):
        raise Fail('frontmatter 중복 키')
    for k, v in sc['doc'].items():
        if fm.get(k) != v:
            raise Fail(f'frontmatter {k} 불일치: {fm.get(k)!r}')
    if not fm.get('status') or fm.get('source_of_truth') not in ('true', 'false') or 'effective_at' not in fm:
        raise Fail('효력 상태 불명: status/source_of_truth/effective_at')
    doc = sc['doc']['document_id']
    if any(f'<!-- {o["doc"]["document_id"]}:' in text for o in SCOPES.values() if o is not sc):
        raise Fail('다른 scope 의 source block 표식')
    if text.count(f'<!-- {doc}:') != 2 * len(sc['sections']):
        raise Fail('source block 표식이 정확히 한 쌍이 아님')
    blocks, last = [], 0
    for sid, _ in sc['sections']:
        b, e = f'<!-- {doc}:{sid}:begin -->', f'<!-- {doc}:{sid}:end -->'
        if text.count(f'{doc}:{sid}:') != 2 or text.count(b) != 1 or text.count(e) != 1:
            raise Fail('source block 표식이 정확히 한 쌍이 아님')
        i, j = text.index(b) + len(b), text.index(e)
        if i - len(b) < last or i > j or not text[i:j].strip():
            raise Fail('source block 순서/내용 깨짐')
        blocks.append(text[i:j].strip('\n'))
        last = j
    return fm, blocks


def render(block, md=MD):
    html = md.render(block)
    if 'href="#' in html:
        raise Fail('노트 안 맨 #앵커 금지: 운영 HTML 절대 URI(REPORT_URI)로 가리킨다')
    html = html.replace('href="' + REPORT_URI, 'href="#')
    return '\n' + html.rstrip('\n')


def split_target(path, sections=((SCOPE, OPEN),)):
    """→ (data, 밖0, 안1, 밖1, …, 안n, 밖n). 섹션은 문서 순서대로."""
    if path.name != 'CHANGJO_GAMES_ORG_RNR.html':
        raise Fail(f'target 문서 아님: {path.name}')
    data = path.read_bytes()
    html = data.decode('utf-8')
    if html.count(TITLE) != 1 or any(html.count(op) != 1 or html.count(f'id="{sid}"') != 1 for sid, op in sections):
        raise Fail('target 문서/parent section 식별 실패')
    parts, at = [], 0
    for _, op in sections:
        a = html.index(op) + len(op)
        b = html.find('</section>', a)
        if a - len(op) < at or b < 0 or '<section' in html[a:b]:
            raise Fail('parent section 경계 불명')
        parts += [html[at:a], html[a:b]]
        at = b
    return (data, *parts, html[at:])


def check_fragment(frags, outside_ids, sc=SCOPES[SCOPE]):
    """frags: {section id: 새 HTML}. 필수 ID 는 제 섹션 안에 있어야 한다(다른 블록으로 옮기면 실패)."""
    for frag in frags.values():
        if FORBIDDEN.search(frag):
            raise Fail('허용하지 않는 태그/속성')
        if any(v != 'viewBox' for v in re.findall(r'\s(viewbox)\s*=', frag, re.I)):
            raise Fail('SVG viewBox 대소문자 변경')
        for t in ('details', 'div', 'figure', 'table'):
            if len(re.findall(rf'<{t}\b', frag, re.I)) != len(re.findall(rf'</{t}>', frag, re.I)):
                raise Fail(f'<{t}> 열고 닫힘 불일치')
    soups = {k: BeautifulSoup(v, 'html.parser') for k, v in frags.items()}
    ids = Counter(t['id'] for s in soups.values() for t in s.find_all(id=True))
    dup = sorted(k for k, n in ids.items() if n > 1 or k in outside_ids)
    if dup:
        raise Fail(f'중복 ID: {dup}')
    missing = [k for sid, req in sc['required'].items() for k in req if not soups[sid].find(id=k)]
    if missing:
        raise Fail(f'필수 ID 누락: {missing}')
    dangling = sorted({a['href'][1:] for s in soups.values() for a in s.select('a[href^="#"]')} - set(ids) - outside_ids)
    if dangling:
        raise Fail(f'target 에 없는 앵커: {dangling}')
    empty = [k for k, s in soups.items() if not s.get_text(strip=True)]
    if empty:
        raise Fail(f'{empty} 내용 누락')
    svgs = [k for k, n in sc.get('svgs', {}).items() if len(soups[k].find_all('svg')) != n]
    if svgs:
        raise Fail(f'SVG 누락/중복: {svgs}')
    if SCOPE not in soups:
        return
    soup = soups[SCOPE]
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


def raw_case(html):
    """html.parser 는 속성 이름을 소문자로 만든다(viewBox → viewbox). 원문 태그 안 대문자 속성 이름을 순서대로 따로 본다."""
    return [n for t in re.findall(r'<[a-zA-Z](?:[^>"\']|"[^"]*"|\'[^\']*\')*>', html) for n in re.findall(r'\s([\w:.-]*[A-Z][\w:.-]*)\s*=', t)]


def same_structure(old, new):
    return canon(old) == canon(new) and raw_case(old) == raw_case(new)


def coverage(old, new):
    fo, fn = facts(old), facts(new)
    r = {k: {'old': sum(fo[k].values()), 'new': sum(fn[k].values()),
             'missing': sorted((fo[k] - fn[k]).elements()), 'added': sorted((fn[k] - fo[k]).elements())} for k in fo}
    r['structure_equal'] = same_structure(old, new)
    return r


SAFE_ROW = {'tr', 'td', 'b', 'br', 'code', 'a'}


def history_check(old, new):
    """기존 이력 DOM 은 그대로, 새 행은 각 tbody 맨 앞에만. 새 행을 지운 새 DOM 이 기존 DOM 과 같아야 한다. 문제 없으면 None."""
    so, sn = BeautifulSoup(old, 'html.parser'), BeautifulSoup(new, 'html.parser')
    to, tn = so.find_all('tbody'), sn.find_all('tbody')
    if len(to) != len(tn):
        return 'tbody 수 변경'
    added = []
    for a, b in zip(to, tn):
        k = len(b.find_all('tr', recursive=False)) - len(a.find_all('tr', recursive=False))
        if k < 0:
            return '기존 행 삭제'
        added += b.find_all('tr', recursive=False)[:k]
    for tr in added:  # 숨김·스타일·class·이벤트 경로 차단: 허용 태그와 a[href] 외 속성 없음
        bad = sorted({f'{t.name}[{",".join(t.attrs)}]' for t in [tr, *tr.find_all(True)]
                      if t.name not in SAFE_ROW or set(t.attrs) - ({'href'} if t.name == 'a' else set())})
        if bad:
            return f'새 행에 허용 안 된 태그/속성: {bad}'
        tr.decompose()
    if canon(str(sn)) != canon(old) or raw_case(old) != raw_case(new):
        return '기존 이력의 구조·속성·링크·표시 상태·순서 변경'
    return None


def check_effective(fm, scope=SCOPE):
    if fm['source_of_truth'] != 'true' or fm['status'] != 'active' or fm.get('source_scope') != scope:
        raise Fail(f'효력 조건 불충족: source_of_truth=true · status=active · source_scope={scope} 필요')
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


def _plain(p):
    r"""\\?\X:\… · \\.\X:\… → X:\…, \\?\UNC\h\s → \\h\s. 같은 파일을 다른 접두어로 쓴 별칭을 한 표기로."""
    s = os.fspath(p).replace('/', '\\')
    for pre, to in (('\\\\?\\UNC\\', '\\\\'), ('\\\\.\\UNC\\', '\\\\'), ('\\\\?\\', ''), ('\\\\.\\', '')):
        if s.upper().startswith(pre.upper()):
            return to + s[len(pre):]
    return s


def in_vault(p):
    root = os.path.normcase(os.path.realpath(VAULT_ROOT))
    try:
        if os.path.commonpath([root, os.path.normcase(os.path.realpath(_plain(p)))]) == root:
            return True
    except ValueError:  # 다른 드라이브·UNC
        pass
    # 표기와 무관하게: 존재하는 조상 폴더가 Vault 루트와 같은 폴더면 내부(UNC 공유·정션·확장 경로 별칭)
    for a in (Path(p), *Path(p).parents):
        try:
            if a.exists() and os.path.samefile(a, VAULT_ROOT):
                return True
        except OSError:
            pass
    return False


def vault_alias(p):
    """Vault 내부이거나 Vault 원본 노트(VAULT_NOTES)와 같은 파일(hard link 등 외부 별칭 포함)."""
    return in_vault(p) or any(same(p, Path(VAULT_ROOT) / n) or same(_plain(p), Path(VAULT_ROOT) / n) for n in VAULT_NOTES)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('mode', choices=['preview', 'apply'])
    ap.add_argument('--scope', choices=list(SCOPES), default=SCOPE)
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
    sc = SCOPES[a.scope]
    if a.fixture and vault_alias(a.fixture):
        ap.error(f'fixture 경로 거부(Vault 내부·별칭 — CLI 대신 파일시스템 우회): {a.fixture}')
    outs = [p for p in (a.out, a.receipt) if p]
    if len(outs) == 2 and same(*outs):
        ap.error('--out 과 --receipt 가 같은 파일')
    for p in outs:
        if vault_alias(p) or any(same(p, g) for g in (a.target, *APPLY_TARGETS, *([a.fixture] if a.fixture else []))):
            ap.error(f'출력 경로 거부(target·정본·fixture·Vault): {p}')
    r = {'mode': a.mode, 'scope': a.scope, 'target': str(a.target.resolve()),
         'source': f'fixture:{a.fixture.resolve()}' if a.fixture else f'obsidian-cli vault={VAULT_ID} root={VAULT_ROOT} path={sc["note"]}'}
    sids = [sid for sid, _ in sc['sections']]
    try:
        src = read_source(a.fixture, sc['note'])
        fm, blocks = parse_note(src, sc)
        data, *parts = split_target(a.target, sc['sections'])
        outside, olds = parts[0::2], parts[1::2]
        news = [render(b, sc['md']) for b in blocks]
        check_fragment(dict(zip(sids, news)), set(re.findall(r'\sid="([^"]+)"', ''.join(outside))), sc)
        out = (''.join(o + n for o, n in zip(outside, news)) + outside[-1]).encode('utf-8')
        cov = coverage(''.join(olds), ''.join(news))
        equal = {sid: same_structure(o, n) for sid, o, n in zip(sids, olds, news)}
        cov['structure_equal'] = all(equal.values())  # 섹션 경계를 넘어 옮긴 내용도 불일치
        if len(sids) > 1:
            cov['sections'] = equal
        bsha = [sha(b.encode('utf-8')) for b in blocks]
        r.update(frontmatter={k: fm.get(k) for k in ('document_id', 'vault_id', 'owner', 'final_editor', 'status', 'source_scope', 'source_of_truth', 'effective_at')},
                 source_sha256=sha(src.encode('utf-8')), block_sha256=bsha[0] if len(bsha) == 1 else dict(zip(sids, bsha)),
                 target_sha256_before=sha(data), candidate_sha256=sha(out), changed=out != data, coverage=cov)
        if sc.get('history'):
            k = sids.index(sc['history'])
            r['history_check'] = history_check(olds[k], news[k]) or 'ok'
        if a.mode == 'preview':
            a.out.write_bytes(out)
        else:
            r['apply_kind'] = 'edit' if a.source_sha256 else 'migration'
            check_effective(fm, a.scope)
            if r.get('history_check', 'ok') != 'ok':
                raise Fail(f"결정 이력 보호: {r['history_check']}")
            if sha(data) != a.target_sha256.lower():
                raise Fail('target SHA-256 불일치')
            if a.source_sha256:
                if r['source_sha256'] != a.source_sha256.lower():
                    raise Fail('source SHA-256 불일치: preview 로 검토한 노트가 아님')
            elif not r['coverage']['structure_equal']:
                raise Fail('최초 이관은 현재 section 과 의미·링크·ID 동등해야 함 (검토한 편집 반영은 --source-sha256)')
            if out != data:
                if read_source(None, sc['note']) != src:
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
