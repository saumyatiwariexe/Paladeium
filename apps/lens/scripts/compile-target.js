/**
 * Paladeium AR Menu — Anchor Compiler
 * Run: node compile-target.js
 * 
 * This reads the anchor image from ./targets/anchor.jpg
 * and writes ./targets/targets.mind
 */

const { Compiler } = require('@midar/compiler');
const path = require('path');

async function compile() {
  const compiler = new Compiler();

  const images = [
    path.join(__dirname, 'targets', 'anchor.jpg'),
    path.join(__dirname, 'targets', 'anchor_n.jpg'),
    path.join(__dirname, 'targets', 'anchor_s.jpg'),
    path.join(__dirname, 'targets', 'anchor_e.jpg'),
    path.join(__dirname, 'targets', 'anchor_w.jpg')
  ];

  console.log('⏳ Compiling 5 multi-angle anchors...');
  
  try {
    await compiler.compileImageTargets(images, (progress) => {
      process.stdout.write(`\r   Progress: ${(progress * 100).toFixed(1)}%`);
    });

    const exportedBuffer = await compiler.exportData();
    require('fs').writeFileSync(outputPath, Buffer.from(exportedBuffer));

    console.log('\n✅ targets.mind written successfully!');
    console.log('   Now open index.html in a mobile browser over HTTPS.');
  } catch (err) {
    console.error('\n❌ Compile failed:', err.message);
    console.error('   Make sure anchor.jpg exists in the targets/ folder.');
  }
}

compile();
