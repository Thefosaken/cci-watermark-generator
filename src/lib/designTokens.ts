export const DESIGN_TOKENS = {
  colors: {
    tileRed: '#d71921',
    barRed: 'rgba(131, 33, 30, 0.75)',
    textWhite: '#ffffff',
    cityYellow: '#f9f152',
    docBadge: 'rgba(0, 0, 0, 0.5)',
  },
  typography: {
    primaryFont: 'Lato',
    topicWeight: 900,
    cityWeight: 700,
  },
} as const;

export const LAYOUTS = {
  portrait: {
    width: 1080,
    height: 1350,
    barHeight: 74,
    tileWidth: 209,
    tileVisibleHeight: 177,
    barY: 1211,
    tileX: 436,
    tileY: 1173,
    logoWidth: 142,
    logoHeight: 69,
    leftPadding: 55,
    rightPadding: 55,
    logoToCityGap: 6,
    topicFontSize: 18.1,
    cityFontSize: 15.17,
  },
  landscape: {
    width: 1920,
    height: 1080,
    barHeight: 74,
    tileWidth: 209,
    tileVisibleHeight: 187,
    barY: 941,
    tileX: 856,
    tileY: 893,
    logoWidth: 142,
    logoHeight: 69,
    leftPadding: 55,
    rightPadding: 55,
    logoToCityGap: 6,
    topicFontSize: 18.1,
    cityFontSize: 15.17,
  },
} as const;

export const DOCUMENTARY_LAYOUTS = {
  portrait: {
    width: 1080,
    height: 1350,
    // Badge: right-anchored black strip, ~63% down
    badgeY: 758, // bottom of strip + 342px gap = top of red tile (1175)
    badgeHeight: 75,
    badgePaddingLeft: 40,
    badgeFontSize: 20,
    // Red tile box: centred, near bottom (209 × 175)
    tileWidth: 209,
    tileHeight: 175,
    tileX: (1080 - 209) / 2,
    tileY: 1350 - 175, // flush with bottom of frame
    // Logo inside tile
    logoWidth: 142,
    logoHeight: 69,
  },
  landscape: {
    width: 1920,
    height: 1080,
    // Badge: right-anchored black strip, vertically centred
    badgeY: 476, // bottom of strip + 342px gap = top of red tile (905)
    badgeHeight: 87,
    badgePaddingLeft: 40,
    badgeFontSize: 20,
    // Red tile box: centred, near bottom (209 × 175)
    tileWidth: 209,
    tileHeight: 175,
    tileX: (1920 - 209) / 2,
    tileY: 1080 - 175, // flush with bottom of frame
    // Logo inside tile
    logoWidth: 142,
    logoHeight: 69,
  },
} as const;

export const SERVICE_LABELS = {
  midweek: 'MDWK',
  sunday: 'Sunday',
  event: 'EVENT',
} as const;

export const DOCUMENTARY_SERVICE_LABELS = {
  midweek: 'MDWK',
  sunday: 'Sunday',
  event: 'Special',
} as const;