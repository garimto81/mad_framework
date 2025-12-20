/**
 * Cycle Detector
 *
 * Judge 모델을 사용하여 순환 패턴 감지
 */

import type { ElementVersion, LLMProvider } from '../../shared/types';
import type { BrowserViewManager } from '../browser/browser-view-manager';

interface CycleDetectionResult {
  isCycle: boolean;
  reason: string;
}

export class CycleDetector {
  constructor(private browserManager: BrowserViewManager) {}

  async detectCycle(judgeProvider: LLMProvider, versions: ElementVersion[]): Promise<boolean> {
    // Need at least 3 versions to detect a cycle
    if (versions.length < 3) {
      return false;
    }

    try {
      const adapter = this.browserManager.getAdapter(judgeProvider);

      // Build prompt for judge
      const prompt = this.buildCycleDetectionPrompt(versions);

      // Send to judge model
      await adapter.waitForInputReady();
      await adapter.inputPrompt(prompt);
      await adapter.sendMessage();
      await adapter.waitForResponse(60000);

      // Extract and parse response
      const response = await adapter.extractResponse();
      const result = this.parseCycleResponse(response);

      return result.isCycle;
    } catch (error) {
      // On error, assume no cycle
      console.error('Cycle detection error:', error);
      return false;
    }
  }

  buildCycleDetectionPrompt(versions: ElementVersion[]): string {
    const last3 = versions.slice(-3);

    const versionTexts = last3
      .map(
        (v, i) => `
## Version ${i + 1} (반복 ${v.iteration}, 점수: ${v.score})
${v.content}
`
      )
      .join('\n---\n');

    return `다음 3개의 버전을 분석하여 순환 패턴이 있는지 판단해주세요.

순환 패턴의 정의:
- 버전들이 서로 유사한 내용으로 반복됨
- 더 이상 개선이 되지 않고 같은 내용이 반복됨
- A → B → A 또는 A → B → C → A 형태의 패턴

${versionTexts}

응답 형식 (JSON으로만 응답):
\`\`\`json
{
  "isCycle": true 또는 false,
  "reason": "판단 이유"
}
\`\`\``;
  }

  parseCycleResponse(response: string): CycleDetectionResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonStr.trim());

      return {
        isCycle: !!parsed.isCycle,
        reason: parsed.reason || '',
      };
    } catch {
      return {
        isCycle: false,
        reason: 'Parse error',
      };
    }
  }
}
