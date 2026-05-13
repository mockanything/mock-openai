const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const src = join(__dirname, '..', 'src', 'templates');
const dest = join(__dirname, '..', 'dist', 'templates');

if (!existsSync(src)) {
  console.error('Templates source not found:', src);
  process.exit(1);
}

cpSync(src, dest, { recursive: true });
console.log('Templates copied to dist/templates/');
