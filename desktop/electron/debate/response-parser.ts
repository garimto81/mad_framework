/**
 * Response Parser
 *
 * Issue #44: 응답 파싱 9단계 폴백 시스템 강화
 * - 파싱 실패 패턴 수집
 * - 마크다운 테이블 파싱
 * - 부분 파싱 지원
 * - 파싱 신뢰도 메타데이터
 */

/** 파싱된 요소 */
export interface ParsedElement {
  elementName: string;
  score: number;
  critique: string;
}

/** 파싱 메타데이터 */
export interface ParseMetadata {
  /** 파싱에 사용된 단계 (1-12) */
  stage: number;
  /** 단계 설명 */
  stageDescription: string;
  /** 신뢰도 점수 (0-100) */
  confidence: number;
  /** 부분 파싱 여부 */
  isPartial: boolean;
  /** 원본 응답 길이 */
  originalLength: number;
  /** 파싱 소요 시간 (ms) */
  parseTimeMs: number;
  /** 발견된 요소 수 */
  elementsFound: number;
  /** 파싱 경고 */
  warnings: string[];
}

/** 파싱 결과 */
export interface ParseResult {
  elements: ParsedElement[];
  metadata: ParseMetadata;
}

/** 파싱 실패 로그 */
export interface ParseFailureLog {
  timestamp: string;
  stage: number;
  reason: string;
  responsePreview: string;
  attemptedPattern?: string;
}

/** 파싱 단계 정의 */
const PARSE_STAGES = {
  1: 'JSON 코드 블록 (```json)',
  2: '일반 코드 블록 (```)',
  3: 'JSON 객체 직접 추출',
  4: 'JSON 배열 직접 추출',
  5: '전체 응답 JSON 파싱',
  6: 'elements 배열 추출',
  7: '루트 배열 처리',
  8: '단일 객체 처리',
  9: '정규식 폴백 (콜론 패턴)',
  10: '정규식 폴백 (대시 패턴)',
  11: '마크다운 테이블 파싱',
  12: '번호 목록 파싱',
};

/**
 * 응답 파서 클래스
 *
 * LLM 응답에서 요소별 점수를 추출합니다.
 */
export class ResponseParser {
  private static instance: ResponseParser;

  /** 실패 로그 */
  private failureLogs: ParseFailureLog[] = [];

  /** 단계별 성공 카운트 */
  private stageSuccessCounts: Record<number, number> = {};

  private constructor() {}

  static getInstance(): ResponseParser {
    if (!ResponseParser.instance) {
      ResponseParser.instance = new ResponseParser();
    }
    return ResponseParser.instance;
  }

  /**
   * 응답 파싱
   */
  parse(response: string): ParseResult {
    const startTime = Date.now();
    const warnings: string[] = [];

    // 빈 응답 체크
    if (!response || response.trim().length === 0) {
      return this.createEmptyResult(startTime, 'Empty response');
    }

    // 1단계: JSON 코드 블록 (```json)
    let result = this.tryJsonCodeBlock(response);
    if (result.length > 0) {
      return this.createResult(result, 1, startTime, response.length, warnings);
    }

    // 2단계: 일반 코드 블록 (```)
    result = this.tryGenericCodeBlock(response);
    if (result.length > 0) {
      return this.createResult(result, 2, startTime, response.length, warnings);
    }

    // 3단계: JSON 객체 직접 추출
    result = this.tryJsonObject(response);
    if (result.length > 0) {
      return this.createResult(result, 3, startTime, response.length, warnings);
    }

    // 4단계: JSON 배열 직접 추출
    result = this.tryJsonArray(response);
    if (result.length > 0) {
      return this.createResult(result, 4, startTime, response.length, warnings);
    }

    // 5단계: 전체 응답 JSON 파싱
    result = this.tryFullJson(response);
    if (result.length > 0) {
      return this.createResult(result, 5, startTime, response.length, warnings);
    }

    // 6-8단계는 tryFullJson 내부에서 처리됨

    // 9단계: 정규식 폴백 (콜론 패턴)
    result = this.tryRegexColon(response);
    if (result.length > 0) {
      warnings.push('JSON 파싱 실패, 정규식 폴백 사용');
      return this.createResult(result, 9, startTime, response.length, warnings, true);
    }

    // 10단계: 정규식 폴백 (대시 패턴)
    result = this.tryRegexDash(response);
    if (result.length > 0) {
      warnings.push('JSON 파싱 실패, 정규식 폴백 사용');
      return this.createResult(result, 10, startTime, response.length, warnings, true);
    }

    // 11단계: 마크다운 테이블 파싱
    result = this.tryMarkdownTable(response);
    if (result.length > 0) {
      warnings.push('마크다운 테이블에서 추출');
      return this.createResult(result, 11, startTime, response.length, warnings, true);
    }

    // 12단계: 번호 목록 파싱
    result = this.tryNumberedList(response);
    if (result.length > 0) {
      warnings.push('번호 목록에서 추출');
      return this.createResult(result, 12, startTime, response.length, warnings, true);
    }

    // 모든 단계 실패
    this.logFailure(0, 'All parse stages failed', response);
    return this.createEmptyResult(startTime, 'All parse stages failed', response.length);
  }

  /**
   * 1단계: JSON 코드 블록
   */
  private tryJsonCodeBlock(response: string): ParsedElement[] {
    const match = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) {
      this.logFailure(1, 'No ```json block found', response);
      return [];
    }

    try {
      const parsed = JSON.parse(match[1]);
      return this.extractElements(parsed);
    } catch (error) {
      this.logFailure(1, `JSON parse error: ${error}`, response, match[1]);
      return [];
    }
  }

  /**
   * 2단계: 일반 코드 블록
   */
  private tryGenericCodeBlock(response: string): ParsedElement[] {
    const match = response.match(/```\s*([\s\S]*?)\s*```/);
    if (!match) {
      return [];
    }

    try {
      const parsed = JSON.parse(match[1]);
      return this.extractElements(parsed);
    } catch {
      this.logFailure(2, 'Code block is not valid JSON', response);
      return [];
    }
  }

  /**
   * 3단계: JSON 객체 직접 추출
   */
  private tryJsonObject(response: string): ParsedElement[] {
    const match = response.match(/\{[\s\S]*"elements"[\s\S]*\}/);
    if (!match) {
      return [];
    }

    try {
      const parsed = JSON.parse(match[0]);
      return this.extractElements(parsed);
    } catch {
      this.logFailure(3, 'Object extraction failed', response);
      return [];
    }
  }

  /**
   * 4단계: JSON 배열 직접 추출
   */
  private tryJsonArray(response: string): ParsedElement[] {
    const match = response.match(/\[\s*\{[\s\S]*"name"[\s\S]*\}\s*\]/);
    if (!match) {
      return [];
    }

    try {
      const parsed = JSON.parse(match[0]);
      return this.normalizeElements(parsed);
    } catch {
      this.logFailure(4, 'Array extraction failed', response);
      return [];
    }
  }

  /**
   * 5-8단계: 전체 JSON 파싱
   */
  private tryFullJson(response: string): ParsedElement[] {
    try {
      const parsed = JSON.parse(response.trim());

      // 6단계: elements 배열
      if (Array.isArray(parsed.elements)) {
        return this.normalizeElements(parsed.elements);
      }

      // 7단계: 루트 배열
      if (Array.isArray(parsed)) {
        return this.normalizeElements(parsed);
      }

      // 8단계: 단일 객체
      if (parsed.name && parsed.score !== undefined) {
        return this.normalizeElements([parsed]);
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * 9단계: 정규식 폴백 (콜론 패턴)
   */
  private tryRegexColon(response: string): ParsedElement[] {
    const results: ParsedElement[] = [];
    const pattern = /["']?([가-힣\w]+)["']?\s*[:：]\s*(\d{1,3})(?:점|점수)?/g;

    let match;
    while ((match = pattern.exec(response)) !== null) {
      const name = match[1];
      const score = parseInt(match[2], 10);

      if (score >= 0 && score <= 100 && !results.find(r => r.elementName === name)) {
        results.push({ elementName: name, score, critique: '' });
      }
    }

    return results;
  }

  /**
   * 10단계: 정규식 폴백 (대시 패턴)
   */
  private tryRegexDash(response: string): ParsedElement[] {
    const results: ParsedElement[] = [];
    const pattern = /([가-힣\w]+)\s*[-–—]\s*(\d{1,3})(?:점|점수)?/g;

    let match;
    while ((match = pattern.exec(response)) !== null) {
      const name = match[1];
      const score = parseInt(match[2], 10);

      if (score >= 0 && score <= 100 && !results.find(r => r.elementName === name)) {
        results.push({ elementName: name, score, critique: '' });
      }
    }

    return results;
  }

  /**
   * 11단계: 마크다운 테이블 파싱
   */
  private tryMarkdownTable(response: string): ParsedElement[] {
    const results: ParsedElement[] = [];

    // 테이블 헤더와 구분선 찾기
    const tablePattern = /\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/g;
    const tableMatch = tablePattern.exec(response);

    if (!tableMatch) {
      return [];
    }

    const headerRow = tableMatch[1];
    const dataRows = tableMatch[2];

    // 헤더에서 열 인덱스 찾기
    const headers = headerRow.split('|').map(h => h.trim().toLowerCase());
    const nameIndex = headers.findIndex(h =>
      h.includes('name') || h.includes('요소') || h.includes('항목')
    );
    const scoreIndex = headers.findIndex(h =>
      h.includes('score') || h.includes('점수') || h.includes('평가')
    );
    const critiqueIndex = headers.findIndex(h =>
      h.includes('critique') || h.includes('비평') || h.includes('설명') || h.includes('코멘트')
    );

    if (nameIndex === -1 || scoreIndex === -1) {
      return [];
    }

    // 데이터 행 파싱
    const rowPattern = /\|(.+)\|/g;
    let rowMatch;
    while ((rowMatch = rowPattern.exec(dataRows)) !== null) {
      const cells = rowMatch[1].split('|').map(c => c.trim());

      const name = cells[nameIndex];
      const scoreStr = cells[scoreIndex];
      const critique = critiqueIndex !== -1 ? cells[critiqueIndex] || '' : '';

      const score = parseInt(scoreStr.replace(/[^0-9]/g, ''), 10);

      if (name && !isNaN(score) && score >= 0 && score <= 100) {
        results.push({ elementName: name, score, critique });
      }
    }

    return results;
  }

  /**
   * 12단계: 번호 목록 파싱
   */
  private tryNumberedList(response: string): ParsedElement[] {
    const results: ParsedElement[] = [];

    // 패턴: 1. 요소명: 점수점 또는 1. 요소명 - 점수
    const pattern = /\d+[.)]\s*([가-힣\w]+)\s*[:：-]\s*(\d{1,3})(?:점|점수)?(?:\s*[-–—]\s*(.+?))?(?=\n\d+[.)]|\n\n|$)/g;

    let match;
    while ((match = pattern.exec(response)) !== null) {
      const name = match[1];
      const score = parseInt(match[2], 10);
      const critique = match[3]?.trim() || '';

      if (score >= 0 && score <= 100 && !results.find(r => r.elementName === name)) {
        results.push({ elementName: name, score, critique });
      }
    }

    return results;
  }

  /**
   * 요소 추출 헬퍼
   */
  private extractElements(parsed: unknown): ParsedElement[] {
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const obj = parsed as Record<string, unknown>;

    // elements 배열
    if (Array.isArray(obj.elements)) {
      return this.normalizeElements(obj.elements);
    }

    // 루트 배열
    if (Array.isArray(parsed)) {
      return this.normalizeElements(parsed);
    }

    // 단일 객체
    if (obj.name && obj.score !== undefined) {
      return this.normalizeElements([obj]);
    }

    return [];
  }

  /**
   * 요소 정규화
   */
  private normalizeElements(elements: unknown[]): ParsedElement[] {
    return elements
      .filter((e): e is Record<string, unknown> =>
        e !== null && typeof e === 'object' && (('name' in e) || ('elementName' in e))
      )
      .map((e) => ({
        elementName: String(e.name || e.elementName || 'unknown'),
        score: Number(e.score) || 0,
        critique: String(e.critique || e.feedback || e.comment || ''),
      }));
  }

  /**
   * 결과 생성
   */
  private createResult(
    elements: ParsedElement[],
    stage: number,
    startTime: number,
    originalLength: number,
    warnings: string[],
    isPartial: boolean = false
  ): ParseResult {
    const parseTimeMs = Date.now() - startTime;

    // 성공 카운트 증가
    this.stageSuccessCounts[stage] = (this.stageSuccessCounts[stage] || 0) + 1;

    // 신뢰도 계산 (단계가 낮을수록 높음)
    const baseConfidence = Math.max(100 - (stage - 1) * 10, 10);
    const confidence = isPartial ? Math.floor(baseConfidence * 0.7) : baseConfidence;

    return {
      elements,
      metadata: {
        stage,
        stageDescription: PARSE_STAGES[stage as keyof typeof PARSE_STAGES] || 'Unknown',
        confidence,
        isPartial,
        originalLength,
        parseTimeMs,
        elementsFound: elements.length,
        warnings,
      },
    };
  }

  /**
   * 빈 결과 생성
   */
  private createEmptyResult(
    startTime: number,
    reason: string,
    originalLength: number = 0
  ): ParseResult {
    return {
      elements: [],
      metadata: {
        stage: 0,
        stageDescription: 'Failed',
        confidence: 0,
        isPartial: false,
        originalLength,
        parseTimeMs: Date.now() - startTime,
        elementsFound: 0,
        warnings: [reason],
      },
    };
  }

  /**
   * 실패 로그 기록
   */
  private logFailure(
    stage: number,
    reason: string,
    response: string,
    attemptedPattern?: string
  ): void {
    this.failureLogs.push({
      timestamp: new Date().toISOString(),
      stage,
      reason,
      responsePreview: response.substring(0, 100) + (response.length > 100 ? '...' : ''),
      attemptedPattern,
    });

    // 로그가 너무 많으면 오래된 것 제거
    if (this.failureLogs.length > 100) {
      this.failureLogs.shift();
    }
  }

  /**
   * 실패 로그 조회
   */
  getFailureLogs(): ParseFailureLog[] {
    return [...this.failureLogs];
  }

  /**
   * 단계별 성공 통계
   */
  getStageStats(): Record<number, { count: number; description: string }> {
    const result: Record<number, { count: number; description: string }> = {};

    for (const [stage, count] of Object.entries(this.stageSuccessCounts)) {
      const stageNum = parseInt(stage, 10);
      result[stageNum] = {
        count,
        description: PARSE_STAGES[stageNum as keyof typeof PARSE_STAGES] || 'Unknown',
      };
    }

    return result;
  }

  /**
   * 통계 리셋
   */
  reset(): void {
    this.failureLogs = [];
    this.stageSuccessCounts = {};
  }
}

// 싱글톤 내보내기
export const responseParser = ResponseParser.getInstance();
