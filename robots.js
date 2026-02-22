const fs = require('fs');
const path = require('path');

function writePublicFile(filename, content) {
    const outPath = path.join(__dirname, 'public', filename);
    fs.writeFileSync(outPath, content, 'utf8');
    return outPath;
}

function generateRobots() {
    const baseUrl = process.env.SITE_BASE_URL || 'https://savsata.com.tr';
    const lines = [
        'User-agent: *',
        'Disallow: /admin/',
        'Disallow: /login/',
        `Sitemap: ${baseUrl}/site_map.xml`
    ];
    const content = lines.join('\n') + '\n';
    writePublicFile('robots.txt', content);
    return true;
}

module.exports = { generateRobots };
