const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 128;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

/** Redimensiona a imagem para no máximo 128px e retorna como data URL, mantendo o localStorage leve. */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
  if (file.size > MAX_FILE_SIZE) throw new Error('A imagem deve ter no máximo 5 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível processar a imagem.');
    context.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/webp', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
