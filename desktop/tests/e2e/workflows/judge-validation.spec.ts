/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Judge Validation E2E Test
 *
 * 다중 LLM 심판 기능을 검증합니다.
 *
 * 테스트 범위:
 * 1. Judge 입력 검증 (참여자 응답 전달)
 * 2. Judge 응답 파싱 (JSON, 코드블록, 텍스트)
 * 3. 점수 기반 평가 (0-100, 임계값)
 * 4. 완료 조건 (임계값 도달, 순환 감지, 최대 iteration)
 */

import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

// 테스트 타임아웃 설정 (5분 - 다중 LLM 사용)
test.setTimeout(300000);

let electronApp: ElectronApplication;
let mainWindow: Page;

// 테스트용 시나리오
const testScenarios = {
  codeReview: {
    topic: 'Review this code for security issues',
    context: 'def process(data): eval(data["cmd"])',
    preset: 'code_review',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
    expectedElements: ['보안', '성능', '가독성', '유지보수성'],
    completionThreshold: 90,
  },
  qaAccuracy: {
    topic: 'AI의 미래에 대한 토론',
    context: '인공지능이 인류에게 미치는 영향을 분석해주세요.',
    preset: 'qa_accuracy',
    participants: ['chatgpt', 'claude'],
    judgeProvider: 'gemini',
    expectedElements: ['정확성', '완전성', '명확성'],
    completionThreshold: 85,
  },
};

test.describe('Judge Validation E2E', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../../dist/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    mainWindow = await electronApp.firstWindow();
    await mainWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Checklist: Judge 입력 검증', () => {
    test('[JUDGE-INPUT-01] 두 참여자 응답을 Judge에게 전달', async () => {
      const scenario = testScenarios.codeReview;

      // 참여자들의 응답 수집
      const participantResponses = await mainWindow.evaluate(async (s) => {
        const { ipcRenderer } = require('electron');
        const responses: Record<string, string> = {};

        for (const participant of s.participants) {
          // 각 참여자에게 토픽 전달
          await ipcRenderer.invoke('adapter:enterPrompt', participant, s.topic + '\n\nContext:\n' + s.context);
          await ipcRenderer.invoke('adapter:submitMessage', participant);
          await ipcRenderer.invoke('adapter:awaitResponse', participant, 120000);
          const result = await ipcRenderer.invoke('adapter:getResponse', participant);
          responses[participant] = result.data;
        }

        return responses;
      }, scenario);

      // 모든 참여자 응답이 있어야 함
      expect(Object.keys(participantResponses)).toHaveLength(scenario.participants.length);
      for (const participant of scenario.participants) {
        expect(participantResponses[participant]).toBeDefined();
        expect(participantResponses[participant].length).toBeGreaterThan(0);
      }
    });

    test('[JUDGE-INPUT-02] 올바른 프롬프트 형식 (JSON 요청)', async () => {
      const judgePromptFormat = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:getJudgePromptFormat');
      });

      // 프롬프트에 JSON 출력 요청이 포함되어야 함
      expect(judgePromptFormat).toContain('JSON');
      expect(judgePromptFormat).toContain('elements');
      expect(judgePromptFormat).toContain('score');
    });

    test('[JUDGE-INPUT-03] 평가 요소 목록 포함', async () => {
      const scenario = testScenarios.codeReview;

      const judgePrompt = await mainWindow.evaluate(async (s) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:buildJudgePrompt', s);
      }, scenario);

      // 모든 평가 요소가 프롬프트에 포함되어야 함
      for (const element of scenario.expectedElements) {
        expect(judgePrompt).toContain(element);
      }
    });
  });

  test.describe('Checklist: Judge 응답 파싱', () => {
    test('[JUDGE-PARSE-01] JSON 코드블록 파싱', async () => {
      const jsonCodeBlockResponse = '```json\n{"elements": [{"name": "보안", "score": 85}]}\n```';

      const parsed = await mainWindow.evaluate(async (response) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:parseJudgeResponse', response);
      }, jsonCodeBlockResponse);

      expect(parsed.success).toBe(true);
      expect(parsed.elements).toHaveLength(1);
      expect(parsed.elements[0].name).toBe('보안');
      expect(parsed.elements[0].score).toBe(85);
    });

    test('[JUDGE-PARSE-02] 직접 JSON 객체 파싱', async () => {
      const directJsonResponse = '{"elements": [{"name": "성능", "score": 90}]}';

      const parsed = await mainWindow.evaluate(async (response) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:parseJudgeResponse', response);
      }, directJsonResponse);

      expect(parsed.success).toBe(true);
      expect(parsed.elements[0].name).toBe('성능');
    });

    test('[JUDGE-PARSE-03] 배열 형식 파싱', async () => {
      const arrayResponse = '[{"name": "가독성", "score": 88}, {"name": "유지보수성", "score": 92}]';

      const parsed = await mainWindow.evaluate(async (response) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:parseJudgeResponse', response);
      }, arrayResponse);

      expect(parsed.success).toBe(true);
      expect(parsed.elements).toHaveLength(2);
    });

    test('[JUDGE-PARSE-04] 한글 텍스트 폴백 파싱', async () => {
      const koreanTextResponse = `
        평가 결과:
        - 보안: 85점 (eval 사용으로 인한 보안 취약점)
        - 성능: 70점 (최적화 필요)
      `;

      const parsed = await mainWindow.evaluate(async (response) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:parseJudgeResponse', response);
      }, koreanTextResponse);

      // 텍스트 파싱이 실패하더라도 에러가 발생하지 않아야 함
      expect(parsed).toBeDefined();
    });
  });

  test.describe('Checklist: 점수 기반 평가', () => {
    test('[JUDGE-SCORE-01] 각 요소 점수 0-100 범위', async () => {
      const mockElements = [
        { name: '보안', score: 85 },
        { name: '성능', score: 105 }, // 범위 초과
        { name: '가독성', score: -10 }, // 범위 미만
      ];

      const validated = await mainWindow.evaluate(async (elements) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:validateScores', elements);
      }, mockElements);

      // 점수가 0-100 범위로 정규화되어야 함
      expect(validated.every((e: { score: number }) => e.score >= 0 && e.score <= 100)).toBe(true);
    });

    test('[JUDGE-SCORE-02] completionThreshold 도달 확인', async () => {
      const elements = [
        { name: '보안', score: 92 },
        { name: '성능', score: 91 },
        { name: '가독성', score: 95 },
      ];
      const threshold = 90;

      const result = await mainWindow.evaluate(async ({ elements, threshold }) => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:checkThresholdReached', elements, threshold);
      }, { elements, threshold });

      expect(result.allReached).toBe(true);
      expect(result.reachedCount).toBe(3);
    });

    test('[JUDGE-SCORE-03] 점수 히스토리 누적', async () => {
      const scoreHistory = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 여러 번의 점수 업데이트 시뮬레이션
        await ipcRenderer.invoke('debate:updateScore', 'elem-1', 80);
        await ipcRenderer.invoke('debate:updateScore', 'elem-1', 85);
        await ipcRenderer.invoke('debate:updateScore', 'elem-1', 90);

        return await ipcRenderer.invoke('debate:getScoreHistory', 'elem-1');
      });

      expect(scoreHistory).toHaveLength(3);
      expect(scoreHistory).toEqual([80, 85, 90]);
    });
  });

  test.describe('Checklist: 완료 조건', () => {
    test('[JUDGE-COMPLETE-01] 모든 요소 임계값 도달 → 완료', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 모든 요소가 임계값 도달한 상태 시뮬레이션
        const state = {
          elements: [
            { id: 'elem-1', name: '보안', currentScore: 92 },
            { id: 'elem-2', name: '성능', currentScore: 91 },
          ],
          completionThreshold: 90,
        };

        return await ipcRenderer.invoke('debate:checkCompletion', state);
      });

      expect(result.isComplete).toBe(true);
      expect(result.reason).toBe('threshold');
    });

    test('[JUDGE-COMPLETE-02] 순환 감지 → 조기 완료', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 순환 패턴 시뮬레이션 (동일한 버전이 반복)
        const versionHistory = [
          { content: 'V1', score: 80 },
          { content: 'V2', score: 82 },
          { content: 'V1', score: 80 }, // V1 반복
        ];

        return await ipcRenderer.invoke('debate:detectCycle', versionHistory);
      });

      expect(result.isCycle).toBe(true);
      expect(result.reason).toContain('repeat');
    });

    test('[JUDGE-COMPLETE-03] 최대 iteration (100) 도달 → 강제 종료', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 최대 iteration 도달 시뮬레이션
        const state = {
          currentIteration: 100,
          maxIterations: 100,
        };

        return await ipcRenderer.invoke('debate:checkMaxIteration', state);
      });

      expect(result.shouldStop).toBe(true);
      expect(result.reason).toBe('max_iteration');
    });
  });

  test.describe('Full Judge Workflow', () => {
    test('[JUDGE-FULL-01] 전체 심판 워크플로우', async () => {
      const scenario = testScenarios.codeReview;

      // 전체 토론 시작
      const debateResult = await mainWindow.evaluate(async (s) => {
        const { ipcRenderer } = require('electron');

        // 토론 시작
        const debateId = await ipcRenderer.invoke('debate:start', {
          topic: s.topic,
          context: s.context,
          preset: s.preset,
          participants: s.participants,
          judgeProvider: s.judgeProvider,
          completionThreshold: s.completionThreshold,
        });

        // 완료 대기 (최대 5분)
        return await ipcRenderer.invoke('debate:waitForCompletion', debateId, 300000);
      }, scenario);

      // 토론이 완료되어야 함
      expect(debateResult.status).toBe('completed');
      expect(debateResult.finalScores).toBeDefined();

      // 모든 요소가 평가되어야 함
      expect(Object.keys(debateResult.finalScores).length).toBeGreaterThan(0);
    });

    test('[JUDGE-FULL-02] 심판 리포트 생성', async () => {
      const report = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');
        return await ipcRenderer.invoke('debate:getReport');
      });

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('iterations');
      expect(report).toHaveProperty('finalScores');
      expect(report).toHaveProperty('completionReason');
    });
  });

  test.describe('Error Handling', () => {
    test('[JUDGE-ERROR-01] Judge 응답 파싱 실패 시 재시도', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 잘못된 형식의 응답
        const invalidResponse = 'This is not a valid JSON response';

        return await ipcRenderer.invoke('debate:parseJudgeResponseWithRetry', invalidResponse, 3);
      });

      // 재시도 후에도 실패하면 에러 상태 반환
      expect(result.success || result.error).toBeDefined();
    });

    test('[JUDGE-ERROR-02] 참여자 응답 실패 시 처리', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 응답 실패 시뮬레이션
        return await ipcRenderer.invoke('debate:handleParticipantFailure', {
          provider: 'chatgpt',
          error: 'Response timeout',
        });
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBeDefined(); // 'retry' or 'skip' or 'abort'
    });

    test('[JUDGE-ERROR-03] 연속 빈 응답 시 circuit breaker', async () => {
      const result = await mainWindow.evaluate(async () => {
        const { ipcRenderer } = require('electron');

        // 3회 연속 빈 응답 시뮬레이션
        for (let i = 0; i < 3; i++) {
          await ipcRenderer.invoke('debate:recordEmptyResponse', 'chatgpt');
        }

        return await ipcRenderer.invoke('debate:checkCircuitBreaker', 'chatgpt');
      });

      expect(result.isOpen).toBe(true);
      expect(result.reason).toContain('empty');
    });
  });
});
