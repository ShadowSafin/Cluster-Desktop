import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

console.log('====================================================');
console.log(' Building Custom Branded Cluster Desktop Installer ');
console.log('====================================================\n');

// 1. Check if apps/electron/release/win-unpacked exists
const electronUnpackedDir = path.join(rootDir, 'apps/electron/release/win-unpacked');
const electronExe = path.join(electronUnpackedDir, 'Cluster.exe');

if (!fs.existsSync(electronExe)) {
  console.log('📦 win-unpacked not found. Building Cluster Desktop first...');
  execSync('npm --workspace=cluster-desktop run build:installer', {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

// 2. Compress win-unpacked into apps/installer/resources/cluster-app.tar.gz
const resourcesDir = path.join(rootDir, 'apps/installer/resources');
fs.mkdirSync(resourcesDir, { recursive: true });
const targetArchive = path.join(resourcesDir, 'cluster-app.tar.gz');

console.log('\n🗜️  Packaging Cluster Desktop payload into cluster-app.tar.gz...');
execSync(`tar.exe -czf "${targetArchive}" -C "${electronUnpackedDir}" .`, {
  stdio: 'inherit',
});

const archiveSizeMb = (fs.statSync(targetArchive).size / (1024 * 1024)).toFixed(2);
console.log(`✓ Payload archive compressed: ${archiveSizeMb} MB`);

// 3. Build installer main, preload, and renderer
console.log('\n🔨 Compiling Cluster Installer application...');
execSync('npm --workspace=cluster-installer run build', {
  cwd: rootDir,
  stdio: 'inherit',
});

// 4. Package installer into single executable
console.log('\n📦 Packaging standalone Windows installer executable...');
try {
  execSync('taskkill /F /IM Cluster-Setup-0.1.0.exe /T', { stdio: 'ignore' });
} catch {}
execSync('npm --workspace=cluster-installer run build:package', {
  cwd: rootDir,
  stdio: 'inherit',
});

// 5. Copy artifact to root release and apps/electron/release
const installerReleaseDir = path.join(rootDir, 'apps/installer/release');
const exeFiles = fs.readdirSync(installerReleaseDir).filter((f) => f.endsWith('.exe'));

if (exeFiles.length > 0) {
  const generatedExe = path.join(installerReleaseDir, exeFiles[0]);
  const destDir1 = path.join(rootDir, 'apps/electron/release');
  const destDir2 = path.join(rootDir, 'release');

  fs.mkdirSync(destDir1, { recursive: true });
  fs.mkdirSync(destDir2, { recursive: true });

  try {
    execSync('taskkill /F /IM Cluster-Setup-0.1.0.exe /T', { stdio: 'ignore' });
  } catch {}

  const targetName = 'Cluster-Setup-0.1.0.exe';
  fs.copyFileSync(generatedExe, path.join(destDir1, targetName));
  fs.copyFileSync(generatedExe, path.join(destDir2, targetName));

  const totalSizeMb = (fs.statSync(generatedExe).size / (1024 * 1024)).toFixed(2);

  console.log('\n====================================================');
  console.log(' ✨ Custom Branded Installer Generated Successfully! ');
  console.log(` 📁 Location: ${path.join(destDir1, targetName)}`);
  console.log(` 📦 Size: ${totalSizeMb} MB`);
  console.log('====================================================\n');
} else {
  console.warn('⚠️ No installer executable found in release directory.');
}
