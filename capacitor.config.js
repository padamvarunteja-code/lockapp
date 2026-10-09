// OnlyUs Capacitor configuration.
//
// NOTE: written with named ESM exports (not `export default`) because the
// Capacitor CLI loads this file with require(), which does not unwrap a
// default export. Named exports land directly on the loaded object.
//
// The APK is a thin native wrapper around the hosted OnlyUs website
// (the backend cannot run on-device). Set ONLYUS_WEB_URL to the public
// HTTPS origin of your deployment before syncing/building, e.g.:
//   ONLYUS_WEB_URL=https://onlyus.example.com npm run build:mobile
const webUrl = process.env.ONLYUS_WEB_URL;

export const appId = 'com.onlyus.app';
export const appName = 'OnlyUs';
export const webDir = 'dist';
export const server = webUrl
  ? {
      url: webUrl,
      cleartext: webUrl.startsWith('http://'),
    }
  : undefined;
export const android = {
  allowMixedContent: false,
};
