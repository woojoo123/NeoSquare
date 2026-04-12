import {
  getAvatarPalette,
  getAvatarPreviewFrame,
  getAvatarSpriteConfig,
} from '../lib/avatarPresets';

const PREVIEW_FRAME_SIZE_BY_VARIANT = {
  hero: 96,
  card: 64,
  medium: 56,
  stage: 144,
};

export default function AvatarPreview({ presetId, size = 'medium', highlighted = false }) {
  const palette = getAvatarPalette(presetId);
  const spriteConfig = getAvatarSpriteConfig(presetId);
  const previewFrame = getAvatarPreviewFrame(presetId);
  const previewFrameSize = PREVIEW_FRAME_SIZE_BY_VARIANT[size] || PREVIEW_FRAME_SIZE_BY_VARIANT.medium;

  return (
    <div
      className={`avatar-preview avatar-preview--${size} ${
        highlighted ? 'avatar-preview--highlighted' : ''
      }`}
      style={{
        '--avatar-accent': palette.accentColor,
      }}
      aria-hidden="true"
    >
      <div className="avatar-preview__halo" />
      <div className="avatar-preview__shadow" />
      <div
        className="avatar-preview__sprite"
        style={{
          width: `${previewFrameSize}px`,
          height: `${previewFrameSize}px`,
          backgroundImage: `url(${spriteConfig.textureUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${spriteConfig.sheetColumns * previewFrameSize}px ${
            spriteConfig.sheetRows * previewFrameSize
          }px`,
          backgroundPosition: `-${previewFrame.column * previewFrameSize}px -${
            previewFrame.row * previewFrameSize
          }px`,
        }}
      />
    </div>
  );
}
