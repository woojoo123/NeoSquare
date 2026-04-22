# NeoSquare Metaverse Asset Pipeline

이 문서는 `frontend/src/game/SpaceScene.js`가 실제 일러스트 자산으로 교체될 수 있도록 필요한 파일과 규칙을 정리한 문서다.

## 목표

현재 메타버스는 코드로 그린 프로토타입에서 `에셋 기반 공간`으로 넘어가는 중이다.
이후부터는 씬 코드를 계속 다시 그리는 대신 아래 파일만 교체하면 된다.

## 필수 파일

공간별 배경:

- `frontend/src/assets/maps/main-plaza-bg.svg`
- `frontend/src/assets/maps/study-lounge-bg.svg`
- `frontend/src/assets/maps/mentoring-hall-bg.svg`

공간별 입구:

- `frontend/src/assets/maps/portals/portal-main.svg`
- `frontend/src/assets/maps/portals/portal-study.svg`
- `frontend/src/assets/maps/portals/portal-mentoring.svg`

설정 데이터:

- `frontend/src/lib/spaceWorlds.js`

## 교체 규칙

1. 배경은 `1280x840` 기준으로 제작한다.
2. 실제 서비스에서는 `.svg` 대신 `.png`를 써도 된다.
3. 파일명을 유지하면 `SpaceScene` 수정 없이 바로 교체된다.
4. 충돌 구역이 바뀌면 `spaceWorlds.js`의 `blockingZones`도 같이 수정해야 한다.
5. 스폰 위치가 바뀌면 `spawn` 좌표를 같이 조정한다.

## 디자이너에게 요청할 요소

배경 한 장 안에 아래 요소가 포함되면 좋다.

- 하늘 또는 상부 분위기 영역
- 메인 바닥 패턴
- 길과 광장 구분
- 건물 외형
- 벤치, 화분, 조명, 표지판
- 공간 이름이 드러나는 간판 또는 타이틀 영역

별도 에셋으로 분리하면 좋은 것:

- 포털 입구
- 가로등 글로우
- 이벤트 배너
- 떠 있는 표식

## 충돌 데이터 작성 기준

`blockingZones`는 플레이어가 지나가면 안 되는 영역이다.

예:

```js
blockingZones: [
  { x: 84, y: 112, width: 246, height: 174 },
  { x: 954, y: 112, width: 242, height: 174 },
]
```

권장 방식:

- 건물 전체보다 약간 작게 잡는다
- 시각적 그림자 영역은 충돌에 포함하지 않는다
- 문 앞은 비워 둔다
- 벤치/테이블은 상황에 따라 충돌을 주거나 주지 않는다

## 포털 에셋 기준

입구 에셋은 배경에 완전히 합치지 않고 별도 파일로 두는 편이 좋다.

이유:

- 상태별 강조 가능
- 다른 공간에서도 재사용 가능
- 애니메이션 추가가 쉬움

포털 파일은 대략 아래 비율을 권장한다.

- 기준 크기: `260x236`
- 중앙 정렬
- 아래쪽 그림자 포함

## 앞으로 확장할 때

다음 단계로 확장 가능하다.

1. 배경 `.svg`를 실사풍 또는 일러스트 `.png`로 교체
2. 포털을 정적 이미지에서 애니메이션 스프라이트로 교체
3. `blockingZones`를 JSON 파일로 분리
4. `Tiled`를 도입해 충돌/오브젝트 레이어를 에디터에서 관리

## 관련 파일

- `frontend/src/game/SpaceScene.js`
- `frontend/src/lib/spaceWorlds.js`
- `frontend/src/assets/maps/`
