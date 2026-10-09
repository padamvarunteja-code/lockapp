<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# OnlyUs — Private Communication

Zero-knowledge private communication: 24h disappearing messages, E2E
encryption, WebRTC voice/video calls, and an encrypted media vault.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   `npm install --legacy-peer-deps`
2. Copy `.env.example` to `.env.local` and fill in secrets.
3. Run the app:
   `npm run dev`

## Use from the Website

Deploy the repo anywhere Node runs (Render, Railway, Fly.io, a VPS):

```bash
npm install --legacy-peer-deps --omit=dev
npm run build
NODE_ENV=production PORT=3000 npm start
```

Put it behind HTTPS (Caddy, Nginx, or Cloudflare Tunnel) — the app assumes
TLS is terminated by the reverse proxy. Open the public URL on any device and
use OnlyUs directly in the browser; on Android Chrome you can also
"Install app" for a home-screen icon (PWA support is built in).

## Android APK (downloadable from the website)

The APK is a thin native wrapper around your hosted site, built with
[Capacitor](https://capacitorjs.com). The welcome screen's
"Get the Android App" button serves it at `/downloads/onlyus.apk`.

1. Deploy the website over **HTTPS** and note its origin.
2. Set the repo variable `ONLYUS_WEB_URL` to that origin
   (GitHub Settings > Secrets and variables > Actions > Variables).
3. Push a tag like `v1.0.0` (or run the **Build Android APK** workflow
   manually) — see `.github/workflows/build-apk.yml`.
4. Download the APK from the GitHub Release, rename to `onlyus.apk`,
   place it at `public/downloads/onlyus.apk`, and redeploy.

Local alternative (needs Android Studio, no cloud):
```bash
ONLYUS_WEB_URL=https://your-site.example.com npm run build:mobile
npx cap open android   # then Build > Build APK(s)
```
