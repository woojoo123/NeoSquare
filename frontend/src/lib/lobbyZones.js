export const LOBBY_ZONE_DEFINITIONS = [
  {
    id: 'MAIN',
    spaceType: 'MAIN',
    label: '메인 광장',
    shortLabel: '광장',
    description: '사람을 만나고 다음 행동을 고르는 출발 지점입니다.',
    helperText: '광장 인원을 확인하고 스터디 메뉴나 내 활동으로 이동해 보세요.',
    fillColor: 0x132238,
    borderColor: 0x38bdf8,
    accentColor: 0xe0f2fe,
    x: 100,
    y: 100,
    width: 1200,
    height: 230,
    center: { x: 700, y: 215 },
    entry: {
      x: 700,
      y: 292,
      width: 172,
      height: 68,
      label: '메인 광장 입구',
    },
  },
  {
    id: 'STUDY',
    spaceType: 'STUDY',
    label: '스터디 라운지',
    shortLabel: '스터디',
    description: '스터디 세션에 입장하는 구역입니다.',
    helperText: '준비된 스터디를 선택해 입장하세요.',
    fillColor: 0x18293d,
    borderColor: 0x22c55e,
    accentColor: 0xdcfce7,
    x: 100,
    y: 390,
    width: 580,
    height: 350,
    center: { x: 390, y: 565 },
    entry: {
      x: 390,
      y: 688,
      width: 172,
      height: 68,
      label: '스터디 라운지 입구',
    },
  },
  {
    id: 'MENTORING',
    spaceType: 'MENTORING',
    label: '멘토링 허브',
    shortLabel: '멘토링',
    description: '요청과 예약을 정리하고 전용 멘토링 세션으로 이어지는 허브 구역입니다.',
    helperText: '내 활동에서 요청과 예약을 관리하고, 수락되면 전용 세션으로 바로 입장할 수 있습니다.',
    fillColor: 0x1f2b47,
    borderColor: 0xf59e0b,
    accentColor: 0xfef3c7,
    x: 720,
    y: 390,
    width: 580,
    height: 350,
    center: { x: 1010, y: 565 },
    entry: {
      x: 1010,
      y: 688,
      width: 172,
      height: 68,
      label: '멘토링 허브 입구',
    },
  },
];

const DEFAULT_ZONE_ID = 'MAIN';

export function getLobbyZoneDefinition(zoneId) {
  return (
    LOBBY_ZONE_DEFINITIONS.find((zone) => zone.id === zoneId) ||
    LOBBY_ZONE_DEFINITIONS[0]
  );
}

export function getLobbyZoneForPosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return getLobbyZoneDefinition(DEFAULT_ZONE_ID);
  }

  return (
    LOBBY_ZONE_DEFINITIONS.find(
      (zone) =>
        x >= zone.x &&
        x <= zone.x + zone.width &&
        y >= zone.y &&
        y <= zone.y + zone.height
    ) || getLobbyZoneDefinition(DEFAULT_ZONE_ID)
  );
}

export function getLobbyZoneCenter(zoneId) {
  return getLobbyZoneDefinition(zoneId).center;
}

export function getLobbyZoneEntry(zoneId) {
  return getLobbyZoneDefinition(zoneId).entry || null;
}

export function formatLobbySpaceLabel(spaceType) {
  if (spaceType === 'MAIN') {
    return '메인 광장';
  }

  if (spaceType === 'STUDY') {
    return '스터디 라운지';
  }

  if (spaceType === 'MENTORING') {
    return '멘토링 허브';
  }

  return spaceType || '공간';
}

export function formatLobbySpaceActionLabel(spaceType) {
  if (spaceType === 'STUDY') {
    return '스터디 구역으로 이동';
  }

  if (spaceType === 'MENTORING') {
    return '멘토링 허브로 이동';
  }

  return '광장으로 이동';
}
