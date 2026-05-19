# SillyTavern Floating Pet Extension

SillyTavern chat/home UI 위에 작은 이미지(펫)를 띄워서 돌아다니게 하는 서드파티 확장입니다.

## 기능
- 사용자 이미지 업로드(투명 PNG 권장)
- 화면 자동 이동(벽 반사) + 드래그 이동
- 캐릭터 응답 시 말풍선 표시
- 속도/크기/말풍선 유지시간 조절
- 스코프별 프리셋 저장
  - `home` / `group:<id>` / `char:<id>` 단위
- 말하기 트리거 고도화
  - `always`: 항상
  - `keywords`: 키워드 포함 시
  - `chance`: 확률 기반
  - 쿨다운(ms), 문장 발췌 사용 여부, 기본 문구 리스트 지원

## 설치
1. 이 저장소를 GitHub에 올립니다.
2. SillyTavern > Extensions > Install extension에서 Git URL로 설치합니다.
3. 확장을 활성화하고 Extensions 패널에서 `Floating Pet` 섹션을 엽니다.

## 사용
1. `Pet image`에 이미지 업로드
2. `Current scope` 확인
3. 설정 후 `Save to this scope` 클릭
4. 스코프별 설정을 지우려면 `Reset this scope`

## 로컬 개발 팁
- 문서 기준으로 third-party 확장은 `/scripts/extensions/third-party/<repo-name>` 경로로 서빙됩니다.
- settings는 `extensionSettings`에 저장되어 재시작 후에도 유지됩니다.
