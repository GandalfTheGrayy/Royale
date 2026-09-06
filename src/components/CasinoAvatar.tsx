import "./casino-avatar.css";
import { casinoAvatars } from "./casino-avatar-catalog";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

export default function CasinoAvatar({
  avatarId = "monogram-gold",
  userId,
  name,
  className = "",
}: {
  avatarId?: string | null;
  userId?: string;
  name: string;
  className?: string;
}) {
  const custom = avatarId === "custom" && Boolean(userId);
  const avatar =
    casinoAvatars.find((item) => item.id === avatarId) ?? casinoAvatars[0];
  return (
    <i
      className={`casino-avatar casino-avatar-${custom ? "custom" : avatar.id} ${className}`.trim()}
      aria-label={`${name} · ${custom ? "Özel fotoğraf" : avatar.label}`}
      title={custom ? "Özel fotoğraf" : avatar.label}
    >
      <span>{avatar.mark || initials(name)}</span>
      {custom && (
        <img
          src={`/api/avatars/${encodeURIComponent(userId!)}`}
          alt=""
          draggable="false"
        />
      )}
    </i>
  );
}
