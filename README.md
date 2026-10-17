# 🐶 Dogear

A cozy little shelf for every book Kaila reads.

Dogear keeps track of every book she's read, how much she loved it (in hearts),
the vibes it gave her, and her scribbles about it. Miso the pup says hello every
time it opens, and the very first time gives a quick four-step tour.

<p>
  <img src="docs/shelf.png" width="260" alt="The shelf">
  <img src="docs/search.png" width="260" alt="Finding a book">
  <img src="docs/book.png" width="260" alt="Writing about a book">
</p>

- **Find any book**: type a title, author or ISBN and Dogear fetches the cover,
  author, year, page count and blurb from [Open Library](https://openlibrary.org)
  (falling back to Google Books). No API key needed. Can't find it? Add it by hand.
- **My take**: mark a book as *Read it*, *Reading* or *Want to read*, give it up
  to 5 hearts, pick vibes (😭 🫶 🌶️ 🤯 …) and write scribbles.
- **Works offline** and installs like a real app on Android and iPhone.
- **Never loses her books**: everything is saved on the phone as you go (in the
  Android app, to the app's own storage too, which Android backs up with the
  phone). **Me → Save a backup** sends a backup file to Google Drive, email or
  Files through the share sheet, and **Restore from a backup** brings it all back
  on any phone.

## Using it

### On the web

Every push to `main` publishes the app to GitHub Pages at
`https://<owner>.github.io/BookTracker/`.

One-time setup: in the repo go to **Settings → Pages** and set **Source** to
**GitHub Actions**.

### On Android

The easiest way: send her the **Get Dogear** page
(`https://<owner>.github.io/BookTracker/get.html`). It has a big *Download for
Android* button and shows the two taps Samsung/Android asks for. The page also
offers the browser version.

Or, two ways by hand:

1. **Install from the website (easiest).** Open the site in Chrome on your phone,
   tap **⋮ → Install app** (or **Add to Home screen**). It gets its own icon and
   opens full screen, and it updates itself.
2. **Install the APK.** Every push to `main` builds `dogear.apk` and attaches it to
   the **Dogear for Android** release on GitHub (and every PR build has it under the
   run's *Artifacts*). Download it on the phone, open it, and allow installing from
   your browser when Android asks.

To build the APK yourself: `npm ci && npm run apk` (needs Java 21 and the Android
SDK), or `npm run android && npx cap open android` to use Android Studio.

### On iPhone

Open the site in Safari, tap **Share → Add to Home Screen**.

## Developing

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

Built with React, TypeScript and Vite. Android packaging uses Capacitor.

| Path | What's there |
| --- | --- |
| `src/lib/search.ts` | Open Library / Google Books lookup |
| `src/lib/store.ts` | Local state and saving |
| `src/lib/vault.ts` | Durable storage (browser + Android native copy) |
| `src/lib/backup.ts` | Backup files via the share sheet |
| `src/lib/merge.ts` | Merging a restored backup into the shelf |
| `src/components/` | Screens and sheets |
| `android-res/` | Android launcher icons |
