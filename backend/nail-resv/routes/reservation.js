// routes/reservation.js
const express = require('express');
const router  = express.Router();

// POST /api/reservations/book
// Body: { username, studio, date, time, note }
router.post('/book', async (req, res, next) => {
  console.log('收到預約請求', req.body);
  try {
    const { username, studio, date, time, note } = req.body;
    if (![username, studio, date, time].every(Boolean)) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const supabase = req.supabase;
    // resolve ids
    const { data: cust } = await supabase
      .from('customers')
      .select('user_id')
      .eq('username', username)
      .single();
    if (!cust) throw new Error('Customer not found');

    const { data: artist } = await supabase
      .from('artists')
      .select('user_id')
      .eq('studio_name', studio)
      .single();
    if (!artist) throw new Error('Artist not found');

    // check slot available: reuse GET slots
    const resp = await fetch(
      `http://localhost:${process.env.PORT || 3000}/api/technicians/${studio}/slots?date=${date}`
    );

    // 新增這段
    if (!resp.ok) {
    const text = await resp.text();
    console.error('獲取 availableSlots 失敗，狀態碼:', resp.status, '內容:', text);
    return res.status(500).json({ error: 'Failed to fetch available slots.' });
    }


    const { availableSlots, error } = await resp.json();
    if (error) throw new Error(error);
    if (!availableSlots.includes(time)) {
      return res.status(400).json({ error: 'Requested slot unavailable.' });
    }

    // insert appointment
    const { error: e2 } = await supabase
      .from('appointments')
      .insert([{
        customer_id:  cust.user_id,
        artist_id:    artist.user_id,
        service_date: date,
        service_time: time,
        status:       'confirmed',
        note:         note || ''
      }]);
    if (e2) throw e2;

    res.status(201).json({ message: 'Reservation confirmed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
