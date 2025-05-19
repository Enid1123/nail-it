// routes/reservation.js
const express = require('express');
const router  = express.Router();

// In-memory reservations: { [artistId]: { [date]: Set<slot> } }
const reservations = {};

/**
 * Helper: return sorted free slots for artistId on dateStr
 * Enforces: date > today, date ≤ end of month+2, weekday availability
 */
function getAvailableSlots(artistId, dateStr) {
  // dynamic require to avoid circular dependency
  const { techAvailability } = require('./availability');

  // 1. Parse date
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date)) throw new Error('Invalid date format');

  // 2. Compute window: tomorrow → end of (current month + 2)
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // month+3, day 0 gives last day of month+2
  const endWindow = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  if (date < tomorrow || date > endWindow) {
    throw new Error(
      `Date must be between ${tomorrow.toISOString().slice(0,10)} and ` +
      `${endWindow.toISOString().slice(0,10)}`
    );
  }

  // 3. Check weekday and slots
  const dayNum = date.getDay();
  const slotsSet = techAvailability[artistId]?.[dayNum];
  if (!slotsSet) {
    throw new Error('Technician not available on this weekday');
  }

  // 4. Filter out already booked slots for that date
  const fullSlots = Array.from(slotsSet);
  const taken     = Array.from(reservations[artistId]?.[dateStr] || []);
  return fullSlots.filter(s => !taken.includes(s)).sort();
}
// expose for availability route
router.getAvailableSlots = getAvailableSlots;

/**
 * POST /api/reservations/book
 * Body: { customerId, artistId, date, time, note? }
 */
router.post('/book', (req, res) => {
  // dynamic require to avoid circular dependency
  const { techAvailability } = require('./availability');

  const { customerId, artistId, date, time, note } = req.body;
  if (![customerId, artistId, date, time].every(Boolean)) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // 1) validate & fetch free slots
  let free;
  try {
    free = getAvailableSlots(artistId, date);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (!free.includes(time)) {
    return res.status(400).json({ error: 'Requested slot unavailable.' });
  }

  // 2) record reservation
  reservations[artistId] = reservations[artistId] || {};
  reservations[artistId][date] = reservations[artistId][date] || new Set();
  reservations[artistId][date].add(time);

  // 3) respond
  return res.status(201).json({
    message: 'Reservation confirmed',
    reservation: { artistId, customerId, date, time, note: note || '' }
  });
});

module.exports = router;