/**
 * Options for image compression
 */
interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  type?: "image/webp" | "image/jpeg" | "image/png";
  cropToSquare?: boolean;
  maxMB?: number;
}

/**
 * Compresses an image file using HTML5 Canvas and returns a Blob.
 * This runs in the browser.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxDimension = 1200,
    quality = 0.8,
    type = "image/webp",
    cropToSquare = false,
    maxMB = 20,
  } = options;

  // Basic size check to prevent browser freeze
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`File is too large to process. Max size is ${maxMB}MB.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        let sx = 0;
        let sy = 0;
        let sWidth = width;
        let sHeight = height;

        if (cropToSquare) {
          const size = Math.min(width, height);
          sx = (width - size) / 2;
          sy = (height - size) / 2;
          sWidth = size;
          sHeight = size;
          width = maxDimension;
          height = maxDimension;
        } else {
          // Maintain aspect ratio
          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Use high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to compress image (blob null)"));
            }
          },
          type,
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image into memory"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
