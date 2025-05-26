// routes/tagImages.js
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// p-limit 导入兼容处理
// 修改為:
let createLimit;
try {
  // 嘗試作為 CommonJS 模組載入
  createLimit = require('p-limit');
  if (typeof createLimit !== 'function' && createLimit.default) {
    createLimit = createLimit.default;
  }
} catch (error) {
  // 提供一個基本的限流函數作為後備
  console.warn('無法載入 p-limit，使用自定義限流器');
  createLimit = (concurrency) => {
    const queue = [];
    let running = 0;
    
    const next = () => {
      if (queue.length === 0 || running >= concurrency) return;
      running++;
      const { fn, resolve, reject } = queue.shift();
      
      Promise.resolve(fn())
        .then(result => {
          running--;
          resolve(result);
          next();
        })
        .catch(err => {
          running--;
          reject(err);
          next();
        });
    };
    
    return (fn) => new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

const { OpenAI } = require('openai');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// ========== 参数区 ==========
const MAX_CONCURRENCY = 4;
const MAX_RETRY       = 6;
const MODEL           = 'gpt-4o';
const ALL_RESULTS     = path.join(__dirname, '../all_results.json');

const STYLE_OPTIONS   = ["漸層","跳色","貓眼","單色","法式","手繪","鏡面"];
const SHAPE_OPTIONS   = ["方形（Square）","圓形（Round）","橢圓形（Oval）","方圓形（Squoval）","尖形（Stiletto）"];
const COLOR_OPTIONS   = ["紅色","橙色","黃色","綠色","藍色","靛色","紫色","黑色","白色","灰色","粉色","金屬銀","裸粉色"];
const TEXTURE_OPTIONS = ["光澤（Glossy）","霧面（Matte）","亮片（Glitter）","珠光（Pearlescent）","砂糖感（Sugar）","金屬箔（Foil）","絲絨（Velvet）"];
const DECOR_OPTIONS   = ["水鑽（Rhinestone）","雕花（3D art）","金屬飾片（Metal pieces）","貝殼（Shell）","貼紙（Sticker）","畫圖章（Stamp）"];
const THEME_OPTIONS   = ["日常","春","夏","秋","冬","韓系","日系","歐美風","簡約","可愛","優雅","繽紛"];

const SYSTEM_PROMPT =
  "你是一位專業美甲標註師，輸出必須符合下列格式與限制：" +
  "回傳 **JSON 陣列**，順序對應輸入圖片，嚴禁程式碼區塊與多餘文字。\n" +
  `style: ${STYLE_OPTIONS}\n` +
  `shape: ${SHAPE_OPTIONS}\n` +
  `color: ${COLOR_OPTIONS}\n` +
  `texture: ${TEXTURE_OPTIONS}\n` +
  `decorations: ${DECOR_OPTIONS}\n` +
  `theme: ${THEME_OPTIONS}\n` +
  "若無法判斷請用空陣列 []。";

// OpenAI Client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// helper: 将文件读成 data URL
function toDataUrl(filePath, mimeType) {
  const b64 = fs.readFileSync(filePath, { encoding: 'base64' });
  return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } };
}

// helper: 从错误消息解析等待秒数
function parseWaitSecs(msg) {
  const m = msg.match(/([\d.]+)\s*(ms|s)/);
  if (!m) return 1.5;
  const [_, val, unit] = m;
  return unit === 'ms' ? parseFloat(val) / 1000 : parseFloat(val);
}

// normalize raw GPT tags into arrays
function normalizeTags(tags) {
  const out = {};
  for (const key of ['style','shape','color','texture','decorations','theme']) {
    const v = tags[key];
    if (!v) {
      out[key] = [];
    } else if (Array.isArray(v)) {
      out[key] = v;
    } else if (typeof v === 'string') {
      out[key] = v
        .split(/[,，、\s]+/)    // 支持中英文逗号、顿号、空白
        .map(s => s.trim())
        .filter(s => s);
    } else {
      out[key] = [String(v)];
    }
  }
  return out;
}

// 调用 GPT 并 retry
async function callWithRetry(filePath, fileMime) {
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
              { type: 'text', text: '請標註此指甲' },
              toDataUrl(filePath, fileMime)
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 256,
      });
      const content = resp.choices[0].message.content.trim();
      if (!content) throw new Error('empty_response');
      return JSON.parse(content);
    } catch (err) {
      if (err.message === 'empty_response' || err instanceof SyntaxError) {
        console.warn(`⚠️ ${path.basename(filePath)} JSON/空回應 #${attempt}`);
      } else if (err.status === 429) {
        const wait = parseWaitSecs(err.message || '');
        console.warn(`⏳ 429 等待 ${wait}s`);
        await new Promise(r => setTimeout(r, wait * 1000));
      } else {
        const wait = 1.5 * Math.pow(2, attempt);
        console.warn(`🌀 API 錯誤 #${attempt} 等待 ${wait}s`, err.status || err.message);
        await new Promise(r => setTimeout(r, wait * 1000));
      }
      await new Promise(r => setTimeout(r, Math.random() * 200 + 100));
    }
  }
  return null;
}

// POST /api/tag
router.post('/tag', upload.array('images', 10), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: '請上傳最多 10 張圖片（field: images）' });
  }

  // 1. 讀 all_results.json
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(ALL_RESULTS, 'utf-8'));
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('讀取 all_results.json 失敗', e);
      return res.status(500).json({ error: 'Server 讀檔錯誤', detail: e.message });
    }
  }

  // 2. 并发限制器
  const limit = createLimit(MAX_CONCURRENCY);

  // 3. 並行呼叫 GPT
  const tasks = req.files.map(file => limit(async () => {
    const rawTags = await callWithRetry(file.path, file.mimetype);
    fs.unlinkSync(file.path);
    if (!rawTags) return { filename: file.originalname, tags: null };
    const tags = normalizeTags(rawTags);
    return { filename: file.originalname, tags };
  }));
  const results = await Promise.all(tasks);

  // 4. 合併並寫回 all_results.json
  results.forEach(({ filename, tags }) => {
    if (tags) existing[filename] = tags;
  });
  try {
    fs.writeFileSync(ALL_RESULTS, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (e) {
    console.error('寫入 all_results.json 失敗', e);
    return res.status(500).json({ error: 'Server 寫檔錯誤', detail: e.message });
  }

  // 5. 回傳結果
  const updated = {};
  results.forEach(r => { if (r.tags) updated[r.filename] = r.tags; });
  res.json({ updated, totalCount: Object.keys(existing).length });
});

module.exports = router;
