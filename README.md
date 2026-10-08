# 🐼 TinySquish — VPS Version

Smart image compression yang berjalan 100% di browser pengunjung. VPS kamu hanya serve file statis — zero CPU/memory usage untuk kompresi.

---

## Fitur

- **Kompresi gambar** — PNG (lossless di kualitas ≥90%, di bawahnya quantization + Floyd-Steinberg dithering), JPEG, WebP
- **Drag & drop** — Seret file atau seluruh folder langsung ke halaman
- **Upload folder** — Pilih folder dan otomatis scan semua gambar di dalamnya (termasuk subfolder)
- **Konversi format** — PNG ↔ JPEG ↔ WebP
- **Before/after slider** — Bandingkan kualitas original vs compressed secara visual
- **Quality control** — Slider 10%–95% untuk atur level kompresi
- **Batch download ZIP** — Download semua hasil kompresi dalam satu file ZIP
- **100% client-side** — Tidak ada data yang dikirim ke server

---

## Struktur File

```
vps-version/
├── index.html    # Shell kosong (loading screen only)
├── style.css     # Styling + anti-copy CSS
├── loader.js     # Protection layer (dimuat pertama)
├── app.js        # Core compression engine (di-inject dinamis)
└── sw.js         # Service Worker (cache control)
```

---

## Proteksi Anti-Save

| Layer | Deskripsi |
|-------|-----------|
| Dynamic Injection | `index.html` hanya shell kosong — app di-inject via JS. "Save Page As" hanya dapat halaman loading. |
| Anti-Local File | App menolak jalan jika dibuka via `file://` protocol |
| Anti-Right Click | Context menu diblokir |
| Anti-Keyboard | Ctrl+S, Ctrl+U, Ctrl+P, Ctrl+Shift+I, F12 diblokir |
| Anti-DevTools | Detect DevTools → sembunyikan app, tampilkan warning |
| Anti-Copy | Text selection dimatikan |
| Anti-Drag | Gambar tidak bisa di-drag keluar halaman |
| Anti-Print | Konten dihapus saat print dipanggil |
| Anti-Cache | No-cache headers via meta tags & Service Worker |
| Watermark | Branding permanent di halaman |

> **Catatan:** Tidak ada proteksi yang 100% bulletproof. Kombinasi di atas cukup untuk mencegah ~95% pengguna awam menyimpan halaman.

---

## Deploy ke VPS

### Nginx

```nginx
server {
    listen 80;
    server_name tinysquish.example.com;
    root /var/www/tinysquish;
    index index.html;

    # Cache control headers
    location ~* \.(js|css)$ {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        add_header X-Content-Type-Options "nosniff";
    }

    # Service Worker scope
    location /sw.js {
        add_header Service-Worker-Allowed "/";
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "DENY";
        add_header X-Content-Type-Options "nosniff";
        add_header Cache-Control "no-store";
    }
}
```

### Apache

```apache
<VirtualHost *:80>
    ServerName tinysquish.example.com
    DocumentRoot /var/www/tinysquish

    <Directory /var/www/tinysquish>
        AllowOverride All
    </Directory>

    <FilesMatch "\.(js|css|html)$">
        Header set Cache-Control "no-store, no-cache, must-revalidate"
        Header set X-Content-Type-Options "nosniff"
    </FilesMatch>

    <Files "sw.js">
        Header set Service-Worker-Allowed "/"
    </Files>

    Header set X-Frame-Options "DENY"
</VirtualHost>
```

### Langkah Deploy

```bash
# 1. Upload file ke VPS
scp -r vps-version/* user@your-vps:/var/www/tinysquish/

# 2. Set permission
ssh user@your-vps "chmod -R 755 /var/www/tinysquish"

# 3. Restart web server
ssh user@your-vps "sudo systemctl restart nginx"
```

---

## HTTPS (Recommended)

Sangat disarankan pakai HTTPS agar Service Worker berfungsi penuh:

```bash
# Install Certbot (Ubuntu/Debian)
sudo apt install certbot python3-certbot-nginx

# Generate SSL
sudo certbot --nginx -d tinysquish.example.com
```

---

## Resource Usage

| Resource | Usage |
|----------|-------|
| VPS CPU | ~0% (hanya serve static files) |
| VPS RAM | Minimal (web server saja) |
| VPS Bandwidth | ~50KB per visitor (load awal) |
| Kompresi | 100% di browser pengunjung |
| Storage VPS | ~50KB (5 file statis) |

---

## Browser Support

- Chrome 66+
- Firefox 57+
- Safari 12+
- Edge 79+

---

## Limitasi

- Maksimal 20 gambar per sesi
- Format: PNG, JPEG, WebP
- Kompresi PNG menggunakan quantization (bukan pngquant native, tapi hasil cukup baik)
- Kualitas kompresi bergantung pada kemampuan Canvas API browser
