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

// Default layout used by Sunday and Midweek services (original CCI watermark
// proportions): a 209-wide red tile flush with the bottom of the frame.
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
    width: 1620,
    height: 1080,
    barHeight: 74,
    tileWidth: 209,
    tileVisibleHeight: 187,
    barY: 941,
    tileX: 706,
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

// Special Event layout: smaller 174x130 red tile with a 116x56 CCI logo so
// the 174x80 event-logo box can sit directly on top without crowding. Used
// only when serviceType === 'event'.
export const EVENT_LAYOUTS = {
  portrait: {
    width: 1080,
    height: 1350,
    barHeight: 74,
    tileWidth: 174,
    tileVisibleHeight: 130,
    barY: 1211,
    tileX: (1080 - 174) / 2,
    tileY: 1350 - 130,
    logoWidth: 116,
    logoHeight: 56,
    leftPadding: 55,
    rightPadding: 55,
    logoToCityGap: 5,
    topicFontSize: 18.1,
    cityFontSize: 12.31,
  },
  landscape: {
    width: 1620,
    height: 1080,
    barHeight: 74,
    tileWidth: 174,
    tileVisibleHeight: 130,
    barY: 941,
    tileX: (1620 - 174) / 2,
    tileY: 1080 - 130,
    logoWidth: 116,
    logoHeight: 56,
    leftPadding: 55,
    rightPadding: 55,
    logoToCityGap: 5,
    topicFontSize: 18.1,
    cityFontSize: 12.31,
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
    logoWidth: 116,
    logoHeight: 56,
  },
  landscape: {
    width: 1620,
    height: 1080,
    // Badge: right-anchored black strip, vertically centred
    badgeY: 441, // bottom of strip + 377px gap = top of red tile (905)
    badgeHeight: 87,
    badgePaddingLeft: 40,
    badgeFontSize: 20,
    // Red tile box: centred, near bottom (209 × 175)
    tileWidth: 209,
    tileHeight: 175,
    tileX: (1620 - 209) / 2,
    tileY: 1080 - 175, // flush with bottom of frame
    // Logo inside tile
    logoWidth: 116,
    logoHeight: 56,
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