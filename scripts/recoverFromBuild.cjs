#!/usr/bin/env node
// Recover Rumen docs from build HTML
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const buildDir = path.join(__dirname, '..', 'build', 'docs', 'shuji', 'rumen');
const docsDir = path.join(__dirname, '..', 'docs', 'shuji', 'rumen');

function toFrontMatter(title) {
  return `---\ntitle: ${JSON.stringify(title)}\n---\n`;
}

function extract(file) {
  const html = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(html);
  const title = $('h1').first().text().trim() || path.basename(path.dirname(file));
  // Grab the main article content
  const article = $('article').first();
  // Remove edit links, anchors etc.
  article.find('a.hash-link').remove();
  const contentHtml = article.html() || '';
  // Convert minimal HTML back to MDX wrapper
  const body = `\n<div className="recovered-from-build">\n${contentHtml}\n</div>\n`;
  return toFrontMatter(title) + body;
}

function main() {
  if (!fs.existsSync(buildDir)) {
    console.error('Build directory not found:', buildDir);
    process.exit(1);
  }
  const entries = fs.readdirSync(buildDir);
  for (const name of entries) {
    const htmlPath = path.join(buildDir, name, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const outDir = path.join(docsDir, name);
    fs.mkdirSync(outDir, {recursive: true});
    const outFile = path.join(outDir, 'index.mdx');
    const mdx = extract(htmlPath);
    fs.writeFileSync(outFile, mdx, 'utf8');
    console.log('Recovered', path.relative(process.cwd(), outFile));
  }
}

main();


