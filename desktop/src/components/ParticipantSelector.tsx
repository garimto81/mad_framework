/**
 * Participant Selector
 *
 * 토론 참여자 (LLM) 선택
 */

import type { LLMProvider } from '@shared/types';
import { useLoginStore } from '../stores/login-store';

interface ParticipantSelectorProps {
  selected: LLMProvider[];
  onChange: (participants: LLMProvider[]) => void;
  disabled?: boolean;
}

const PROVIDERS: { id: LLMProvider; name: string; color: string }[] = [
  { id: 'chatgpt', name: 'ChatGPT', color: 'border-chatgpt bg-chatgpt/10' },
  { id: 'claude', name: 'Claude', color: 'border-claude bg-claude/10' },
  { id: 'gemini', name: 'Gemini', color: 'border-gemini bg-gemini/10' },
];

export function ParticipantSelector({
  selected,
  onChange,
  disabled,
}: ParticipantSelectorProps) {
  const { status } = useLoginStore();

  const toggleProvider = (provider: LLMProvider) => {
    if (disabled) return;

    if (selected.includes(provider)) {
      // Don't allow less than 2 participants
      if (selected.length > 2) {
        onChange(selected.filter((p) => p !== provider));
      }
    } else {
      onChange([...selected, provider]);
    }
  };

  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">토론 참여자</label>
      <div className="flex gap-2">
        {PROVIDERS.map((provider) => {
          const isSelected = selected.includes(provider.id);
          const isLoggedIn = status[provider.id]?.isLoggedIn;

          return (
            <button
              key={provider.id}
              onClick={() => toggleProvider(provider.id)}
              disabled={disabled || !isLoggedIn}
              className={`
                flex-1 py-3 px-4 rounded-lg border-2 transition-all
                ${
                  isSelected
                    ? `${provider.color} border-opacity-100`
                    : 'border-gray-600 bg-gray-700/30'
                }
                ${!isLoggedIn ? 'opacity-50 cursor-not-allowed' : 'hover:border-opacity-80'}
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="font-medium">{provider.name}</span>
              {!isLoggedIn && (
                <span className="block text-xs text-gray-500 mt-1">로그인 필요</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">최소 2개 선택</p>
    </div>
  );
}
