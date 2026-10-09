# Published Android APK goes here.
#
# Place the built file at: public/downloads/onlyus.apk
#
# Two ways to produce it:
#   1. Automatic (recommended): push a tag like `v1.0.0` — the
#      `.github/workflows/build-apk.yml` workflow builds the APK in the
#      cloud and attaches it to a GitHub Release. Download it from there
#      and copy it to this folder.
#   2. Local: install Android Studio, then run:
#        ONLYUS_WEB_URL=https://your-site.example.com npm run build:mobile
#        npx cap open android
#      ...and Build > Build APK(s) from Android Studio.
#
# The website serves it at /downloads/onlyus.apk (see server.ts).
# This folder ships empty so no stale APK is ever served by accident.
