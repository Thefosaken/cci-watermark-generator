export const DESIGN_TOKENS = {
  colors: {
    tileRed: '#d71921',
    barRed: 'rgba(215, 25, 33, 0.5)',
    textWhite: '#ffffff',
    cityYellow: '#f9f152',
  },
  typography: {
    primaryFont: 'Lato',
    topicWeight: 900,
    cityWeight: 900,
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
    topicFontSize: 16.5,
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
    topicFontSize: 16.5,
    cityFontSize: 15.17,
  },
} as const;

export const SERVICE_LABELS = {
  midweek: 'MDWK',
  sunday: 'Sunday',
  event: 'EVENT',
} as const;