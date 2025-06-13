const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const router = express.Router();

router.post('/search-image', async (req, res) => {
  try {
    const { imageData } = req.body;
    const supabase = req.supabase;
    if (!imageData) {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `query_${Date.now()}.jpg`;
    await supabase.storage.from('user-query').upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpPath = path.join(tmpDir, filename);
    fs.writeFileSync(tmpPath, buffer);
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = spawnSync(pythonCmd, [
      path.join(__dirname, '../../python/image_search.py'),
      'search',
      tmpPath,
      '--supabase-url',
      process.env.SUPABASE_URL,
      '--supabase-key',
      process.env.SUPABASE_SERVICE_KEY
    ], {
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE' }
    });

    fs.unlinkSync(tmpPath);
    if (result.error || result.status !== 0) {
      console.error('Python error:', result.error || result.stderr.toString());
      return res.status(500).json({ success: false, error: 'Search failed' });
    }
    const stdout = result.stdout.toString().trim();
    const lastLine = stdout.split(/\r?\n/).pop();
    const items = JSON.parse(lastLine || '[]');

    if (!items.length) {
      return res.json({ success: false, error: 'no nails detected' });
    }

    const ids = items.map(it => it.id);

    const { data: nails, error: nailErr } = await supabase
      .from('nail_images')
      .select('id, artist_id, image_url, style, shape, color, texture, decorations, theme')
      .in('id', ids);

    if (nailErr) {
      console.error('fetch nails error:', nailErr);
      return res.status(500).json({ success: false, error: 'Database query failed' });
    }

    const nailMap = nails.reduce((acc, n) => {
      acc[n.id] = n;
      return acc;
    }, {});

    const artistIds = [...new Set(nails.map(n => n.artist_id))];
    let artists = [];
    if (artistIds.length) {
      const { data: aData, error: aErr } = await supabase
        .from('artists')
        .select('user_id, studio_name, price_min, price_max, rating')
        .in('user_id', artistIds);
      if (!aErr && aData) artists = aData; else console.error('fetch artists error:', aErr);
    }
    const artistMap = artists.reduce((acc, a) => {
      acc[a.user_id] = a;
      return acc;
    }, {});

    const results = items.map(it => {
      const nail = nailMap[it.id] || {};
      const artist = artistMap[nail.artist_id] || {};
      const tags = [];
      for (const k of ['style','shape','color','texture','decorations','theme']) {
        if (Array.isArray(nail[k])) tags.push(...nail[k]);
      }
      return {
        id: it.id,
        artistId: nail.artist_id,
        image: nail.image_url,
        studio: artist.studio_name || '',
        rating: artist.rating || 0,
        priceLow: artist.price_min || 0,
        priceHigh: artist.price_max || 0,
        tags: tags.filter(Boolean)
      };
    });

    res.json({ success: true, results });
  } catch (err) {
    console.error('search-image error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
