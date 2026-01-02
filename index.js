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
    console.error('⚠️ Tambahkan GROQ_API_KEY ke environment variables Heroku');
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

// Inisialisasi Groq dengan error handling
let groq;
try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log('✅ Groq SDK berhasil diinisialisasi');
} catch (error) {
    console.error('❌ Gagal inisialisasi Groq SDK:', error.message);
    process.exit(1);
}

const mediaCache = new Map(); 

// ==============================================
// 🌐 SERVER DASHBOARD (EXPRESS)
// ==============================================
const app = express();

// Middleware basic
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint untuk Heroku
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        bot: NAMA_BOT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Dashboard utama
app.get('/', (req, res) => {
    const waktu = getWaktuIndonesia(); 
    const mongoStatus = MONGO_URI ? '✅ Connected' : '⚠️ LocalAuth';
    const groqStatus = GROQ_API_KEY ? '✅ Active' : '❌ Missing';
    
    res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${NAMA_BOT} Dashboard</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background-color: #050505; 
                color: #ffffff; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                margin: 0; 
                background-image: 
                    linear-gradient(rgba(20, 20, 20, 0.9), rgba(20, 20, 20, 0.9)), 
                    url('${HEADER_IMAGE_URL}'); 
                background-size: cover; 
                background-position: center; 
                background-attachment: fixed;
                padding: 20px;
            }
            .card { 
                background: rgba(20, 25, 30, 0.95); 
                border: 1px solid #333; 
                border-radius: 20px; 
                width: 100%; 
                max-width: 400px; 
                overflow: hidden; 
                box-shadow: 0 0 40px rgba(0, 255, 100, 0.1); 
                text-align: center; 
                backdrop-filter: blur(10px); 
                animation: fadeIn 0.5s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .header-img { 
                width: 100%; 
                height: 150px; 
                object-fit: cover; 
                border-bottom: 3px solid #00d26a; 
            }
            .content { 
                padding: 25px; 
            }
            h1 { 
                font-size: 26px; 
                margin: 0 0 10px 0; 
                color: #fff; 
                text-transform: uppercase; 
                letter-spacing: 2px; 
                background: linear-gradient(90deg, #00d26a, #00b8ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .info-box { 
                background: #1f1f1f; 
                padding: 15px; 
                border-radius: 12px; 
                margin: 20px 0; 
                border: 1px solid #333; 
                text-align: left;
            }
            .greet { 
                font-size: 18px; 
                font-weight: bold; 
                color: #00d26a; 
                margin-bottom: 5px; 
            }
            .date { 
                font-size: 14px; 
                color: #aaa; 
                font-weight: 500; 
                margin-bottom: 5px;
            }
            .clock { 
                font-size: 16px; 
                color: #00b8ff; 
                font-weight: bold; 
                font-family: monospace;
            }
            .status { 
                display: inline-block; 
                padding: 5px 15px; 
                border-radius: 50px; 
                background: rgba(0, 210, 106, 0.1); 
                border: 1px solid #00d26a; 
                color: #00d26a; 
                font-size: 12px; 
                font-weight: bold; 
                margin-bottom: 15px;
            }
            .service-status {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                font-size: 12px;
            }
            .btn-group { 
                display: flex; 
                flex-direction: column; 
                gap: 10px; 
                margin-top: 20px; 
            }
            .btn { 
                padding: 12px; 
                border-radius: 10px; 
                text-decoration: none; 
                font-weight: bold; 
                font-size: 14px; 
                transition: 0.3s; 
                text-align: center;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            .btn-owner { 
                background: #007bff; 
                color: white; 
            }
            .btn-donate { 
                background: #ffc107; 
                color: #000; 
            }
            .btn-status {
                background: #6c757d;
                color: white;
            }
            .footer { 
                margin-top: 20px; 
                font-size: 11px; 
                color: #555; 
            }
            .qr-placeholder {
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                font-size: 12px;
                color: #888;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <img src="${HEADER_IMAGE_URL}" class="header-img" alt="Header Image">
            <div class="content">
                <h1>${NAMA_BOT}</h1>
                <div class="status">● SYSTEM ONLINE</div>
                
                <div class="info-box">
                    <div class="greet">${waktu.sapaan}, Bos!</div>
                    <div class="date">${waktu.tanggalLengkap}</div>
                    <div class="clock">${waktu.jam}</div>
                </div>
                
                <div class="service-status">
                    <span>MongoDB:</span>
                    <span>${mongoStatus}</span>
                </div>
                <div class="service-status">
                    <span>Groq AI:</span>
                    <span>${groqStatus}</span>
                </div>
                
                <div class="qr-placeholder">
                    📱 Scan QR Code di terminal untuk login WhatsApp
                </div>
                
                <div class="btn-group">
                    <a href="https://wa.me/${NOMOR_OWNER}" class="btn btn-owner" target="_blank">👤 Chat Owner</a>
                    <a href="${LINK_DONASI}" class="btn btn-donate" target="_blank">☕ Trakteer Donasi</a>
                    <a href="/health" class="btn btn-status">🩺 Health Check</a>
                </div>
                
                <div class="footer">
                    Port: ${PORT} | Node: ${process.version} | Env: ${process.env.NODE_ENV || 'development'}
                </div>
            </div>
        </div>
        
        <script>
            // Auto refresh waktu
            function updateTime() {
                const clockElement = document.querySelector('.clock');
                if (clockElement) {
                    const now = new Date();
                    const timeString = now.toLocaleTimeString('id-ID', { 
                        timeZone: 'Asia/Jakarta',
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    clockElement.textContent = timeString + ' WIB';
                }
            }
            
            setInterval(updateTime, 1000);
            updateTime();
        </script>
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
                    Jawab singkat, gaul, & seru maksimal 3 paragraf. 
                    Gunakan emoji yang relevan.` 
                },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 512,
            timeout: 30000 // 30 detik timeout
        });
        return chatCompletion.choices[0]?.message?.content || "🤖 Otak bot lagi loading...";
    } catch (error) {
        console.error("AI Error:", error.message);
        if (error.status === 429) {
            return "⚠️ Limit AI hari ini habis, coba lagi besok ya!";
        }
        if (error.code === 'ETIMEDOUT') {
            return "⏰ Waktu request AI habis, coba pertanyaan yang lebih singkat.";
        }
        return "⚠️ Sedang gangguan jaringan AI, coba lagi nanti.";
    }
}

// --- FUNGSI WAKTU INDONESIA ---
function getWaktuIndonesia() {
    const now = new Date();
    const options = { timeZone: "Asia/Jakarta" };
    const indonesiaTime = new Date(now.toLocaleString("en-US", options));
    
    const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulanArr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const jam = indonesiaTime.getHours();
    let sapaan = 'Selamat Malam 🌙';
    if (jam >= 4 && jam < 11) sapaan = 'Selamat Pagi 🌅';
    else if (jam >= 11 && jam < 15) sapaan = 'Selamat Siang ☀️';
    else if (jam >= 15 && jam < 18) sapaan = 'Selamat Sore 🌇';

    return {
        sapaan: sapaan,
        tanggalLengkap: `${hariArr[indonesiaTime.getDay()]}, ${indonesiaTime.getDate()} ${bulanArr[indonesiaTime.getMonth()]} ${indonesiaTime.getFullYear()}`,
        jam: `${String(indonesiaTime.getHours()).padStart(2,'0')}:${String(indonesiaTime.getMinutes()).padStart(2,'0')}:${String(indonesiaTime.getSeconds()).padStart(2,'0')} WIB`
    };
}

// ==============================================
// 🚀 START DATABASE & BOT
// ==============================================
console.log('🔄 Memulai WhatsApp Bot...');
console.log('🤖 Nama Bot:', NAMA_BOT);
console.log('👤 Owner:', NAMA_OWNER);
console.log('🌐 Port:', PORT);

const startBot = async () => {
    let store;
    
    // Koneksi MongoDB
    if (MONGO_URI) {
        try {
            console.log('🔗 Menghubungkan ke MongoDB...');
            mongoose.set('strictQuery', true);
            
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });
            
            // Test connection
            mongoose.connection.on('connected', () => {
                console.log('✅ MongoDB Connected!');
            });
            
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB Connection Error:', err);
            });
            
            store = new MongoStore({ 
                mongoose: mongoose,
                collectionName: 'whatsapp_sessions'
            });
            
        } catch (err) {
            console.error('❌ Gagal koneksi MongoDB:', err.message);
            console.log('⚠️ Beralih ke LocalAuth');
        }
    } else {
        console.log('ℹ️ MONGO_URI tidak ditemukan, menggunakan LocalAuth');
    }

    // Konfigurasi Puppeteer untuk Heroku
    const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
        '--disable-features=site-per-process'
    ];

    // Path Chrome untuk Heroku
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                         (process.env.NODE_ENV === 'production' ? 
                          '/app/.apt/usr/bin/google-chrome' : undefined);

    console.log('🚀 Inisialisasi WhatsApp Client...');

    // Konfigurasi Client WhatsApp
    const client = new Client({
        authStrategy: store ? new RemoteAuth({
            clientId: 'jonkris-whatsapp-bot',
            store: store,
            backupSyncIntervalMs: 600000,
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

    // Event Handlers
    client.on('qr', (qr) => { 
        console.log('📱 SCAN QR CODE DI BAWAH INI:');
        console.log('='.repeat(50));
        qrcode.generate(qr, { small: true });
        console.log('='.repeat(50));
        console.log('💡 Scan QR code di atas dengan WhatsApp > Menu > Linked Devices');
    });

    client.on('ready', () => { 
        console.clear(); 
        console.log(`✨ ${'='.repeat(50)}`);
        console.log(`✅ ${NAMA_BOT} SUDAH ONLINE!`);
        console.log(`📱 WhatsApp: ${client.info.pushname}`);
        console.log(`👤 Number: ${client.info.wid.user}`);
        console.log(`🎯 Siap melayani!`);
        console.log(`✨ ${'='.repeat(50)}`);
    });

    client.on('remote_session_saved', () => {
        console.log('💾 Session saved to database');
    });

    client.on('authenticated', () => {
        console.log('🔐 Authenticated successfully');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('❌ Disconnected:', reason);
        console.log('🔄 Restarting in 10 seconds...');
        setTimeout(() => {
            console.log('🔄 Restarting client...');
            client.initialize();
        }, 10000);
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`🔄 Loading: ${percent}% - ${message}`);
    });

    // ==============================================
    // 👋 WELCOME & LEAVE HANDLERS
    // ==============================================
    client.on('group_join', async (notification) => {
        try {
            const chat = await notification.getChat();
            const contact = await client.getContactById(notification.recipientIds[0]);
            const welcomeMsg = `╔═══════════════════╗\n   🎉 *WELCOME PLAYER!*\n╚═══════════════════╝\nHalo Kak @${contact.id.user} 👋\nSelamat bergabung di *${chat.name}*!\n\nSemoga betah yaa! 😄\n\n_Jangan lupa baca deskripsi grup!_`;
            
            await chat.sendMessage(welcomeMsg, { mentions: [contact] });
            
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
    // 📨 MESSAGE HANDLER
    // ==============================================
    client.on('message_create', async msg => {
        try {
            // Skip status broadcast dan pesan dari bot sendiri
            if (msg.from === 'status@broadcast' || msg.fromMe) return;

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // Cache media untuk anti-delete
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
                    // Silent error untuk cache
                }
            }

            // 1. MENU
            if (command === '.menu' || command === '.help' || command === '!menu') {
                const waktu = getWaktuIndonesia();
                const captionMenu = `
╭━━━〔 🤖 ${NAMA_BOT} 〕━━━╮
┃ 👤 Owner: ${NAMA_OWNER}
┃ 🚀 Status: Online 24 Jam
╰━━━━━━━━━━━━━━━━━━━━━━━━╯
👋 ${waktu.sapaan}, *${msg._data.notifyName || 'User'}*!
📅 ${waktu.tanggalLengkap}
⏰ ${waktu.jam}

╭───『 🔥 FITUR UTAMA 』───
│ 📋 *.menu* - Tampilkan menu
│ 🛠️ *.sticker* - Buat sticker
│ 🤣 *.meme Atas|Bawah* - Buat meme
│ 📢 *.hidetag* - Tag semua member
│ 👑 *.owner* - Info owner
│ ☕ *.donasi* - Support bot
│ 🏓 *.ping* - Cek status bot
│ 💬 Chat langsung - AI Assistant
╰──────────────────────

💡 *Cara Pakai AI:*
- Tag bot di grup: @${NAMA_BOT} pertanyaan
- Atau chat langsung di private
                `;
                
                await msg.reply(captionMenu);
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
                    let text = args || "📢 *PENGUMUMAN PENTING!*"; 
                    let mentions = [];
                    
                    for(let participant of chat.participants) {
                        try {
                            const contact = await client.getContactById(participant.id._serialized);
                            mentions.push(contact);
                        } catch (e) {
                            // Skip jika error
                        }
                    }
                    
                    await chat.sendMessage(text, { mentions });
                } else { 
                    await msg.reply('❌ Command ini hanya untuk grup!'); 
                }
            }

            // 4. MEME
            else if (command === '.meme') {
                if (args.includes('|')) {
                    await msg.reply('ℹ️ Fitur meme sedang dalam perbaikan. Gunakan .sticker untuk sekarang.');
                } else {
                    await msg.reply('❌ Format: *.meme Atas|Bawah*\nContoh: .meme WHEN YOU|SEE THE BUG');
                }
            }

            // 5. OWNER
            else if (command === '.owner') {
                await msg.reply(`👑 *OWNER ${NAMA_BOT}*\n\nNama: ${NAMA_OWNER}\nWhatsApp: wa.me/${NOMOR_OWNER}\n\nJangan spam ya! 🙏`);
            }

            // 6. DONASI
            else if (command === '.donasi' || command === '.donate') {
                await msg.reply(`☕ *SUPPORT ${NAMA_BOT}*\n\nBantu bot tetap online dengan donasi:\n🔗 ${LINK_DONASI}\n\nTerima kasih banyak! 🙏`);
            }

            // 7. PING
            else if (command === '.ping' || command === '.status') {
                const waktu = getWaktuIndonesia();
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                
                await msg.reply(`🏓 *PONG!*\n\n🕐 Uptime: ${hours}h ${minutes}m ${seconds}s\n📅 ${waktu.tanggalLengkap}\n⏰ ${waktu.jam}\n\n${NAMA_BOT} siap melayani!`);
            }

            // 8. AI CHAT (Sederhana)
            else {
                const isGroup = msg.from.includes('@g.us');
                const isMentioned = msg.mentionedIds && 
                    msg.mentionedIds.includes(client.info?.wid?._serialized);
                
                if (!isGroup || isMentioned || body.toLowerCase().includes(NAMA_BOT.toLowerCase())) {
                    if (body.length > 2) {
                        try {
                            const chat = await msg.getChat();
                            await chat.sendStateTyping();
                            
                            let prompt = body;
                            if (isMentioned) {
                                prompt = body.replace(`@${client.info.wid.user}`, '').trim();
                            }
                            
                            if (prompt.length > 1) {
                                const jawaban = await tanyaAI(prompt);
                                await msg.reply(jawaban);
                            }
                        } catch (error) {
                            console.log('AI Response error:', error.message);
                            await msg.reply('⚠️ Gagal memproses pertanyaan. Coba lagi nanti.');
                        }
                    }
                }
            }

        } catch (err) { 
            console.log('Message Handler Error:', err.message);
        }
    });

    // ANTI-DELETE
    client.on('message_revoke_everyone', async (after, before) => {
        if (before && !before.fromMe) {
            try {
                const media = mediaCache.get(before.id.id);
                const contact = await before.getContact();
                const waktu = getWaktuIndonesia();
                
                let caption = `👮 *PESAN DIHAPUS*\n\n👤 Dari: @${contact.id.user}\n`;
                
                if (before.body) {
                    caption += `📝 Isi: ${before.body.substring(0, 100)}${before.body.length > 100 ? '...' : ''}\n`;
                }
                
                caption += `⏰ Waktu: ${waktu.jam}`;
                
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

    // Start Express Server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Dashboard: http://0.0.0.0:${PORT}`);
        console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
    });
    
    // Initialize WhatsApp Client
    await client.initialize();
};

// JALANKAN BOT
startBot().catch(err => {
    console.error('❌ FATAL ERROR:', err);
    process.exit(1);
});

// Error Handlers
process.on('uncaughtException', (err) => { 
    console.error('⚠️ Uncaught Exception:', err); 
});

process.on('unhandledRejection', (reason, promise) => { 
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason); 
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received. Shutting down...');
    process.exit(0);
});