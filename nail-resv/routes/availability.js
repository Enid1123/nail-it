// routes/availability.js
const express = require('express');
const router  = express.Router();
const { getAvailableSlots } = require('./reservation');

// Map weekday names → JS getDay() numbers
const WEEKDAY_MAP = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

// In‐memory availability: { [artistId]: { [weekday]: Set<slot> } }
const techAvailability = {};

/**
 * POST /api/technicians/:artistId/availability
 * Body: { availability: { Mon:[...], Wed:[...], … } }
 */
router.post('/:artistId/availability', (req, res) => {
  const { artistId }     = req.params;
  const { availability } = req.body;
  if (!availability || typeof availability !== 'object') {
    return res.status(400).json({ error: 'Must provide availability object.' });
  }

  techAvailability[artistId] = {};
  for (const [dayName, slots] of Object.entries(availability)) {
    const dayNum = WEEKDAY_MAP[dayName];
    if (dayNum === undefined) {
      return res.status(400).json({ error: `Invalid weekday: ${dayName}` });
    }
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: `Slots for ${dayName} must be an array.` });
    }
    techAvailability[artistId][dayNum] = new Set(slots);
  }

  res.status(201).json({
    message:      'Weekly availability set per weekday',
    artistId,
    availability
  });
});

/**
 * GET /api/technicians/:artistId/slots?date=YYYY-MM-DD
 * Delegates to getAvailableSlots to apply date window and weekday rules
 */

router.get('/:artistId/slots', (req, res) => {
  const { artistId } = req.params;
  const { date }     = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date query parameter required' });
  }

  try {
    const slots = getAvailableSlots(artistId, date);
    return res.json({ artistId, date, availableSlots: slots });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

module.exports = { router, techAvailability };
