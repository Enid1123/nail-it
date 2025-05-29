// server.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const cors = require('cors');
app.use(cors());

// init Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(express.json());

// inject supabase client into req
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Routers
const { router: availabilityRouter } = require('./routes/availability');
const reservationRouter              = require('./routes/reservation');
const searchRouter = require('./routes/search');
//const tagImagesRouter = require('./routes/tagImages'); 

app.use('/api/technicians', availabilityRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api', searchRouter);
//app.use('/api', tagImagesRouter);

app.get('/', (req, res) => res.send('Nail-Resv API'));

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

//Test!!!!
app.get('/_health', async (req, res, next) => {
  try {
    const { data, error } = await req.supabase.from('artists').select('user_id').limit(1);
    if (error) throw error;
    res.json({ ok: true, sampleArtist: data[0] });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

