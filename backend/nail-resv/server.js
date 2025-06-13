// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4000;

// init Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS 設定 (開發環境允許多個 LAN 位址)
const corsDev = require('./middleware/cors-dev');
app.use(corsDev);

// inject supabase client into req
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Routers
const { router: availabilityRouter } = require('./routes/availability');
const { router: reservationRouter } = require('./routes/reservation');
const searchRouter = require('./routes/search');
const searchSupabaseRouter = require('./routes/searchWithSupabase');
const tagImagesRouter = require('./routes/tagImages');

const searchImageRouter = require('./routes/searchImage');
const { router: registerRouter } = require('./routes/register');
const loginRoute = require('./routes/login');
const logoutRoute = require('./routes/logout'); 
const customersRouter = require('./routes/customers');
const artistsRouter = require('./routes/artists');
const worksRouter = require('./routes/works');

app.use('/api/reviews', require('./routes/reviews').router)
app.use('/api/reservations', reservationRouter);
app.use('/api/technicians', availabilityRouter);
app.use('/api', searchRouter);
app.use('/api', searchSupabaseRouter);
app.use('/api', tagImagesRouter);
app.use('/api', searchImageRouter);

app.use('/api/register', registerRouter);
app.use('/api/login', loginRoute);
app.use('/api/logout', logoutRoute);  
app.use('/api/customers', customersRouter);
app.use('/api/artists', artistsRouter);          // 先掛基本的 artists 路由
app.use('/api/artists', availabilityRouter); 
app.use('/api/works', worksRouter); 


// 提供 API 文檔靜態文件
app.use('/docs', express.static(path.join(__dirname, './')));

// API 文檔路由
app.get('/swagger-ui.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger-ui.html'));
});

app.get('/swagger-ui-complete.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger-ui-standalone.html'));
});

app.get('/swagger-ui-latest.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger-ui-latest.html'));
});

app.get('/swagger-ui-latest-standalone.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger-ui-latest-standalone.html'));
});

app.get('/swagger-ui-complete-new.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger-ui-complete-new.html'));
});

app.get('/openapi.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.get('/openapi-complete.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile(path.join(__dirname, 'openapi-complete.yaml'));
});

// 根路徑重導向到 API 文檔
app.get('/', (req, res) => {
  res.send(`
    <h1>美甲預約系統 API 服務</h1>
    <p>歡迎使用美甲預約系統 API！</p>
    <h2>📚 API 文檔</h2>
    <ul>
      <li><a href="/swagger-ui-complete-new.html">🎯 完整系統 API 文檔 (包含所有功能) - 最推薦！</a></li>
      <li><a href="/swagger-ui.html">🎨 美甲標註 API 文檔 (基礎版)</a></li>
      <li><a href="/swagger-ui-latest-standalone.html">✨ 最新完整系統 API 文檔 (離線版)</a></li>
      <li><a href="/swagger-ui-latest.html">📋 最新完整系統 API 文檔 (線上版)</a></li>
      <li><a href="/swagger-ui-complete.html">📄 舊版完整系統 API 文檔</a></li>
      <li><a href="/openapi-complete.yaml">📄 完整系統 OpenAPI 規格文件</a></li>
    </ul>
    <h2>🔗 主要 API 端點</h2>
    <ul>
      <li><a href="/api/tag">🎨 美甲標註 API (批量上傳)</a></li>
      <li><a href="/api/tag-base64">✨ Base64 圖片標註 API (新功能)</a></li>
      <li><a href="/api/search-supabase">🔍 美甲搜尋 API</a></li>
      <li><a href="/api/register">👤 用戶註冊 API</a></li>
      <li><a href="/api/login">🔑 用戶登入 API</a></li>
    </ul>
    <h2>🏷️ 系統功能</h2>
    <ul>
      <li>🔐 用戶認證系統</li>
      <li>👥 顧客和美甲師管理</li>
      <li>📅 預約管理系統</li>
      <li>🎨 AI 美甲圖片標註</li>
      <li>🔍 智能搜尋功能</li>
      <li>⏰ 營業時間管理</li>
    </ul>
    <p>版本: 1.0.0</p>
    <hr>
    <p><small>💡 提示：查看完整的 API 功能請點擊上方的文檔連結</small></p>
  `);
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


