import { WatermarkPayload } from '@/types/watermark';
import { DESIGN_TOKENS, LAYOUTS, SERVICE_LABELS, DOCUMENTARY_LAYOUTS, DOCUMENTARY_SERVICE_LABELS } from './designTokens';
import { fitTextToWidth } from './fitText';

export type Orientation = 'portrait' | 'landscape';

interface LayoutConfig {
  width: number;
  height: number;
  barHeight: number;
  tileWidth: number;
  tileVisibleHeight: number;
  barY: number;
  tileX: number;
  tileY: number;
  logoWidth: number;
  logoHeight: number;
  leftPadding: number;
  rightPadding: number;
  logoToCityGap: number;
  topicFontSize: number;
  cityFontSize: number;
}

export async function renderWatermark(
  payload: WatermarkPayload,
  orientation: Orientation,
  logoImage: HTMLImageElement,
  eventLogoImage?: HTMLImageElement,
  eventBgImage?: HTMLImageElement
): Promise<{ canvas: HTMLCanvasElement; url: string }> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const layout = LAYOUTS[orientation] as LayoutConfig;
  const scale = 3; // 3x = portrait 3240×4050 / landscape 5760×3240 — print quality

  const canvas = document.createElement('canvas');
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext('2d')!;

  // Scale the context so drawing logic remains identical
  ctx.scale(scale, scale);

  ctx.clearRect(0, 0, layout.width, layout.height);

  drawBottomBar(ctx, layout);
  drawCentralTile(ctx, layout, payload.cityLabel, logoImage, payload.isCellChurch);
  drawServiceText(ctx, layout, payload.serviceType, payload.topic);
  drawAddressText(ctx, layout, payload.address);

  if (payload.serviceType === 'event' && eventLogoImage) {
    drawEventLogo(ctx, layout, eventLogoImage, payload, eventBgImage);
  }

  const url = canvas.toDataURL('image/png');
  return { canvas, url };
}

function drawBottomBar(ctx: CanvasRenderingContext2D, layout: LayoutConfig): void {
  // Background strip - black at 50% opacity
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, layout.barY, layout.width, layout.barHeight);
  
  // Foreground strip - red at 50% opacity
  ctx.fillStyle = 'rgba(197, 50, 45, 0.5)';
  ctx.fillRect(0, layout.barY, layout.width, layout.barHeight);
}

function drawCentralTile(
  ctx: CanvasRenderingContext2D,
  layout: LayoutConfig,
  cityLabel: string,
  logoImage: HTMLImageElement,
  isCellChurch?: boolean
): void {
  ctx.fillStyle = DESIGN_TOKENS.colors.tileRed;
  ctx.fillRect(layout.tileX, layout.tileY, layout.tileWidth, layout.tileVisibleHeight);

  const tileCenterX = layout.tileX + layout.tileWidth / 2;
  const tileCenterY = layout.tileY + layout.tileVisibleHeight / 2;

  let logoY: number;
  let logoX: number;

  if (isCellChurch) {
    logoY = tileCenterY - layout.logoHeight / 2;
    logoX = tileCenterX - layout.logoWidth / 2;
  } else {
    ctx.font = `${DESIGN_TOKENS.typography.cityWeight} ${layout.cityFontSize}px Lato, sans-serif`;
    const cityText = cityLabel.toUpperCase();
    const cityTextHeight = layout.cityFontSize;

    const totalContentHeight = layout.logoHeight + layout.logoToCityGap + cityTextHeight;
    const contentStartY = tileCenterY - totalContentHeight / 2;

    logoY = contentStartY;
    logoX = tileCenterX - layout.logoWidth / 2;

    if (logoImage) {
      ctx.drawImage(logoImage, logoX, logoY, layout.logoWidth, layout.logoHeight);
    }

    ctx.fillStyle = DESIGN_TOKENS.colors.cityYellow;
    ctx.textAlign = 'center';
    const cityY = logoY + layout.logoHeight + layout.logoToCityGap + cityTextHeight * 0.85;
    ctx.fillText(cityText, tileCenterX, cityY);
    return;
  }
  
  if (logoImage) {
    ctx.drawImage(logoImage, logoX, logoY, layout.logoWidth, layout.logoHeight);
  }
}

function drawServiceText(
  ctx: CanvasRenderingContext2D,
  layout: LayoutConfig,
  serviceType: WatermarkPayload['serviceType'],
  topic: string
): void {
  const label = SERVICE_LABELS[serviceType];
  const serviceText = serviceType === 'event' ? topic : `${label}/${topic}`;
  
  ctx.fillStyle = DESIGN_TOKENS.colors.textWhite;
  fitTextToWidth(ctx, serviceText, 400, layout.topicFontSize, 8);
  ctx.textAlign = 'right';
  const barCenterY = layout.barY + layout.barHeight / 2;
  const textY = barCenterY + layout.topicFontSize * 0.35;
  ctx.fillText(serviceText, layout.tileX - layout.leftPadding, textY);
}

function drawAddressText(ctx: CanvasRenderingContext2D, layout: LayoutConfig, address: string): void {
  ctx.fillStyle = DESIGN_TOKENS.colors.textWhite;
  fitTextToWidth(ctx, address, 400, layout.topicFontSize, 8);
  ctx.textAlign = 'left';
  const barCenterY = layout.barY + layout.barHeight / 2;
  const textY = barCenterY + layout.topicFontSize * 0.35;
  ctx.fillText(address, layout.tileX + layout.tileWidth + layout.rightPadding, textY);
}

function drawEventLogo(
  ctx: CanvasRenderingContext2D,
  layout: LayoutConfig,
  eventLogo: HTMLImageElement,
  payload: WatermarkPayload,
  eventBgImage?: HTMLImageElement
): void {
  // Event box: 174 × 80, sitting directly on top of the red tile (per design
  // spec). Width matches the tile; height is fixed at 80.
  const rectWidth = layout.tileWidth;
  const rectHeight = 80;

  const rectX = layout.tileX;
  const rectY = layout.tileY - rectHeight;

  // Background: an uploaded image takes priority (cover-fit, clipped to the
  // rect so it never bleeds onto the red tile). Falls back to the solid
  // colour from the picker.
  if (eventBgImage) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rectX, rectY, rectWidth, rectHeight);
    ctx.clip();
    const imgAspect = eventBgImage.width / eventBgImage.height;
    const rectAspect = rectWidth / rectHeight;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > rectAspect) {
      drawH = rectHeight;
      drawW = drawH * imgAspect;
      drawX = rectX - (drawW - rectWidth) / 2;
      drawY = rectY;
    } else {
      drawW = rectWidth;
      drawH = drawW / imgAspect;
      drawX = rectX;
      drawY = rectY - (drawH - rectHeight) / 2;
    }
    ctx.drawImage(eventBgImage, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (payload.eventBgColor) {
    ctx.fillStyle = payload.eventBgColor;
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
  }

  // Draw scaled logo inside
  const scale = (payload.eventLogoScale || 100) / 100;
  
  const padding = 20;
  const maxLogoWidth = rectWidth - padding * 2;
  const maxLogoHeight = rectHeight - padding * 2;
  
  const imgAspect = eventLogo.width / eventLogo.height;
  const boxAspect = maxLogoWidth / maxLogoHeight;
  
  let baseWidth, baseHeight;
  if (imgAspect > boxAspect) {
    baseWidth = maxLogoWidth;
    baseHeight = maxLogoWidth / imgAspect;
  } else {
    baseHeight = maxLogoHeight;
    baseWidth = maxLogoHeight * imgAspect;
  }
  
  const finalWidth = baseWidth * scale;
  const finalHeight = baseHeight * scale;
  
  const logoX = rectX + (rectWidth / 2) - (finalWidth / 2);
  const logoY = rectY + (rectHeight / 2) - (finalHeight / 2);
  
  ctx.drawImage(eventLogo, logoX, logoY, finalWidth, finalHeight);
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentary Watermark Renderer
// Transparent background overlay with:
//   • Right-anchored grey semi-transparent badge (Service / Topic / Campus)
//   • CCI logo square centred at the bottom
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentaryLayoutConfig {
  width: number;
  height: number;
  badgeY: number;
  badgeHeight: number;
  badgePaddingLeft: number;
  badgeFontSize: number;
  tileWidth: number;
  tileHeight: number;
  tileX: number;
  tileY: number;
  logoWidth: number;
  logoHeight: number;
}

export async function renderDocumentaryWatermark(
  payload: WatermarkPayload,
  orientation: Orientation,
  logoImage: HTMLImageElement
): Promise<{ canvas: HTMLCanvasElement; url: string }> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const layout = DOCUMENTARY_LAYOUTS[orientation] as DocumentaryLayoutConfig;
  const scale = 3;

  const canvas = document.createElement('canvas');
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Fully transparent background
  ctx.clearRect(0, 0, layout.width, layout.height);

  // ── Badge ──────────────────────────────────────────────────────────────────
  const serviceLabel = DOCUMENTARY_SERVICE_LABELS[payload.serviceType];
  // Strip spaces from each segment so there is no whitespace in the badge text
  const topicNoSpaces = payload.topic.replace(/\s+/g, '');
  const campusNoSpaces = payload.campusName.replace(/\s+/g, '');
  const badgeText =
    payload.serviceType === 'event'
      ? `${topicNoSpaces}/${campusNoSpaces}`
      : `${serviceLabel}/${topicNoSpaces}/${campusNoSpaces}`;

  // Use the same font as topic/theme in the normal watermark ("Expose Bold")
  ctx.font = `700 ${layout.badgeFontSize}px "Expose Bold", sans-serif`;
  const textMetrics = ctx.measureText(badgeText);
  const textWidth = textMetrics.width;
  const badgeWidth = textWidth + layout.badgePaddingLeft * 2;
  const badgeX = layout.width - badgeWidth;

  ctx.fillStyle = DESIGN_TOKENS.colors.docBadge;
  ctx.fillRect(badgeX, layout.badgeY, badgeWidth, layout.badgeHeight);

  ctx.fillStyle = DESIGN_TOKENS.colors.textWhite;
  ctx.textAlign = 'center';
  const textX = badgeX + badgeWidth / 2;
  const textY = layout.badgeY + layout.badgeHeight / 2 + layout.badgeFontSize * 0.35;
  ctx.fillText(badgeText, textX, textY);

  // ── Red Tile Box (209 × 175) ──────────────────────────────────────────────
  ctx.fillStyle = DESIGN_TOKENS.colors.tileRed;
  ctx.fillRect(layout.tileX, layout.tileY, layout.tileWidth, layout.tileHeight);

  // ── CCI Logo (centred inside the red tile) ─────────────────────────────────
  if (logoImage) {
    const logoX = layout.tileX + (layout.tileWidth - layout.logoWidth) / 2;
    const logoY = layout.tileY + (layout.tileHeight - layout.logoHeight) / 2;
    ctx.drawImage(logoImage, logoX, logoY, layout.logoWidth, layout.logoHeight);
  }

  const url = canvas.toDataURL('image/png');
  return { canvas, url };
}