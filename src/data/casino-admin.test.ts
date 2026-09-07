import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ALLAH_TUNING,
  DEFAULT_MINE_DROP_TUNING,
  migrateMineDropTuning,
  applyAdminAllahPreset,
  applyAdminGamePreset,
  getAdminSettings,
  resetAdminSettings,
  updateAdminGame,
  updateGeneralSettings,
  upsertAdminUser,
} from "./casino-admin";

describe("casino admin settings", () => {
  afterEach(() => resetAdminSettings());

  it("opening profiles are repeatable and balanced restores every game's math", () => {
    const baseline = structuredClone(getAdminSettings().games);
    for (const game of Object.values(baseline)) {
      applyAdminGamePreset(game.id, "ilk-giris");
      const opening = structuredClone(getAdminSettings().games[game.id]);
      applyAdminGamePreset(game.id, "ilk-giris");
      expect(getAdminSettings().games[game.id]).toEqual(opening);
      expect(opening.minBet).toBe(game.minBet);
      if (game.slot) expect(opening.slot!.math.payoutScale).toBeGreaterThan(game.slot.math.payoutScale);
      else if (game.mineDrop) {
        expect(opening.mineDrop!.payoutScales.base).toBe(1.15);
        expect(opening.mineDrop!.symbolWeights.base.tool).toBeGreaterThan(game.mineDrop.symbolWeights.base.tool);
        expect(opening.mineDrop!.bonusSpins).toBe(game.mineDrop.bonusSpins);
        expect(opening.mineDrop!.maxWinX).toBe(game.mineDrop.maxWinX);
      } else if (game.allah) expect(opening.allah!.coinPayoutScale).toBeGreaterThan(game.allah.coinPayoutScale);
      else if (["blackjack", "roulette", "poker"].includes(game.id)) expect(opening.openingPayoutBoost).toBeCloseTo(0.15);
      else expect(opening.targetRtp).toBe(99.5);
      applyAdminGamePreset(game.id, "dengeli");
      const restored = getAdminSettings().games[game.id];
      expect(restored.targetRtp).toBe(game.targetRtp);
      if (game.mineDrop) expect(restored.mineDrop!.payoutScales).toEqual(game.mineDrop.payoutScales);
      if (game.slot) expect(restored.slot!.math.payoutScale).toEqual(game.slot.math.payoutScale);
    }
  });

  it("eski Baykuş Madeni sembol dengesini taşır, özel admin ayarlarını korur", () => {
    const saved = structuredClone(DEFAULT_MINE_DROP_TUNING);
    saved.profileName = "baykus-madeni-v2-drop-choreography-967";
    saved.symbolWeights.obsidian = { tool: 72, eye: 2, tnt: 8, book: 5, maxBook: 2, empty: 11 };
    saved.symbolWeights.diamond.tool = 49;
    saved.animation.hitMs = 725;
    saved.modeCosts.obsidian = 1200;
    const migrated = migrateMineDropTuning(saved)!;
    expect(migrated.symbolWeights.obsidian).toEqual(DEFAULT_MINE_DROP_TUNING.symbolWeights.obsidian);
    expect(migrated.symbolWeights.diamond.tool).toBe(49);
    expect(migrated.animation.hitMs).toBe(725);
    expect(migrated.modeCosts.obsidian).toBe(1200);
    expect(migrated.profileName).toBe(DEFAULT_MINE_DROP_TUNING.profileName);
    expect(saved.symbolWeights.obsidian.tool).toBe(72);
    expect(migrateMineDropTuning(migrated)).toBe(migrated);
    saved.profileName = "özel-profil";
    expect(migrateMineDropTuning(saved)).toBe(saved);
  });

  it("oyun ayarlarını diğer feature anahtarlarını kaybetmeden günceller", () => {
    updateAdminGame("neon-kasasi", {
      minBet: 50,
      features: { bonusBuy: false },
    });
    const game = getAdminSettings().games["neon-kasasi"];
    expect(game.minBet).toBe(50);
    expect(game.features.bonusBuy).toBe(false);
    expect(game.features.miraBoost).toBe(true);
  });

  it("genel bakım durumunu ve kullanıcı dizinini kalıcı modelde tutar", () => {
    updateGeneralSettings({
      maintenanceMode: true,
      musicEnabled: false,
      musicVolume: 0.4,
    });
    const now = new Date().toISOString();
    upsertAdminUser({
      id: "test-user",
      name: "Test Oyuncu",
      role: "player",
      status: "active",
      balance: 2500,
      createdAt: now,
      lastSeenAt: now,
    });
    expect(getAdminSettings().general.maintenanceMode).toBe(true);
    expect(getAdminSettings().general.musicEnabled).toBe(false);
    expect(getAdminSettings().general.musicVolume).toBe(0.4);
    expect(
      getAdminSettings().users.some((user) => user.id === "test-user"),
    ).toBe(true);
  });

  it("oyun müzik ayarını parça bilgisini kaybetmeden günceller", () => {
    const before = getAdminSettings().games.roulette.music;
    updateAdminGame("roulette", {
      music: { ...before, enabled: false, volume: 0.18 },
    });
    const after = getAdminSettings().games.roulette.music;
    expect(after.enabled).toBe(false);
    expect(after.volume).toBe(0.18);
    expect(after.trackId).toBe(before.trackId);
  });

  it("slot matematik ve deneyim ayarlarını diğer değerleri kaybetmeden birleştirir", () => {
    const before = getAdminSettings().games["neon-kasasi"].slot!;
    updateAdminGame("neon-kasasi", {
      slot: {
        ...before,
        math: { ...before.math, baseScatterRate: 140 },
        presentation: { ...before.presentation, teaseMs: 1600 },
        valueWeights: { ...before.valueWeights, "1000": 3 },
      },
    });
    const after = getAdminSettings().games["neon-kasasi"].slot!;
    expect(after.math.baseScatterRate).toBe(140);
    expect(after.math.bonusSpecialRate).toBe(before.math.bonusSpecialRate);
    expect(after.presentation.teaseMs).toBe(1600);
    expect(after.valueWeights["2"]).toBe(before.valueWeights["2"]);
    expect(after.valueWeights["1000"]).toBe(3);
  });

  it("Allah'in Lutfu mikro ayarlarini diger dagilimlari kaybetmeden birlestirir", () => {
    const before = getAdminSettings().games["allahin-lutfu"].allah!;
    updateAdminGame("allahin-lutfu", {
      allah: {
        ...before,
        reelEyeChancePercent: {
          ...before.reelEyeChancePercent,
          base: 1.25,
        },
        reelScatterChancePercent: {
          ...before.reelScatterChancePercent,
          enhancer: 3.75,
        },
        mysteryWeights: { ...before.mysteryWeights, redrop: 3.5 },
      },
    });
    const after = getAdminSettings().games["allahin-lutfu"].allah!;
    expect(after.reelEyeChancePercent.base).toBe(1.25);
    expect(after.reelEyeChancePercent.trickster).toBe(before.reelEyeChancePercent.trickster);
    expect(after.reelScatterChancePercent.enhancer).toBe(3.75);
    expect(after.mysteryWeights.redrop).toBe(3.5);
    expect(after.mysteryWeights.collector).toBe(before.mysteryWeights.collector);
  });

  it("Allah'in Lutfu hazir profilini tek islemle uygular", () => {
    applyAdminAllahPreset("hareketli");
    const lively = getAdminSettings().games["allahin-lutfu"].allah!;
    expect(lively.profileName).toContain("lively");
    expect(lively.reelEyeChancePercent.base).toBeGreaterThan(
      DEFAULT_ALLAH_TUNING.reelEyeChancePercent.base,
    );
    expect(lively.eyeTargetsMax).toBeGreaterThan(DEFAULT_ALLAH_TUNING.eyeTargetsMax);
  });
});
