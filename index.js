const { Client, RemoteAuth, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');

// ==============================================
// ⚙️ KONFIGURASI UTAMA
// ==============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Validasi environment variables
if (!GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY tidak ditemukan di environment variables!');
    process.exit(1);
}

const NOMOR_OWNER = process.env.NOMOR_OWNER || '6289509158681'; 
const NAMA_BOT = process.env.NAMA_BOT || 'JONKRIS BOT';      
const NAMA_OWNER = process.env.NAMA_OWNER || 'Jon Kris'; 
const LINK_DONASI = process.env.LINK_DONASI || 'https://saweria.co/jonkris'; 
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

// ==============================================
// 🌐 SERVER DASHBOARD (EXPRESS)
// ==============================================
const app = express();

// Middleware untuk parsing JSON
app.use(express.json());

// Health check endpoint untuk Heroku
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        bot: NAMA_BOT,
        timestamp: new Date().toISOString()
    });
});

// Dashboard utama
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
            .mongo-status { margin-top: 10px; font-size: 10px; padding: 5px; border-radius: 5px; background: #2a2a2a; }
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
                <div class="mongo-status">MongoDB: ${MONGO_URI ? '✅ Connected' : '⚠️ LocalAuth'}</div>
                <div class="btn-group">
                    <a href="https://wa.me/${NOMOR_OWNER}" class="btn btn-owner" target="_blank">👤 Chat Owner</a>
                    <a href="${LINK_DONASI}" class="btn btn-donate" target="_blank">☕ Trakteer Donasi</a>
                </div>
                <div class="footer">Running on Port ${PORT} | ${process.env.NODE_ENV || 'development'}</div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// --- FUNGSI AI ---
async function tanyaAI(pertanyaan) {
    try {
        console.log(`🧠 AI Processing: ${pertanyaan.substring(0, 50)}...`);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: `Kamu adalah ${NAMA_BOT}, asisten ${NAMA_OWNER}. 
                    Jawab singkat, gaul, & seru. 
                    Maksimal 3 paragraf. 
                    Gunakan emoji yang relevan.` 
                },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 512, // Kurangi untuk hemat quota
        });
        return chatCompletion.choices[0]?.message?.content || "🤖 Otak bot lagi loading...";
    } catch (error) {
        console.error("AI Error:", error.message);
        // Berikan response yang lebih spesifik berdasarkan error
        if (error.status === 429) {
            return "⚠️ Limit AI hari ini habis, coba lagi besok ya!";
        }
        return "⚠️ Sedang gangguan jaringan AI, coba lagi nanti.";
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
        jam: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} WIB`
    };
}

// ==============================================
// 🚀 START DATABASE & BOT
// ==============================================
console.log('🔄 Menghubungkan ke Database...');

const startBot = async () => {
    let store;
    
    // Cek apakah ada MONGO_URI
    if (MONGO_URI) {
        try {
            console.log('🔗 Mencoba koneksi ke MongoDB...');
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            
            // Test connection
            await mongoose.connection.db.admin().ping();
            
            store = new MongoStore({ 
                mongoose: mongoose,
                collectionName: 'whatsapp_sessions'
            });
            console.log('✅ Berhasil terhubung ke MongoDB!');
        } catch (err) {
            console.error('❌ Gagal koneksi MongoDB:', err.message);
            console.log('⚠️ Beralih ke LocalAuth (Perlu scan ulang jika restart)');
        }
    } else {
        console.log('⚠️ MONGO_URI tidak ditemukan. Menggunakan LocalAuth.');
    }

    // Konfigurasi Puppeteer untuk Heroku
    const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
    ];

    // Jika di Heroku, gunakan Chromium yang tersedia
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                         (process.env.NODE_ENV === 'production' ? 
                          '/app/.apt/usr/bin/google-chrome-stable' : undefined);

    // Konfigurasi Client
    const client = new Client({
        authStrategy: store ? new RemoteAuth({
            clientId: 'jonkris-whatsapp-bot',
            store: store,
            backupSyncIntervalMs: 600000, // 10 menit
            dataPath: './.wwebjs_auth'
        }) : new LocalAuth({ 
            clientId: "jonkris-local",
            dataPath: './.wwebjs_auth'
        }),

        puppeteer: {
            headless: 'new',
            executablePath: executablePath,
            args: puppeteerArgs,
            ignoreDefaultArgs: ['--disable-extensions']
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    client.on('qr', (qr) => { 
        console.log('📱 SCAN QR CODE SEKARANG DI TERMINAL:'); 
        qrcode.generate(qr, { small: true }); 
        console.log('QR Code juga tersedia di dashboard (jika diatur)');
    });

    client.on('ready', () => { 
        console.clear(); 
        console.log(`✅ ${NAMA_BOT} SUDAH ONLINE!`); 
        console.log(`📱 WhatsApp: ${client.info.pushname}`);
        console.log(`👤 Number: ${client.info.wid.user}`);
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Sesi tersimpan di Database!');
    });

    client.on('authenticated', () => {
        console.log('✅ Authenticated!');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('❌ Client disconnected:', reason);
        // Coba restart setelah 10 detik
        setTimeout(() => {
            console.log('🔄 Mencoba restart...');
            client.initialize();
        }, 10000);
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
            
            // Coba kirim media
            try {
                const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                await chat.sendMessage(media, { caption: "Selamat datang! 🎉" });
            } catch(e) { 
                console.log('Media welcome error:', e.message); 
            }
        } catch (err) { 
            console.log('Welcome Error:', err.message); 
        }
    });

    client.on('group_leave', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const leaveMsg = `╔═══════════════════╗\n   🍂 *GAME OVER*\n╚═══════════════════╝\nYah, Kak @${contact.id.user} keluar... 👋\nGood bye!`;
            await chat.sendMessage(leaveMsg, { mentions: [contact] });
        } catch (err) { 
            console.log('Leave Error:', err.message); 
        }
    });

    // ==============================================
    // 📨 LOGIKA PESAN & COMMANDS
    // ==============================================
    client.on('message_create', async msg => {
        try {
            // Skip status broadcast
            if (msg.from === 'status@broadcast') return;

            // Skip jika pesan dari bot sendiri
            if (msg.fromMe) return;

            // AUTO REACTION (hanya 30% pesan)
            if (Math.random() < 0.3) {
                try {
                    const randomEmoji = REACTION_LIST[Math.floor(Math.random() * REACTION_LIST.length)];
                    await msg.react(randomEmoji);
                } catch (e) { 
                    // Silent error untuk reaction
                }
            }

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // CACHE MEDIA untuk anti-delete
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        mediaCache.set(msg.id.id, media);
                        // Batasi cache size
                        if (mediaCache.size > 50) {
                            const firstKey = mediaCache.keys().next().value;
                            mediaCache.delete(firstKey);
                        }
                    }
                } catch (e) { 
                    console.log('Download media error:', e.message); 
                }
            }

            // ANTI VIEW ONCE
            if (msg.hasMedia && (msg.isViewOnce || (msg._data && msg._data.isViewOnce))) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        await client.sendMessage(msg.from, media, { 
                            caption: '🔓 *Anti-View Once*\nJangan pelit-pelit napa! 😜' 
                        });
                    }
                } catch (e) {
                    console.log('Anti view once error:', e.message);
                }
                return;
            }

            // 1. MENU
            if (command === '.menu' || command === '.help') {
                const waktu = getWaktuIndonesia(); 
                const motivasi = await tanyaAI("Quote singkat motivasi hacker/gamer (maksimal 10 kata).");
                
                const captionMenu = `
╭━━━〔 🤖 ${NAMA_BOT} 〕━━━╮
┃ 👤 Owner: ${NAMA_OWNER}
┃ 🚀 Status: Online 24 Jam
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 ${waktu.sapaan}, *${msg._data.notifyName || 'User'}*!
📅 *${waktu.tanggalLengkap}*
⏰ ${waktu.jam}
❝ _${motivasi}_ ❞

╭───『 🔥 FITUR UTAMA 』───
│ 📋 *.menu* - Tampilkan menu ini
│ 🛠️ *.sticker* - Buat sticker dari gambar
│ 🤣 *.meme Atas|Bawah* - Buat meme
│ 📢 *.hidetag* - Tag semua member
│ 👑 *.owner* - Info owner
│ ☕ *.donasi* - Support bot
│ 💬 *NamaBot pertanyaan* - Chat AI
╰──────────────────────

💡 *Catatan:* 
- Reply gambar dengan .sticker
- Tag bot di grup untuk chat AI
                `;
                
                try {
                    const media = await MessageMedia.fromUrl(HEADER_IMAGE_URL, { unsafeMime: true });
                    await client.sendMessage(msg.from, media, { caption: captionMenu });
                } catch (e) { 
                    await msg.reply(captionMenu); 
                }
            }

            // 2. STICKER
            else if (command === '.sticker' || command === '.s') {
                let media = null;
                if (msg.hasMedia) {
                    media = await msg.downloadMedia();
                } else if (msg.hasQuotedMsg) {
                    const quotedMsg = await msg.getQuotedMessage();
                    if (quotedMsg.hasMedia) {
                        media = await quotedMsg.downloadMedia();
                    }
                }
                
                if (media) {
                    await msg.react('🎨');
                    await client.sendMessage(msg.from, media, { 
                        sendMediaAsSticker: true, 
                        stickerName: NAMA_BOT, 
                        stickerAuthor: NAMA_OWNER 
                    });
                } else { 
                    await msg.reply('❌ Kirim/Reply gambar dengan caption *.sticker*'); 
                }
            }

            // 3. HIDE TAG
            else if (command === '.hidetag' || command === '.h') {
                const chat = await msg.getChat();
                if (chat.isGroup) {
                    await msg.react('📢');
                    let text = args || "📢 *PENGUMUMAN PENTING!*"; 
                    let mentions = [];
                    
                    for(let participant of chat.participants) {
                        try {
                            const contact = await client.getContactById(participant.id._serialized);
                            mentions.push(contact);
                        } catch (e) {
                            console.log('Error mendapatkan kontak:', e.message);
                        }
                    }
                    
                    if (mentions.length > 0) {
                        await chat.sendMessage(text, { mentions });
                    } else {
                        await msg.reply('❌ Gagal mendapatkan daftar member');
                    }
                } else { 
                    await msg.reply('❌ Command ini hanya untuk grup!'); 
                }
            }

            // 4. MEME
            else if (command === '.meme') {
                let media = null;
                if (msg.hasMedia) {
                    media = await msg.downloadMedia();
                } else if (msg.hasQuotedMsg) {
                    const quotedMsg = await msg.getQuotedMessage();
                    if (quotedMsg.hasMedia) {
                        media = await quotedMsg.downloadMedia();
                    }
                }
                
                if (media && args.includes('|')) {
                    try {
                        await msg.react('😆');
                        const [top, bottom] = args.split('|');
                        
                        // Decode base64 image
                        const imageBuffer = Buffer.from(media.data, 'base64');
                        const image = await Jimp.read(imageBuffer);
                        
                        // Resize dengan rasio yang baik
                        image.resize(512, Jimp.AUTO);
                        
                        // Load font
                        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
                        
                        // Hitung posisi teks
                        const imageWidth = image.bitmap.width;
                        const imageHeight = image.bitmap.height;
                        
                        // Tambah teks atas
                        if (top && top.trim()) {
                            const topText = top.trim().toUpperCase();
                            const topTextWidth = Jimp.measureText(font, topText);
                            const topX = (imageWidth - topTextWidth) / 2;
                            image.print(font, topX, 10, topText);
                        }
                        
                        // Tambah teks bawah
                        if (bottom && bottom.trim()) {
                            const bottomText = bottom.trim().toUpperCase();
                            const bottomTextWidth = Jimp.measureText(font, bottomText);
                            const bottomX = (imageWidth - bottomTextWidth) / 2;
                            image.print(font, bottomX, imageHeight - 50, bottomText);
                        }
                        
                        // Konversi ke buffer
                        const buff = await image.getBufferAsync(Jimp.MIME_JPEG);
                        
                        // Kirim sebagai gambar biasa
                        const memeMedia = new MessageMedia('image/jpeg', buff.toString('base64'));
                        await client.sendMessage(msg.from, memeMedia, { 
                            caption: `Meme by ${NAMA_BOT}` 
                        });
                        
                    } catch (e) { 
                        console.log('Meme error:', e.message);
                        await msg.reply('❌ Gagal membuat meme. Pastikan format: *.meme TeksAtas|TeksBawah*'); 
                    }
                } else {
                    await msg.reply('❌ Format: *.meme Atas|Bawah*\nContoh: .meme WHEN YOU|SEE THE BUG');
                }
            }

            // 5. OWNER & DONASI
            else if (command === '.owner') {
                try {
                    const kontak = await client.getContactById(`${NOMOR_OWNER}@c.us`);
                    await client.sendMessage(msg.from, kontak, { 
                        caption: `👑 *OWNER ${NAMA_BOT}*\n\nNama: ${NAMA_OWNER}\nWhatsApp: wa.me/${NOMOR_OWNER}` 
                    });
                } catch (e) {
                    await msg.reply(`👑 *OWNER ${NAMA_BOT}*\n\nNama: ${NAMA_OWNER}\nWhatsApp: wa.me/${NOMOR_OWNER}`);
                }
            }
            else if (command === '.donasi' || command === '.donate') {
                await msg.reply(`☕ *SUPPORT ${NAMA_BOT}*\n\nBantu bot tetap online dengan donasi:\n🔗 ${LINK_DONASI}\n\nTerima kasih banyak! 🙏`);
            }

            // 6. PING / STATUS
            else if (command === '.ping' || command === '.status') {
                const waktu = getWaktuIndonesia();
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                
                await msg.reply(`🏓 *PONG!*\n\n🕐 Uptime: ${hours}h ${minutes}m ${seconds}s\n📅 ${waktu.tanggalLengkap}\n⏰ ${waktu.jam}\n\n${NAMA_BOT} siap melayani!`);
            }

            // 7. AI CHAT
            else {
                const isGroup = msg.from.includes('@g.us');
                const isMentioned = msg.mentionedIds && 
                    msg.mentionedIds.includes(client.info?.wid?._serialized);
                const isDirectMessage = !isGroup;
                const isBotMentionedInText = body.toLowerCase().includes(NAMA_BOT.toLowerCase());
                
                // Logika trigger AI:
                // 1. DM langsung (bukan grup)
                // 2. Di-mention di grup
                // 3. Menyebut nama bot di grup
                // 4. Pesan panjang (>5 kata) di grup (random 20% chance)
                
                let shouldRespond = false;
                let prompt = body;
                
                if (isDirectMessage) {
                    shouldRespond = true;
                } else if (isGroup) {
                    if (isMentioned) {
                        shouldRespond = true;
                        prompt = body.replace(`@${client.info.wid.user}`, '').trim();
                    } else if (isBotMentionedInText) {
                        shouldRespond = true;
                        prompt = body.replace(new RegExp(NAMA_BOT, 'gi'), '').trim();
                    } else if (body.length > 20 && Math.random() < 0.2) {
                        shouldRespond = true;
                    }
                }
                
                if (shouldRespond && prompt.length > 1) {
                    try {
                        const chat = await msg.getChat();
                        await chat.sendStateTyping();
                        
                        const jawaban = await tanyaAI(prompt);
                        await msg.reply(jawaban);
                    } catch (error) {
                        console.log('AI Response error:', error.message);
                        await msg.reply('⚠️ Gagal memproses pertanyaan. Coba lagi nanti.');
                    }
                }
            }

        } catch (err) { 
            console.log('Message Error:', err.message);
            console.log('Stack:', err.stack);
        }
    });

    // 🗑️ ANTI-DELETE
    client.on('message_revoke_everyone', async (after, before) => {
        if (before && !before.fromMe) {
            try {
                const media = mediaCache.get(before.id.id);
                const contact = await before.getContact();
                const waktu = getWaktuIndonesia();
                
                let caption = `👮 *ANTI-DELETE DETECTED*\n\n👤 Pelaku: @${contact.id.user}\n`;
                
                if (before.body) {
                    caption += `📝 Pesan: ${before.body.substring(0, 100)}${before.body.length > 100 ? '...' : ''}\n`;
                }
                
                caption += `⏰ Waktu: ${waktu.jam}\n📍 ${before.fromMe ? 'Dikirim oleh bot' : 'Dikirim oleh user'}`;
                
                if (media) {
                    await client.sendMessage(before.from, media, { 
                        caption: caption, 
                        mentions: [contact] 
                    });
                } else {
                    await client.sendMessage(before.from, caption, { 
                        mentions: [contact] 
                    });
                }
            } catch (e) {
                console.log('Anti-delete error:', e.message);
            }
        }
    });

    // Start Server Express
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Dashboard siap di http://0.0.0.0:${PORT}`);
        console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
    });
    
    // Jalankan Bot
    await client.initialize();
};

// JALANKAN FUNGSI UTAMA
startBot().catch(err => {
    console.error('❌ Gagal memulai bot:', err);
    process.exit(1);
});

// Handler Error Global
process.on('uncaughtException', (err) => { 
    console.error('⚠️ Uncaught Exception:', err); 
});

process.on('unhandledRejection', (reason, promise) => { 
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason); 
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received. Shutting down...');
    process.exit(0);
});