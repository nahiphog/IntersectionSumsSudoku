/** Render independently of DOM visibility so collapsed grids can also be copied. */
export function gridImage(values: readonly (number | null)[], clues: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 904;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 904, 904);
  ctx.fillStyle = clues ? '#7b2cbf' : '#263c34'; ctx.strokeStyle = '#53634f';
  ctx.font = clues ? '24px sans-serif' : '48px sans-serif';
  ctx.textAlign = clues ? 'left' : 'center'; ctx.textBaseline = clues ? 'top' : 'middle';
  values.forEach((value, i) => {
    if (value !== null) ctx.fillText(String(value), 2 + (i % 9) * 100 + (clues ? 7 : 50), 2 + Math.floor(i / 9) * 100 + (clues ? 7 : 50));
  });
  for (let i = 0; i <= 9; i++) {
    ctx.lineWidth = i % 3 ? 1 : 4;
    ctx.beginPath(); ctx.moveTo(2 + i * 100, 2); ctx.lineTo(2 + i * 100, 902);
    ctx.moveTo(2, 2 + i * 100); ctx.lineTo(902, 2 + i * 100); ctx.stroke();
  }
  return canvas;
}

export function imageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create image.')), 'image/png'));
}
