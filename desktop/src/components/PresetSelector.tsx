/**
 * Preset Selector
 *
 * 토론 프리셋 선택
 */

interface PresetSelectorProps {
  selected: string;
  onChange: (preset: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  {
    id: 'code_review',
    name: '코드 리뷰',
    description: '보안, 성능, 가독성, 유지보수성 평가',
    icon: '💻',
  },
  {
    id: 'qa_accuracy',
    name: 'Q&A 정확도',
    description: '정확성, 완전성, 명확성 검증',
    icon: '❓',
  },
  {
    id: 'decision',
    name: '의사결정',
    description: '장점, 단점, 위험, 기회 분석',
    icon: '⚖️',
  },
];

export function PresetSelector({ selected, onChange, disabled }: PresetSelectorProps) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">토론 프리셋</label>
      <div className="grid grid-cols-3 gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange(preset.id)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${
                selected === preset.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
              }
              ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
          >
            <div className="text-2xl mb-2">{preset.icon}</div>
            <div className="font-medium">{preset.name}</div>
            <div className="text-xs text-gray-400 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
