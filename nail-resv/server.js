// server.js
const express = require('express');
const app     = express();
const PORT    = process.env.PORT || 3000;

// Routers
const { router: availabilityRouter } = require('./routes/availability');
const reservationRouter              = require('./routes/reservation');

app.use(express.json());

// Mount routes
app.use('/api/technicians', availabilityRouter);
app.use('/api/reservations', reservationRouter);

// Root
app.get('/', (req, res) => res.send('Nail-Resv API 🚀'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
