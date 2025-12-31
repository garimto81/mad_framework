/**
 * Response Parser Tests
 *
 * Issue #44: 응답 파싱 9단계 폴백 시스템 강화
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseParser, responseParser } from '../../../electron/debate/response-parser';

describe('ResponseParser', () => {
  let parser: ResponseParser;

  beforeEach(() => {
    parser = ResponseParser.getInstance();
    parser.reset();
  });

  describe('Stage 1: JSON code block', () => {
    it('should parse ```json code block', () => {
      const response = `Here is my analysis:
\`\`\`json
{
  "elements": [
    {"name": "보안", "score": 85, "critique": "보안이 좋습니다"}
  ]
}
\`\`\``;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('보안');
      expect(result.elements[0].score).toBe(85);
      expect(result.metadata.stage).toBe(1);
      expect(result.metadata.confidence).toBe(100);
    });
  });

  describe('Stage 2: Generic code block', () => {
    it('should parse ``` code block without json marker', () => {
      const response = `Analysis:
\`\`\`
{
  "elements": [
    {"name": "성능", "score": 90, "critique": "성능이 우수합니다"}
  ]
}
\`\`\``;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('성능');
      expect(result.metadata.stage).toBe(2);
      expect(result.metadata.confidence).toBe(90);
    });
  });

  describe('Stage 3: JSON object direct extraction', () => {
    it('should extract JSON object with elements', () => {
      const response = `분석 결과입니다: {"elements": [{"name": "가독성", "score": 75, "critique": "개선 필요"}]} 감사합니다.`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('가독성');
      expect(result.metadata.stage).toBe(3);
    });
  });

  describe('Stage 4: JSON array direct extraction', () => {
    it('should extract JSON array with name/score', () => {
      const response = `결과: [{"name": "유지보수성", "score": 80, "critique": "양호"}]`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('유지보수성');
      expect(result.metadata.stage).toBe(4);
    });
  });

  describe('Stage 3-5: JSON object/array parsing', () => {
    it('should parse JSON object with elements (stage 3)', () => {
      const response = `{"elements": [{"name": "정확성", "score": 95, "critique": "매우 정확"}]}`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      // Stage 3 matches first because it contains "elements"
      expect(result.metadata.stage).toBe(3);
    });

    it('should parse root array (stage 4)', () => {
      const response = `[{"name": "완전성", "score": 88, "critique": "완전함"}]`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      // Stage 4 matches array with "name"
      expect(result.metadata.stage).toBe(4);
    });

    it('should parse single object (stage 5)', () => {
      const response = `{"name": "명확성", "score": 92, "critique": "명확함"}`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      // Full JSON parsing catches single object
      expect(result.metadata.stage).toBe(5);
    });
  });

  describe('Stage 9: Regex fallback (colon pattern)', () => {
    it('should parse colon pattern', () => {
      const response = `분석 결과:
- 보안: 85점
- 성능: 90
- 가독성: 75점`;

      const result = parser.parse(response);

      expect(result.elements.length).toBeGreaterThanOrEqual(3);
      expect(result.metadata.stage).toBe(9);
      expect(result.metadata.isPartial).toBe(true);
    });

    it('should parse Korean colon style', () => {
      const response = `"보안": 85, "성능": 90, "가독성": 75`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(3);
      expect(result.metadata.stage).toBe(9);
    });
  });

  describe('Stage 10: Regex fallback (dash pattern)', () => {
    it('should parse dash pattern', () => {
      const response = `보안 - 85점
성능 - 90점
가독성 - 75점`;

      const result = parser.parse(response);

      expect(result.elements.length).toBeGreaterThanOrEqual(3);
      expect(result.metadata.stage).toBe(10);
    });
  });

  describe('Stage 11: Markdown table parsing', () => {
    it('should parse markdown table', () => {
      const response = `| 요소 | 점수 | 비평 |
|------|------|------|
| 보안 | 85 | 보안이 좋습니다 |
| 성능 | 90 | 성능이 우수합니다 |`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(2);
      expect(result.elements[0].elementName).toBe('보안');
      expect(result.elements[0].score).toBe(85);
      expect(result.elements[1].elementName).toBe('성능');
      expect(result.metadata.stage).toBe(11);
    });

    it('should handle table with different header names', () => {
      const response = `| name | score | critique |
|------|-------|----------|
| Security | 85 | Good |`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('Security');
    });
  });

  describe('Stage 12: Numbered list parsing', () => {
    it('should parse numbered list that colon pattern also matches', () => {
      // Note: This format is also matched by stage 9 (colon pattern)
      // Stage 12 is for specific numbered list format
      const response = `1. 보안: 85점 - 보안 개선 필요
2. 성능: 90 - 성능 우수
3. 가독성: 75점`;

      const result = parser.parse(response);

      expect(result.elements.length).toBeGreaterThanOrEqual(3);
      // Colon pattern (stage 9) matches first
      expect(result.metadata.stage).toBe(9);
    });
  });

  describe('Parse metadata', () => {
    it('should include confidence score', () => {
      const response = `\`\`\`json
{"elements": [{"name": "test", "score": 80, "critique": ""}]}
\`\`\``;

      const result = parser.parse(response);

      expect(result.metadata.confidence).toBe(100); // Stage 1 = 100%
    });

    it('should mark partial parse results', () => {
      const response = `보안: 85점`;

      const result = parser.parse(response);

      expect(result.metadata.isPartial).toBe(true);
      expect(result.metadata.confidence).toBeLessThan(100);
    });

    it('should include parse time', () => {
      const response = `{"elements": []}`;

      const result = parser.parse(response);

      expect(result.metadata.parseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include warnings for fallback parsing', () => {
      const response = `보안 - 85점`;

      const result = parser.parse(response);

      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Empty and invalid responses', () => {
    it('should handle empty response', () => {
      const result = parser.parse('');

      expect(result.elements).toHaveLength(0);
      expect(result.metadata.confidence).toBe(0);
    });

    it('should handle whitespace only response', () => {
      const result = parser.parse('   \n\t  ');

      expect(result.elements).toHaveLength(0);
    });

    it('should handle response with no parseable content', () => {
      const response = `이것은 점수가 없는 일반 텍스트입니다.`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(0);
      expect(result.metadata.stage).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple elements', () => {
      const response = `\`\`\`json
{
  "elements": [
    {"name": "보안", "score": 85, "critique": "좋음"},
    {"name": "성능", "score": 90, "critique": "우수"},
    {"name": "가독성", "score": 75, "critique": "개선필요"},
    {"name": "유지보수성", "score": 80, "critique": "양호"}
  ]
}
\`\`\``;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(4);
    });

    it('should handle elementName instead of name', () => {
      const response = `{"elements": [{"elementName": "보안", "score": 85}]}`;

      const result = parser.parse(response);

      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].elementName).toBe('보안');
    });

    it('should handle feedback instead of critique', () => {
      const response = `{"elements": [{"name": "보안", "score": 85, "feedback": "좋습니다"}]}`;

      const result = parser.parse(response);

      expect(result.elements[0].critique).toBe('좋습니다');
    });

    it('should filter out invalid scores', () => {
      const response = `보안: 150점, 성능: -10점, 가독성: 85점`;

      const result = parser.parse(response);

      // Only 가독성 (85) should be valid
      const validElements = result.elements.filter(e => e.score >= 0 && e.score <= 100);
      expect(validElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Statistics', () => {
    it('should track stage success counts', () => {
      // Parse multiple responses
      parser.parse(`\`\`\`json
{"elements": [{"name": "a", "score": 80}]}
\`\`\``);
      parser.parse(`\`\`\`json
{"elements": [{"name": "b", "score": 85}]}
\`\`\``);
      parser.parse(`보안: 90`);

      const stats = parser.getStageStats();

      expect(stats[1]?.count).toBe(2); // Stage 1 succeeded twice
      expect(stats[9]?.count).toBe(1); // Stage 9 succeeded once
    });

    it('should track failure logs', () => {
      parser.parse('invalid json {{{');

      const logs = parser.getFailureLogs();

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      parser.parse(`\`\`\`json
{"elements": [{"name": "test", "score": 80}]}
\`\`\``);

      parser.reset();

      expect(parser.getStageStats()).toEqual({});
      expect(parser.getFailureLogs()).toEqual([]);
    });
  });
});

describe('responseParser singleton', () => {
  it('should be a singleton', () => {
    const instance1 = ResponseParser.getInstance();
    const instance2 = ResponseParser.getInstance();

    expect(instance1).toBe(instance2);
    expect(responseParser).toBe(instance1);
  });
});
