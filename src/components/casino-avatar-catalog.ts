export const casinoAvatars = [
  { id: "monogram-gold", label: "Altın Monogram", mark: "" },
  { id: "kasa-baronu", label: "Kasa Baronu", mark: "♛" },
  { id: "gece-kurdu", label: "Gece Kurdu", mark: "◆" },
  { id: "kartal", label: "Kartal", mark: "✦" },
  { id: "kara-as", label: "Kara As", mark: "A♠" },
  { id: "mercan-reisi", label: "Mercan Reisi", mark: "⚓" },
  { id: "neon-patronu", label: "Neon Patronu", mark: "77" },
  { id: "seker-babasi", label: "Şeker Babası", mark: "★" },
] as const;

export type CasinoAvatarId = (typeof casinoAvatars)[number]["id"];
