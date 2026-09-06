import { describe, expect, it } from "vitest";
import { parseAvatarDataUrl } from "./auth-system.mjs";

function png(width = 128, height = 128) {
  const buffer = Buffer.alloc(32);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

describe("avatar upload validation", () => {
  it("izin verilen raster imzasını ve boyutunu kabul eder", () => {
    const result = parseAvatarDataUrl(png());
    expect(result).toMatchObject({
      mimeType: "image/png",
      width: 128,
      height: 128,
    });
    expect(result.hash).toHaveLength(64);
  });

  it("svg, sahte imza ve aşırı küçük görseli reddeder", () => {
    expect(() =>
      parseAvatarDataUrl("data:image/svg+xml;base64,PHN2Zy8+"),
    ).toThrow(/PNG, JPEG veya WebP/);
    expect(() =>
      parseAvatarDataUrl(
        `data:image/png;base64,${Buffer.from("not-a-png").toString("base64")}`,
      ),
    ).toThrow(/imzası/);
    expect(() => parseAvatarDataUrl(png(16, 16))).toThrow(/32×32/);
  });
});
