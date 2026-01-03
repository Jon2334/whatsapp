const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const qrcode = require('qrcode-terminal'); // Tetap dipasang untuk fallback
require('dotenv').config();

// ==============================================
// ⚙️ KONFIGURASI ENV (JANGAN UBAH DISINI, UBAH DI HEROKU)
// ==============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const MONGODB_URI = process.env.MONGODB_URI; // Wajib isi Connection String MongoDB
const NOMOR_BOT_PAIRING = process.env.NOMOR_BOT; // Contoh: 62895xxxx (Tanpa +)
const NOMOR_OWNER = '6289509158681'; 
const NAMA_BOT = 'JONKRIS BOT';      
const NAMA_OWNER = 'Jon Kris'; 
const LINK_DONASI = 'https://saweria.co/jonkris'; 
const PORT = process.env.PORT || 3000;

const HEADER_IMAGE_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000&auto=format&fit=crop';

const REACTION_LIST = ['🔥', '✨', '😂', '🤣', '❤️', '😎', '🤯', '😱', '🥳', '😡', '😭', '🥺', '👍', '👎', '🚀', '⭐', '✅', '❌', '⚠️'];

// ==============================================
// 🔌 KONEKSI DATABASE & INISIALISASI
// ==============================================
const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const mediaCache = new Map();

// Konek ke MongoDB dulu, baru jalanin Bot
console.log("⏳ Menghubungkan ke MongoDB...");
mongoose.connect(MONGODB_URI).then(() => {
    console.log("✅ Terhubung ke MongoDB.");
    const store = new MongoStore({ mongoose: mongoose });
    runBot(store);
}).catch(err => {
    console.error("❌ Gagal konek MongoDB:", err);
});

function runBot(store) {
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // Backup sesi tiap 5 menit
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // --- LOGIKA PAIRING CODE (LOGIN TANPA SCAN) ---
    // Jika ada NOMOR_BOT di environment, kita minta Pairing Code
    if (NOMOR_BOT_PAIRING) {
        console.log(`⚙️ Mode Pairing Code Aktif untuk: ${NOMOR_BOT_PAIRING}`);
        
        // Timer tunggu sebentar sampai client siap request
        setTimeout(async () => {
            if (!client.info) { // Cek jika belum login
                try {
                    // Request Kode
                    const code = await client.requestPairingCode(NOMOR_BOT_PAIRING);
                    console.log(`\n================================`);
                    console.log(`🔗 KODE PAIRING ANDA: ${code}`);
                    console.log(`   Masukan kode ini di WA: Perangkat Tertaut > Tautkan dengan No. HP`);
                    console.log(`================================\n`);
                } catch (e) {
                    // Biasanya error kalau sudah login, abaikan saja
                }
            }
        }, 10000); // Delay 10 detik setelah start
    } 
    
    // Tetap tampilkan QR jika pairing code gagal/tidak diset
    client.on('qr', (qr) => {
        if (!NOMOR_BOT_PAIRING) {
            console.log('📱 SCAN QR CODE:');
            qrcode.generate(qr, { small: true });
        }
    });

    client.on('ready', () => {
        console.clear();
        console.log(`✅ ${NAMA_BOT} BERHASIL LOGIN & ONLINE!`);
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sesi tersimpan di Database.');
    });

    // ==============================================
    // 📨 LOGIKA PESAN (Your Original Logic)
    // ==============================================
    client.on('message_create', async msg => {
        try {
            if (msg.from === 'status@broadcast') return;
            if (msg.fromMe) return;

            // Auto Reaction (Random)
            if (Math.random() > 0.7) {
                const randEmoji = REACTION_LIST[Math.floor(Math.random() * REACTION_LIST.length)];
                await msg.react(randEmoji).catch(() => {});
            }

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // 1. MENU
            if (command === '.menu' || command === '.help') {
                const waktu = getWaktuIndonesia();
                const caption = `
╭━━━〔 🤖 ${NAMA_BOT} 〕━━━╮
┃ 👤 Owner: ${NAMA_OWNER}
┃ 🚀 Status: Online 24 Jam
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 ${waktu.sapaan}, *${msg._data.notifyName}*!

🔥 *FITUR TERSEDIA:*
✅ *.sticker* (Reply Gambar)
✅ *.meme Atas|Bawah* (Buat Meme)
✅ *.hidetag* (Tag Grup)
✅ *.ai* <pertanyaan> (Tanya Bot)
✅ *.donasi*
`;
                try {
                    const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: caption });
                } catch (e) { msg.reply(caption); }
            }

            // 2. STICKER
            else if (command === '.sticker' || command === '.s') {
                let media = msg.hasMedia ? await msg.downloadMedia() : (msg.hasQuotedMsg ? await (await msg.getQuotedMessage()).downloadMedia() : null);
                if (media) {
                    await client.sendMessage(msg.from, media, { sendMediaAsSticker: true, stickerName: NAMA_BOT, stickerAuthor: NAMA_OWNER });
                } else { msg.reply('❌ Kirim/Reply gambar dengan caption *.sticker*'); }
            }

            // 3. AI / TANYA
            else if (command === '.ai' || command === '.tanya') {
                if(!args) return msg.reply("❌ Mau tanya apa? Contoh: .ai Resep nasi goreng");
                const jawab = await tanyaAI(args);
                msg.reply(jawab);
            }
            
            // 4. MEME (Fitur Jimp)
            else if (command === '.meme') {
                let media = msg.hasMedia ? await msg.downloadMedia() : (msg.hasQuotedMsg ? await (await msg.getQuotedMessage()).downloadMedia() : null);
                if (media && args.includes('|')) {
                    try {
                        const image = await Jimp.read(Buffer.from(media.data, 'base64'));
                        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
                        image.resize(800, Jimp.AUTO);
                        let [top, bottom] = args.split('|');
                        if(top) image.print(font, 0, 10, { text: top.trim().toUpperCase(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 800);
                        if(bottom) image.print(font, 0, image.bitmap.height - 80, { text: bottom.trim().toUpperCase(), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 800);
                        const buff = await image.getBufferAsync(Jimp.MIME_JPEG);
                        await client.sendMessage(msg.from, new MessageMedia('image/jpeg', buff.toString('base64')), { sendMediaAsSticker: true });
                    } catch (e) { msg.reply('❌ Gagal edit.'); }
                } else msg.reply('❌ Format: .meme Atas|Bawah');
            }

            // 5. HIDETAG
            else if (command === '.hidetag') {
                const chat = await msg.getChat();
                if (chat.isGroup) {
                    let mentions = await chat.participants.map(p => p.id._serialized);
                    await chat.sendMessage(args || "Halo semua!", { mentions });
                }
            }

            // Chat AI Otomatis (Jika dimention atau PC)
            else {
                const isGroup = msg.from.includes('@g.us');
                if ((!isGroup || (isGroup && msg.mentionedIds.includes(client.info.wid._serialized))) && body.length > 2) {
                    const prompt = body.replace('.','').replace(`@${client.info.wid.user}`, '').trim();
                    const jawaban = await tanyaAI(prompt);
                    await msg.reply(jawaban);
                }
            }

        } catch (err) { console.log(err); }
    });

    client.initialize();
}

// --- FUNGSI AI ---
async function tanyaAI(pertanyaan) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Kamu adalah ${NAMA_BOT}. Jawab singkat, gaul, & seru.` },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
        });
        return chatCompletion.choices[0]?.message?.content || "Lagi error nih bos.";
    } catch (error) { return "Limit AI Habis / Error API."; }
}

// --- FUNGSI WAKTU ---
function getWaktuIndonesia() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const jam = now.getHours();
    let sapaan = 'Selamat Malam 🌙';
    if (jam >= 4 && jam < 11) sapaan = 'Selamat Pagi 🌅';
    else if (jam >= 11 && jam < 15) sapaan = 'Selamat Siang ☀️';
    else if (jam >= 15 && jam < 18) sapaan = 'Selamat Sore 🌇';
    return { sapaan, jam: `${jam}:${now.getMinutes()}`, tanggalLengkap: now.toDateString() };
}

// ==============================================
// 🌐 SERVER DASHBOARD (Keep Alive)
// ==============================================
app.get('/', (req, res) => res.send(`BOT ONLINE. ${getWaktuIndonesia().jam}`));
app.listen(PORT, () => console.log(`🚀 Server Dashboard running on port ${PORT}`));