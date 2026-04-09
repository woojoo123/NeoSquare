const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_CONFIG_SOURCE_DEFAULT = 'default_stun';
const ICE_CONFIG_SOURCE_JSON = 'custom_json';
const ICE_CONFIG_SOURCE_SPLIT = 'custom_split';

function normalizeIceServerEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    return {
      urls: entry,
    };
  }

  if (Array.isArray(entry)) {
    return {
      urls: entry.filter((value) => typeof value === 'string' && value.trim() !== ''),
    };
  }

  if (typeof entry !== 'object') {
    return null;
  }

  const urls = Array.isArray(entry.urls)
    ? entry.urls.filter((value) => typeof value === 'string' && value.trim() !== '')
    : typeof entry.urls === 'string'
      ? entry.urls
      : null;

  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return null;
  }

  return {
    urls,
    username: typeof entry.username === 'string' ? entry.username : undefined,
    credential: typeof entry.credential === 'string' ? entry.credential : undefined,
  };
}

function parseEnvUrlList(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function hasTurnUrl(urls) {
  if (typeof urls === 'string') {
    return urls.startsWith('turn:') || urls.startsWith('turns:');
  }

  if (Array.isArray(urls)) {
    return urls.some((url) => typeof url === 'string' && (url.startsWith('turn:') || url.startsWith('turns:')));
  }

  return false;
}

function buildIceServersFromSplitEnv() {
  const stunUrls = parseEnvUrlList(import.meta.env.VITE_WEBRTC_STUN_URLS);
  const turnUrls = parseEnvUrlList(import.meta.env.VITE_WEBRTC_TURN_URLS);
  const turnUsername = import.meta.env.VITE_WEBRTC_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL;
  const nextIceServers = [];

  if (stunUrls.length > 0) {
    nextIceServers.push({
      urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls,
    });
  }

  if (turnUrls.length > 0) {
    nextIceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: typeof turnUsername === 'string' && turnUsername.trim() !== '' ? turnUsername : undefined,
      credential: typeof turnCredential === 'string' && turnCredential.trim() !== '' ? turnCredential : undefined,
    });
  }

  return nextIceServers.map(normalizeIceServerEntry).filter(Boolean);
}

function buildRtcConfiguration(iceServers, source) {
  const normalizedIceServers =
    Array.isArray(iceServers) && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  const hasTurnRelay = normalizedIceServers.some((server) => hasTurnUrl(server.urls));

  return {
    iceServers: normalizedIceServers,
    source,
    hasTurnRelay,
  };
}

function resolveRtcConfiguration() {
  const configuredIceServers = import.meta.env.VITE_WEBRTC_ICE_SERVERS;

  if (configuredIceServers) {
    try {
      const parsedIceServers = JSON.parse(configuredIceServers);
      const normalizedIceServers = (Array.isArray(parsedIceServers) ? parsedIceServers : [parsedIceServers])
        .map(normalizeIceServerEntry)
        .filter(Boolean);

      if (normalizedIceServers.length > 0) {
        return buildRtcConfiguration(normalizedIceServers, ICE_CONFIG_SOURCE_JSON);
      }
    } catch (error) {
      console.warn('Failed to parse VITE_WEBRTC_ICE_SERVERS. Falling back to split env or default STUN.', error);
    }
  }

  const splitEnvIceServers = buildIceServersFromSplitEnv();

  if (splitEnvIceServers.length > 0) {
    return buildRtcConfiguration(splitEnvIceServers, ICE_CONFIG_SOURCE_SPLIT);
  }

  return buildRtcConfiguration(DEFAULT_ICE_SERVERS, ICE_CONFIG_SOURCE_DEFAULT);
}

export const RTC_CONFIGURATION = resolveRtcConfiguration();

export function getIceServerModeLabel() {
  if (RTC_CONFIGURATION.hasTurnRelay) {
    return 'TURN 설정됨';
  }

  if (RTC_CONFIGURATION.source === ICE_CONFIG_SOURCE_JSON || RTC_CONFIGURATION.source === ICE_CONFIG_SOURCE_SPLIT) {
    return '사용자 지정 STUN';
  }

  return '기본 STUN';
}

export function getIceServerDetailMessage() {
  if (RTC_CONFIGURATION.hasTurnRelay) {
    return 'TURN 서버가 설정되어 있어 NAT가 강한 환경에서도 릴레이 연결을 시도할 수 있습니다.';
  }

  if (RTC_CONFIGURATION.source === ICE_CONFIG_SOURCE_JSON || RTC_CONFIGURATION.source === ICE_CONFIG_SOURCE_SPLIT) {
    return 'TURN 없이 STUN만 설정되어 있습니다. 네트워크 환경에 따라 연결이 제한될 수 있습니다.';
  }

  return '기본 Google STUN만 사용 중입니다. 실환경 시연 전 TURN 서버를 추가하는 편이 안전합니다.';
}
