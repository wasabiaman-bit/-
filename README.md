# SillyTavern Pokemon Pet Extension

SillyTavern 홈/채팅 화면 위에 펫(포켓몬) 오버레이를 띄워서 자동 이동 또는 드래그 이동할 수 있는 확장입니다.

## Features

- Home/Chat 화면에서 펫 자동 이동
- 펫을 마우스로 드래그해서 수동 이동
- 사용자 이미지 업로드 (`GIF`, `PNG`)
- 설정 저장 (활성화, 속도, 크기, 위치, 이미지)

## Directory Layout

```text
pokemon-pet-extension/
  script.js
  style.css
  manifest.json
  templates/
    settings.html
```

## Install (Git 배포용)

SillyTavern 기준 확장 경로:

`public/scripts/extensions/third-party/`

### 신규 설치

```bash
cd public/scripts/extensions/third-party
git clone https://github.com/<YOUR_GITHUB>/<YOUR_REPO>.git pokemon-pet-extension
```

### 업데이트

```bash
cd public/scripts/extensions/third-party/pokemon-pet-extension
git pull
```

설치/업데이트 후 SillyTavern 새로고침.

## Usage

1. Extensions 설정에서 `Pokemon Pet Overlay` 섹션 열기
2. `Enable pet` ON
3. `Pet image (GIF/PNG)`로 이미지 업로드
4. 필요 시 `Autonomous move` ON/OFF
5. `Size`, `Speed` 조절
6. 펫 드래그로 위치 이동

## Notes

- 파일 업로드는 `GIF`, `PNG`만 허용됩니다.
- 업로드 이미지는 settings에 Data URL로 저장됩니다.
