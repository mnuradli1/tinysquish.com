#!/usr/bin/env python3
"""Generates every static page from one template, so header, footer, navigation and SEO tags
never drift apart. Benchmark numbers are read from bench/results.json.

    python3 tools/build-site.py

Writes index.html, <page>/index.html, id/…, 404.html, sitemap.xml and llms.txt.
Edit the PAGES content here, never the generated HTML. Bump LASTMOD when page content changes.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://tinysquish.com"
LASTMOD = "2026-10-09"
GITHUB = "https://github.com/mnuradli1/tinysquish.com"
AUTHOR_GITHUB = "https://github.com/mnuradli1"
# Bing Webmaster Tools ownership (homepage only). Google is verified via a DNS TXT record.
BING_VERIFY = "40B8A819EC28B5C70B4FFC042D266DB4"
PERSON_ID = f"{SITE}/about/#nur-adli"
APP_ID = f"{SITE}/#app"
SITE_ID = f"{SITE}/#website"

BENCH = json.loads((ROOT / "bench/results.json").read_text())


def b(set_id, setting):
    return next(r for r in BENCH["results"] if r["set"] == set_id and r["setting"] == setting)


def pct(x):
    return f"{x:g}%"


def kb(n):
    return f"{n / 1024:.1f} KB" if n < 1048576 else f"{n / 1048576:.2f} MB"


K = {k: b("kodak", k) for k in ("png-75", "png-95", "jpeg-75", "webp-75", "jpeg-max-50kb")}
U = {k: b("ui", k) for k in ("png-75", "png-95", "jpeg-75", "webp-75", "jpeg-max-50kb")}

# ---------------------------------------------------------------------------------------------
# Shared copy
# ---------------------------------------------------------------------------------------------

HOW_EN = """
<section aria-labelledby="how-title">
  <h2 id="how-title">How it works</h2>
  <ol class="steps">
    <li><strong>Add images.</strong> Drop PNG, JPEG or WebP files, or a whole folder, onto the page. Up to 20 at a time.</li>
    <li><strong>Pick the output.</strong> Set the quality, keep the format or convert to JPEG, PNG or WebP, cap the file size, and resize if you like. Every change recompresses right away.</li>
    <li><strong>Compare and download.</strong> Drag the before/after slider to check the result, then save single files or everything as one ZIP.</li>
  </ol>
</section>"""

WHY_EN = """
<section aria-labelledby="why-title">
  <h2 id="why-title">Why TinySquish</h2>
  <ul class="facts">
    <li><strong>Private by design.</strong> Compression runs in your browser. Your images never leave your device.</li>
    <li><strong>Works offline.</strong> After your first visit the app is saved in your browser and keeps working without a connection.</li>
    <li><strong>Lossless PNG when you need it.</strong> At 90% quality and above, PNGs are re-encoded without losing a pixel; lower settings shrink the palette for much smaller files.</li>
    <li><strong>Hit an exact size.</strong> Set a max size from 50 KB to 2 MB and TinySquish finds the best quality that fits, shrinking the dimensions only when it has to.</li>
    <li><strong>Free and open source.</strong> No account, no daily limit, no watermark. The code is MIT-licensed on GitHub.</li>
  </ul>
</section>"""

HOW_ID = """
<section aria-labelledby="how-title">
  <h2 id="how-title">Cara kerjanya</h2>
  <ol class="steps">
    <li><strong>Tambahkan gambar.</strong> Taruh file PNG, JPEG, atau WebP, atau satu folder sekaligus, ke halaman ini. Maksimal 20 gambar per batch.</li>
    <li><strong>Atur hasilnya.</strong> Pilih kualitas, pertahankan format atau ubah ke JPEG, PNG, atau WebP, batasi ukuran file, dan ubah dimensi bila perlu. Setiap perubahan langsung dikompres ulang.</li>
    <li><strong>Bandingkan dan unduh.</strong> Geser slider sebelum/sesudah untuk mengecek hasilnya, lalu simpan per file atau semuanya dalam satu ZIP.</li>
  </ol>
</section>"""

WHY_ID = """
<section aria-labelledby="why-title">
  <h2 id="why-title">Kenapa TinySquish</h2>
  <ul class="facts">
    <li><strong>Privasi terjaga.</strong> Kompresi berjalan di browser Anda. Gambar tidak pernah keluar dari perangkat.</li>
    <li><strong>Bisa offline.</strong> Setelah kunjungan pertama, aplikasi tersimpan di browser dan tetap jalan tanpa internet.</li>
    <li><strong>PNG lossless bila perlu.</strong> Di kualitas 90% ke atas, PNG disimpan ulang tanpa kehilangan satu piksel pun; pengaturan lebih rendah mengurangi jumlah warna agar file jauh lebih kecil.</li>
    <li><strong>Ukuran pas sesuai target.</strong> Pilih ukuran maksimal 50 KB sampai 2 MB, dan TinySquish mencari kualitas terbaik yang muat, mengecilkan dimensi hanya bila terpaksa.</li>
    <li><strong>Gratis dan open source.</strong> Tanpa akun, tanpa batas harian, tanpa watermark. Kodenya berlisensi MIT di GitHub.</li>
  </ul>
</section>"""

FAQ_HOME_EN = [
    ("Are my images uploaded to a server?",
     "No. TinySquish compresses images locally in your browser, so the files never leave your device. The only thing the site sends is an anonymous visit count, and your IP address is never stored."),
    ("Does TinySquish work offline?",
     "Yes. A service worker saves the app on your first visit. After that you can open tinysquish.com and compress images without an internet connection."),
    ("Which image formats are supported?",
     "You can add PNG, JPEG and WebP images, up to 20 per batch, including whole folders. The output keeps the original format or converts to PNG, JPEG or WebP."),
    ("Will compression reduce image quality?",
     "The Quality slider (10–95%) sets the trade-off. JPEG and WebP are re-encoded at that quality. PNG stays lossless at 90% and above; from 65% to 89% it is reduced to a 256-color palette, and to fewer colors below that. When you keep the original format and a result comes out larger than the original, TinySquish keeps the original file."),
    ("Can I compress an image to a specific file size, like 100 KB?",
     "Yes. Choose a Max size between 50 KB and 2 MB. TinySquish searches for the highest quality that fits, using the Quality slider as the upper limit, and only reduces the dimensions when even low quality is still too big."),
    ("Can I resize images too?",
     "Yes. Resize by percentage (10–200%) or to an exact width and height, with the aspect ratio locked by default."),
    ("Is TinySquish free?",
     "Yes. There is no account, no daily limit and no watermark on your images. The source code is open under the MIT license."),
    ("How is TinySquish different from TinyPNG and other online compressors?",
     "Upload-based compressors such as TinyPNG send your files to their servers to process them. TinySquish does the work on your own device, so your images stay private, it works offline, and there is no upload to wait for."),
]

FAQ_HOME_ID = [
    ("Apakah gambar saya diunggah ke server?",
     "Tidak. TinySquish mengompres gambar langsung di browser Anda, jadi file tidak pernah keluar dari perangkat. Satu-satunya yang dikirim situs ini adalah hitungan kunjungan anonim, dan alamat IP Anda tidak pernah disimpan."),
    ("Apakah TinySquish bisa dipakai offline?",
     "Bisa. Service worker menyimpan aplikasi saat kunjungan pertama. Setelah itu Anda bisa membuka tinysquish.com dan mengompres gambar tanpa koneksi internet."),
    ("Format gambar apa saja yang didukung?",
     "Anda bisa menambahkan gambar PNG, JPEG, dan WebP, maksimal 20 per batch, termasuk satu folder sekaligus. Hasilnya tetap dalam format asli atau diubah ke PNG, JPEG, atau WebP."),
    ("Apakah kompresi menurunkan kualitas gambar?",
     "Slider Kualitas (10–95%) mengatur keseimbangannya. JPEG dan WebP disimpan ulang pada kualitas tersebut. PNG tetap lossless di 90% ke atas; dari 65% sampai 89% dikurangi menjadi 256 warna, dan lebih sedikit lagi di bawahnya. Jika format asli dipertahankan dan hasilnya justru lebih besar, TinySquish memakai file aslinya."),
    ("Bisakah saya mengompres foto ke ukuran tertentu, misalnya 100 KB?",
     "Bisa. Pilih Ukuran maks antara 50 KB dan 2 MB. TinySquish mencari kualitas tertinggi yang muat, dengan slider Kualitas sebagai batas atas, dan hanya mengecilkan dimensi bila kualitas rendah pun masih terlalu besar."),
    ("Apakah TinySquish gratis?",
     "Ya. Tanpa akun, tanpa batas harian, dan tanpa watermark pada gambar Anda. Kode sumbernya terbuka dengan lisensi MIT."),
]

# ---------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------

PAGES = [
    dict(
        path="/", lang="en", alt={"id": "/id/"}, app=True, kind="home",
        title="TinySquish — Compress PNG, JPEG & WebP Images Offline",
        description="Free image compressor that runs in your browser. Shrink, resize and convert PNG, JPEG and WebP in batches. Works offline; images are never uploaded.",
        h1="Compress PNG, JPEG &amp; WebP images in your browser — nothing is uploaded",
        sections=HOW_EN + WHY_EN, faq=FAQ_HOME_EN,
    ),
    dict(
        path="/compress-png/", lang="en", app=True, crumb="Compress PNG",
        title="Compress PNG Online Without Uploading — TinySquish",
        description="Shrink PNG files in your browser with palette quantization, or keep them lossless. Transparency stays intact, nothing is uploaded, and it works offline.",
        h1="Compress PNG images without uploading them",
        lead="Drop your PNGs below. They are compressed on your device and keep their transparency.",
        sections=f"""
<section aria-labelledby="png-how">
  <h2 id="png-how">How PNG compression works here</h2>
  <p>PNG is lossless, so the biggest savings come from reducing the number of colors. Below 90% quality, TinySquish converts each PNG to an indexed palette (256 colors from 65% to 89%, fewer below that) with dithering, then compresses it with the same DEFLATE algorithm PNG always uses. At 90% and above it re-encodes losslessly instead, keeping every pixel.</p>
  <p>Transparency is preserved in both modes. If a re-encoded PNG would come out larger than your original, TinySquish keeps the original file.</p>
</section>
<section aria-labelledby="png-numbers">
  <h2 id="png-numbers">What to expect</h2>
  <p>In our <a href="/benchmark/">reproducible benchmark</a>, quality 75% made UI screenshots {pct(U['png-75']['reductionPct'])} smaller with a mean PSNR of {U['png-75']['meanPsnr']:g} dB, which is visually indistinguishable. Photos saved as PNG shrank by {pct(K['png-75']['reductionPct'])} at {K['png-75']['meanPsnr']:g} dB. Lossless mode saved {pct(U['png-95']['reductionPct'])} on screenshots but nothing on the photo set, whose PNGs were already tightly compressed.</p>
  <p>For photos, converting to <a href="/png-to-webp/">WebP</a> or JPEG usually saves far more than any PNG setting.</p>
</section>""",
        faq=[
            ("Does compressing a PNG remove transparency?",
             "No. Both the palette mode and the lossless mode keep the alpha channel. Transparency is only lost if you convert to JPEG, which has no alpha channel; transparent areas then become white."),
            ("What quality should I use for PNG?",
             "Use 75% for screenshots, icons and illustrations: the 256-color palette is usually indistinguishable from the original. Use 90% or more when every pixel has to stay exact, for example for pixel art or images you will edit again."),
            ("Why is my PNG not getting smaller?",
             "Some PNGs are already well optimized, and photos stored as PNG have too many colors for a palette to help much. Lower the quality, or convert photos to WebP or JPEG for much smaller files."),
        ],
    ),
    dict(
        path="/compress-jpeg/", lang="en", app=True, crumb="Compress JPEG",
        title="Compress JPEG Online, Privately in Your Browser — TinySquish",
        description="Make JPG photos smaller without uploading them. Pick a quality or a target size, compare before and after, and download one file or a ZIP.",
        h1="Compress JPEG photos privately in your browser",
        lead="Drop your JPG files below. They never leave your device.",
        sections=f"""
<section aria-labelledby="jpeg-how">
  <h2 id="jpeg-how">How JPEG compression works here</h2>
  <p>TinySquish decodes each photo and re-encodes it with your browser's built-in JPEG encoder at the quality you choose. Most photos straight from a phone or camera are saved at a very high quality, so a setting around 75% typically cuts the size a lot with no visible difference. Use the before/after slider to check fine detail such as hair, text and sky gradients.</p>
  <p>Re-encoded files don't carry EXIF metadata such as camera details or GPS location, which is a privacy bonus when you share photos. If TinySquish can't make a file smaller and keeps your original, the original's metadata stays.</p>
</section>
<section aria-labelledby="jpeg-numbers">
  <h2 id="jpeg-numbers">What to expect</h2>
  <p>In our <a href="/benchmark/">benchmark</a> of the 24 Kodak test photos, saving them as JPEG at 75% produced files {pct(K['jpeg-75']['reductionPct'])} smaller than the lossless originals, at a mean PSNR of {K['jpeg-75']['meanPsnr']:g} dB. Need a hard limit? Set a <a href="/compress-image-to-100kb/">max size</a> and TinySquish finds the highest quality that fits.</p>
</section>""",
        faq=[
            ("What is a good JPEG quality setting?",
             "75% is a good default for photos on the web. Go up to 85–90% for prints or detailed images, and down to 60% when size matters more than fine detail."),
            ("Does TinySquish remove EXIF and GPS data from JPEGs?",
             "Re-encoded JPEGs are saved without EXIF metadata, so camera details and GPS location are not included. The only exception is when TinySquish keeps your original file because it could not make it smaller."),
            ("Can I convert JPEG to WebP instead?",
             "Yes. Set Format to WebP. WebP files are usually smaller than JPEGs at the same visual quality and work in all current major browsers."),
        ],
    ),
    dict(
        path="/png-to-webp/", lang="en", app=True, crumb="PNG to WebP", preset_format="image/webp",
        title="Convert PNG to WebP Online, No Upload — TinySquish",
        description="Convert PNG images to WebP in your browser and keep transparency. Batch up to 20 files, compare quality, and download a ZIP. Nothing is uploaded.",
        h1="Convert PNG to WebP in your browser",
        lead="The output format is already set to WebP. Drop your PNGs below.",
        sections=f"""
<section aria-labelledby="webp-why">
  <h2 id="webp-why">Why convert PNG to WebP</h2>
  <p>WebP supports both lossy compression and transparency, so it can replace PNG for photos, screenshots and graphics with an alpha channel. Every current major browser displays WebP, including Chrome, Edge, Firefox and Safari.</p>
  <p>In our <a href="/benchmark/">benchmark</a>, converting PNG photos to WebP at 75% quality made them {pct(K['webp-75']['reductionPct'])} smaller (mean PSNR {K['webp-75']['meanPsnr']:g} dB). UI screenshots shrank by {pct(U['webp-75']['reductionPct'])}, about the same as TinySquish's palette PNG, so for flat graphics either format works well.</p>
</section>""",
        faq=[
            ("Does WebP keep PNG transparency?",
             "Yes. WebP supports an alpha channel, so transparent areas of your PNG stay transparent after conversion."),
            ("Is WebP supported everywhere?",
             "All current versions of Chrome, Edge, Firefox and Safari display WebP. Some older software and a few upload forms still only accept JPEG or PNG, so keep the originals if you might need them."),
            ("Should I use WebP or PNG for screenshots?",
             "Both work well. In our benchmark WebP at 75% and palette PNG at 75% saved a similar amount on UI screenshots, and the PNG kept more detail. Use PNG when you need exact pixels or maximum compatibility."),
        ],
    ),
    dict(
        path="/jpg-to-webp/", lang="en", app=True, crumb="JPG to WebP", preset_format="image/webp",
        title="Convert JPG to WebP Online, Free & Private — TinySquish",
        description="Turn JPG photos into smaller WebP files right in your browser. No upload, no sign-up, batch up to 20 images, with a before/after comparison.",
        h1="Convert JPG to WebP without uploading",
        lead="The output format is already set to WebP. Drop your JPG photos below.",
        sections="""
<section aria-labelledby="jpgwebp-why">
  <h2 id="jpgwebp-why">Why WebP instead of JPEG</h2>
  <p>WebP was designed by Google as a smaller replacement for JPEG on the web. Google's own study found lossy WebP files to be 25–34% smaller than JPEG files of comparable quality (<a href="https://developers.google.com/speed/webp/docs/webp_study" rel="noopener">WebP compression study</a>). Smaller images load faster, which helps both visitors and Core Web Vitals.</p>
  <p>Converting a JPEG to WebP re-encodes an image that has already lost some detail, so compare the result with the before/after slider and keep the quality at 75% or higher for photos with fine texture.</p>
</section>""",
        faq=[
            ("Will converting JPG to WebP lose quality?",
             "Any lossy re-encode can lose a little detail. At 75% quality the difference is usually invisible; check it with the before/after slider and raise the quality if you see artifacts."),
            ("Can I convert many JPGs to WebP at once?",
             "Yes. Add up to 20 images per batch, or drop a whole folder. Download them one by one or all together as a ZIP."),
            ("Do WebP images keep EXIF data?",
             "No. Converted files are saved without EXIF metadata such as camera details or GPS location."),
        ],
    ),
    dict(
        path="/compress-image-to-100kb/", lang="en", app=True, crumb="Compress to 100 KB", preset_max_kb="100",
        alt={"id": "/id/kompres-foto-100kb/"},
        title="Compress Image to 100 KB (or Any Size) — TinySquish",
        description="Make a photo fit under 100 KB, 200 KB, 500 KB or 1 MB for upload forms. Runs in your browser: no upload, no sign-up, and it works offline.",
        h1="Compress an image to 100 KB or any target size",
        lead="Max size is already set to 100 KB. Drop your image below, or pick another limit in the settings.",
        sections=f"""
<section aria-labelledby="size-how">
  <h2 id="size-how">How the size target works</h2>
  <p>Many upload forms reject photos above a fixed size. With a Max size set, TinySquish encodes your image at the quality on the slider and checks the result. If it's too big, it searches for the highest quality that still fits. Only when even a low quality is too big does it shrink the image's dimensions, step by step, until the file fits.</p>
  <p>Available limits are 50 KB, 100 KB, 200 KB, 300 KB, 500 KB, 1 MB and 2 MB. For photos, choose JPEG or WebP as the output: they reach small sizes with much better quality than PNG.</p>
</section>
<section aria-labelledby="size-numbers">
  <h2 id="size-numbers">Tested on real photos</h2>
  <p>In our <a href="/benchmark/">benchmark</a> with a 50 KB limit, all 24 Kodak photos came out at or under the limit (largest: {kb(K['jpeg-max-50kb']['maxOutBytes'])}), at a mean PSNR of {K['jpeg-max-50kb']['meanPsnr']:g} dB. {K['jpeg-max-50kb']['resized']} of the 24 needed slightly smaller dimensions to fit.</p>
</section>""",
        faq=[
            ("How do I reduce a photo to under 100 KB?",
             "Add the photo, keep Max size at 100 KB and pick JPEG as the format. TinySquish finds the highest quality that fits under 100 KB and shows the final size before you download."),
            ("Will the image dimensions change?",
             "Only if they have to. TinySquish first lowers the quality; it reduces the width and height only when even a low quality would still be over the limit. The file list shows the new dimensions when that happens."),
            ("Can I choose 200 KB, 500 KB or 1 MB instead?",
             "Yes. Pick any limit from 50 KB to 2 MB in the Max size setting. Every image in the batch is compressed to fit that limit."),
        ],
    ),
    dict(
        path="/bulk-image-compressor/", lang="en", app=True, crumb="Bulk image compressor",
        title="Bulk Image Compressor: Batch PNG, JPEG & WebP — TinySquish",
        description="Compress up to 20 images at once, or a whole folder, in your browser. Same settings for every file, one ZIP download, and nothing is uploaded.",
        h1="Compress images in bulk, right in your browser",
        lead="Drop up to 20 images or a whole folder below. One set of settings applies to every file.",
        sections="""
<section aria-labelledby="bulk-how">
  <h2 id="bulk-how">Built for batches</h2>
  <ul class="facts">
    <li><strong>Folders included.</strong> Drop a folder and TinySquish finds the PNG, JPEG and WebP images inside it, including subfolders.</li>
    <li><strong>One setting, every file.</strong> Quality, format, max size and resize apply to the whole batch, and changing a setting recompresses everything automatically.</li>
    <li><strong>One ZIP.</strong> Download all results as a single ZIP. Files with the same name get numbered instead of overwriting each other.</li>
    <li><strong>No waiting for uploads.</strong> Everything happens on your device, so a batch of large photos is limited by your computer, not your connection.</li>
  </ul>
</section>""",
        faq=[
            ("How many images can I compress at once?",
             "Up to 20 images per batch. When you're done, clear the list and add the next 20; there is no daily limit."),
            ("Can I compress a whole folder?",
             "Yes. Use the Folder button or drop a folder onto the page. Supported images in subfolders are included too."),
            ("What happens to files with the same name?",
             "They are numbered in the ZIP, for example photo-compressed.png and photo-compressed (2).png, so nothing is overwritten when you extract it."),
        ],
    ),
    dict(
        path="/tinypng-alternative/", lang="en", app=True, crumb="TinyPNG alternative",
        title="TinyPNG Alternative That Never Uploads Your Images",
        description="TinySquish vs TinyPNG vs Squoosh: where your images are processed, offline use, batch limits and formats, compared side by side with sources.",
        h1="A TinyPNG alternative that keeps your images on your device",
        lead="Try it below, then see how it compares.",
        sections="""
<section aria-labelledby="cmp-table">
  <h2 id="cmp-table">TinySquish vs TinyPNG vs Squoosh</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col"></th><th scope="col">TinySquish</th><th scope="col">TinyPNG (free web)</th><th scope="col">Squoosh</th></tr></thead>
    <tbody>
      <tr><th scope="row">Where images are processed</th><td>In your browser</td><td>On TinyPNG's servers; files are kept for up to 48 hours</td><td>In your browser</td></tr>
      <tr><th scope="row">Works offline</th><td>Yes, after the first visit</td><td>No</td><td>Yes, after the first visit</td></tr>
      <tr><th scope="row">Images per batch</th><td>20</td><td>20, max 5 MB each</td><td>One at a time</td></tr>
      <tr><th scope="row">Output formats</th><td>JPEG, PNG, WebP</td><td>JPEG, PNG, WebP, AVIF, JPEG XL, APNG (3 free conversions)</td><td>Many, including AVIF and JPEG XL</td></tr>
      <tr><th scope="row">Target file size</th><td>Yes (50 KB – 2 MB)</td><td>—</td><td>—</td></tr>
      <tr><th scope="row">Source code</th><td>Open source (MIT)</td><td>Closed source</td><td>Open source (Apache-2.0)</td></tr>
    </tbody>
  </table>
  </div>
  <p class="table-note">Sources: <a href="https://tinypng.com/" rel="noopener">tinypng.com</a> (upload limits, 48-hour retention, formats) and the <a href="https://github.com/GoogleChromeLabs/squoosh" rel="noopener">Squoosh repository</a>, checked October 2026. “—” means we did not find the feature.</p>
</section>
<section aria-labelledby="cmp-when">
  <h2 id="cmp-when">Which one should you use?</h2>
  <ul class="facts">
    <li><strong>TinySquish</strong> when privacy matters, you work offline, or you need several images under a fixed size.</li>
    <li><strong>TinyPNG</strong> when you need AVIF, JPEG XL or animated PNG output and don't mind uploading files.</li>
    <li><strong>Squoosh</strong> when you want to fine-tune advanced codecs on a single image.</li>
  </ul>
</section>""",
        faq=[
            ("Is TinySquish as good as TinyPNG?",
             "Both reduce PNGs with palette quantization and JPEGs by re-encoding. The main differences are where the work happens and the formats: TinySquish runs on your device and works offline, while TinyPNG processes files on its servers and also offers AVIF, JPEG XL and animated PNG."),
            ("Does TinyPNG upload my images?",
             "Yes. TinyPNG compresses files on its servers and states that it keeps them for up to 48 hours before deleting them. TinySquish never uploads your images."),
            ("What about Squoosh?",
             "Squoosh also runs in the browser and offers many advanced codecs, but its web app works on one image at a time. TinySquish handles batches of up to 20 images, folders, ZIP downloads and target file sizes."),
        ],
    ),
    dict(
        path="/cli/", lang="en", app=False, crumb="CLI & MCP", kind="cli",
        title="TinySquish CLI & MCP Server: Image Compression for Agents",
        description="Compress, resize and convert images from the terminal, scripts and AI agents (MCP). Runs on your machine: no upload, no API key, no server.",
        h1="TinySquish for the terminal and AI agents",
        lead="A command-line tool, an MCP server and an agent skill. All of them run on your own machine.",
        sections=f"""
<section aria-labelledby="cli-install">
  <h2 id="cli-install">Install</h2>
  <p>You need Node.js 20 or newer. Run it without installing, or install it once to use it offline:</p>
<pre><code>npx -y tinysquish photo.jpg --max 100kb
npm install -g tinysquish</code></pre>
  <p>The package uses <a href="https://sharp.pixelplumbing.com/" rel="noopener">sharp</a> (libvips) and takes about 50 MB on disk. Source code: <a href="{GITHUB}" rel="noopener">GitHub</a>, MIT license.</p>
</section>
<section aria-labelledby="cli-use">
  <h2 id="cli-use">Command line</h2>
<pre><code># one photo under an upload limit
tinysquish photo.jpg --max 100kb -f jpeg

# a folder of images for a website, as WebP, into another folder
tinysquish ./images -f webp -o ./images-web

# lossless PNG, thumbnails, machine-readable output
tinysquish logo.png -q 95
tinysquish ./photos --width 400 -f webp -o ./thumbs
tinysquish ./screenshots --json</code></pre>
  <p>Inputs are never modified. Results are written as <code>name-compressed.ext</code> next to each input, or into <code>--out</code>. Folders are scanned recursively. Run <code>tinysquish --help</code> for every option.</p>
</section>
<section aria-labelledby="cli-mcp">
  <h2 id="cli-mcp">MCP server for AI agents</h2>
  <p>The MCP server gives assistants such as Claude, Cursor and other MCP clients two tools: <code>compress_images</code> (files or folders, with quality, format, max size and resize options) and <code>image_info</code>. It runs as a local stdio process and opens no network connections.</p>
  <p>Claude Code:</p>
<pre><code>claude mcp add tinysquish -- npx -y -p tinysquish tinysquish-mcp</code></pre>
  <p>Claude Desktop, Cursor and other clients (<code>mcpServers</code> in their JSON config):</p>
<pre><code>{{
  "mcpServers": {{
    "tinysquish": {{
      "command": "npx",
      "args": ["-y", "-p", "tinysquish", "tinysquish-mcp"]
    }}
  }}
}}</code></pre>
  <p>To limit which folders the agent can read and write, add <code>--allow</code> once per folder, for example <code>"args": ["-y", "-p", "tinysquish", "tinysquish-mcp", "--allow", "/home/me/Pictures"]</code>. Files that link outside those folders are refused too.</p>
</section>
<section aria-labelledby="cli-skill">
  <h2 id="cli-skill">Agent skill</h2>
  <p>The skill teaches an agent when to reach for TinySquish and how to read its results. For Claude Code, save it as <code>~/.claude/skills/tinysquish/SKILL.md</code>:</p>
<pre><code>mkdir -p ~/.claude/skills/tinysquish
curl -fsSL https://raw.githubusercontent.com/mnuradli1/tinysquish.com/main/skill/tinysquish/SKILL.md \
  -o ~/.claude/skills/tinysquish/SKILL.md</code></pre>
  <p>It is also included in the npm package under <code>skill/tinysquish/</code>.</p>
</section>
<section aria-labelledby="cli-local">
  <h2 id="cli-local">Runs on your machine</h2>
  <ul class="facts">
    <li><strong>No upload, no API key, no account.</strong> Images are read and written on the computer that runs the tool.</li>
    <li><strong>No server in the loop.</strong> Bots and pipelines can call it as often as they like; nothing is sent to tinysquish.com.</li>
    <li><strong>Same rules as the web app.</strong> Quality, lossless PNG from 90%, max size and “never larger than the original” behave the same way. The encoders are libvips instead of the browser's, so sizes are similar but not byte-identical.</li>
  </ul>
</section>""",
        faq=[
            ("Does the TinySquish CLI or MCP server upload my images?",
             "No. Both run as local programs on your computer and open no network connections. The only download is installing the package from npm."),
            ("Do I need an API key or an account?",
             "No. TinySquish is free and open source under the MIT license, with no keys, accounts or usage limits."),
            ("Is the output the same as on tinysquish.com?",
             "The rules are the same: quality settings, lossless PNG from 90%, max size and keeping the original when it can't be made smaller. The command-line version encodes with libvips instead of the browser, so file sizes are similar but not byte-identical."),
            ("Which AI tools can use the MCP server?",
             "Any client that supports local (stdio) MCP servers, including Claude Code, Claude Desktop and Cursor. Agents without MCP can call the command-line tool with --json instead."),
        ],
    ),
    dict(
        path="/benchmark/", lang="en", app=False, crumb="Benchmark", kind="benchmark",
        title="TinySquish Benchmark: File Size and Quality, Reproduced",
        description="Measured results for TinySquish on the 24-image Kodak photo suite and UI screenshots: size reduction and PSNR for PNG, JPEG, WebP and max-size modes.",
        h1="Benchmark: how much smaller, at what quality",
        lead=f"Measured on {BENCH['generated']} with the live app engine (commit {BENCH['commit']}, {BENCH['browser']}).",
        sections=None,  # built from bench/results.json below
        faq=[],
    ),
    dict(
        path="/about/", lang="en", app=False, crumb="About", kind="about",
        title="About TinySquish — Open-Source Image Compressor",
        description="Who builds TinySquish, how it works under the hood, and how to report a bug or request a feature. Free, open source under the MIT license.",
        h1="About TinySquish",
        lead=None,
        sections=f"""
<section aria-labelledby="about-who">
  <h2 id="about-who">Who makes it</h2>
  <p>TinySquish is built and maintained by <a href="{AUTHOR_GITHUB}" rel="me noopener">Nur Adli</a>. It started from a simple need: compress images quickly without handing them to someone else's server.</p>
</section>
<section aria-labelledby="about-how">
  <h2 id="about-how">How it works</h2>
  <p>Everything runs as plain JavaScript in your browser. JPEG and WebP are encoded with the browser's own encoders through the Canvas API. PNG uses <a href="https://github.com/photopea/UPNG.js" rel="noopener">UPNG.js</a> for color quantization and <a href="https://github.com/nodeca/pako" rel="noopener">pako</a> for DEFLATE compression. A service worker caches the app so it keeps working offline.</p>
</section>
<section aria-labelledby="about-limits">
  <h2 id="about-limits">Limitations</h2>
  <ul class="facts">
    <li><strong>Three formats.</strong> TinySquish reads and writes PNG, JPEG and WebP. It doesn't produce AVIF or JPEG XL, and animated images aren't supported.</li>
    <li><strong>20 images per batch.</strong> Clear the list to start the next batch; there is no daily limit.</li>
    <li><strong>Your device does the work.</strong> Very large images (tens of megapixels) need a lot of memory and may fail on older phones.</li>
    <li><strong>Metadata isn't copied.</strong> Re-encoded files drop EXIF data such as camera details and GPS location, which is usually what you want when sharing.</li>
  </ul>
</section>
<section aria-labelledby="about-oss">
  <h2 id="about-oss">Open source</h2>
  <p>The full source code, tests and the benchmark script are on <a href="{GITHUB}" rel="noopener">GitHub</a> under the MIT license. Third-party components keep their own licenses (pako: MIT and Zlib, UPNG.js: MIT, DM Sans font: SIL Open Font License).</p>
</section>
<section aria-labelledby="about-contact">
  <h2 id="about-contact">Contact</h2>
  <p>Found a bug or want a feature? Open an issue on <a href="{GITHUB}/issues" rel="noopener">GitHub Issues</a>.</p>
</section>""",
        faq=[],
    ),
    dict(
        path="/privacy/", lang="en", app=False, crumb="Privacy", kind="page",
        title="Privacy Policy — TinySquish Image Compressor",
        description="Your images never leave your device. Here is exactly what tinysquish.com does collect: an anonymous visit count and standard web server logs.",
        h1="Privacy",
        lead="Short version: your images never leave your device, and we don't use cookies or third-party analytics.",
        sections="""
<section aria-labelledby="pv-images">
  <h2 id="pv-images">Your images</h2>
  <p>Images are opened, compressed and saved entirely in your browser. They are never uploaded to tinysquish.com or anywhere else, and the app keeps working with no internet connection.</p>
</section>
<section aria-labelledby="pv-counter">
  <h2 id="pv-counter">The visit counter</h2>
  <p>When the compressor page loads, it sends one request to count the visit. To count each visitor once per day, the server stores a keyed hash (HMAC) of the date, your IP address and your browser's user agent; your IP address itself is never stored, and the previous day's hashes are deleted. The request also includes the host name of the site that linked to us (for example <em>www.google.com</em>, never the full address) and the path of the TinySquish page, which are only added up into daily totals.</p>
</section>
<section aria-labelledby="pv-logs">
  <h2 id="pv-logs">Web server logs</h2>
  <p>Like almost every website, our web server (nginx) writes a standard access log with your IP address, the requested page, the time, the referring page and your browser's user agent. These logs are used only for security and troubleshooting, are not shared, and are deleted automatically after 14 days.</p>
</section>
<section aria-labelledby="pv-none">
  <h2 id="pv-none">What we don't do</h2>
  <ul class="facts">
    <li>No cookies. The page only keeps a flag in your browser's session storage so the visit isn't counted twice.</li>
    <li>No third-party analytics, ads, trackers or fonts loaded from other servers.</li>
    <li>No accounts, so no personal data to store.</li>
  </ul>
</section>
<section aria-labelledby="pv-contact">
  <h2 id="pv-contact">Questions</h2>
  <p>Ask on <a href="https://github.com/mnuradli1/tinysquish.com/issues" rel="noopener">GitHub Issues</a>. This page was last updated on 9 October 2026.</p>
</section>""",
        faq=[],
    ),
    dict(
        path="/id/", lang="id", alt={"en": "/"}, app=True, kind="home",
        title="TinySquish — Kompres Foto PNG, JPEG & WebP Tanpa Upload",
        description="Kompres, ubah ukuran, dan konversi foto PNG, JPEG, dan WebP langsung di browser. Gratis, bisa offline, dan foto Anda tidak pernah diunggah.",
        h1="Kompres foto PNG, JPEG &amp; WebP di browser — tanpa diunggah",
        sections=HOW_ID + WHY_ID, faq=FAQ_HOME_ID,
    ),
    dict(
        path="/id/kompres-foto-100kb/", lang="id", alt={"en": "/compress-image-to-100kb/"}, app=True,
        crumb="Kompres foto ke 100 KB", preset_max_kb="100",
        title="Kompres Foto ke 100 KB (atau Ukuran Lain) — TinySquish",
        description="Kecilkan foto di bawah 100 KB, 200 KB, 500 KB, atau 1 MB untuk formulir online. Langsung di browser: tanpa upload, tanpa daftar, bisa offline.",
        h1="Kompres foto ke 100 KB atau ukuran lain",
        lead="Ukuran maks sudah diatur ke 100 KB. Taruh foto Anda di bawah, atau pilih batas lain di pengaturan.",
        sections=f"""
<section aria-labelledby="size-how">
  <h2 id="size-how">Cara kerja target ukuran</h2>
  <p>Banyak formulir online, misalnya pendaftaran kerja, beasiswa, atau layanan pemerintah, menolak foto di atas ukuran tertentu. Dengan Ukuran maks, TinySquish menyimpan foto pada kualitas di slider lalu mengecek hasilnya. Jika masih terlalu besar, ia mencari kualitas tertinggi yang masih muat. Hanya bila kualitas rendah pun masih terlalu besar, dimensi foto dikecilkan sedikit demi sedikit sampai muat.</p>
  <p>Pilihan batasnya 50 KB, 100 KB, 200 KB, 300 KB, 500 KB, 1 MB, dan 2 MB. Untuk foto, pilih format JPEG atau WebP: keduanya mencapai ukuran kecil dengan kualitas jauh lebih baik daripada PNG.</p>
</section>
<section aria-labelledby="size-numbers">
  <h2 id="size-numbers">Sudah diuji pada foto sungguhan</h2>
  <p>Dalam <a href="/benchmark/">benchmark</a> kami dengan batas 50 KB, ke-24 foto uji Kodak semuanya berukuran 50 KB atau kurang (terbesar: {kb(K['jpeg-max-50kb']['maxOutBytes'])}), dengan PSNR rata-rata {K['jpeg-max-50kb']['meanPsnr']:g} dB. {K['jpeg-max-50kb']['resized']} dari 24 foto perlu dimensi sedikit lebih kecil agar muat.</p>
</section>""",
        faq=[
            ("Bagaimana cara mengecilkan foto di bawah 100 KB?",
             "Tambahkan foto, biarkan Ukuran maks di 100 KB, dan pilih format JPEG. TinySquish mencari kualitas tertinggi yang muat di bawah 100 KB dan menampilkan ukuran akhirnya sebelum Anda mengunduh."),
            ("Apakah dimensi foto akan berubah?",
             "Hanya jika terpaksa. TinySquish menurunkan kualitas lebih dulu; lebar dan tinggi baru dikecilkan bila kualitas rendah pun masih melebihi batas. Daftar file menampilkan dimensi baru bila itu terjadi."),
            ("Bisakah memilih 200 KB, 500 KB, atau 1 MB?",
             "Bisa. Pilih batas mana pun dari 50 KB sampai 2 MB di pengaturan Ukuran maks. Semua foto dalam batch dikompres agar muat dalam batas itu."),
        ],
    ),
]

NAV = {
    "en": [
        ("Tools", [("/compress-png/", "Compress PNG"), ("/compress-jpeg/", "Compress JPEG"), ("/png-to-webp/", "PNG to WebP"),
                   ("/jpg-to-webp/", "JPG to WebP"), ("/compress-image-to-100kb/", "Compress to 100 KB"),
                   ("/bulk-image-compressor/", "Bulk compressor")]),
        ("TinySquish", [("/cli/", "CLI & MCP"), ("/benchmark/", "Benchmark"), ("/tinypng-alternative/", "TinyPNG alternative"), ("/about/", "About"),
                        ("/privacy/", "Privacy"), (GITHUB, "GitHub"), ("/id/", "Bahasa Indonesia")]),
    ],
    "id": [
        ("Alat", [("/id/", "Kompres foto"), ("/id/kompres-foto-100kb/", "Kompres foto ke 100 KB"),
                  ("/png-to-webp/", "PNG ke WebP (EN)"), ("/bulk-image-compressor/", "Kompres massal (EN)")]),
        ("TinySquish", [("/benchmark/", "Benchmark (EN)"), ("/about/", "Tentang (EN)"), ("/privacy/", "Privasi (EN)"),
                        (GITHUB, "GitHub"), ("/", "English")]),
    ],
}

UI = {
    "en": dict(home="/", loading="Loading compressor…", faq="Frequently asked questions", nojs="JavaScript is required to run the compressor.",
               footer="🐼 TinySquish · Works offline after your first visit · Open source (MIT)", crumb_home="TinySquish", og_locale="en_US"),
    "id": dict(home="/id/", loading="Memuat kompresor…", faq="Pertanyaan yang sering diajukan", nojs="JavaScript diperlukan untuk menjalankan kompresor.",
               footer="🐼 TinySquish · Bisa offline setelah kunjungan pertama · Open source (MIT)", crumb_home="TinySquish", og_locale="id_ID"),
}

# ---------------------------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------------------------


def esc(s):
    return html.escape(s, quote=True)


def text_of(h):
    """Plain text of an authored h1 (which may contain entities like &amp;)."""
    return html.unescape(h)


def benchmark_sections():
    sets = BENCH["sets"]
    rows = []
    for set_id in ("kodak", "ui"):
        body = []
        for r in (x for x in BENCH["results"] if x["set"] == set_id):
            psnr = "lossless" if r["lossless"] else f"{r['meanPsnr']:g} dB (min {r['minPsnr']:g})"
            extra = f" · {r['resized']} resized" if r["resized"] else ""
            body.append(f"<tr><th scope=\"row\">{esc(r['label'])}</th><td class=\"num\">{kb(r['totalIn'])} → {kb(r['totalOut'])}</td>"
                        f"<td class=\"num\">{pct(r['reductionPct'])}</td><td class=\"num\">{pct(r['medianReductionPct'])}</td><td class=\"num\">{psnr}{extra}</td></tr>")
        rows.append(f"""
<section aria-labelledby="bench-{set_id}">
  <h2 id="bench-{set_id}">{esc(sets[set_id]['label'])}</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Setting</th><th scope="col">Total size</th><th scope="col">Smaller by</th><th scope="col">Median per image</th><th scope="col">Mean PSNR</th></tr></thead>
    <tbody>{''.join(body)}</tbody>
  </table>
  </div>
</section>""")
    return f"""
<section aria-labelledby="bench-key">
  <h2 id="bench-key">Key results</h2>
  <ul class="facts">
    <li><strong>Photos:</strong> WebP at 75% made the Kodak photos {pct(K['webp-75']['reductionPct'])} smaller than the lossless PNG originals (mean PSNR {K['webp-75']['meanPsnr']:g} dB); JPEG at 75%: {pct(K['jpeg-75']['reductionPct'])} ({K['jpeg-75']['meanPsnr']:g} dB).</li>
    <li><strong>Screenshots:</strong> palette PNG at 75% saved {pct(U['png-75']['reductionPct'])} at {U['png-75']['meanPsnr']:g} dB, visually identical; JPEG saved only {pct(U['jpeg-75']['reductionPct'])} and blurred text.</li>
    <li><strong>Max size:</strong> with a 50 KB limit every photo fit (largest {kb(K['jpeg-max-50kb']['maxOutBytes'])}); {K['jpeg-max-50kb']['resized']} of 24 needed smaller dimensions.</li>
    <li><strong>Where it doesn't help:</strong> lossless PNG saved {pct(K['png-95']['reductionPct'])} on the photos, whose PNG files were already tightly compressed, so TinySquish kept the originals.</li>
  </ul>
</section>
{''.join(rows)}
<section aria-labelledby="bench-method">
  <h2 id="bench-method">Method</h2>
  <p>The benchmark drives the real app in headless Chromium, so it measures exactly the code visitors run. Each image is added through the file picker, compressed with the setting shown, and downloaded as a ZIP. Size reduction compares output bytes with the input PNG. PSNR (peak signal-to-noise ratio, higher is better; above about 40 dB differences are very hard to see) is computed over RGB after both files are decoded by the browser; outputs that were resized are scaled back up first, so the score includes the lost resolution.</p>
  <p>Photos: the 24 images of the <a href="https://r0k.us/graphics/kodak/" rel="noopener">Kodak Lossless True Color Image Suite</a>, a standard test set for image compression. Screenshots: four PNG screenshots of tinysquish.com rendered by the benchmark script. Raw per-image results: <a href="/bench/results.json">results.json</a>. Run it yourself with <code>tools/benchmark.js</code> from the <a href="{GITHUB}" rel="noopener">source repository</a>.</p>
</section>"""


def json_ld(page):
    url = SITE + page["path"]
    lang = page["lang"]
    graph = []
    faq = page.get("faq") or []
    if page.get("kind") == "home" and lang == "en":
        graph.append({"@type": "WebSite", "@id": SITE_ID, "url": SITE + "/", "name": "TinySquish", "inLanguage": "en"})
        graph.append({
            "@type": "WebApplication", "@id": APP_ID, "name": "TinySquish", "url": SITE + "/",
            "description": "Free, open-source image compressor that runs entirely in the browser. Compresses, resizes and converts PNG, JPEG and WebP images in batches of up to 20, can target a maximum file size, works offline, and never uploads images.",
            "applicationCategory": "MultimediaApplication", "operatingSystem": "Any (modern web browser)",
            "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "image": SITE + "/og-image.png", "author": {"@id": PERSON_ID},
            "license": "https://opensource.org/licenses/MIT", "codeRepository": GITHUB,
            "featureList": [
                "Compress PNG, JPEG and WebP images locally in the browser",
                "Convert between PNG, JPEG and WebP",
                "Lossless PNG at 90% quality and above",
                "Compress to a maximum file size from 50 KB to 2 MB",
                "Resize by percentage or exact dimensions",
                "Batch up to 20 images, including whole folders",
                "Before/after comparison slider",
                "Download as individual files or one ZIP",
                "Works offline after the first visit",
            ],
            "isPartOf": {"@id": SITE_ID},
        })
    else:
        page_type = {"about": "AboutPage"}.get(page.get("kind"), "WebPage")
        graph.append({"@type": page_type, "@id": url + "#webpage", "url": url, "name": text_of(page["title"]),
                      "description": page["description"], "inLanguage": lang,
                      "isPartOf": {"@id": SITE_ID}, "about": {"@id": APP_ID}})
        crumbs = [{"@type": "ListItem", "position": 1, "name": "TinySquish", "item": SITE + UI[lang]["home"]}]
        if page.get("crumb"):
            crumbs.append({"@type": "ListItem", "position": 2, "name": page["crumb"], "item": url})
            graph.append({"@type": "BreadcrumbList", "itemListElement": crumbs})
    if page.get("kind") == "cli":
        graph.append({
            "@type": "SoftwareApplication", "@id": url + "#software", "name": "TinySquish CLI and MCP server",
            "applicationCategory": "DeveloperApplication", "operatingSystem": "Windows, macOS, Linux (Node.js 20+)",
            "description": "Command-line tool and MCP server that compress, resize and convert PNG, JPEG and WebP images locally.",
            "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "license": "https://opensource.org/licenses/MIT", "codeRepository": GITHUB,
            "downloadUrl": "https://www.npmjs.com/package/tinysquish", "author": {"@id": PERSON_ID},
        })
    if page.get("kind") == "about":
        graph.append({"@type": "Person", "@id": PERSON_ID, "name": "Nur Adli", "url": AUTHOR_GITHUB, "sameAs": [AUTHOR_GITHUB]})
    if page.get("kind") == "benchmark":
        graph.append({
            "@type": "Dataset", "name": "TinySquish compression benchmark",
            "description": "File size and PSNR for TinySquish compression settings on the Kodak photo suite and UI screenshots.",
            "url": url, "creator": {"@id": PERSON_ID}, "license": "https://opensource.org/licenses/MIT",
            "dateModified": BENCH["generated"], "isAccessibleForFree": True,
            "measurementTechnique": "Headless Chromium driving the live app; PSNR over RGB after browser decoding",
            "variableMeasured": ["File size reduction (%)", "PSNR (dB)"],
            "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE + "/bench/results.json"},
        })
    if faq:
        graph.append({"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


def render(page, error_page=False):
    lang = page["lang"]
    ui = UI[lang]
    url = SITE + page["path"]
    title = page["title"]
    alts = page.get("alt") or {}
    head_alt = ""
    if alts:
        pairs = {lang: page["path"], **alts}
        head_alt = "".join(f'\n<link rel="alternate" hreflang="{l}" href="{SITE}{p}">' for l, p in sorted(pairs.items()))
        head_alt += f'\n<link rel="alternate" hreflang="x-default" href="{SITE}{pairs.get("en", page["path"])}">'
    robots = "noindex" if error_page else "index, follow, max-image-preview:large"
    verify = f'\n<meta name="msvalidate.01" content="{BING_VERIFY}">' if page["path"] == "/" else ""
    body_attrs = ""
    if page.get("preset_format"):
        body_attrs += f' data-preset-format="{page["preset_format"]}"'
    if page.get("preset_max_kb"):
        body_attrs += f' data-preset-max-kb="{page["preset_max_kb"]}"'

    crumb = ""
    if page.get("crumb"):
        crumb = (f'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="{ui["home"]}">{ui["crumb_home"]}</a>'
                 f'<span aria-hidden="true"> › </span><span aria-current="page">{esc(page["crumb"])}</span></nav>')
    lead = f'\n  <p class="page-lead">{page["lead"]}</p>' if page.get("lead") else ""
    app = f"""
  <!-- The app itself is injected here by loader.js -->
  <div id="app-root">
    <div class="loading-screen" id="loadingScreen">
      <div class="loading-logo" aria-hidden="true">🐼</div>
      <p class="loading-title">{ui["loading"]}</p>
      <div class="loading-bar"><div class="loading-bar-fill"></div></div>
    </div>
  </div>
""" if page.get("app") else ""
    sections = benchmark_sections() if page.get("kind") == "benchmark" else (page.get("sections") or "")
    faq_html = ""
    if page.get("faq"):
        items = "".join(f"""
        <details>
          <summary>{esc(q)}</summary>
          <p>{esc(a)}</p>
        </details>""" for q, a in page["faq"])
        faq_html = f"""
    <section aria-labelledby="faq-title">
      <h2 id="faq-title">{ui["faq"]}</h2>
      <div class="faq">{items}
      </div>
    </section>"""
    nav = "".join(
        f'<div class="footer-col"><p class="footer-heading">{esc(heading)}</p><ul>'
        + "".join(f'<li><a href="{href}"{" hreflang=\"id\" lang=\"id\"" if href == "/id/" else ""}>{esc(label)}</a></li>' for href, label in links)
        + "</ul></div>" for heading, links in NAV[lang])
    ld = "" if error_page else f'\n<script type="application/ld+json">\n{json_ld(page)}\n</script>'
    canonical = "" if error_page else f'\n<link rel="canonical" href="{url}">'

    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Generated by tools/build-site.py — edit the generator, not this file -->
<title>{esc(title)}</title>
<meta name="description" content="{esc(page['description'])}">
<meta name="robots" content="{robots}">{verify}{canonical}{head_alt}
<meta name="theme-color" content="#f6f5f1">

<meta property="og:type" content="website">
<meta property="og:site_name" content="TinySquish">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(page['description'])}">
<meta property="og:image" content="{SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="TinySquish: compress PNG, JPEG and WebP images in your browser, nothing is uploaded">
<meta property="og:locale" content="{ui['og_locale']}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(page['description'])}">
<meta name="twitter:image" content="{SITE}/og-image.png">

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">

<!-- Prevent caching so saved pages break -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">

<link rel="preload" href="/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">{ld}
</head>
<body{body_attrs}>

<header class="header">
  <a class="brand" href="{ui['home']}"><span class="brand-icon" aria-hidden="true">🐼</span><span class="brand-name">TinySquish</span></a>
  {crumb}<h1 class="brand-tagline">{page['h1']}</h1>{lead}
</header>

<main>{app}
  <div class="info">{sections}{faq_html}
  </div>
</main>

<footer class="footer">
  <nav class="footer-nav" aria-label="Site">{nav}</nav>
  <p>{ui['footer']}</p>
  <p class="visitor-count" id="visitorCount" hidden></p>
</footer>

<noscript>
  <p style="text-align:center;padding:1rem 2rem 3rem;color:#5a5a58;">{ui['nojs']}</p>
</noscript>

<script src="/loader.js"></script>

</body>
</html>
"""


def build():
    written = []
    for page in PAGES:
        out = ROOT / ("index.html" if page["path"] == "/" else page["path"].strip("/") + "/index.html")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render(page))
        written.append(out.relative_to(ROOT))

    not_found = dict(path="/404.html", lang="en", app=False, title="Page not found — TinySquish",
                     description="This page doesn't exist. Go back to the TinySquish image compressor.",
                     h1="This page doesn't exist", lead='Try the <a href="/">image compressor</a> or one of the pages below.')
    (ROOT / "404.html").write_text(render(not_found, error_page=True))
    written.append(Path("404.html"))

    # Sitemap with hreflang alternates for translated pairs
    urls = []
    for page in PAGES:
        alts = page.get("alt") or {}
        links = ""
        if alts:
            pairs = {page["lang"]: page["path"], **alts}
            links = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{SITE}{p}"/>' for l, p in sorted(pairs.items()))
        urls.append(f"  <url>\n    <loc>{SITE}{page['path']}</loc>\n    <lastmod>{LASTMOD}</lastmod>{links}\n  </url>")
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n")
    written.append(Path("sitemap.xml"))

    # llms.txt: compact facts plus the page map, for AI answer engines
    page_lines = "\n".join(f"- [{text_of(p['h1'])}]({SITE}{p['path']}): {p['description']}" for p in PAGES)
    (ROOT / "llms.txt").write_text(f"""# TinySquish

> TinySquish (https://tinysquish.com/) is a free, open-source (MIT) image compressor that runs entirely in the web browser. It compresses, resizes and converts PNG, JPEG and WebP images without uploading them, can target a maximum file size, and keeps working offline after the first visit.

Key facts:

- Privacy: images are processed locally with JavaScript (Canvas API, UPNG.js, pako) and never leave the user's device. The only request the site makes is an anonymous visit counter that never stores IP addresses.
- Formats: input PNG, JPEG and WebP; output keeps the original format or converts to PNG, JPEG or WebP. No AVIF or JPEG XL output.
- Quality: a 10–95% slider. JPEG and WebP are re-encoded at that quality. PNG is lossless at 90% and above, reduced to a 256-color palette from 65% to 89%, and to fewer colors below that.
- Max size: 50 KB, 100 KB, 200 KB, 300 KB, 500 KB, 1 MB or 2 MB. The highest quality that fits is chosen; dimensions shrink only when needed.
- If a result is larger than the original while keeping the original format, the original file is kept.
- Resize by percentage (10–200%) or exact width × height, aspect ratio locked by default.
- Batches of up to 20 images, including whole folders; results download individually or as one ZIP.
- Works offline after the first visit (service worker). Free, no account, no daily limit, no watermark.
- Benchmark ({BENCH['generated']}, Kodak 24-photo suite): WebP 75% was {pct(K['webp-75']['reductionPct'])} smaller than the PNG originals at {K['webp-75']['meanPsnr']:g} dB PSNR; palette PNG 75% saved {pct(U['png-75']['reductionPct'])} on UI screenshots at {U['png-75']['meanPsnr']:g} dB. Details: {SITE}/benchmark/
- Compared with TinyPNG: TinyPNG processes files on its servers (kept up to 48 hours; free limit 20 images, 5 MB each) and also outputs AVIF, JPEG XL and APNG. Squoosh also runs locally but handles one image at a time.
- Command line and AI agents: `npx -y tinysquish <files> --max 100kb --json` (npm package "tinysquish", Node.js 20+) and a local stdio MCP server (`tinysquish-mcp`, tools compress_images and image_info). Both run on the user's machine with no network calls. Details: {SITE}/cli/
- Made by Nur Adli. Source code: {GITHUB}

## Pages

{page_lines}

## Data

- [Benchmark results (JSON)]({SITE}/bench/results.json): per-image sizes and PSNR for every setting
""")
    written.append(Path("llms.txt"))
    return written


if __name__ == "__main__":
    for f in build():
        print(f)
