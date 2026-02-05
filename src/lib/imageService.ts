/**
 * Servicio de imágenes usando Base64
 * Comprime y convierte imágenes para almacenamiento
 */

/**
 * Convierte una imagen a Base64 comprimida
 * @param file - Archivo de imagen
 * @param maxWidth - Ancho máximo (default 800px)
 * @param maxHeight - Alto máximo (default 600px)
 * @param quality - Calidad JPEG 0-1 (default 0.7)
 * @returns Base64 string
 */
export const convertImageToBase64 = async (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 600,
  quality: number = 0.7
): Promise<string> => {
  console.log('Converting image:', file.name, 'Type:', file.type);
  console.log('Original size:', (file.size / 1024).toFixed(2), 'KB');

  // Determine if we should preserve transparency (PNG/WebP)
  const preserveTransparency = file.type === 'image/png' || file.type === 'image/webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }

        // For transparent images, don't fill background
        // For JPEG, fill with white background first
        if (!preserveTransparency) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Base64 - preserve PNG for transparent images
        const base64 = preserveTransparency
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);

        // Calculate final size
        const finalSize = (base64.length * 0.75) / 1024; // Approximate KB
        console.log('Compressed size:', finalSize.toFixed(2), 'KB');
        console.log('Dimensions:', width, 'x', height);

        // Validate final size
        if (finalSize > 1024) {
          // > 1MB
          reject(
            new Error(
              'Image too large even after compression. Try a smaller image.'
            )
          );
          return;
        }

        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Error loading image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Validates an image before processing
 */
export const validateImage = (
  file: File
): { valid: boolean; error?: string } => {
  // Validate type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Only image files are allowed' };
  }

  // Validate size (5MB maximum before compression)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must not exceed 5MB' };
  }

  return { valid: true };
};

/**
 * Creates a thumbnail from Base64
 */
export const createThumbnail = async (
  base64: string,
  size: number = 150
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Error creating thumbnail'));
        return;
      }

      // Crop to square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => reject(new Error('Error processing thumbnail'));
    img.src = base64;
  });
};
