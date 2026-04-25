const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_IMG = path.join(__dirname, 'targets', 'anchor.jpg');
const OUTPUT_DIR = path.join(__dirname, 'targets');

async function warp() {
  console.log('🚀 Starting perspective warping...');
  
  if (!fs.existsSync(INPUT_IMG)) {
    console.error('❌ Error: targets/anchor.jpg not found!');
    process.exit(1);
  }

  const image = sharp(INPUT_IMG);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  console.log(`📸 Image loaded: ${width}x${height}`);

  // We will create 4 warped versions mimicking 45-degree tilts
  // Using affine transforms to simulate the perspective squeeze
  
  const variants = [
    { name: 'n', matrix: [1, 0, 0, 0.7] }, // Squeeze height
    { name: 's', matrix: [1, 0, 0, 0.7] }, // Squeeze height (later flip)
    { name: 'e', matrix: [0.7, 0, 0, 1] }, // Squeeze width
    { name: 'w', matrix: [0.7, 0, 0, 1] }, // Squeeze width (later flip)
  ];

  for (const v of variants) {
    let out = sharp(INPUT_IMG).affine(v.matrix, { background: '#000000' });
    
    // For S and W, we also flip to represent the other side
    if (v.name === 's') out = out.flip();
    if (v.name === 'w') out = out.flop();

    const outPath = path.join(OUTPUT_DIR, `anchor_${v.name}.jpg`);
    await out.toFile(outPath);
    console.log(`✅ Generated: anchor_${v.name}.jpg`);
  }

  console.log('✨ All 4 warped anchors generated in /targets');
}

warp().catch(console.error);
