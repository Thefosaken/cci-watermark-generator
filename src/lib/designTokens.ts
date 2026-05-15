export const DESIGN_TOKENS = {
  colors: {
    tileRed: '#d71921',
    barRed: 'rgba(131, 33, 30, 0.75)',
    textWhite: '#ffffff',
    cityYellow: '#f9f152',
    docBadge: 'rgba(80, 80, 80, 0.75)',
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
    // Badge: right-anchored grey pill, ~63% down
    badgeY: 865,
    badgeHeight: 75,
    badgePaddingLeft: 40,
    badgeFontSize: 20,
    // Logo: centered, near bottom
    logoWidth: 182,
    logoHeight: 182,
    logoX: (1080 - 182) / 2,
    logoY: 1125,
  },
  landscape: {
    width: 1920,
    height: 1080,
    // Badge: right-anchored grey pill, vertically centered
    badgeY: 460,
    badgeHeight: 70,
    badgePaddingLeft: 40,
    badgeFontSize: 20,
    // Logo: centered, near bottom
    logoWidth: 182,
    logoHeight: 182,
    logoX: (1920 - 182) / 2,
    logoY: 845,
  },
} as const;

export const SERVICE_LABELS = {
  midweek: 'MDWK',
  sunday: 'Sunday',
  event: 'EVENT',
} as const;

export const DOCUMENTARY_SERVICE_LABELS = {
  midweek: 'Midweek',
  sunday: 'Sunday',
  event: 'Special',
} as const;