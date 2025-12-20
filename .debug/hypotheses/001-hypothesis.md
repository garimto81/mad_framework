# Hypothesis #1

**Created**: 2025-12-21T03:40:50.707989

## Hypothesis

getResponse() 함수가 selector-config.ts를 사용하지 않고 선택자를 하드코딩하고 있어서, Claude UI 업데이트에 따라 응답 컨테이너를 찾지 못함. 특히 [data-is-streaming="false"] 선택자가 현재 UI와 맞지 않거나, isWriting이 false 반환 후 DOM 안정화 전에 getResponse가 호출됨.

## Verification Result

(pending)
