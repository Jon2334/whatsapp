const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// ==============================================
// ⚙️ KONFIGURASI ENV (SETTING DI HEROKU)
// ==============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const MONGODB_URI = process.env.MONGODB_URI; // Wajib diisi Connection String MongoDB
const NOMOR_OWNER = '6289509158681'; 
const NOMOR_BOT_PAIRING = process.env.NOMOR_BOT; // Isi nomor bot (tanpa +) jika ingin login via Kode
const NAMA_BOT = 'JONKRIS BOT';      
const NAMA_OWNER = 'Jon Kris'; 
const LINK_DONASI = 'https://saweria.co/jonkris'; 
const PORT = process.env.PORT || 3000;

const HEADER_IMAGE_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000&auto=format&fit=crop';

const REACTION_LIST = ['🔥', '✨', '😂', '🤣', '❤️', '😎', '🤯', '😱', '🥳', '😡', '😭', '🥺', '👍', '👎', '🚀', '⭐', '✅', '❌', '⚠️'];

// ==============================================
// 🔌 INISIALISASI DATABASE & SERVER
// ==============================================
const app = express();
const groq = new Groq({ apiKey: GROQ_API_KEY });
const mediaCache = new Map();

// Konek MongoDB dulu sebelum jalanin Bot
console.log("⏳ Menghubungkan ke MongoDB...");
mongoose.connect(MONGODB_URI).then(() => {
    console.log("✅ Terhubung ke MongoDB.");
    const store = new MongoStore({ mongoose: mongoose });
    startBot(store);
}).catch(err => console.error("❌ Gagal Konek MongoDB:", err));

// ==============================================
// 🤖 LOGIKA BOT
// ==============================================
function startBot(store) {
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // Backup sesi tiap 5 menit
        }),
       puppeteer: {
            // JANGAN TULIS MANUAL '/app/.apt/...'. Gunakan Variable ini:
            executablePath: process.env.GOOGLE_CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', 
                '--disable-gpu'
            ]
        }
    });

    // --- PAIRING CODE (LOGIN TANPA SCAN) ---
    if (NOMOR_BOT_PAIRING) {
        console.log(`⚙️ Mode Pairing Code untuk: ${NOMOR_BOT_PAIRING}`);
        setTimeout(async () => {
            if (!client.info) {
                try {
                    const code = await client.requestPairingCode(NOMOR_BOT_PAIRING);
                    console.log(`\n================================`);
                    console.log(`🔗 KODE PAIRING ANDA: ${code}`);
                    console.log(`================================\n`);
                } catch (e) {}
            }
        }, 8000);
    } 

    // Fallback QR Code
    client.on('qr', (qr) => {
        if (!NOMOR_BOT_PAIRING) {
            console.log('📱 SCAN QR CODE:');
            qrcode.generate(qr, { small: true });
        }
    });

    client.on('ready', () => {
        console.clear();
        console.log(`✅ ${NAMA_BOT} SUDAH ONLINE 24 JAM!`);
    });

    client.on('remote_session_saved', () => console.log('💾 Sesi tersimpan di Database.'));

    // ==============================================
    // 👋 WELCOME & LEAVE
    // ==============================================
    client.on('group_join', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const prompt = `Buatkan ucapan selamat datang singkat, lucu, gaul untuk member baru bernama ${contact.pushname || "Member"} di grup ${chat.name}.`;
            const pesanAI = await tanyaAI(prompt);
            
            const welcomeMsg = `╔═══════════════════╗\n   🎉 *WELCOME PLAYER!*\n╚═══════════════════╝\nHalo Kak @${contact.id.user} 👋\nSelamat bergabung di *${chat.name}*!\n\n"${pesanAI}"\n\n_Jangan lupa baca deskripsi grup ya!_`;
            
            await chat.sendMessage(welcomeMsg, { mentions: [contact] });
        } catch (err) { console.log('Welcome Error:', err.message); }
    });

    client.on('group_leave', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            await chat.sendMessage(`👋 Yah, Kak @${contact.id.user} keluar... Good bye!`, { mentions: [contact] });
        } catch (e) {}
    });

    // ==============================================
    // 📨 MESSAGE HANDLER
    // ==============================================
    client.on('message_create', async msg => {
        try {
            if (msg.from === 'status@broadcast') return;
            if (msg.fromMe) return;

            // Auto Reaction
            if (Math.random() > 0.8) {
                const randomEmoji = REACTION_LIST[Math.floor(Math.random() * REACTION_LIST.length)];
                await msg.react(randomEmoji).catch(()=>{});
            }

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // 1. MENU (DENGAN MOTIVASI & WAKTU)
            if (command === '.menu' || command === '.help') {
                // Ambil Motivasi dari AI (Sesuai Permintaan)
                const motivasi = await tanyaAI("Buatkan 1 kalimat motivasi singkat tapi nendang untuk programmer/gamer.");
                const waktu = getWaktuIndonesia(); 
                
                const captionMenu = `
╭━━━〔 🤖 ${NAMA_BOT} 〕━━━╮
┃ 👤 Owner: ${NAMA_OWNER}
┃ 🚀 Status: Online 24 Jam
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 ${waktu.sapaan}, *${msg._data.notifyName}*!
📅 *${waktu.tanggalLengkap}*
⏰ *${waktu.jam}*

❝ _${motivasi}_ ❞

╭───『 🔥 FITUR UTAMA 』───
│ 🛠️ *.sticker* (Reply Gambar)
│ 🤣 *.meme TeksAtas|TeksBawah*
│ 📢 *.hidetag* (Tag All Hidden)
│ 💬 *.ai* <pertanyaan> (Tanya AI)
╰──────────────────────
`;
                try {
                    const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: captionMenu });
                } catch (e) { await msg.reply(captionMenu); }
            }

            // 2. STICKER
            else if (command === '.sticker' || command === '.s') {
                let media = msg.hasMedia ? await msg.downloadMedia() : (msg.hasQuotedMsg ? await (await msg.getQuotedMessage()).downloadMedia() : null);
                if (media) {
                    await client.sendMessage(msg.from, media, { sendMediaAsSticker: true, stickerName: NAMA_BOT, stickerAuthor: NAMA_OWNER });
                } else { msg.reply('❌ Kirim/Reply gambar dengan caption *.sticker*'); }
            }

            // 3. AI CHAT MANUAL
            else if (command === '.ai' || command === '.tanya') {
                if(!args) return msg.reply("Mau tanya apa bos?");
                const jawab = await tanyaAI(args);
                msg.reply(jawab);
            }

            // 4. MEME
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
                    await chat.sendMessage(args || "📢 *PENGUMUMAN!*", { mentions });
                }
            }

            // 6. DONASI
            else if (command === '.donasi') {
                msg.reply(`☕ *TRAKTEER DONG*\n🔗 ${LINK_DONASI}`);
            }

            // AI OTOMATIS (JIKA DIMENTION / PC)
            else {
                const isGroup = msg.from.includes('@g.us');
                if ((!isGroup || (isGroup && msg.mentionedIds.includes(client.info.wid._serialized))) && body.length > 2) {
                    const prompt = body.replace('.','').replace(`@${client.info.wid.user}`, '').trim();
                    const jawaban = await tanyaAI(prompt);
                    await msg.reply(jawaban);
                }
            }

        } catch (err) { console.log('Error:', err.message); }
    });

    // ANTI-DELETE
    client.on('message_revoke_everyone', async (after, before) => {
        if (before && !before.fromMe) {
            let media = mediaCache.get(before.id.id);
            const contact = await before.getContact();
            const caption = `👮 *ANTI-DELETE*\n👤 @${contact.id.user}\n📝 ${before.body}`;
            if (media) await client.sendMessage(before.from, media, { caption: caption, mentions: [contact] });
            else client.sendMessage(before.from, caption, { mentions: [contact] });
        }
    });

    client.initialize();
}

// --- FUNGSI PENDUKUNG ---
async function tanyaAI(pertanyaan) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Kamu adalah ${NAMA_BOT}, asisten ${NAMA_OWNER}. Jawab singkat, gaul, & seru.` },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
        });
        return chatCompletion.choices[0]?.message?.content || "Loading...";
    } catch (error) { return "Limit AI Habis / Error."; }
}

function getWaktuIndonesia() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulanArr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const jam = now.getHours();
    let sapaan = 'Selamat Malam 🌙';
    if (jam >= 4 && jam < 11) sapaan = 'Selamat Pagi 🌅';
    else if (jam >= 11 && jam < 15) sapaan = 'Selamat Siang ☀️';
    else if (jam >= 15 && jam < 18) sapaan = 'Selamat Sore 🌇';
    return {
        sapaan: sapaan,
        tanggalLengkap: `${hariArr[now.getDay()]}, ${now.getDate()} ${bulanArr[now.getMonth()]} ${now.getFullYear()}`,
        jam: `${String(jam).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`
    };
}

// SERVER DASHBOARD (Agar Heroku tidak mati)
app.get('/', (req, res) => {
    const waktu = getWaktuIndonesia();
    res.send(`BOT ONLINE 24 JAM. ${waktu.jam}`);
});
app.listen(PORT, () => console.log(`🚀 Server running on Port ${PORT}`));