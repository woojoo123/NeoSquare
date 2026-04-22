import mainPlazaBackgroundUrl from '../assets/maps/main-plaza-bg.png';
import studyLoungeBackgroundUrl from '../assets/maps/study-lounge-bg.png';
import mentoringHallBackgroundUrl from '../assets/maps/mentoring-hall-bg.png';
import portalMainUrl from '../assets/maps/portals/portal-main.svg';
import portalStudyUrl from '../assets/maps/portals/portal-study.svg';
import portalMentoringUrl from '../assets/maps/portals/portal-mentoring.svg';

const DEFAULT_WORLD_CONFIG = {
  assetKey: 'space-world-main',
  backgroundUrl: mainPlazaBackgroundUrl,
  portalAssetKey: 'space-portal-main',
  portalAssetUrl: portalMainUrl,
  spawn: { x: 640, y: 404 },
  blockingZones: [],
  ambienceLights: [],
};

export const SPACE_WORLD_CONFIGS = {
  MAIN: {
    assetKey: 'space-world-main',
    backgroundUrl: mainPlazaBackgroundUrl,
    portalAssetKey: 'space-portal-main',
    portalAssetUrl: portalMainUrl,
    spawn: { x: 640, y: 418 },
    blockingZones: [
      { x: 84, y: 112, width: 246, height: 174 },
      { x: 954, y: 112, width: 242, height: 174 },
      { x: 118, y: 352, width: 172, height: 172 },
      { x: 992, y: 352, width: 170, height: 172 },
      { x: 482, y: 620, width: 318, height: 56 },
    ],
    ambienceLights: [
      { x: 222, y: 290, color: 0x60a5fa, radius: 138, intensity: 0.28 },
      { x: 1058, y: 290, color: 0x60a5fa, radius: 138, intensity: 0.28 },
      { x: 640, y: 414, color: 0xfbbf24, radius: 104, intensity: 0.18 },
    ],
  },
  STUDY: {
    assetKey: 'space-world-study',
    backgroundUrl: studyLoungeBackgroundUrl,
    portalAssetKey: 'space-portal-study',
    portalAssetUrl: portalStudyUrl,
    spawn: { x: 640, y: 446 },
    blockingZones: [
      { x: 86, y: 94, width: 228, height: 194 },
      { x: 964, y: 94, width: 228, height: 194 },
      { x: 398, y: 198, width: 484, height: 78 },
      { x: 402, y: 330, width: 474, height: 62 },
      { x: 170, y: 594, width: 192, height: 90 },
      { x: 920, y: 594, width: 192, height: 90 },
    ],
    ambienceLights: [
      { x: 640, y: 168, color: 0x22c55e, radius: 164, intensity: 0.18 },
      { x: 308, y: 616, color: 0xfde68a, radius: 112, intensity: 0.18 },
      { x: 972, y: 616, color: 0xfde68a, radius: 112, intensity: 0.18 },
    ],
  },
  MENTORING: {
    assetKey: 'space-world-mentoring',
    backgroundUrl: mentoringHallBackgroundUrl,
    portalAssetKey: 'space-portal-mentoring',
    portalAssetUrl: portalMentoringUrl,
    spawn: { x: 640, y: 452 },
    blockingZones: [
      { x: 88, y: 88, width: 234, height: 204 },
      { x: 958, y: 88, width: 234, height: 204 },
      { x: 472, y: 164, width: 336, height: 110 },
      { x: 410, y: 344, width: 456, height: 72 },
      { x: 214, y: 612, width: 188, height: 78 },
      { x: 878, y: 612, width: 188, height: 78 },
    ],
    ambienceLights: [
      { x: 640, y: 146, color: 0xf59e0b, radius: 172, intensity: 0.18 },
      { x: 638, y: 492, color: 0xfde68a, radius: 122, intensity: 0.14 },
    ],
  },
};

export function getSpaceWorldConfig(spaceType) {
  return SPACE_WORLD_CONFIGS[spaceType] || DEFAULT_WORLD_CONFIG;
}
