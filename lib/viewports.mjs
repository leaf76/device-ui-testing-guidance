export const VIEWPORT_MATRIX = [
  {
    key: "phone-compact-portrait",
    label: "Compact Phone Portrait",
    width: 360,
    height: 640,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    tier: "mobile",
  },
  {
    key: "phone-portrait",
    label: "Mainstream Phone Portrait",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    tier: "mobile",
  },
  {
    key: "phone-short-landscape",
    label: "Short Phone Landscape",
    width: 667,
    height: 375,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    tier: "mobile",
  },
  {
    key: "phone-landscape",
    label: "Mainstream Phone Landscape",
    width: 844,
    height: 390,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    tier: "mobile",
  },
  {
    key: "laptop-half-split",
    label: "Laptop Half-Split",
    width: 640,
    height: 800,
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    tier: "desktop",
  },
  {
    key: "tablet-portrait",
    label: "Tablet Portrait",
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    tier: "tablet",
  },
  {
    key: "tablet-landscape",
    label: "Tablet Landscape",
    width: 1024,
    height: 768,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    tier: "tablet",
  },
  {
    key: "laptop",
    label: "Laptop",
    width: 1280,
    height: 800,
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    tier: "desktop",
  },
  {
    key: "desktop",
    label: "Desktop",
    width: 1440,
    height: 900,
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    tier: "desktop",
  },
];

export const ULTRAWIDE_VIEWPORT = {
  key: "desktop-ultrawide",
  label: "Ultrawide Desktop",
  width: 1920,
  height: 1080,
  isMobile: false,
  hasTouch: false,
  deviceScaleFactor: 1,
  tier: "desktop",
};

export const PRESET_KEYS = {
  full: VIEWPORT_MATRIX.map((v) => v.key),
  quick: ["phone-compact-portrait", "phone-short-landscape", "tablet-portrait", "laptop"],
  mobile: [
    "phone-compact-portrait",
    "phone-portrait",
    "phone-short-landscape",
    "phone-landscape",
  ],
  tablet: ["tablet-portrait", "tablet-landscape"],
  desktop: ["laptop-half-split", "laptop", "desktop"],
  ultrawide: [...VIEWPORT_MATRIX.map((v) => v.key), ULTRAWIDE_VIEWPORT.key],
};

const ALL_BY_KEY = new Map(
  [...VIEWPORT_MATRIX, ULTRAWIDE_VIEWPORT].map((vp) => [vp.key, vp])
);

/**
 * Parse custom viewport specs such as "360x640,667x375:touch,1280x800:desktop"
 * or resolve named presets ("full", "quick", "mobile", "tablet", "desktop", "ultrawide").
 */
export function resolveViewports({ preset = "full", custom = "" } = {}) {
  if (custom && custom.trim()) {
    return custom
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((token) => {
        if (ALL_BY_KEY.has(token)) {
          return { ...ALL_BY_KEY.get(token) };
        }
        const m = /^(\d{3,4})x(\d{3,4})(?::(touch|mobile|desktop))?$/i.exec(token);
        if (!m) {
          throw new Error(
            `Invalid viewport spec "${token}". Expected "<width>x<height>[:touch|desktop]" or a known key.`
          );
        }
        const width = Number(m[1]);
        const height = Number(m[2]);
        const mode = m[3]?.toLowerCase();
        const isTouch =
          mode === "touch" || mode === "mobile"
            ? true
            : mode === "desktop"
              ? false
              : width <= 1024 && height <= 1024;
        return {
          key: `custom-${width}x${height}`,
          label: `Custom ${width}x${height}`,
          width,
          height,
          isMobile: isTouch,
          hasTouch: isTouch,
          deviceScaleFactor: isTouch ? 2 : 1,
          tier: isTouch ? (width >= 768 && height >= 768 ? "tablet" : "mobile") : "desktop",
        };
      });
  }

  const keys = PRESET_KEYS[preset];
  if (!keys) {
    throw new Error(
      `Unknown preset "${preset}". Available presets: ${Object.keys(PRESET_KEYS).join(", ")}`
    );
  }
  return keys.map((k) => ({ ...ALL_BY_KEY.get(k) }));
}
