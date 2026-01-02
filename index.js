const { Client, RemoteAuth, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const Groq = require('groq-sdk');
const Jimp = require('jimp');
const mongoose = require('mongoose');

// Cek apakah wwebjs-mongo tersedia
let MongoStore;
try {
    MongoStore = require('wwebjs-mongo').MongoStore;
    console.log('✅ wwebjs-mongo loaded successfully');
} catch (error) {
    console.warn('⚠️ wwebjs-mongo not found, using LocalAuth');
    MongoStore = null;
}

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

const REACTION_LIST = ['🔥', '✨', '😂', '🤣', '❤️', '😎'];

// Inisialisasi Groq
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        bot: NAMA_BOT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Dashboard utama
app.get('/', (req, res) => {
    const waktu = getWaktuIndonesia(); 
    const mongoStatus = MONGO_URI ? '✅ Configured' : '⚠️ Not Configured';
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
                background-color: #0a0a0a; 
                color: #ffffff; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                margin: 0; 
                padding: 20px;
            }
            .card { 
                background: rgba(15, 20, 25, 0.95); 
                border: 1px solid #2a2a2a; 
                border-radius: 16px; 
                width: 100%; 
                max-width: 400px; 
                overflow: hidden; 
                box-shadow: 0 8px 32px rgba(0, 210, 106, 0.1); 
                text-align: center; 
                backdrop-filter: blur(10px); 
            }
            .header { 
                background: linear-gradient(135deg, #00d26a 0%, #00b8ff 100%);
                padding: 30px 20px;
                color: white;
            }
            .content { 
                padding: 25px; 
            }
            h1 { 
                font-size: 24px; 
                margin: 0 0 10px 0; 
                color: #fff; 
            }
            .status-badge { 
                display: inline-block; 
                padding: 6px 16px; 
                border-radius: 20px; 
                background: rgba(0, 210, 106, 0.2); 
                color: #00d26a; 
                font-size: 12px; 
                font-weight: bold; 
                margin-bottom: 20px;
                border: 1px solid rgba(0, 210, 106, 0.3);
            }
            .info-box { 
                background: #1a1a1a; 
                padding: 15px; 
                border-radius: 12px; 
                margin: 20px 0; 
                border: 1px solid #2a2a2a; 
                text-align: left;
            }
            .greet { 
                font-size: 16px; 
                font-weight: bold; 
                color: #00d26a; 
                margin-bottom: 5px; 
            }
            .time { 
                font-size: 14px; 
                color: #aaa; 
            }
            .service-status {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 10px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                font-size: 13px;
            }
            .btn-group { 
                display: flex; 
                flex-direction: column; 
                gap: 12px; 
                margin-top: 20px; 
            }
            .btn { 
                padding: 14px; 
                border-radius: 10px; 
                text-decoration: none; 
                font-weight: 600; 
                font-size: 14px; 
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-owner { 
                background: #007bff; 
                color: white; 
            }
            .btn-owner:hover { 
                background: #0056b3; 
            }
            .btn-donate { 
                background: #ffc107; 
                color: #000; 
            }
            .btn-donate:hover { 
                background: #e0a800; 
            }
            .btn-status {
                background: #6c757d;
                color: white;
            }
            .btn-status:hover {
                background: #545b62;
            }
            .footer { 
                margin-top: 25px; 
                font-size: 11px; 
                color: #666; 
                text-align: center;
            }
            .qr-info {
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 10px;
                margin: 15px 0;
                font-size: 12px;
                color: #888;
                border-left: 3px solid #00d26a;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>${NAMA_BOT}</h1>
                <div>WhatsApp AI Assistant Bot</div>
            </div>
            <div class="content">
                <div class="status-badge">● SYSTEM ONLINE</div>
                
                <div class="info-box">
                    <div class="greet">${waktu.sapaan}</div>
                    <div class="time">${waktu.tanggalLengkap} • ${waktu.jam}</div>
                </div>
                
                <div class="qr-info">
                    📱 <strong>Scan QR Code di Terminal</strong><br>
                    Buka WhatsApp → Settings → Linked Devices
                </div>
                
                <div class="service-status">
                    <span>MongoDB:</span>
                    <span>${mongoStatus}</span>
                </div>
                <div class="service-status">
                    <span>Groq AI:</span>
                    <span>${groqStatus}</span>
                </div>
                
                <div class="btn-group">
                    <a href="https://wa.me/${NOMOR_OWNER}" class="btn btn-owner" target="_blank">
                        <span>👤</span> Chat Owner
                    </a>
                    <a href="${LINK_DONASI}" class="btn btn-donate" target="_blank">
                        <span>☕</span> Support Bot
                    </a>
                    <a href="/health" class="btn btn-status">
                        <span>🩺</span> Health Check
                    </a>
                </div>
                
                <div class="footer">
                    Port ${PORT} • Node.js ${process.version} • ${process.env.NODE_ENV || 'production'}
                </div>
            </div>
        </div>
        
        <script>
            // Auto refresh waktu
            function updateTime() {
                const timeElement = document.querySelector('.time');
                if (timeElement) {
                    const now = new Date();
                    const options = { 
                        weekday: 'long',
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'Asia/Jakarta'
                    };
                    timeElement.textContent = now.toLocaleDateString('id-ID', options) + ' WIB';
                }
            }
            
            setInterval(updateTime, 1000);
            updateTime();
            
            // Auto refresh halaman setiap 30 detik untuk update status
            setTimeout(() => {
                window.location.reload();
            }, 30000);
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
                    content: `Kamu adalah ${NAMA_BOT}, asisten WhatsApp. 
                    Jawab dengan singkat, ramah, dan membantu. 
                    Gunakan bahasa Indonesia yang mudah dipahami.` 
                },
                { role: "user", content: pertanyaan }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 500,
        });
        return chatCompletion.choices[0]?.message?.content || "🤖 Maaf, saya sedang sibuk. Coba lagi nanti ya!";
    } catch (error) {
        console.error("AI Error:", error.message);
        return "⚠️ Maaf, AI sedang gangguan. Coba lagi nanti!";
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
        jam: `${String(indonesiaTime.getHours()).padStart(2,'0')}:${String(indonesiaTime.getMinutes()).padStart(2,'0')} WIB`
    };
}

// ==============================================
// 🚀 START BOT
// ==============================================
console.log('🚀 Memulai WhatsApp Bot...');
console.log('🤖 Nama Bot:', NAMA_BOT);
console.log('👤 Owner:', NAMA_OWNER);
console.log('🌐 Port:', PORT);

const startBot = async () => {
    let store = null;
    let mongoConnected = false;
    
    // Koneksi MongoDB jika tersedia
    if (MONGO_URI && MongoStore) {
        try {
            console.log('🔗 Menghubungkan ke MongoDB...');
            
            mongoose.set('strictQuery', false);
            
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
            });
            
            mongoConnected = true;
            console.log('✅ MongoDB Connected!');
            
            // Buat store dengan error handling
            try {
                store = new MongoStore({ mongoose: mongoose });
            } catch (storeError) {
                console.warn('⚠️ Gagal membuat MongoStore:', storeError.message);
                console.log('⚠️ Menggunakan LocalAuth sebagai fallback');
                store = null;
            }
            
        } catch (err) {
            console.error('❌ Gagal koneksi MongoDB:', err.message);
            console.log('⚠️ Menggunakan LocalAuth');
        }
    } else {
        console.log('ℹ️ MongoDB tidak dikonfigurasi, menggunakan LocalAuth');
    }

    // Konfigurasi Puppeteer untuk Heroku
    const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ];

    // Gunakan Chrome yang tersedia di Heroku
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                         (process.env.NODE_ENV === 'production' ? 
                          '/usr/bin/google-chrome-stable' : undefined);

    console.log('🚀 Inisialisasi WhatsApp Client...');

    // Konfigurasi Client WhatsApp
    const clientOptions = {
        puppeteer: {
            headless: 'new',
            executablePath: executablePath,
            args: puppeteerArgs,
        }
    };

    // Tambahkan auth strategy jika store tersedia
    if (store && mongoConnected) {
        clientOptions.authStrategy = new RemoteAuth({
            clientId: 'jonkris-bot',
            store: store,
            backupSyncIntervalMs: 300000,
        });
    } else {
        clientOptions.authStrategy = new LocalAuth({
            clientId: 'jonkris-local',
            dataPath: './.wwebjs_auth'
        });
    }

    const client = new Client(clientOptions);

    // Event Handlers
    client.on('qr', (qr) => { 
        console.log('\n📱 ============================================');
        console.log('📱 SCAN QR CODE DI BAWAH INI UNTUK LOGIN:');
        console.log('📱 ============================================');
        qrcode.generate(qr, { small: true });
        console.log('📱 ============================================');
        console.log('💡 Cara Scan:');
        console.log('1. Buka WhatsApp di HP');
        console.log('2. Settings → Linked Devices → Link a Device');
        console.log('3. Scan QR code di atas');
        console.log('📱 ============================================\n');
    });

    client.on('ready', () => { 
        console.log('\n✨ ============================================');
        console.log(`✨ ${NAMA_BOT} BERHASIL DIJALANKAN!`);
        console.log(`✨ WhatsApp: ${client.info.pushname}`);
        console.log(`✨ Nomor: ${client.info.wid.user}`);
        console.log(`✨ Siap melayani!`);
        console.log('✨ ============================================\n');
    });

    client.on('authenticated', () => {
        console.log('✅ Authenticated successfully');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('❌ Disconnected:', reason);
        console.log('🔄 Restarting in 5 seconds...');
        setTimeout(() => {
            console.log('🔄 Restarting client...');
            client.initialize();
        }, 5000);
    });

    // ==============================================
    // 📨 MESSAGE HANDLER (SIMPLE VERSION)
    // ==============================================
    client.on('message_create', async msg => {
        try {
            // Skip pesan dari bot sendiri dan status broadcast
            if (msg.from === 'status@broadcast' || msg.fromMe) return;

            const body = msg.body.trim();
            const command = body.split(' ')[0].toLowerCase();
            const args = body.slice(command.length + 1).trim();

            // 1. MENU
            if (command === '.menu' || command === '.help' || command === '!menu') {
                const waktu = getWaktuIndonesia();
                const captionMenu = `
🤖 *${NAMA_BOT} MENU*

👋 ${waktu.sapaan}, ${msg._data.notifyName || 'User'}!
⏰ ${waktu.jam}

📋 *FITUR TERSEDIA:*
• *.menu* - Tampilkan menu ini
• *.sticker* - Buat sticker dari gambar
• *.owner* - Info pemilik bot
• *.donasi* - Support bot
• *.ping* - Cek status bot
• Chat langsung untuk AI Assistant

💡 *Cara Pakai:*
- Kirim gambar dengan caption *.sticker*
- Tag bot di grup untuk chat AI
- Atau chat langsung di private

🔧 *Status:* ${mongoConnected ? 'MongoDB Active' : 'Local Mode'}
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
                    await msg.reply('❌ Kirim atau reply gambar dengan caption *.sticker*'); 
                }
            }

            // 3. OWNER
            else if (command === '.owner') {
                await msg.reply(`👑 *OWNER ${NAMA_BOT}*\n\n📛 Nama: ${NAMA_OWNER}\n📱 WA: wa.me/${NOMOR_OWNER}\n\nJangan spam ya! 😊`);
            }

            // 4. DONASI
            else if (command === '.donasi' || command === '.donate') {
                await msg.reply(`💖 *SUPPORT ${NAMA_BOT}*\n\nBantu bot tetap online dengan donasi:\n🔗 ${LINK_DONASI}\n\nTerima kasih banyak! 🙏`);
            }

            // 5. PING
            else if (command === '.ping' || command === '.status') {
                const waktu = getWaktuIndonesia();
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                
                await msg.reply(`🏓 *PONG!*\n\n⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s\n📅 ${waktu.tanggalLengkap}\n⏰ ${waktu.jam}\n\n${NAMA_BOT} siap melayani! 🚀`);
            }

            // 6. AI CHAT (Private chat atau mention di grup)
            else {
                const isGroup = msg.from.includes('@g.us');
                const isMentioned = msg.mentionedIds && 
                    msg.mentionedIds.includes(client.info?.wid?._serialized);
                
                if (!isGroup || isMentioned) {
                    if (body.length > 2 && !body.startsWith('.')) {
                        try {
                            const chat = await msg.getChat();
                            await chat.sendStateTyping();
                            
                            let prompt = body;
                            if (isMentioned) {
                                prompt = body.replace(`@${client.info.wid.user}`, '').trim();
                            }
                            
                            const jawaban = await tanyaAI(prompt);
                            await msg.reply(jawaban);
                        } catch (error) {
                            console.log('AI Response error:', error.message);
                            await msg.reply('⚠️ Maaf, terjadi error. Coba lagi nanti ya!');
                        }
                    }
                }
            }

        } catch (err) { 
            console.log('Message Handler Error:', err.message);
        }
    });

    // Start Express Server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Dashboard: http://localhost:${PORT}`);
        console.log(`🏥 Health: http://localhost:${PORT}/health`);
    });
    
    // Initialize WhatsApp Client
    await client.initialize();
};

// JALANKAN BOT
startBot().catch(err => {
    console.error('❌ FATAL ERROR:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
});

// Error Handlers
process.on('uncaughtException', (err) => { 
    console.error('⚠️ Uncaught Exception:', err); 
});

process.on('unhandledRejection', (reason, promise) => { 
    console.error('⚠️ Unhandled Rejection:', reason); 
});