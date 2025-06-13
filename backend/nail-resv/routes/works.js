// backend/nail-resv/routes/works.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 獲取美甲師的所有作品
router.get('/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { limit = 50 } = req.query;
    const supabase = req.supabase;

    const maxLimit = Math.min(parseInt(limit, 10) || 50, 100);

    // 從 nail_images 表格獲取該美甲師的所有作品
    const { data, error } = await supabase
      .from('nail_images')
      .select('*')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(maxLimit);

    if (error) {
      console.error('查詢美甲師作品失敗:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Database query failed',
        details: error.message 
      });
    }

    // 格式化作品資料，符合前端 Profile 頁面的期望格式
    const works = data.map(item => ({
        id: item.id,
        description: item.description || '',
        date: item.created_at.split('T')[0],
        image: item.image_url,
        tags: [
          ...(Array.isArray(item.style) ? item.style : []),
          ...(Array.isArray(item.shape) ? item.shape : []),       
          ...(Array.isArray(item.color) ? item.color : []),
          ...(Array.isArray(item.texture) ? item.texture : []),
          ...(Array.isArray(item.decorations) ? item.decorations : []), 
          ...(Array.isArray(item.theme) ? item.theme : [])
        ].filter(tag => tag && tag.trim())
      }));
      
      res.json({
        success: true,
        count: works.length,
        works: works
      });

  } catch (error) {
    console.error('獲取美甲師作品錯誤:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// 新增作品
router.post('/artist/:artistId', async (req, res) => {
    try {
      const { artistId } = req.params;
      const { description, tags, imageData } = req.body; // imageData 是 base64
      const supabase = req.supabase;
  
      // 驗證必要欄位
      if (!imageData) {
        return res.status(400).json({
          success: false,
          error: 'Image data is required'
        });
      }
  
      // 獲取美甲師的 place_id
      const { data: artistData, error: artistError } = await supabase
        .from('artists')
        .select('place_id')
        .eq('user_id', artistId)
        .single();
  
      if (artistError || !artistData) {
        return res.status(404).json({
          success: false,
          error: 'Artist not found'
        });
      }
  
      // 生成檔案名稱
      const timestamp = Date.now();
      const filename = `manual_upload_${artistId}_${timestamp}.jpg`;
  
      // 處理 base64 圖片
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
  
      // 上傳圖片到 Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('nailimg')
        .upload(`allimgs/${filename}`, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
  
      if (uploadError) {
        console.error('Supabase 上傳錯誤:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload image'
        });
      }
  
      // 獲取公開 URL
      const { data: publicData } = supabase.storage
        .from('nailimg')
        .getPublicUrl(`allimgs/${filename}`);
  
      const imageUrl = publicData.publicUrl;
  
      // 處理標籤格式 - 修正後的優先分配邏輯
      const tagsArray = Array.isArray(tags) ? tags : [];

        const processedTags = {
        style: [],
        shape: [],
        color: [],
        texture: [],
        decorations: [],
        theme: []
        };

        tagsArray.forEach(tag => {
        let matched = false;
        
        // Style 優先 - 美甲技法
        if (['亮片', '單色', '手繪', '法式', '漸層', '貓眼', '跳色', '鏡面', '雕花'].includes(tag)) {
            processedTags.style.push(tag);
            matched = true;
        }
        // Shape 優先 - 指甲形狀
        else if ([
            '圓形（Round）', '圓形', 'Round',
            '尖形', '尖形（Stiletto）', 'Stiletto', 
            '方圓形（Squoval）', '方圓形', 'Squoval',
            '方形（Square）', '方形', 'Square',
            '橢圓形（Oval）', '橢圓形', 'Oval'
        ].includes(tag)) {
            processedTags.shape.push(tag);
            matched = true;
        }
        // Color 優先 - 顏色
        else if ([
            '亮片', '咖啡色', '棕色', '橙色', '灰色', '白色', '粉色', '紅色', '紫色', 
            '綠色', '藍色', '裸粉色', '酒紅色', '金屬銀', '銀色', '靛色', 
            '黃色', '黑色'
        ].includes(tag)) {
            processedTags.color.push(tag);
            matched = true;
        }
        // Texture 優先 - 質感效果
        else if ([
            '亮片', '亮片（Glitter）', 'Glitter',
            '光澤', '光澤（Glossy）', 'Glossy',
            '珠光（Pearlescent）', '珠除光（Pearlescent）', 'Pearlescent',
            '砂糖感（Sugar）', '砂糖感', 'Sugar',
            '金屬箔（Foil）',
            '霧面（Matte）', '霧面', 'Matte'
        ].includes(tag)) {
            processedTags.texture.push(tag);
            matched = true;
        }
        // Decorations 優先 - 裝飾元素
        else if ([
            '水鑽', '水鑽（Rhinestone）', 'Rhinestone',
            '珠光（Pearlescent）',
            '畫圖章（Stamp）', '畫圖章', 'Stamp',
            '貝殼（Shell）', '貝殼', 'Shell',
            '貼紙（Sticker）', '貼紙', 'Sticker',
            '金屬箔', '金屬箔（Foil）', 'Foil',
            '金屬飾片', '金屬飾片（Metal pieces）', 'Metal pieces',
            '雕花', '雕花（3D art）', '3D art'
        ].includes(tag)) {
            processedTags.decorations.push(tag);
            matched = true;
        }
        // Theme 優先 - 主題風格
        else if ([
            '優雅', '冬', '可愛', '夏', '日常', '日系', '春', '歐美風', 
            '秋', '簡約', '繽紛', '韓系'
        ].includes(tag)) {
            processedTags.theme.push(tag);
            matched = true;
        }
        
        // 🔥 新增：如果不在任何預設分類中，放到 theme 作為自訂標籤
        if (!matched && tag.trim()) {
            processedTags.theme.push(tag.trim());
        }
        });
  
      // 插入到 nail_images 表格
      const { data, error } = await supabase
        .from('nail_images')
        .insert([{
          artist_id: artistId,
          place_id: artistData.place_id,
          filename: filename,
          image_url: imageUrl,
          description: description || '',
          style: processedTags.style,
          shape: processedTags.shape,
          color: processedTags.color,
          texture: processedTags.texture,
          decorations: processedTags.decorations,
          theme: processedTags.theme,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
  
      if (error) {
        console.error('新增作品失敗:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to add work',
          details: error.message
        });
      }
  
      // 格式化回傳資料
      const newWork = {
        id: data.id,
        description: data.description,
        date: data.created_at.split('T')[0],
        image: data.image_url,
        tags: [
          ...processedTags.style,
          ...processedTags.shape,
          ...processedTags.color,
          ...processedTags.texture,
          ...processedTags.decorations,
          ...processedTags.theme
        ].filter(tag => tag)
      };
      // invoke feature extraction
      const tmpDir = path.join(__dirname, "../tmp");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpPath = path.join(tmpDir, filename);
      fs.writeFileSync(tmpPath, buffer);
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const py = spawn(pythonCmd, [
        path.join(__dirname, "../../python/image_search.py"),
        "extract",
        tmpPath,
        String(data.id),
        "--supabase-url",
        process.env.SUPABASE_URL,
        "--supabase-key",
        process.env.SUPABASE_SERVICE_KEY,
      ], {
        env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' }
      });

      py.on("close", () => fs.unlink(tmpPath, () => {}));
      py.on("error", (err) => {
        console.error('Python error:', err);
      });
  
      res.json({
        success: true,
        message: 'Work added successfully',
        work: newWork
      });
  
    } catch (error) {
      console.error('新增作品錯誤:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
});

// 刪除作品
router.delete('/:workId', async (req, res) => {
  try {
    const { workId } = req.params;
    const supabase = req.supabase;

    // 刪除作品
    const { error } = await supabase
      .from('nail_images')
      .delete()
      .eq('id', workId);

    if (error) {
      console.error('刪除作品失敗:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete work',
        details: error.message
      });
    }

    res.json({
      success: true,
      message: 'Work deleted successfully'
    });

  } catch (error) {
    console.error('刪除作品錯誤:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// 更新作品
router.put('/:workId', async (req, res) => {
  try {
    const { workId } = req.params;
    const { description, tags } = req.body;
    const supabase = req.supabase;

    // 處理標籤格式 - 使用與 POST 路由相同的邏輯
    const tagsArray = Array.isArray(tags) ? tags : [];

    const processedTags = {
    style: [],
    shape: [],
    color: [],
    texture: [],
    decorations: [],
    theme: []
    };

    tagsArray.forEach(tag => {
    let matched = false;
    
    // Style 優先 - 美甲技法
    if (['亮片', '單色', '手繪', '法式', '漸層', '貓眼', '跳色', '鏡面', '雕花'].includes(tag)) {
        processedTags.style.push(tag);
        matched = true;
    }
    // Shape 優先 - 指甲形狀
    else if ([
        '圓形（Round）', '圓形', 'Round',
        '尖形', '尖形（Stiletto）', 'Stiletto', 
        '方圓形（Squoval）', '方圓形', 'Squoval',
        '方形（Square）', '方形', 'Square',
        '橢圓形（Oval）', '橢圓形', 'Oval'
    ].includes(tag)) {
        processedTags.shape.push(tag);
        matched = true;
    }
    // Color 優先 - 顏色
    else if ([
        '亮片', '咖啡色', '棕色', '橙色', '灰色', '白色', '粉色', '紅色', '紫色', 
        '綠色', '藍色', '裸粉色', '酒紅色', '金屬銀', '銀色', '靛色', 
        '黃色', '黑色'
    ].includes(tag)) {
        processedTags.color.push(tag);
        matched = true;
    }
    // Texture 優先 - 質感效果
    else if ([
        '亮片', '亮片（Glitter）', 'Glitter',
        '光澤', '光澤（Glossy）', 'Glossy',
        '珠光（Pearlescent）', '珠除光（Pearlescent）', 'Pearlescent',
        '砂糖感（Sugar）', '砂糖感', 'Sugar',
        '金屬箔（Foil）',
        '霧面（Matte）', '霧面', 'Matte'
    ].includes(tag)) {
        processedTags.texture.push(tag);
        matched = true;
    }
    // Decorations 優先 - 裝飾元素
    else if ([
        '水鑽', '水鑽（Rhinestone）', 'Rhinestone',
        '珠光（Pearlescent）',
        '畫圖章（Stamp）', '畫圖章', 'Stamp',
        '貝殼（Shell）', '貝殼', 'Shell',
        '貼紙（Sticker）', '貼紙', 'Sticker',
        '金屬箔', '金屬箔（Foil）', 'Foil',
        '金屬飾片', '金屬飾片（Metal pieces）', 'Metal pieces',
        '雕花', '雕花（3D art）', '3D art'
    ].includes(tag)) {
        processedTags.decorations.push(tag);
        matched = true;
    }
    // Theme 優先 - 主題風格
    else if ([
        '優雅', '冬', '可愛', '夏', '日常', '日系', '春', '歐美風', 
        '秋', '簡約', '繽紛', '韓系'
    ].includes(tag)) {
        processedTags.theme.push(tag);
        matched = true;
    }
    
    // 🔥 新增：如果不在任何預設分類中，放到 theme 作為自訂標籤
    if (!matched && tag.trim()) {
        processedTags.theme.push(tag.trim());
    }
    });

        // 更新作品
        const { data, error } = await supabase
        .from('nail_images')
        .update({
            description: description || '',
            style: processedTags.style,
            shape: processedTags.shape,
            color: processedTags.color,
            texture: processedTags.texture,
            decorations: processedTags.decorations,
            theme: processedTags.theme
        })
        .eq('id', workId)
        .select()
        .single();

        if (error) {
        console.error('更新作品失敗:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update work',
            details: error.message
        });
        }

        // 格式化回傳資料 - 只顯示純中文標籤
        const simplifyTag = (tag) => {
        // 移除英文括號部分，只保留中文
        return tag.replace(/\s*\([^)]*\)\s*/g, '').trim();
        };

        const updatedWork = {
        id: data.id,
        description: data.description || '',
        date: data.created_at.split('T')[0],
        image: data.image_url,
        tags: [
            ...processedTags.style.map(simplifyTag),
            ...processedTags.shape.map(simplifyTag),
            ...processedTags.color.map(simplifyTag),
            ...processedTags.texture.map(simplifyTag),
            ...processedTags.decorations.map(simplifyTag),
            ...processedTags.theme.map(simplifyTag)
        ].filter(tag => tag)
        };

        res.json({
        success: true,
        message: 'Work updated successfully',
        work: updatedWork
        });

    } catch (error) {
        console.error('更新作品錯誤:', error);
        res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
        });
    }
    });

module.exports = router;