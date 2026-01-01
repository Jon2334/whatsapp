const { Client, RemoteAuth, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const mongoose = require('mongoose'); // Library Database
const { MongoStore } = require('wwebjs-mongo'); // Library Penyimpan Sesi

// ==============================================
// ⚙️ KONFIGURASI UTAMA
// ==============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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'; 
// Masukkan URL MongoDB dari Atlas di Config Vars Heroku dengan nama key: MONGO_URI
const MONGO_URI = process.env.MONGO_URI; 

const NOMOR_OWNER = '6289509158681'; 
const NAMA_BOT = 'JONKRIS BOT';      
const NAMA_OWNER = 'Jon Kris'; 
const LINK_DONASI = 'https://saweria.co/jonkris'; 
const PORT = process.env.PORT || 3000;

const HEADER_IMAGE_URL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1000&auto=format&fit=crop';

const REACTION_LIST = [
    '🔥', '✨', '😂', '🤣', '❤️', '😎', '🤯', '😱', '🥳', '😡', '😭', '🥺', '🤪', '😇', '🤫', '🤔', '🙄', '😤', '🤤', '🤡', '👻', '💀', '👽', '🤖',
    '👍', '👎', '✌️', '🤞', '🤟', '🤙', '🤝', '🙏', '💪', '🧠', '👀', '👁️', '🤦‍♂️', '🤷‍♂️',
    '🚀', '⭐', '🌟', '⚡', '💣', '💥', '💯', '💢', '💤', '💦', '🍆', '🍑', '🍕', '🍔', '🍺', '🗿', '🗽', '💎', '🔮', '🦠',
    '✅', '❌', '⚠️', '⛔', '🆗', '🆒', '🚩', '🏁'
];

const groq = new Groq({ apiKey: GROQ_API_KEY });
const mediaCache = new Map(); 

// --- FUNGSI AI ---
async function tanyaAI(pertanyaan) {
    try {
        console.log(`🧠 AI Processing...`);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Kamu adalah ${NAMA_BOT}, asisten ${NAMA_OWNER}. Jawab singkat, gaul, & seru.` },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
        });
        return chatCompletion.choices[0]?.message?.content || "Otak bot lagi loading...";
    } catch (error) {
        console.error("AI Error:", error);
        return "⚠️ Limit AI habis / Error.";
    }
}

// --- FUNGSI WAKTU INDONESIA ---
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

// ==============================================
// 🌐 SERVER DASHBOARD (EXPRESS)
// ==============================================
const app = express();
app.get('/', (req, res) => {
    const waktu = getWaktuIndonesia(); 
    res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${NAMA_BOT} Dashboard</title>
        <style>
            body { background-color: #050505; color: #ffffff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-image: linear-gradient(rgba(20, 20, 20, 0.9), rgba(20, 20, 20, 0.9)), url('${HEADER_IMAGE_URL}'); background-size: cover; background-position: center; }
            .card { background: rgba(20, 25, 30, 0.95); border: 1px solid #333; border-radius: 20px; width: 90%; max-width: 380px; overflow: hidden; box-shadow: 0 0 40px rgba(0, 255, 100, 0.1); text-align: center; backdrop-filter: blur(10px); }
            .header-img { width: 100%; height: 150px; object-fit: cover; border-bottom: 3px solid #00d26a; }
            .content { padding: 25px; }
            h1 { font-size: 26px; margin: 0; color: #fff; text-transform: uppercase; letter-spacing: 2px; }
            .info-box { background: #1f1f1f; padding: 15px; border-radius: 12px; margin: 20px 0; border: 1px solid #333; }
            .greet { font-size: 18px; font-weight: bold; color: #00d26a; margin-bottom: 5px; }
            .date { font-size: 14px; color: #aaa; font-weight: 500; }
            .status { display: inline-block; padding: 5px 15px; border-radius: 50px; background: rgba(0, 210, 106, 0.1); border: 1px solid #00d26a; color: #00d26a; font-size: 12px; font-weight: bold; margin-top: 10px; }
            .btn-group { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
            .btn { padding: 12px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; transition: 0.3s; }
            .btn-owner { background: #007bff; color: white; }
            .btn-donate { background: #ffc107; color: #000; }
            .footer { margin-top: 20px; font-size: 11px; color: #555; }
        </style>
    </head>
    <body>
        <div class="card">
            <img src="${HEADER_IMAGE_URL}" class="header-img">
            <div class="content">
                <h1>${NAMA_BOT}</h1>
                <div class="status">● SYSTEM ONLINE</div>
                <div class="info-box">
                    <div class="greet">${waktu.sapaan}, Bos!</div>
                    <div class="date">${waktu.tanggalLengkap}</div>
                    <div class="clock">${waktu.jam}</div>
                </div>
                <div class="btn-group">
                    <a href="https://wa.me/${NOMOR_OWNER}" class="btn btn-owner">👤 Chat Owner</a>
                    <a href="${LINK_DONASI}" class="btn btn-donate">☕ Trakteer Donasi</a>
                </div>
                <div class="footer">Running on Port ${PORT}</div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// ==============================================
// 🚀 START DATABASE & BOT
// ==============================================
console.log('🔄 Menghubungkan ke Database...');

// Fungsi Start agar bisa async/await
const startBot = async () => {
    let store;
    
    // Cek apakah ada MONGO_URI
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            store = new MongoStore({ mongoose: mongoose });
            console.log('✅ Berhasil terhubung ke MongoDB!');
        } catch (err) {
            console.error('❌ Gagal koneksi MongoDB:', err.message);
            console.log('⚠️ Beralih ke LocalAuth (Perlu scan ulang jika restart)');
        }
    } else {
        console.log('⚠️ MONGO_URI tidak ditemukan. Menggunakan LocalAuth.');
    }

    // Konfigurasi Client
   const client = new Client({
        authStrategy: store ? new RemoteAuth({
            clientId: 'jonkris-session',
            store: store,
            backupSyncIntervalMs: 300000 
        }) : new LocalAuth({ clientId: "jonkris-local" }),

     puppeteer: {
            headless: true,
            // KITA PAKSA PAKAI ALAMAT ASLI DARI BUILD PACK JONTEWKS
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/app/.apt/usr/bin/google-chrome',
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

    client.on('qr', (qr) => { 
        console.log('📱 SCAN QR CODE SEKARANG DI TERMINAL:'); 
        qrcode.generate(qr, { small: true }); 
    });

    client.on('ready', () => { 
        console.clear(); 
        console.log(`✅ ${NAMA_BOT} SUDAH ONLINE!`); 
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sesi tersimpan di Database!');
    });

    // ==============================================
    // 👋 WELCOME & LEAVE
    // ==============================================
    client.on('group_join', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const prompt = `Buatkan ucapan selamat datang singkat, lucu, dan nyeleneh untuk member baru bernama ${contact.pushname || "Member Baru"} di grup ${chat.name}.`;
            const pesanAI = await tanyaAI(prompt);
            const welcomeMsg = `╔═══════════════════╗\n   🎉 *WELCOME PLAYER!*\n╚═══════════════════╝\nHalo Kak @${contact.id.user} 👋\nSelamat bergabung di *${chat.name}*!\n\n"${pesanAI}"\n\n_Jangan lupa baca deskripsi grup ya!_`;
            
            await chat.sendMessage(welcomeMsg, { mentions: [contact] });
            try {
                const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                await chat.sendMessage(media, { caption: "Selamat datang!" });
            } catch(e) {}
        } catch (err) { console.log('Welcome Error:', err.message); }
    });

    client.on('group_leave', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const leaveMsg = `╔═══════════════════╗\n   🍂 *GAME OVER*\n╚═══════════════════╝\nYah, Kak @${contact.id.user} keluar... 👋\nGood bye!`;
            await chat.sendMessage(leaveMsg, { mentions: [contact] });
        } catch (err) { console.log('Leave Error:', err.message); }
    });

    // ==============================================
    // 📨 LOGIKA PESAN & COMMANDS
    // ==============================================
    client.on('message_create', async msg => {
        try {
            if (msg.from === 'status@broadcast') return;

            // --- CACHE & SECURITY ---
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        mediaCache.set(msg.id.id, media);
                        if (mediaCache.size > 50) mediaCache.delete(mediaCache.keys().next().value);
                    }
                } catch (e) {}
            }
            if (msg.hasMedia && (msg.isViewOnce || msg._data.isViewOnce)) {
                const media = await msg.downloadMedia();
                if (media) await client.sendMessage(msg.from, media, { caption: '🔓 *Anti-View Once*\nJangan pelit-pelit napa! 😜' });
                return;
            }

            if (msg.fromMe) return; 

            // AUTO REACTION
            try {
                const randomEmoji = REACTION_LIST[Math.floor(Math.random() * REACTION_LIST.length)];
                await msg.react(randomEmoji);
            } catch (e) {}

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // 1. MENU
            if (command === '.menu' || command === '.help') {
                const motivasi = await tanyaAI("Quote singkat motivasi hacker/gamer.");
                const waktu = getWaktuIndonesia(); 
                const captionMenu = `
╭━━━〔 🤖 ${NAMA_BOT} 〕━━━╮
┃ 👤 Owner: ${NAMA_OWNER}
┃ 🚀 Status: Online 24 Jam
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 ${waktu.sapaan}, *${msg._data.notifyName}*!
📅 *${waktu.tanggalLengkap}*
❝ _${motivasi}_ ❞

╭───『 🔥 FITUR UTAMA 』───
│ 🛠️ *.sticker* (Reply Gambar)
│ 🤣 *.meme TeksAtas|TeksBawah*
│ 📢 *.hidetag* (Tag All Hidden)
│ 💬 *Chat AI* (Langsung ketik aja)
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

            // 3. HIDE TAG
            else if (command === '.hidetag' || command === '.h') {
                const chat = await msg.getChat();
                if (chat.isGroup) {
                    let text = args || "📢 *PENGUMUMAN PENTING!*"; 
                    let mentions = [];
                    for(let participant of chat.participants) {
                        const contact = await client.getContactById(participant.id._serialized);
                        mentions.push(contact);
                    }
                    await chat.sendMessage(text, { mentions });
                } else { msg.reply('❌ Khusus Grup!'); }
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
                    } catch (e) { msg.reply('❌ Gagal edit. Format: .meme Atas|Bawah'); }
                } else msg.reply('❌ Format: .meme Atas|Bawah');
            }

            // 5. OWNER & DONASI
            else if (command === '.owner') {
                const kontak = await client.getContactById(NOMOR_OWNER + '@c.us');
                await client.sendMessage(msg.from, kontak, { caption: `👑 Ini Tuan saya, *${NAMA_OWNER}*` });
            }
            else if (command === '.donasi') {
                await msg.reply(`☕ *TRAKTEER KOPI*\n\nSupport bot agar tetap online:\n🔗 ${LINK_DONASI}\n\nTerima kasih! 🙏`);
            }

            // 6. AI CHAT
            else {
                const isGroup = msg.from.includes('@g.us');
                if (!isGroup || (isGroup && msg.mentionedIds.includes(client.info.wid._serialized)) || body.startsWith('.')) {
                    if (body.length > 1) { 
                        const chat = await msg.getChat();
                        await chat.sendStateTyping();
                        let prompt = body.replace('.','').replace(`@${client.info.wid.user}`, '').trim();
                        const jawaban = await tanyaAI(prompt);
                        await msg.reply(jawaban);
                    }
                }
            }

        } catch (err) { console.log('Error:', err.message); }
    });

    // 🗑️ ANTI-DELETE
    client.on('message_revoke_everyone', async (after, before) => {
        if (before && !before.fromMe) {
            let media = mediaCache.get(before.id.id);
            const contact = await before.getContact();
            const caption = `👮 *ANTI-DELETE DETECTED*\n👤 Pelaku: @${contact.id.user}\n📝 Pesan: ${before.body}\n⏰ ${new Date().toLocaleTimeString()}`;
            if (media) await client.sendMessage(before.from, media, { caption: caption, mentions: [contact] });
            else client.sendMessage(before.from, caption, { mentions: [contact] });
        }
    });

    // Start Server Express setelah Bot siap
    app.listen(PORT, () => console.log(`🚀 Dashboard siap di Port ${PORT}`));
    
    // Jalankan Bot
    client.initialize();
};

// JALANKAN FUNGSI UTAMA
startBot();

// Handler Error Global
process.on('uncaughtException', (err) => { console.error('⚠️ Uncaught Exception:', err); });
process.on('unhandledRejection', (reason) => { console.error('⚠️ Unhandled Rejection:', reason); });