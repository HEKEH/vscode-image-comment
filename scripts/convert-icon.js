const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../images/icon.svg');
const pngPath = path.join(__dirname, '../images/icon.png');

// Read SVG file
const svgBuffer = fs.readFileSync(svgPath);
const size = 256;

// Convert SVG to PNG
sharp(svgBuffer)
  .resize(size, size, {
    kernel: sharp.kernel.lanczos3 // High-quality resampling
  })
  .png({
    quality: 100,
    compressionLevel: 9
  })
  .toFile(pngPath)
  .then(() => {
    console.log(`✅ Successfully converted icon.svg to icon.png (${size}x${size}, high quality)`);
  })
  .catch((err) => {
    console.error('❌ Error converting icon:', err);
    process.exit(1);
  });

