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

### Persistence (important)

Accounts, sessions, messages, vault files, and admin data live under
`DATA_DIR` (`./data` by default). Most cheap hosts wipe that folder on every
restart — losing all accounts and password changes. For production you have
two options, both free:

**Free (recommended): Supabase Postgres.** Create a free project at
supabase.com, copy its connection string, and set it as `DATABASE_URL`.
The app mirrors every mutation into Postgres and reloads it at boot, so
everything survives restarts with no disk needed. Vault files are stored as
blobs and restored automatically.

**Paid alternative: persistent disk.** Mount a disk (e.g. `/data` on Render)
and set `DATA_DIR=/data`. This repo's `render.yaml` Blueprint shows the
shape, but Render disks need a paid instance type — Postgres above is the
free path.

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
