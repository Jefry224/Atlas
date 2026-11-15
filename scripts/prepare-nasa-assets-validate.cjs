// Optional full Khronos validation. Install gltf-validator in an isolated /tmp prefix
// and set NODE_PATH to that prefix's node_modules; no Atlas dependency is added.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const validator = require('gltf-validator');
const root = path.resolve(__dirname, '..');

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/nasa-assets.json')));
  const results = [];
  for (const asset of manifest.assets.filter(item => item.format === 'glb' && item.available)) {
    const bytes = fs.readFileSync(path.join(root, asset.localPath));
    const report = await validator.validateBytes(new Uint8Array(bytes), {
      uri: asset.localPath,
      maxIssues: 10000,
    });
    results.push({ id: asset.id, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      validatorVersion: validator.version(), ...report });
    console.log(`${asset.id}: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings`);
  }
  fs.writeFileSync(path.join(root, 'assets/models/nasa/validation.json'), `${JSON.stringify(results, null, 2)}\n`);
  if (results.length !== 7 || results.some(result => result.issues.numErrors || result.issues.truncated)) {
    process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
