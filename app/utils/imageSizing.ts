export function fitImageToMaxWidth(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number
): { width: number; height: number } {
  const safeWidth = Math.max(1, imageWidth);
  const safeHeight = Math.max(1, imageHeight);
  const safeMaxWidth = Math.max(1, maxWidth);

  if (safeWidth <= safeMaxWidth) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = safeMaxWidth / safeWidth;
  return {
    width: safeWidth * scale,
    height: safeHeight * scale,
  };
}
