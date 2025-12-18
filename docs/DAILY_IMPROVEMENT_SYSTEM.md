# Daily Improvement System

**Version**: 1.0.0 | **Updated**: 2025-12-12

CLAUDE.md, 워크플로우, 스킬, 에이전트, 커맨드를 **매일 자동으로 점검하고 개선**하는 시스템입니다.

---

## 목차

1. [개요](#개요)
2. [솔루션 A: GitHub Actions 자동화](#솔루션-a-github-actions-자동화)
3. [솔루션 B: Self-Reflection 에이전트](#솔루션-b-self-reflection-에이전트)
4. [솔루션 C: 일일 점검 커맨드](#솔루션-c-일일-점검-커맨드)
5. [솔루션 D: Drift Detection](#솔루션-d-drift-detection)
6. [구현 권장사항](#구현-권장사항)

---

## 개요

### 문제점

| 영역 | 현재 상태 | 문제 |
|------|----------|------|
| CLAUDE.md | 수동 업데이트 | 구버전 정보 누적 |
| 커맨드 | 12개 개별 관리 | 일관성 부족 |
| 에이전트 | 18개 분산 | 중복/누락 감지 어려움 |
| 스킬 | 13개 트리거 | 트리거 조건 최적화 미흡 |

### 목표

```
매일 자동 점검 → 문제 감지 → 개선 제안 → 승인 후 적용
```

---

## 솔루션 A: GitHub Actions 자동화

**가장 권장하는 방법** - 무료, 자동화, 기록 유지

### 1. 일일 점검 워크플로우 생성

```yaml
# .github/workflows/daily-config-audit.yml
name: Daily Configuration Audit

on:
  schedule:
    # 매일 오전 9시 (KST) = 0시 (UTC)
    - cron: '0 0 * * *'
  workflow_dispatch:  # 수동 실행도 가능

jobs:
  audit-config:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Run Configuration Audit
        run: |
          python scripts/daily_audit.py

      - name: Create Issue if Problems Found
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔍 Daily Config Audit: Issues Found',
              body: '자동 점검에서 문제가 발견되었습니다. 상세 내용은 Actions 로그를 확인하세요.',
              labels: ['automation', 'config-audit']
            })
```

### 2. 점검 스크립트 생성

```python
# scripts/daily_audit.py
"""
일일 설정 점검 스크립트
CLAUDE.md, commands, agents, skills 일관성 검사
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime

ROOT = Path("D:/AI/claude01")
REPORT_PATH = ROOT / ".claude" / "audit" / f"audit-{datetime.now().strftime('%Y-%m-%d')}.md"


def audit_claude_md():
    """CLAUDE.md 버전 및 일관성 검사"""
    issues = []
    claude_md = ROOT / "CLAUDE.md"

    with open(claude_md, 'r', encoding='utf-8') as f:
        content = f.read()

    # 버전 확인
    version_match = re.search(r'\*\*Version\*\*:\s*([\d.]+)', content)
    if version_match:
        print(f"✓ CLAUDE.md 버전: {version_match.group(1)}")
    else:
        issues.append("CLAUDE.md에 버전 정보 없음")

    # 커맨드 개수 일치 확인
    command_count = len(list((ROOT / ".claude" / "commands").glob("*.md")))
    if f"{command_count}개" not in content and f"({command_count}개)" not in content:
        issues.append(f"커맨드 개수 불일치: 실제 {command_count}개")

    # 에이전트 개수 일치 확인
    agent_count = len(list((ROOT / ".claude" / "agents").glob("*.md")))
    if f"{agent_count}개" not in content:
        issues.append(f"에이전트 개수 불일치: 실제 {agent_count}개")

    # 스킬 개수 일치 확인
    skill_count = len(list((ROOT / ".claude" / "skills").glob("*/SKILL.md")))
    if f"{skill_count}개" not in content:
        issues.append(f"스킬 개수 불일치: 실제 {skill_count}개")

    return issues


def audit_commands():
    """커맨드 파일 검사"""
    issues = []
    commands_dir = ROOT / ".claude" / "commands"

    for cmd_file in commands_dir.glob("*.md"):
        with open(cmd_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # frontmatter 확인
        if not content.startswith("---"):
            issues.append(f"{cmd_file.name}: frontmatter 누락")

        # name 필드 확인
        if "name:" not in content:
            issues.append(f"{cmd_file.name}: name 필드 누락")

        # description 필드 확인
        if "description:" not in content:
            issues.append(f"{cmd_file.name}: description 필드 누락")

        # Usage 섹션 확인
        if "## Usage" not in content and "## 사용법" not in content:
            issues.append(f"{cmd_file.name}: Usage 섹션 누락")

    print(f"✓ 커맨드 검사 완료: {len(list(commands_dir.glob('*.md')))}개")
    return issues


def audit_agents():
    """에이전트 파일 검사"""
    issues = []
    agents_dir = ROOT / ".claude" / "agents"

    for agent_file in agents_dir.glob("*.md"):
        with open(agent_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 필수 섹션 확인
        required_sections = ["## 역할", "## 전문 분야", "## 도구"]
        for section in required_sections:
            if section not in content:
                # 영어 버전도 허용
                eng_section = section.replace("역할", "Role").replace("전문 분야", "Expertise").replace("도구", "Tools")
                if eng_section not in content:
                    issues.append(f"{agent_file.name}: {section} 섹션 누락")

    print(f"✓ 에이전트 검사 완료: {len(list(agents_dir.glob('*.md')))}개")
    return issues


def audit_skills():
    """스킬 파일 검사"""
    issues = []
    skills_dir = ROOT / ".claude" / "skills"

    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue

        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            issues.append(f"{skill_dir.name}: SKILL.md 누락")
            continue

        with open(skill_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 트리거 조건 확인
        if "트리거" not in content and "trigger" not in content.lower():
            issues.append(f"{skill_dir.name}: 트리거 조건 미정의")

    print(f"✓ 스킬 검사 완료: {len(list(skills_dir.iterdir()))}개")
    return issues


def check_consistency():
    """문서 간 일관성 검사"""
    issues = []

    # COMMAND_REFERENCE.md vs 실제 커맨드
    cmd_ref = ROOT / "docs" / "COMMAND_REFERENCE.md"
    if cmd_ref.exists():
        with open(cmd_ref, 'r', encoding='utf-8') as f:
            ref_content = f.read()

        for cmd_file in (ROOT / ".claude" / "commands").glob("*.md"):
            cmd_name = cmd_file.stem
            if f"/{cmd_name}" not in ref_content:
                issues.append(f"COMMAND_REFERENCE.md에 /{cmd_name} 누락")

    # AGENTS_REFERENCE.md vs 실제 에이전트
    agent_ref = ROOT / "docs" / "AGENTS_REFERENCE.md"
    if agent_ref.exists():
        with open(agent_ref, 'r', encoding='utf-8') as f:
            ref_content = f.read()

        for agent_file in (ROOT / ".claude" / "agents").glob("*.md"):
            agent_name = agent_file.stem
            if agent_name not in ref_content:
                issues.append(f"AGENTS_REFERENCE.md에 {agent_name} 누락")

    return issues


def generate_report(all_issues):
    """점검 보고서 생성"""
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    report = f"""# 일일 설정 점검 보고서

**날짜**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
**상태**: {'⚠️ 문제 발견' if all_issues else '✅ 정상'}

---

## 점검 항목

| 항목 | 상태 |
|------|------|
| CLAUDE.md | {'❌' if any('CLAUDE.md' in i for i in all_issues) else '✅'} |
| 커맨드 | {'❌' if any('커맨드' in i or '.md:' in i for i in all_issues) else '✅'} |
| 에이전트 | {'❌' if any('에이전트' in i or 'agent' in i.lower() for i in all_issues) else '✅'} |
| 스킬 | {'❌' if any('스킬' in i or 'SKILL' in i for i in all_issues) else '✅'} |
| 문서 일관성 | {'❌' if any('REFERENCE' in i for i in all_issues) else '✅'} |

---

## 발견된 문제

"""

    if all_issues:
        for issue in all_issues:
            report += f"- {issue}\n"
    else:
        report += "_문제 없음_\n"

    report += f"""
---

## 권장 조치

"""

    if all_issues:
        report += """1. 위 문제들을 검토하고 수정
2. `/check` 커맨드로 추가 검증
3. 수정 후 이 점검 다시 실행
"""
    else:
        report += "_조치 필요 없음_\n"

    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n📋 보고서 저장: {REPORT_PATH}")
    return report


def main():
    print("=" * 50)
    print("🔍 일일 설정 점검 시작")
    print("=" * 50)

    all_issues = []

    # 각 영역 점검
    all_issues.extend(audit_claude_md())
    all_issues.extend(audit_commands())
    all_issues.extend(audit_agents())
    all_issues.extend(audit_skills())
    all_issues.extend(check_consistency())

    # 보고서 생성
    report = generate_report(all_issues)

    print("\n" + "=" * 50)
    if all_issues:
        print(f"⚠️  {len(all_issues)}개 문제 발견")
        for issue in all_issues:
            print(f"  - {issue}")
        exit(1)  # GitHub Actions에서 실패로 처리
    else:
        print("✅ 모든 점검 통과")
        exit(0)


if __name__ == "__main__":
    main()
```

---

## 솔루션 B: Self-Reflection 에이전트

**AI 기반 자동 개선** - OpenAI의 Self-Evolving Agents 패턴 적용

### 개념

```
┌─────────────────────────────────────────┐
│         Self-Reflection Agent           │
├─────────────────────────────────────────┤
│  1. Generate: 현재 설정 분석            │
│  2. Critique: 문제점 식별               │
│  3. Refine: 개선안 생성                 │
│  4. Validate: 검증                      │
│  5. Apply: 승인 후 적용                 │
└─────────────────────────────────────────┘
```

### 스킬 생성

```markdown
# .claude/skills/daily-reflection/SKILL.md

# Daily Reflection Skill

자동 트리거로 설정 파일을 분석하고 개선안을 제시합니다.

## 트리거 조건

- 매일 첫 세션 시작 시
- 사용자가 "점검", "review config" 요청 시

## 수행 작업

1. **분석 (Analyze)**
   - CLAUDE.md 현재 버전 확인
   - 커맨드/에이전트/스킬 개수 및 일관성 검사
   - 최근 7일 사용 패턴 분석 (가능한 경우)

2. **비평 (Critique)**
   - 구버전 정보 식별
   - 중복 기능 감지
   - 누락된 문서화 발견
   - 비효율적 워크플로우 식별

3. **개선 제안 (Suggest)**
   ```markdown
   ## 개선 제안 보고서

   ### 즉시 수정 필요
   - [ ] CLAUDE.md 버전 업데이트 (10.1.0 → 10.2.0)

   ### 권장 개선
   - [ ] /commit과 /pr 통합 고려

   ### 장기 개선
   - [ ] 에이전트 성능 메트릭 추가
   ```

4. **사용자 승인**
   - 변경사항 diff 표시
   - 승인/거부/수정 선택

## 출력 형식

```
🔄 Daily Reflection Report - 2025-12-12

📊 상태 요약
- CLAUDE.md: v10.1.0 (최신)
- 커맨드: 13개 (변경 없음)
- 에이전트: 18개 (변경 없음)
- 스킬: 13개 (변경 없음)

✅ 발견된 문제: 0개
💡 개선 제안: 2개

개선 제안을 확인하시겠습니까? (Y/N)
```
```

---

## 솔루션 C: 일일 점검 커맨드

**수동 트리거** - 사용자가 원할 때 실행

### 커맨드 생성

```markdown
# .claude/commands/audit.md

---
name: audit
description: Daily configuration audit and improvement suggestions
---

# /audit - 일일 설정 점검

설정 파일을 점검하고 개선안을 제시합니다.

## Usage

```bash
/audit              # 전체 점검
/audit quick        # 빠른 점검 (버전/개수만)
/audit deep         # 심층 점검 (내용 분석 포함)
/audit fix          # 발견된 문제 자동 수정
/audit report       # 보고서만 생성
```

## 점검 항목

### 1. 버전 일관성
- CLAUDE.md 버전
- 참조 문서 버전

### 2. 개수 일치
- 커맨드: CLAUDE.md 기재 vs 실제
- 에이전트: CLAUDE.md 기재 vs 실제
- 스킬: CLAUDE.md 기재 vs 실제

### 3. 필수 요소
- 커맨드: frontmatter, Usage 섹션
- 에이전트: 역할, 도구 정의
- 스킬: 트리거 조건

### 4. 문서 동기화
- COMMAND_REFERENCE.md
- AGENTS_REFERENCE.md

## 출력 형식

```
🔍 Configuration Audit - 2025-12-12

[1/5] CLAUDE.md 점검...
  ✅ 버전: 10.1.0
  ⚠️ 커맨드 개수 불일치: 문서 12개, 실제 13개

[2/5] 커맨드 점검...
  ✅ 13개 파일 검사 완료
  ✅ 모든 파일 정상

[3/5] 에이전트 점검...
  ✅ 18개 파일 검사 완료

[4/5] 스킬 점검...
  ✅ 13개 디렉토리 검사 완료

[5/5] 문서 동기화 점검...
  ⚠️ COMMAND_REFERENCE.md에 /audit 누락

📋 요약
- 총 문제: 2개
- 자동 수정 가능: 1개

자동 수정을 실행할까요? (Y/N)
```

## 자동 수정 항목

| 항목 | 자동 수정 | 수동 필요 |
|------|----------|----------|
| 개수 불일치 | ✅ | |
| 버전 업데이트 | ✅ | |
| frontmatter 누락 | | ✅ |
| 문서 동기화 | ✅ | |
| 내용 개선 | | ✅ |
```

---

## 솔루션 D: Drift Detection

**설정 변경 감지** - 의도하지 않은 변경 추적

### 기준 상태 저장

```yaml
# .claude/baseline/config-baseline.yaml
version: "2025-12-12"

claude_md:
  version: "10.1.0"
  checksum: "abc123..."

commands:
  count: 13
  files:
    - name: audit
      checksum: "def456..."
    - name: check
      checksum: "ghi789..."
    # ...

agents:
  count: 18
  files:
    - name: architect
      checksum: "jkl012..."
    # ...

skills:
  count: 13
  directories:
    - name: tdd-workflow
      checksum: "mno345..."
    # ...
```

### Drift 감지 스크립트

```python
# scripts/drift_detection.py
"""
설정 변경(Drift) 감지
기준 상태와 현재 상태 비교
"""

import hashlib
import yaml
from pathlib import Path

def calculate_checksum(file_path):
    """파일 체크섬 계산"""
    with open(file_path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def detect_drift():
    """Drift 감지"""
    baseline_path = Path(".claude/baseline/config-baseline.yaml")

    if not baseline_path.exists():
        print("⚠️ 기준 상태 없음. 먼저 /audit baseline 실행 필요")
        return

    with open(baseline_path) as f:
        baseline = yaml.safe_load(f)

    drifts = []

    # CLAUDE.md 변경 확인
    current_checksum = calculate_checksum("CLAUDE.md")
    if current_checksum != baseline['claude_md']['checksum']:
        drifts.append({
            'type': 'modified',
            'file': 'CLAUDE.md',
            'message': 'CLAUDE.md 내용이 변경됨'
        })

    # 커맨드 변경 확인
    commands_dir = Path(".claude/commands")
    current_commands = set(f.stem for f in commands_dir.glob("*.md"))
    baseline_commands = set(c['name'] for c in baseline['commands']['files'])

    added = current_commands - baseline_commands
    removed = baseline_commands - current_commands

    for cmd in added:
        drifts.append({
            'type': 'added',
            'file': f'.claude/commands/{cmd}.md',
            'message': f'새 커맨드 추가: {cmd}'
        })

    for cmd in removed:
        drifts.append({
            'type': 'removed',
            'file': f'.claude/commands/{cmd}.md',
            'message': f'커맨드 삭제됨: {cmd}'
        })

    return drifts

def main():
    drifts = detect_drift()

    if drifts:
        print(f"⚠️ {len(drifts)}개 Drift 감지:")
        for d in drifts:
            print(f"  [{d['type'].upper()}] {d['message']}")
    else:
        print("✅ Drift 없음 - 기준 상태와 동일")

if __name__ == "__main__":
    main()
```

---

## 구현 권장사항

### 즉시 구현 (1단계)

| 우선순위 | 솔루션 | 소요 시간 | 효과 |
|---------|--------|----------|------|
| **1** | `/audit` 커맨드 | 30분 | 수동 점검 가능 |
| **2** | `daily_audit.py` 스크립트 | 1시간 | 자동화 기반 |
| **3** | GitHub Actions 워크플로우 | 30분 | 매일 자동 실행 |

### 중기 구현 (2단계)

| 우선순위 | 솔루션 | 소요 시간 | 효과 |
|---------|--------|----------|------|
| **4** | Drift Detection | 2시간 | 변경 추적 |
| **5** | Self-Reflection 스킬 | 3시간 | AI 기반 개선 |

### 장기 구현 (3단계)

| 우선순위 | 솔루션 | 소요 시간 | 효과 |
|---------|--------|----------|------|
| **6** | 사용 패턴 분석 | 1일 | 최적화 인사이트 |
| **7** | 자동 개선 적용 | 2일 | 완전 자동화 |

---

## Quick Start

### 1단계: /audit 커맨드 추가

```bash
# 커맨드 파일 생성 후
/audit
```

### 2단계: 스크립트 실행

```bash
python scripts/daily_audit.py
```

### 3단계: GitHub Actions 활성화

```bash
# .github/workflows/daily-config-audit.yml 생성 후
# GitHub에서 Actions 탭 확인
```

---

## 참고 자료

| 출처 | 내용 |
|------|------|
| [OpenAI Self-Evolving Agents](https://cookbook.openai.com/examples/partners/self_evolving_agents/) | 자기 개선 에이전트 패턴 |
| [Promptfoo](https://promptfoo.dev/) | LLM 프롬프트 테스트 자동화 |
| [GitHub Actions Cron](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs) | 스케줄 기반 워크플로우 |
| [Reflection Agent Pattern](https://agent-patterns.readthedocs.io/en/stable/patterns/reflection.html) | Generate-Critique-Refine 사이클 |
| [Spacelift Drift Management](https://spacelift.io/blog/drift-management) | 설정 변경 감지 |

---

## 변경 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 1.0.0 | 2025-12-12 | 초기 문서 작성 |
