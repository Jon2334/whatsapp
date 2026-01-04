const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const https = require('https'); // ✅ Tambahan untuk fitur Anti-Tidur

// ==============================================
// ⚙️ KONFIGURASI ENV (WAJIB DIISI DI HEROKU)
// ==============================================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; 
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const PAIRING_NUMBER = process.env.PAIRING_NUMBER;
// ✅ Masukkan URL aplikasi Heroku kamu di Config Vars (Contoh: https://nama-bot.herokuapp.com)
const APP_URL = process.env.APP_URL; 

const NOMOR_OWNER = '6289509158681'; 
const NAMA_BOT = 'JONKRIS BOT';      
const NAMA_OWNER = 'Jon Kris'; 
const LINK_DONASI = 'https://saweria.co/jonkris'; 

const HEADER_IMAGE_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000&auto=format&fit=crop';

// ==============================================
// 🔥 INIT SERVER & DATABASE
// ==============================================
const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const mediaCache = new Map();

// Koneksi ke MongoDB
mongoose.connect(MONGO_URI).then(() => {
    console.log('✅ Terkoneksi ke MongoDB');
    const store = new MongoStore({ mongoose: mongoose });
    startBot(store);
}).catch(err => console.error('❌ Gagal konek MongoDB:', err));

// ==============================================
// 🤖 LOGIKA BOT UTAMA
// ==============================================
function startBot(store) {
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 60000 
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

    // --- PAIRING CODE & QR ---
    client.on('qr', async (qr) => {
        if (PAIRING_NUMBER) {
            console.log('⏳ Meminta Kode Pairing untuk:', PAIRING_NUMBER);
            try {
                setTimeout(async () => {
                    const code = await client.requestPairingCode(PAIRING_NUMBER);
                    console.log(`\n============================\n📟 KODE PAIRING ANDA: ${code}\n============================\n`);
                }, 3000);
            } catch (e) {
                console.error('Gagal request pairing code:', e);
            }
        } else {
            console.log('📱 SCAN QR CODE SEKARANG:');
            qrcode.generate(qr, { small: true });
        }
    });

    client.on('ready', () => { 
        console.clear(); 
        console.log(`✅ ${NAMA_BOT} SUDAH ONLINE & TERSIMPAN DI DATABASE!`); 
    });
    
    client.on('remote_session_saved', () => {
        console.log('💾 Session tersimpan di MongoDB.');
    });

    // --- WELCOME & LEAVE ---
    client.on('group_join', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const pesanAI = await tanyaAI(`Buatkan ucapan selamat datang singkat lucu untuk ${contact.pushname || "Member"} di grup ${chat.name}.`);
            
            const welcomeMsg = `👋 *WELCOME*\nHalo @${contact.id.user}!\n\n"${pesanAI}"`;
            await chat.sendMessage(welcomeMsg, { mentions: [contact] });
        } catch (err) {}
    });

    client.on('group_leave', async (notification) => {
        try {
            const contact = await client.getContactById(notification.recipientIds[0]);
            await notification.getChat().then(chat => chat.sendMessage(`🍂 Bye @${contact.id.user}, semoga tenang di alam sana.`, { mentions: [contact] }));
        } catch (err) {}
    });

    // --- MESSAGE HANDLER ---
    client.on('message_create', async msg => {
        try {
            if (msg.from === 'status@broadcast') return;
            if (msg.fromMe) return;

            // Cache Media untuk Anti-Delete
            if (msg.hasMedia) {
                const media = await msg.downloadMedia().catch(() => null);
                if (media) {
                    mediaCache.set(msg.id.id, media);
                    if (mediaCache.size > 20) mediaCache.delete(mediaCache.keys().next().value);
                }
            }

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // 1. AI CHAT
            if (!body.startsWith('.') && !msg.from.includes('@g.us')) {
                await msg.react('🧠');
                const reply = await tanyaAI(body);
                await msg.reply(reply);
            } 
            else if (!body.startsWith('.') && msg.from.includes('@g.us') && msg.mentionedIds.includes(client.info.wid._serialized)) {
                const prompt = body.replace(`@${client.info.wid.user}`, '').trim();
                await msg.react('🤖');
                const reply = await tanyaAI(prompt);
                await msg.reply(reply);
            }

            // 2. MENU
            if (command === '.menu') {
                const info = `
🤖 *${NAMA_BOT} DASHBOARD*
📅 ${new Date().toLocaleDateString('id-ID')}

🔥 *Fitur Tersedia:*
• .sticker (Reply Gambar)
• .meme TeksAtas|TeksBawah
• .hidetag (Admin Group)
• .ping (Cek Server)
• Chat langsung = AI Mode
`;
                try {
                    const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: info });
                } catch { msg.reply(info); }
            }

            // 3. STICKER
            if (command === '.sticker' || command === '.s') {
                let media = msg.hasMedia ? await msg.downloadMedia() : (msg.hasQuotedMsg ? await (await msg.getQuotedMessage()).downloadMedia() : null);
                if (media) {
                    await client.sendMessage(msg.from, media, { sendMediaAsSticker: true, stickerName: NAMA_BOT, stickerAuthor: NAMA_OWNER });
                } else { msg.reply('❌ Kirim gambar dengan caption .sticker'); }
            }

            // 4. MEME
            if (command === '.meme') {
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
                    } catch (e) { msg.reply('❌ Gagal. Format: .meme Atas|Bawah'); }
                }
            }

            // 5. HIDETAG
            if (command === '.hidetag') {
                const chat = await msg.getChat();
                if (chat.isGroup) {
                    let text = args || "📢 PENGUMUMAN!";
                    let mentions = chat.participants.map(p => p.id._serialized);
                    await chat.sendMessage(text, { mentions });
                }
            }
             // 6. PING
            if (command === '.ping') {
               msg.reply('🏓 Pong! Server masih hidup.');
            }

        } catch (err) { console.error(err); }
    });

    // ANTI DELETE
    client.on('message_revoke_everyone', async (after, before) => {
        if (before && !before.fromMe && mediaCache.has(before.id.id)) {
            const media = mediaCache.get(before.id.id);
            const contact = await before.getContact();
            client.sendMessage(before.from, media, { caption: `👮 Hapus pesan ya @${contact.id.user}?`, mentions: [contact] });
        }
    });

    client.initialize();
}

// ==============================================
// 🧠 FUNGSI AI
// ==============================================
async function tanyaAI(pertanyaan) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Kamu adalah ${NAMA_BOT}. Jawab singkat, lucu, dan membantu.` },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
        });
        return chatCompletion.choices[0]?.message?.content || "Error AI.";
    } catch (error) { return "Limit AI habis/Error."; }
}

// ==============================================
// 🌐 SERVER DASHBOARD & ANTI-TIDUR
// ==============================================
app.get('/', (req, res) => {
    res.send(`<h1>${NAMA_BOT} is Online</h1><p>Running on Port ${PORT}</p>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Server Web di Port ${PORT}`);
    
    // 🔥 FITUR ANTI-TIDUR (KEEP ALIVE) 🔥
    if (APP_URL) {
        console.log(`⏰ Anti-Tidur diaktifkan untuk: ${APP_URL}`);
        setInterval(() => {
            https.get(APP_URL, (res) => {
                // Hanya log status code agar tidak nyepam console
                // console.log(`⏰ Ping Sukses: ${res.statusCode}`);
            }).on('error', (e) => {
                console.error(`⚠️ Ping Error: ${e.message}`);
            });
        }, 10 * 60 * 1000); // Ping setiap 10 Menit (600.000 ms)
    } else {
        console.log('⚠️ PERINGATAN: Variabel APP_URL belum diisi di Heroku. Fitur Anti-Tidur NONAKTIF.');
    }
});