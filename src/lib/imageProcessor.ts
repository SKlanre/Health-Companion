/**
 * Robust image processor optimized for mobile devices, specifically Apple iOS (Safari & WebKit).
 * 
 * Key iPhone challenges solved:
 * 1. Safe native decode first (avoids unnecessary conversions when iOS handles HEIC natively or snaps JPEG).
 * 2. heic2any fallback when native decode fails for unconverted HEIC/HEIF files.
 * 3. NO img.crossOrigin on blob: URLs (avoids iOS Safari WebKit CORS rejection).
 * 4. Downscaling 12MP-48MP camera photos using Canvas to max 640px to prevent Safari memory exhaustion.
 * 5. FileReader fallback if ObjectURL fails.
 * 6. Guaranteed resource cleanup and timeouts.
 */

export interface ProcessedImage {
  base64Data: string;
  previewDataUrl: string;
  width: number;
  height: number;
}

let heic2anyModule: any = null;

async function getHeic2any() {
  if (!heic2anyModule && typeof window !== 'undefined') {
    try {
      const mod = await import('heic2any');
      heic2anyModule = mod.default || mod;
    } catch (err) {
      console.warn('heic2any dynamic loader notice:', err);
    }
  }
  return heic2anyModule;
}

function loadImageFromBlob(blob: Blob, timeoutMs = 8000): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    const timer = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image decode timed out.'));
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve({ img, objectUrl });
    };

    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Native decode failed.'));
    };

    // NOTE: Strictly avoid img.crossOrigin on local blob: URLs in iOS Safari!
    img.src = objectUrl;
  });
}

function readViaFileReader(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not yield string.'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error.'));
    reader.readAsDataURL(blob);
  });
}

export async function processImageForScanning(
  file: File | Blob,
  maxDimension: number = 640
): Promise<ProcessedImage> {
  const fileName = (file as File).name || '';
  const fileType = (file.type || '').toLowerCase();
  const isHeic = 
    fileType.includes('heic') || 
    fileType.includes('heif') || 
    /\.(heic|heif)$/i.test(fileName);

  let loadedImg: HTMLImageElement | null = null;
  let activeObjectUrl: string | null = null;

  // Step 1: Try native browser decode first
  try {
    const res = await loadImageFromBlob(file, 6000);
    loadedImg = res.img;
    activeObjectUrl = res.objectUrl;
  } catch (err) {
    console.log('Direct blob decode failed, checking HEIC converter or FileReader...');
  }

  // Step 2: If native decode failed and file appears to be HEIC/HEIF, try heic2any
  if (!loadedImg && isHeic) {
    try {
      const converter = await getHeic2any();
      if (converter) {
        const conversionResult = await converter({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.85,
        });
        const convertedBlob: Blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        const res = await loadImageFromBlob(convertedBlob, 8000);
        loadedImg = res.img;
        activeObjectUrl = res.objectUrl;
      }
    } catch (heicErr) {
      console.warn('HEIC fallback conversion failed:', heicErr);
    }
  }

  // Step 3: Fallback via FileReader if still not loaded
  if (!loadedImg) {
    try {
      const dataUrl = await readViaFileReader(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('DataURL image load timed out')), 6000);
        img.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          reject(new Error('DataURL image load error'));
        };
        img.src = dataUrl;
      });
      loadedImg = img;
    } catch (readerErr) {
      console.warn('FileReader fallback failed:', readerErr);
    }
  }

  if (!loadedImg) {
    throw new Error('Unable to decode image. On iPhone, please check Safari camera permissions or try uploading a photo from your gallery.');
  }

  try {
    let width = loadedImg.naturalWidth || loadedImg.width || 512;
    let height = loadedImg.naturalHeight || loadedImg.height || 512;

    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to initialize 2D canvas context');
    }

    ctx.drawImage(loadedImg, 0, 0, width, height);

    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = previewDataUrl.includes(',') ? previewDataUrl.split(',')[1] : previewDataUrl;

    return {
      base64Data,
      previewDataUrl,
      width,
      height,
    };
  } finally {
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
    }
  }
}
