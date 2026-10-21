const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const SYSTEM_INSTRUCTION = "Kamu adalah asisten virtual website portofolio Swandy Sianturi. "
    + "Jawab ramah, singkat, dan membantu, dalam Bahasa Indonesia kecuali pengguna memakai bahasa lain. "
    + "Konteks: Swandy Sianturi adalah mahasiswa awal semester Jurusan Teknik Informatika, "
    + "Program Studi Teknologi Rekayasa Perangkat Lunak di Politeknik Negeri Batam. "
    + "Proyek: (1) Aplikasi Website Pengajuan Dokumen Warga Digital (HTML, CSS, PHP), "
    + "(2) AR HAND DRAW DETECTOR, aplikasi menggambar AR yang memakai computer vision "
    + "untuk melukis di ruang digital dengan gestur tangan (HTML, CSS). "
    + "Tech stack: React, Three.js, Tailwind, Node.js, Figma, Next.js. "
    + "Kontak: email swandyxtry@gmail.com, Instagram @classicalwan, LinkedIn Swandy Sianturi. "
    + "Jika ditanya hal di luar portofolio, tetap bantu dengan sopan.";

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY belum diset di environment variable.' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            res.status(400).json({ error: 'Invalid JSON body' });
            return;
        }
    }
    if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
    }

    let message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message === '') {
        res.status(400).json({ error: 'Message kosong' });
        return;
    }
    if (message.length > 4000) {
        message = message.slice(0, 4000);
    }

    const contents = [];
    if (Array.isArray(body.history)) {
        for (const turn of body.history) {
            if (!turn || typeof turn !== 'object') continue;
            const role = turn.role === 'user' ? 'user' : 'model';
            const text = typeof turn.text === 'string' ? turn.text.trim() : '';
            if (text === '') continue;
            contents.push({ role, parts: [{ text }] });
        }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const trimmed = contents.length > 40 ? contents.slice(-40) : contents;

    const payload = {
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: trimmed,
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
        },
    };

    let lastError = 'semua model sibuk, coba lagi sebentar';

    for (const model of GEMINI_MODELS) {
        let response;
        try {
            response = await fetch(GEMINI_BASE + model + ':generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY,
                },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            lastError = 'Gagal menghubungi Gemini: ' + err.message;
            continue;
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            lastError = 'Respons Gemini tidak valid';
            continue;
        }

        if (response.ok) {
            let reply = '';
            const parts = data && data.candidates && data.candidates[0]
                && data.candidates[0].content && data.candidates[0].content.parts;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    if (part && typeof part.text === 'string') reply += part.text;
                }
            }
            reply = reply.trim();
            if (reply === '') {
                reply = 'Maaf, saya belum bisa menjawab itu. Coba tanya dengan cara lain ya.';
            }
            res.status(200).json({ reply });
            return;
        }

        const detail = data && data.error && data.error.message ? data.error.message : 'Unknown error';
        lastError = 'Gemini error: ' + detail;

        if (response.status !== 503 && response.status !== 429) {
            break;
        }
    }

    res.status(502).json({ error: lastError });
};