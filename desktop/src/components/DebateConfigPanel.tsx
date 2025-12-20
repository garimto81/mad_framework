/**
 * Debate Config Panel
 *
 * 토론 설정 입력 패널
 */

import { useState } from 'react';
import type { DebateConfig, LLMProvider } from '@shared/types';
import { ParticipantSelector } from './ParticipantSelector';
import { PresetSelector } from './PresetSelector';

interface DebateConfigPanelProps {
  onStart: (config: DebateConfig) => void;
  disabled?: boolean;
}

export function DebateConfigPanel({ onStart, disabled }: DebateConfigPanelProps) {
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [preset, setPreset] = useState('code_review');
  const [participants, setParticipants] = useState<LLMProvider[]>(['chatgpt', 'claude']);
  const [judgeProvider, setJudgeProvider] = useState<LLMProvider>('gemini');
  const [threshold, setThreshold] = useState(90);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic.trim()) return;

    onStart({
      topic: topic.trim(),
      context: context.trim() || undefined,
      preset,
      participants,
      judgeProvider,
      completionThreshold: threshold,
    });
  };

  const isValid = topic.trim() && participants.length >= 2;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topic */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">토론 주제 *</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: 이 코드의 보안 취약점을 검토해주세요"
          className="input w-full"
          disabled={disabled}
        />
      </div>

      {/* Context */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">컨텍스트 (선택)</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="코드, 문서, 또는 추가 정보를 입력하세요"
          rows={4}
          className="input w-full resize-none"
          disabled={disabled}
        />
      </div>

      {/* Preset */}
      <PresetSelector selected={preset} onChange={setPreset} disabled={disabled} />

      {/* Participants */}
      <ParticipantSelector
        selected={participants}
        onChange={setParticipants}
        disabled={disabled}
      />

      {/* Judge */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">심판 LLM</label>
        <select
          value={judgeProvider}
          onChange={(e) => setJudgeProvider(e.target.value as LLMProvider)}
          className="input w-full"
          disabled={disabled}
        >
          <option value="chatgpt">ChatGPT</option>
          <option value="claude">Claude</option>
          <option value="gemini">Gemini</option>
        </select>
      </div>

      {/* Threshold */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          완료 임계값: {threshold}점
        </label>
        <input
          type="range"
          min={70}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full"
          disabled={disabled}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>70</span>
          <span>100</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled || !isValid}
        className="btn btn-primary w-full py-3 text-lg"
      >
        토론 시작
      </button>
    </form>
  );
}
