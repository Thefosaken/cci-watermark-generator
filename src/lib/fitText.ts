export function fitTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialFontSize: number,
  minFontSize: number
): number {
  let fontSize = initialFontSize;
  ctx.font = `700 ${fontSize}px "Expose Bold", sans-serif`;
  
  while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px "Expose Bold", sans-serif`;
  }
  
  return fontSize;
}