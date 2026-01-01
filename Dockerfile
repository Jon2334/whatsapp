# 1. Gunakan Base Image resmi Puppeteer
# (Ini sudah berisi Node.js + Google Chrome + Library yang dibutuhkan)
FROM ghcr.io/puppeteer/puppeteer:21.5.0

# 2. Switch ke user ROOT sebentar untuk install FFmpeg
USER root

# 3. Install FFmpeg (Wajib untuk fitur Stiker & Media)
RUN apt-get update && apt-get install -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 4. Set Environment Variables
# Agar Puppeteer tau lokasi Chrome dan tidak mendownload ulang
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 5. Setup Direktori Kerja
WORKDIR /usr/src/app

# 6. Copy file package.json dulu (agar cache layer bekerja)
COPY package*.json ./

# 7. Install dependensi bot
RUN npm ci

# 8. Copy seluruh sisa file project
COPY . .

# 9. PERBAIKAN IZIN FOLDER (PENTING!)
# Kita buat folder session dan ubah pemiliknya ke user 'pptruser'
# Agar bot bisa menyimpan login QR Code tanpa error permission
RUN mkdir -p .wwebjs_auth .wwebjs_cache && \
    chown -R pptruser:pptruser /usr/src/app

# 10. Kembalikan user ke 'pptruser' (User aman bawaan image)
USER pptruser

# 11. Buka Port (Render butuh ini)
EXPOSE 3000

# 12. Perintah menjalan bot
CMD [ "node", "index.js" ]