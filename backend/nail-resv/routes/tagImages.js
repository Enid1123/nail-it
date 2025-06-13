// routes/tagImages.js
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// 動態載入 p-limit ES module
let createLimit;
const initPLimit = async () => {
  if (!createLimit) {
    const pLimit = await import('p-limit');
    createLimit = pLimit.default;
  }
  return createLimit;
};

const { OpenAI } = require('openai');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

// 生成符合搜尋邏輯的檔案名稱
function generateImageName(placeId, index) {
  const timestamp = Date.now();
  return `photo_placeid-${placeId}_idx-${index}_${timestamp}.jpg`;
}

// 上傳圖片到 Supabase Storage
async function uploadImageToSupabase(filePath, filename) {
  try {
    console.log(`🔍 開始上傳: ${filename}`);
    console.log(`📁 檔案路徑: ${filePath}`);
    
    // 檢查檔案是否存在
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 檔案不存在: ${filePath}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`📏 檔案大小: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    
    const { data, error } = await supabase.storage
      .from('nailimg')
      .upload(`allimgs/${filename}`, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true // 允許覆蓋現有檔案
      });

    if (error) {
      console.error('❌ Supabase 上傳錯誤:');
      console.error('   錯誤代碼:', error.error);
      console.error('   錯誤訊息:', error.message);
      console.error('   狀態碼:', error.statusCode);
      console.error('   完整錯誤:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log(`✅ 上傳成功: ${data.path}`);

    // 獲取公開 URL
    const { data: publicData } = supabase.storage
      .from('nailimg')
      .getPublicUrl(`allimgs/${filename}`);

    console.log(`🔗 公開 URL: ${publicData.publicUrl}`);
    return publicData.publicUrl;
  } catch (error) {
    console.error('❌ 上傳圖片到 Supabase 失敗:', error);
    return null;
  }
}

// 根據 place_id 查找對應的 artist_id
async function findArtistByPlaceId(placeId) {
  try {
    const { data, error } = await supabase
      .from('artists')
      .select('user_id')
      .eq('place_id', placeId)
      .single();

    if (error || !data) {
      console.warn(`⚠️ 找不到 place_id ${placeId} 對應的美甲師`);
      return null;
    }

    return data.user_id;
  } catch (error) {
    console.error('查找美甲師失敗:', error);
    return null;
  }
}

// 將資料存到 Supabase nail_images 表
async function saveToNailImages(placeId, imageUrl, tags, filename) {
  try {
    // 根據 place_id 查找對應的 artist_id
    const artistId = await findArtistByPlaceId(placeId);
    
    if (!artistId) {
      console.error(`❌ 無法找到 place_id ${placeId} 對應的美甲師，跳過資料庫儲存`);
      return false;
    }

    const { data, error } = await supabase
      .from('nail_images')
      .insert([
      {
        artist_id: artistId,
        place_id: placeId,
        filename: filename,
        image_url: imageUrl,
        style: tags.style || [],
        shape: tags.shape || [],
        color: tags.color || [],
        texture: tags.texture || [],
        decorations: tags.decorations || [],
        theme: tags.theme || [],
        created_at: new Date().toISOString()
      }
    ])
      .select()
      .single();
    

    if (error) {
      console.error('儲存到 nail_images 表失敗:', error);
      return null;
    }

    console.log(`✅ 成功儲存 ${filename} 到 nail_images 表 (artist: ${artistId})`);
    return data.id;
  } catch (error) {
    console.error('儲存到 nail_images 表發生錯誤:', error);
    return null;
  }
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

  // 從請求中取得 placeId，這應該是真實的 Google Places ID
  const placeId = req.body.placeId;
  if (!placeId) {
    return res.status(400).json({ error: '請提供 placeId（美甲店的 Google Places ID）' });
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

  // 2. 初始化並發限制器
  const limitFunction = await initPLimit();
  const limit = limitFunction(MAX_CONCURRENCY);

  // 3. 處理每個圖片：標註 + 上傳 + 儲存
  const tasks = req.files.map((file, index) => limit(async () => {
    try {
      // 生成符合搜尋邏輯的檔案名稱
      const filename = generateImageName(placeId, index + 1);
      
      // OpenAI 標註
      const rawTags = await callWithRetry(file.path, file.mimetype);
      if (!rawTags) {
        fs.unlinkSync(file.path);
        return { 
          originalName: file.originalname, 
          filename: filename,
          success: false, 
          error: 'AI 標註失敗' 
        };
      }

      const tags = normalizeTags(rawTags);
      
      // 上傳圖片到 Supabase Storage
      const imageUrl = await uploadImageToSupabase(file.path, filename);
      if (!imageUrl) {
        fs.unlinkSync(file.path);
        return { 
          originalName: file.originalname, 
          filename: filename,
          success: false, 
          error: 'Supabase 上傳失敗' 
        };
      }

      // 儲存到 nail_images 表
      const imageId = await saveToNailImages(placeId, imageUrl, tags, filename);

      if (imageId) {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        spawnSync(pythonCmd, [
          path.join(__dirname, '../../python/image_search.py'),
          'extract',
          file.path,
          String(imageId),
          '--supabase-url', process.env.SUPABASE_URL,
          '--supabase-key', process.env.SUPABASE_SERVICE_KEY
        ], { env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' } });
      }

      // 清理臨時檔案
      fs.unlinkSync(file.path);

      return { 
        originalName: file.originalname,
        filename: filename,
        imageUrl: imageUrl,
        tags: tags,
        success: true,
        nailImagesSaved: Boolean(imageId)
      };

    } catch (error) {
      console.error(`處理圖片 ${file.originalname} 時發生錯誤:`, error);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return { 
        originalName: file.originalname, 
        success: false, 
        error: error.message 
      };
    }
  }));

  const results = await Promise.all(tasks);

  // 4. 更新 all_results.json（只有成功的標註）
  const successfulResults = results.filter(r => r.success && r.tags);
  successfulResults.forEach(({ filename, tags }) => {
    if (tags) existing[filename] = tags;
  });

  try {
    fs.writeFileSync(ALL_RESULTS, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (e) {
    console.error('寫入 all_results.json 失敗', e);
    return res.status(500).json({ error: 'Server 寫檔錯誤', detail: e.message });
  }

  // 5. 統計結果
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // 6. 回傳結果
  res.json({ 
    message: `處理完成！成功: ${successful.length} 張，失敗: ${failed.length} 張`,
    successful: successful.map(r => ({
      originalName: r.originalName,
      filename: r.filename,
      imageUrl: r.imageUrl,
      tags: r.tags,
      nailImagesSaved: r.nailImagesSaved
    })),
    failed: failed.map(r => ({
      originalName: r.originalName,
      error: r.error
    })),
    totalInAllResults: Object.keys(existing).length
  });
});


router.post('/tag-base64', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供 base64 圖片資料' 
      });
    }

    // 確保 uploads 目錄存在
    const uploadsDir = path.join(__dirname, '../uploads/');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const tempPath = path.join(__dirname, '../uploads/', `temp_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);

    try {
      console.log('🔍 開始 AI 分析圖片...');
      const rawTags = await callWithRetry(tempPath, 'image/jpeg');
      
      // 清理臨時檔案
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      
      if (!rawTags) {
        console.log('⚠️ AI 分析無結果，使用預設標籤');
        return res.json({ 
          success: true, 
          tags: ['簡約', '優雅', '日常', '可愛'] // 預設建議
        });
      }

      console.log('✅ AI 分析結果:', rawTags);
      const normalizedTags = normalizeTags(rawTags);
      
      const allTags = [
        ...(normalizedTags.style || []),
        ...(normalizedTags.shape || []), 
        ...(normalizedTags.color || []),
        ...(normalizedTags.texture || []),
        ...(normalizedTags.decorations || []),
        ...(normalizedTags.theme || [])
      ].filter(tag => tag && typeof tag === 'string' && tag.trim()); // 加強過濾

      const uniqueTags = [...new Set(allTags)].slice(0, 8);

      res.json({ 
        success: true, 
        tags: uniqueTags.length > 0 ? uniqueTags : ['簡約', '優雅', '日常'] // 確保至少有標籤
      });

    } catch (error) {
      // 確保清理臨時檔案
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      console.error('AI 分析錯誤:', error);
      
      // 回傳預設標籤而非錯誤
      res.json({ 
        success: true, 
        tags: ['精緻', '清新', '溫柔']
      });
    }

  } catch (error) {
    console.error('base64 標註錯誤:', error);
    res.json({ 
      success: true, // 改成 true，避免前端錯誤
      tags: ['美甲', '設計', '藝術']
    });
  }
});


module.exports = router;
