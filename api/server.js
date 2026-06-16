const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// دالة داخلية لإنشاء الاتصال بشكل مؤقت لكل طلب
function createPool() {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // لو معلق يقفل في 5 ثواني
    });
}

// API الرفع
app.post('/api/upload', async (req, res) => {
    const { videoUrl, srtText, srtName } = req.body;
    if (!videoUrl || !srtText) return res.status(400).json({ error: "البيانات ناقصة" });

    const pool = createPool(); // افتح الاتصال

    try {
        const result = await pool.query(
            "INSERT INTO uploads (user_email, video_url, srt_name, srt_content) VALUES ($1, $2, $3, $4) RETURNING id",
            ['anonymous_user', videoUrl, srtName || 'sub.srt', srtText]
        );
        res.status(200).json({ srtId: result.rows[0].id });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } finally {
        await pool.end(); // 💡 السحر هنا: قفل الاتصال فوراً وتحرير المساحة في Neon للي بعده
    }
});

// API جلب الترجمة
app.get('/api/srt/:id', async (req, res) => {
    const pool = createPool(); // افتح الاتصال
    try {
        const result = await pool.query("SELECT srt_content FROM uploads WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).send("الترجمة غير موجودة");
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(result.rows[0].srt_content);
    } catch (err) { 
        res.status(500).send(err.message); 
    } finally {
        await pool.end(); // 💡 قفل الاتصال فوراً بعد العرض
    }
});

module.exports = app;
