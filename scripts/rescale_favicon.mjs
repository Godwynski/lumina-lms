import sharp from 'sharp';
import fs from 'fs';

const inputPath = 'C:\\Users\\kuyag\\.gemini\\antigravity\\brain\\f495c380-3b08-497b-82f7-0aa1b9683ba6\\lumina_logo_raw_1774789990594.png';
const outputPath = 'c:\\Systems\\system\\app\\favicon.ico';

async function generateFavicon() {
  try {
    // Sharp can't write .ico directly without extra plugins, 
    // but Next.js supports favicon.png or just a small .ico (which is essentially a renamed bmp/png often).
    // Actually, I'll just save it as a 32x32 png and rename it to .ico, 
    // or better, next.js 13+ supports icon.png. 
    // Let's just overwrite the existing favicon.ico with a small PNG content (most browsers handle this).
    
    await sharp(inputPath)
      .resize(32, 32)
      .toFile(outputPath);
      
    console.log('Favicon generated at:', outputPath);
    const stats = fs.statSync(outputPath);
    console.log('New favicon size:', stats.size, 'bytes');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }
}

generateFavicon();
