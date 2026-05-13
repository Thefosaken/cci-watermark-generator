import { WatermarkPayload } from '@/types/watermark';
import { DESIGN_TOKENS, LAYOUTS, SERVICE_LABELS } from './designTokens';
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
  eventLogoImage?: HTMLImageElement
): Promise<{ canvas: HTMLCanvasElement; url: string }> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const layout = LAYOUTS[orientation] as LayoutConfig;
  const scale = 3; // 3x multiplier for ultra-high export quality

  const canvas = document.createElement('canvas');
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext('2d')!;

  // Scale the context so drawing logic remains identical
  ctx.scale(scale, scale);

  ctx.clearRect(0, 0, layout.width, layout.height);

  drawBottomBar(ctx, layout);
  drawCentralTile(ctx, layout, payload.cityLabel, logoImage);
  drawServiceText(ctx, layout, payload.serviceType, payload.topic);
  drawAddressText(ctx, layout, payload.address);

  if (payload.serviceType === 'event' && eventLogoImage) {
    drawEventLogo(ctx, layout, eventLogoImage, payload);
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
  logoImage: HTMLImageElement
): void {
  ctx.fillStyle = DESIGN_TOKENS.colors.tileRed;
  ctx.fillRect(layout.tileX, layout.tileY, layout.tileWidth, layout.tileVisibleHeight);

  const tileCenterX = layout.tileX + layout.tileWidth / 2;
  const tileCenterY = layout.tileY + layout.tileVisibleHeight / 2;

  ctx.font = `${DESIGN_TOKENS.typography.cityWeight} ${layout.cityFontSize}px Lato, sans-serif`;
  const cityText = cityLabel.toUpperCase();
  const cityMetrics = ctx.measureText(cityText);
  const cityTextHeight = layout.cityFontSize;

  const totalContentHeight = layout.logoHeight + layout.logoToCityGap + cityTextHeight;
  const contentStartY = tileCenterY - totalContentHeight / 2;

  const logoY = contentStartY;
  const logoX = tileCenterX - layout.logoWidth / 2;
  
  if (logoImage) {
    ctx.drawImage(logoImage, logoX, logoY, layout.logoWidth, layout.logoHeight);
  }

  ctx.fillStyle = DESIGN_TOKENS.colors.cityYellow;
  ctx.textAlign = 'center';
  const cityY = logoY + layout.logoHeight + layout.logoToCityGap + cityTextHeight * 0.85;
  ctx.fillText(cityText, tileCenterX, cityY);
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
  payload: WatermarkPayload
): void {
  const baseRectWidth = 454;
  const baseRectHeight = 174;
  const rectWidth = layout.tileWidth;
  const rectHeight = layout.tileWidth * (baseRectHeight / baseRectWidth);
  
  const rectX = layout.tileX;
  const rectY = layout.tileY - rectHeight + 12;

  // Draw background rectangle
  if (payload.eventBgColor) {
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