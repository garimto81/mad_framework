# PRD-0031: Agent Consolidation (50개 → 15-20개)

**버전**: 1.0.0 | **상태**: Draft | **작성일**: 2025-12-11

---

## 1. 개요

### 1.1 문제 정의

현재 `.claude/agents/` 디렉토리에 **50개 에이전트**가 존재하나:
- 기능 중복 다수 (typescript-pro vs typescript-expert)
- MCP 도구와 에이전트 역할 혼재
- 실제 사용 빈도 대비 과도한 세분화
- 관리 및 유지보수 오버헤드

### 1.2 목표

| 목표 | 측정 지표 |
|------|----------|
| 에이전트 수 최적화 | 50개 → 15-20개 |
| 역할 명확화 | 중복 0%, 각 에이전트 고유 역할 |
| MCP/Agent 분리 | MCP 도구는 도구로, 전문성은 에이전트로 |

### 1.3 참조

- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [MCP vs Skills Comparison](https://skywork.ai/blog/ai-agent/claude-skills-vs-mcp-vs-llm-tools-comparison-2025/)
- [How Agents and MCPs Work Together](https://medium.com/@ooi_yee_fei/how-claude-code-agents-and-mcps-work-better-together-5c8d515fcbbd)

---

## 2. MCP vs Agent 분석

### 2.1 핵심 차이점

| 특성 | MCP Server | Custom Agent |
|------|------------|--------------|
| **목적** | 외부 시스템 연결/도구 제공 | 전문 지식/추론 능력 제공 |
| **실행** | 도구 호출 시 실행 | 컨텍스트 전환 후 전체 대화 |
| **컨텍스트** | 호출 파라미터만 | 별도 시스템 프롬프트 + 전체 컨텍스트 |
| **비용** | 낮음 (단일 호출) | 높음 (새 에이전트 세션) |
| **적합 용도** | API 호출, 데이터 조회 | 복잡한 판단, 멀티스텝 추론 |

### 2.2 결정 프레임워크

```
                    ┌─────────────────────────────────┐
                    │       작업 유형 판단             │
                    └────────────┬────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
     ┌─────────────────┐                   ┌─────────────────┐
     │ 단순 도구 호출?  │                   │ 전문 판단 필요?  │
     │ (조회, API 호출) │                   │ (분석, 설계)     │
     └────────┬────────┘                   └────────┬────────┘
              │                                      │
              ▼                                      ▼
         ┌────────┐                            ┌────────┐
         │  MCP   │                            │ Agent  │
         └────────┘                            └────────┘
```

### 2.3 MCP 전용 에이전트 분석

| 현재 에이전트 | 권장 | 이유 |
|--------------|------|------|
| `context7-engineer` | **삭제** → MCP 직접 사용 | Context7 MCP가 문서 조회 도구, 에이전트 불필요 |
| `exa-search-specialist` | **삭제** → MCP 직접 사용 | Exasearch MCP가 검색 도구, 에이전트 불필요 |
| `seq-engineer` | **삭제** → MCP 직접 사용 | Sequential Thinking MCP 직접 호출로 충분 |
| `taskmanager-planner` | **삭제** → MCP 직접 사용 | TaskManager MCP 직접 호출로 충분 |
| `github-engineer` | **유지** (통합) | Git 전문 지식 + 판단 필요 (MCP로 대체 불가) |

**핵심 원칙**: MCP는 "도구"이고, 에이전트는 "전문가"
- MCP를 감싸는 에이전트 = 불필요한 오버헤드
- 전문 지식/판단이 필요한 경우만 에이전트화

---

## 3. 통합 계획

### 3.1 최종 에이전트 구조 (18개)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TIER 1: CORE (6개)                          │
│ 모든 프로젝트에서 필수적으로 사용되는 핵심 에이전트               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  code-reviewer        코드 리뷰 + 품질 검사 통합                │
│  ├ 흡수: pragmatic-code-review                                  │
│                                                                 │
│  architect            설계/아키텍처 통합                        │
│  ├ 흡수: architect-reviewer, backend-architect, graphql-arch    │
│                                                                 │
│  debugger             디버깅/트러블슈팅 (기존 유지)              │
│                                                                 │
│  test-engineer        테스트 통합 (TDD, E2E, 단위)              │
│  ├ 흡수: test-automator, playwright-engineer, tdd-orchestrator  │
│                                                                 │
│  security-auditor     보안 전문 (기존 유지)                     │
│                                                                 │
│  docs-writer          문서화 통합                               │
│  ├ 흡수: api-documenter, docs-architect                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   TIER 2: DOMAIN (8개)                          │
│ 특정 도메인에서 전문 지식이 필요할 때 선택적 사용                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  frontend-dev         프론트엔드 통합                           │
│  ├ 흡수: UI_UX-Designer, design-review                          │
│                                                                 │
│  backend-dev          백엔드 통합                               │
│  ├ 흡수: fastapi-pro                                            │
│                                                                 │
│  fullstack-dev        풀스택 (기존 유지)                        │
│                                                                 │
│  devops-engineer      CI/CD, 컨테이너, 인프라 통합               │
│  ├ 흡수: deployment-engineer, devops-troubleshooter             │
│  ├ 흡수: kubernetes-architect, terraform-specialist             │
│                                                                 │
│  cloud-architect      클라우드/네트워크 통합                     │
│  ├ 흡수: network-engineer                                       │
│                                                                 │
│  database-specialist  DB 설계 + 최적화 통합                     │
│  ├ 흡수: database-architect, database-optimizer, supabase-eng   │
│                                                                 │
│  data-specialist      데이터/ML 통합                            │
│  ├ 흡수: data-scientist, data-engineer, ml-engineer             │
│                                                                 │
│  ai-engineer          AI/LLM 전문 (기존 유지)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: LANGUAGE (2개)                       │
│ 특정 언어의 고급 패턴/최적화가 필요할 때만                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  typescript-dev       TypeScript 전문                           │
│  ├ 흡수: typescript-pro, typescript-expert                      │
│                                                                 │
│  python-dev           Python 전문                               │
│  ├ 흡수: python-pro                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   TIER 4: TOOLING (2개)                         │
│ 도구/플랫폼 전문 지식이 필요할 때                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  github-engineer      GitHub/Git 워크플로우 전문                 │
│                                                                 │
│  claude-expert        Claude Code/MCP/에이전트 전문              │
│  ├ 흡수: agent-expert, command-expert, mcp-expert, prompt-eng   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 삭제 대상 (MCP 직접 사용)

| 에이전트 | 대체 MCP | 이유 |
|---------|---------|------|
| `context7-engineer` | Context7 MCP | 문서 조회는 도구 호출로 충분 |
| `exa-search-specialist` | Exasearch MCP | 검색은 도구 호출로 충분 |
| `seq-engineer` | Sequential Thinking MCP | 순차 추론은 MCP 직접 사용 |
| `taskmanager-planner` | TaskManager MCP | 태스크 생성은 MCP 직접 사용 |

### 3.3 삭제 대상 (불필요)

| 에이전트 | 이유 |
|---------|------|
| `task-decomposition-expert` | 기본 Claude 능력으로 충분 |
| `context-manager` | 기본 Claude 능력으로 충분 |
| `dx-optimizer` | architect에 포함 |
| `legacy-modernizer` | architect에 포함 |
| `performance-engineer` | debugger/architect에 포함 |
| `observability-engineer` | devops-engineer에 포함 |
| `mobile-developer` | frontend-dev에 포함 |
| `javascript-pro` | typescript-dev로 커버 가능 |

---

## 4. 통합 매트릭스

### 4.1 변환 맵

| 기존 에이전트 | 통합 후 | 액션 |
|--------------|--------|------|
| code-reviewer | **code-reviewer** | 유지 (확장) |
| pragmatic-code-review | code-reviewer | 병합 |
| architect-reviewer | **architect** | 유지 (확장) |
| backend-architect | architect | 병합 |
| graphql-architect | architect | 병합 |
| debugger | **debugger** | 유지 |
| test-automator | **test-engineer** | 유지 (확장) |
| playwright-engineer | test-engineer | 병합 |
| tdd-orchestrator | test-engineer | 병합 |
| security-auditor | **security-auditor** | 유지 |
| api-documenter | **docs-writer** | 유지 (확장) |
| docs-architect | docs-writer | 병합 |
| frontend-developer | **frontend-dev** | 유지 (확장) |
| UI_UX-Designer | frontend-dev | 병합 |
| design-review | frontend-dev | 병합 |
| fastapi-pro | **backend-dev** | 유지 (확장) |
| fullstack-developer | **fullstack-dev** | 유지 |
| deployment-engineer | **devops-engineer** | 유지 (확장) |
| devops-troubleshooter | devops-engineer | 병합 |
| kubernetes-architect | devops-engineer | 병합 |
| terraform-specialist | devops-engineer | 병합 |
| cloud-architect | **cloud-architect** | 유지 (확장) |
| network-engineer | cloud-architect | 병합 |
| database-architect | **database-specialist** | 유지 (확장) |
| database-optimizer | database-specialist | 병합 |
| supabase-engineer | database-specialist | 병합 |
| data-scientist | **data-specialist** | 유지 (확장) |
| data-engineer | data-specialist | 병합 |
| ml-engineer | data-specialist | 병합 |
| ai-engineer | **ai-engineer** | 유지 |
| typescript-pro | **typescript-dev** | 유지 (확장) |
| typescript-expert | typescript-dev | 병합 |
| python-pro | **python-dev** | 유지 |
| github-engineer | **github-engineer** | 유지 |
| agent-expert | **claude-expert** | 유지 (확장) |
| command-expert | claude-expert | 병합 |
| mcp-expert | claude-expert | 병합 |
| prompt-engineer | claude-expert | 병합 |
| context7-engineer | - | **삭제** (MCP 직접 사용) |
| exa-search-specialist | - | **삭제** (MCP 직접 사용) |
| seq-engineer | - | **삭제** (MCP 직접 사용) |
| taskmanager-planner | - | **삭제** (MCP 직접 사용) |
| task-decomposition-expert | - | **삭제** (불필요) |
| context-manager | - | **삭제** (불필요) |
| dx-optimizer | - | **삭제** (architect 포함) |
| legacy-modernizer | - | **삭제** (architect 포함) |
| performance-engineer | - | **삭제** (debugger 포함) |
| observability-engineer | - | **삭제** (devops 포함) |
| mobile-developer | - | **삭제** (frontend 포함) |
| javascript-pro | - | **삭제** (typescript 커버) |

### 4.2 최종 결과

| 카테고리 | 변경 전 | 변경 후 |
|----------|--------|--------|
| Core | 10개 | **6개** |
| Domain | 22개 | **8개** |
| Language | 6개 | **2개** |
| Tooling | 8개 | **2개** |
| MCP 전용 | 4개 | **0개** (삭제) |
| **총계** | **50개** | **18개** |

---

## 5. 구현 계획

### Phase 0: MCP 서버 설치 (Day 0) ⭐ 선행 필수

에이전트 삭제 전, 대체 MCP 서버를 먼저 설치하여 기능 공백 방지

#### 5.0.1 Context7 MCP 설치

**역할**: 기술 문서/라이브러리 버전 검증 (context7-engineer 대체)

**참조**: [Context7 MCP - GitHub](https://github.com/upstash/context7) | [npm](https://www.npmjs.com/package/@upstash/context7-mcp)

```bash
# Claude Code에 추가
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

**또는 수동 설정** (`~/.claude.json` 또는 프로젝트 `.claude.json`):
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

**고급 옵션** (API 키로 rate limit 증가):
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "YOUR_API_KEY"]
    }
  }
}
```

**사용법**: 프롬프트에 `use context7` 포함

---

#### 5.0.2 Exa Search MCP 설치

**역할**: 고급 웹 검색/리서치 (exa-search-specialist 대체)

**참조**: [Exa MCP - GitHub](https://github.com/exa-labs/exa-mcp-server) | [Exa Docs](https://docs.exa.ai/reference/exa-mcp)

**사전 요구사항**: Exa API 키 필요 ([dashboard.exa.ai](https://dashboard.exa.ai/api-keys))

```bash
# Claude Code에 추가
claude mcp add exa --env EXA_API_KEY=your-api-key -- npx -y exa-mcp-server
```

**또는 수동 설정**:
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**호스팅 버전** (로컬 설치 없이):
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.exa.ai/mcp"]
    }
  }
}
```

**사용 가능 도구**:
- `web_search_exa`: 웹 검색
- `get_code_context_exa`: 코드/라이브러리 검색
- `deep_search_exa`: 심층 검색
- `company_research`: 회사 리서치
- `crawling`: URL 콘텐츠 추출

---

#### 5.0.3 Sequential Thinking MCP 설치

**역할**: 순차적 추론/복잡한 문제 분해 (seq-engineer 대체)

**참조**: [Sequential Thinking - GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) | [npm](https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking)

```bash
# Claude Code에 추가
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
```

**또는 수동 설정**:
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

**Docker 사용 시**:
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "mcp/sequentialthinking"]
    }
  }
}
```

---

#### 5.0.4 TaskManager MCP 설치

**역할**: 작업 계획/WBS/태스크 관리 (taskmanager-planner 대체)

**참조**: [TaskManager - GitHub](https://github.com/kazuph/mcp-taskmanager) | [npm](https://www.npmjs.com/package/@kazuph/mcp-taskmanager)

```bash
# Claude Code에 추가
claude mcp add taskmanager -- npx -y @kazuph/mcp-taskmanager
```

**또는 수동 설정**:
```json
{
  "mcpServers": {
    "taskmanager": {
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-taskmanager"]
    }
  }
}
```

**대안: Task Master** (더 강력한 기능):
```bash
claude mcp add task-master-ai --env TASK_MASTER_TOOLS="core" -- npx -y task-master-ai@latest
```

---

#### 5.0.5 설치 검증

```bash
# 설치된 MCP 서버 확인
claude mcp list

# 예상 출력:
# context7: npx -y @upstash/context7-mcp
# exa: npx -y exa-mcp-server
# sequential-thinking: npx -y @modelcontextprotocol/server-sequential-thinking
# taskmanager: npx -y @kazuph/mcp-taskmanager
```

#### 5.0.6 통합 설정 예시

**전체 `.claude.json` 예시**:
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "taskmanager": {
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-taskmanager"]
    }
  }
}
```

---

### Phase 1: 신규 에이전트 생성 (Day 1-2)

1. `architect.md` - backend-architect 확장
2. `test-engineer.md` - test-automator 확장
3. `docs-writer.md` - api-documenter 확장
4. `frontend-dev.md` - frontend-developer 확장
5. `backend-dev.md` - fastapi-pro 확장
6. `devops-engineer.md` - deployment-engineer 확장
7. `database-specialist.md` - database-architect 확장
8. `data-specialist.md` - data-scientist 확장
9. `typescript-dev.md` - typescript-pro 확장
10. `python-dev.md` - python-pro 확장
11. `claude-expert.md` - agent-expert 확장

### Phase 2: 기존 에이전트 보강 (Day 2-3)

1. `code-reviewer.md` - pragmatic-code-review 병합
2. `cloud-architect.md` - network-engineer 병합
3. `fullstack-dev.md` - 이름 변경
4. `ai-engineer.md` - 유지
5. `security-auditor.md` - 유지
6. `debugger.md` - 유지
7. `github-engineer.md` - 유지

### Phase 3: 정리 (Day 3-4)

1. 기존 에이전트 백업 (`.claude/agents.backup/`)
2. 병합된 에이전트 삭제
3. MCP 전용 에이전트 삭제 (**Phase 0 완료 후만**)
4. AGENTS_REFERENCE.md 업데이트
5. CLAUDE.md 업데이트 (있으면)

### Phase 4: 검증 (Day 4)

1. 모든 에이전트 로드 테스트
2. MCP 서버 동작 테스트
3. 대표 시나리오 테스트
4. 문서 정합성 검증

---

## 6. 위험 요소 및 완화

| 위험 | 영향 | 완화 방안 |
|------|------|----------|
| 기능 손실 | 중간 | 병합 시 모든 전문 지식 통합 확인 |
| 호환성 | 낮음 | 기존 에이전트 alias 제공 고려 |
| 롤백 필요 | 낮음 | 백업 디렉토리 유지 |

---

## 7. 수락 기준

### 7.1 Phase 0 (MCP 설치)
- [ ] Context7 MCP 설치 및 동작 확인
- [ ] Exa Search MCP 설치 및 동작 확인
- [ ] Sequential Thinking MCP 설치 및 동작 확인
- [ ] TaskManager MCP 설치 및 동작 확인
- [ ] `claude mcp list`로 4개 MCP 확인

### 7.2 전체 완료
- [ ] 에이전트 수 50개 → 18개 이하
- [ ] 모든 기존 기능 커버 확인
- [ ] MCP 전용 에이전트 0개
- [ ] AGENTS_REFERENCE.md 업데이트 완료
- [ ] 각 에이전트 테스트 통과

---

## 8. 부록: CLAUDE.md 에이전트 추천 가이드 초안

```markdown
## 에이전트 사용 가이드

### 필수 (CORE)
- `code-reviewer` - 코드 리뷰, 품질 검사
- `architect` - 설계, 아키텍처 결정
- `debugger` - 버그 분석, 트러블슈팅
- `test-engineer` - 테스트 작성/실행
- `security-auditor` - 보안 취약점 분석
- `docs-writer` - 문서화

### 도메인별 (선택)
- `frontend-dev` - 프론트엔드/UI 개발
- `backend-dev` - 백엔드/API 개발
- `devops-engineer` - CI/CD, 인프라
- `database-specialist` - DB 설계/최적화
- `data-specialist` - 데이터/ML 파이프라인
- `ai-engineer` - LLM/RAG 시스템

### 언어 전문
- `typescript-dev` - TypeScript 고급 패턴
- `python-dev` - Python 고급 패턴

### 도구/플랫폼
- `github-engineer` - GitHub 워크플로우
- `claude-expert` - Claude Code/MCP 설정
```

---

**작성자**: Claude Code
**검토자**: (사용자 승인 대기)
**다음 단계**: 사용자 승인 후 Phase 1 시작
