# Launch kit

Ready-to-post copy for getting TinySquish mentioned off-site. Search engines and AI answer engines
learn about tools from the places people discuss them, so these posts matter more for GEO than
anything on the site itself. Post them yourself, one or two a week, and reply to comments.

Facts to keep consistent everywhere: free, MIT-licensed, runs in the browser, images never uploaded,
works offline, PNG/JPEG/WebP, batches of 20, max-size mode (50 KB–2 MB), English + Indonesian.
Don't claim AVIF/JPEG XL support or numbers that aren't on https://tinysquish.com/benchmark/.

## 1. Search consoles (do first)

- [ ] Google Search Console → add domain `tinysquish.com` → submit `https://tinysquish.com/sitemap.xml`
- [ ] Bing Webmaster Tools → import from Search Console (one click) → check that IndexNow shows submissions
- [ ] After a week: `python3 server/visits.py --report 7` and `python3 tools/crawler-report.py 7`

## 2. Hacker News (Show HN)

**Title:** `Show HN: TinySquish – compress PNG/JPEG/WebP in the browser, nothing uploaded`
**URL:** https://tinysquish.com/

**First comment:**

> I wanted TinyPNG-style compression without sending images to someone's server, so I built a
> static page that does it all in the browser: JPEG/WebP through the canvas encoders, PNG through
> UPNG.js palette quantization + pako. It works offline after the first visit (service worker).
>
> Things that might be interesting:
> - A "max size" mode that binary-searches quality and only downscales when even low quality
>   doesn't fit (useful for upload forms with 100 KB limits).
> - A reproducible benchmark that drives the real app in headless Chromium over the Kodak suite:
>   https://tinysquish.com/benchmark/ — including where it doesn't help (lossless PNG on photos: 0%).
> - No build step, no framework, MIT: https://github.com/mnuradli1/tinysquish.com
>
> Squoosh is great for fine-tuning one image with advanced codecs; this is for batches.
> Feedback welcome, especially on the PNG quantization quality.

## 3. Product Hunt

- **Name:** TinySquish
- **Tagline (≤60):** `Compress images in your browser. Nothing is uploaded.`
- **Description:** Free, open-source image compressor for PNG, JPEG and WebP that runs entirely on
  your device. Batch up to 20 images, convert formats, resize, or fit every file under a size limit
  like 100 KB. Works offline.
- **Topics:** Design Tools, Privacy, Open Source, Developer Tools
- **Gallery:** `og-image.png`, plus screenshots of the app with a batch compressed and the
  before/after slider.

## 4. AlternativeTo

Add TinySquish at https://alternativeto.net/ as an alternative to **TinyPNG** and **Squoosh**.
- License: Free, Open Source · Platforms: Online, Self-Hosted
- Tags: image-compression, privacy-focused, offline, png, webp

## 5. Reddit

- **r/webdev** (only on "Showoff Saturday"): title `[Showoff Saturday] An image compressor that never uploads your files`
- **r/SideProject:** `I built a TinyPNG alternative that runs entirely in the browser (open source)`
- **r/opensource:** link the GitHub repo, lead with the MIT license and the benchmark script.

Body (adapt per sub): two or three sentences on why, the max-size mode, the benchmark link, and the repo.

## 6. Indonesian audience

> Butuh foto di bawah 100 KB buat daftar CPNS, beasiswa, atau formulir online? TinySquish bisa
> mengompres foto langsung di browser, tanpa upload, gratis, dan bisa offline:
> https://tinysquish.com/id/kompres-foto-100kb/

Good places: X/Twitter, Facebook groups for job seekers and students, Kaskus (Computer Stuff).

## 7. GitHub

- Repo description: `Compress PNG, JPEG & WebP in your browser — nothing uploaded. Offline, MIT.`
- Website field: https://tinysquish.com
- Topics: `image-compression`, `png`, `webp`, `jpeg`, `privacy`, `offline-first`, `pwa`, `vanilla-js`
- Look for "awesome" lists on image optimization or privacy-friendly tools and open a PR where it fits
  the list's rules.
