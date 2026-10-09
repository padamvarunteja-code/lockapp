// Idempotently patches the Capacitor Android manifest for OnlyUs:
// - CAMERA + RECORD_AUDIO permissions (WebRTC voice/video calls)
// - hardware acceleration (smooth video rendering)
// - declares camera/mic hardware as not required (installable on all devices)
//
// Run after `npx cap add android` (locally or in CI). Safe to re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST = resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const PERMISSIONS_BLOCK = `    <!-- OnlyUs: WebRTC voice/video calls -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
`;

let xml = readFileSync(MANIFEST, 'utf-8');

if (!xml.includes('android.permission.CAMERA')) {
  xml = xml.replace(
    '    <!-- Permissions -->',
    `    <!-- Permissions -->\n${PERMISSIONS_BLOCK}`
  );
  console.log('added camera/mic permissions');
} else {
  console.log('permissions already present');
}

if (!xml.includes('android:hardwareAccelerated')) {
  xml = xml.replace(
    '<application',
    '<application\n        android:hardwareAccelerated="true"'
  );
  console.log('enabled hardware acceleration');
} else {
  console.log('hardware acceleration already set');
}

writeFileSync(MANIFEST, xml);
console.log('patched', MANIFEST);
