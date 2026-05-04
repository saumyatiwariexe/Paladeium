const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const IMAGES = [
  'anchor.jpg',
  'anchor_n.jpg',
  'anchor_s.jpg',
  'anchor_e.jpg',
  'anchor_w.jpg'
];

async function run() {
  console.log('🤖 Launching Headless Compiler...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  // Pipe browser console to node console
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  // Load the MindAR library in the headless browser
  await page.goto('about:blank');
  console.log('🌐 Browser ready.');

  console.log('🖼️ Reading images...');
  const imageDataArray = [];
  for (const imgName of IMAGES) {
    const filePath = path.join(__dirname, 'targets', imgName);
    const buffer = fs.readFileSync(filePath);
    imageDataArray.push(buffer.toString('base64'));
  }

  console.log('⏳ Compiling (this may take a minute)...');
  
  const result = await page.evaluate(async (base64Images) => {
    console.log('🌐 Importing MindAR compiler module...');
    const { Compiler } = await import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
    console.log('✅ Compiler loaded.');

    // Convert base64 to Blob/Image objects for the browser
    async function loadImage(base64) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = 'data:image/jpeg;base64,' + base64;
      });
    }

    const imgs = await Promise.all(base64Images.map(loadImage));
    
    // Create compiler instance
    const compiler = new Compiler();
    await compiler.compileImageTargets(imgs, (progress) => {
      console.log(`📦 Progression: ${(progress * 100).toFixed(1)}%`);
    });

    const exported = await compiler.exportData();
    // Return as numbers to safely pass through IPC
    return Array.from(new Uint8Array(exported));
  }, imageDataArray);

  console.log('💾 Writing targets.mind...');
  const outputPath = path.join(__dirname, 'targets', 'targets.mind');
  fs.writeFileSync(outputPath, Buffer.from(result));

  await browser.close();
  console.log('✅ Done! Multi-angle targets compiled successfully.');
}

run().catch(err => {
  console.error('❌ Error during compilation:', err);
  process.exit(1);
});
