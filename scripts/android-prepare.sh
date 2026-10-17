#!/usr/bin/env sh
# Builds the web app and wraps it in the Android project (android/ is generated,
# not committed). Afterwards: `cd android && ./gradlew assembleDebug`, or
# `npx cap open android` to use Android Studio.
set -e
cd "$(dirname "$0")/.."
npm run build
[ -d android ] || npx cap add android
# Dogear's launcher icons instead of Capacitor's defaults.
rm -rf android/app/src/main/res/mipmap-anydpi-v26
cp -R android-res/. android/app/src/main/res/
# Sign every build with the same key, so a new APK installs over the old
# one (keeping her books) instead of failing as a conflicting package.
grep -q dogear.keystore android/app/build.gradle || cat >> android/app/build.gradle <<'GRADLE'

// Dogear: one fixed signing key for every build.
android.signingConfigs.debug.storeFile = rootProject.file('../android-signing/dogear.keystore')
GRADLE
npx cap sync android
