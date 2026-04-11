import { getAvatarPalette } from '../lib/avatarPresets';

export default function AvatarPreview({ presetId, size = 'medium', highlighted = false }) {
  const palette = getAvatarPalette(presetId);

  return (
    <div
      className={`avatar-preview avatar-preview--${size} ${
        highlighted ? 'avatar-preview--highlighted' : ''
      }`}
      style={{
        '--avatar-body': palette.bodyColor,
        '--avatar-outline': palette.bodyOutlineColor,
        '--avatar-cape': palette.capeColor,
        '--avatar-head': palette.headColor,
        '--avatar-hair': palette.hairColor,
        '--avatar-accent': palette.accentColor,
      }}
      aria-hidden="true"
    >
      <div className="avatar-preview__halo" />
      <div className="avatar-preview__shadow" />
      <div className="avatar-preview__cape" />
      <div className="avatar-preview__body" />
      <div className="avatar-preview__head" />
      <div className="avatar-preview__hair" />
      <div className="avatar-preview__badge" />
    </div>
  );
}
