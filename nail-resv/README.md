# Nail Reservation Backend

Define weekly availability by **weekday** with fixed time slots (e.g., Monday at 10:00, Wednesday at 14:00).
Customers can fetch available slots for a given date (tomorrow through the nearest 3-month window).
Book a slot (with an optional note), which removes it for that specific date.

All data is stored in-memory for MVP testing currently.

## Prerequisites

* Node.js v14+ installed
* Git (optional, to clone this repo)

---

## Setup & Run

1. **Install dependencies**

   ```bash
   npm install express
   ```
2. **Start the server**

   ```bash
   node server.js
   ```

   The server will listen on `http://localhost:3000` by default.

---

## API Endpoints & Testing

Use these **Windows CMD–compatible** `curl` one-liners to interact.

### 1. Technician: Set Weekly Availability

Define which weekdays and time slots the artist is available:

```cmd
curl -X POST http://localhost:3000/api/technicians/tech001/availability  -H "Content-Type: application/json"  -d "{\"availability\":{\"Mon\":[\"10:00\"],\"Wed\":[\"12:00\",\"14:00\"],\"Fri\":[\"10:00\",\"18:00\"]}}"
```

* **`tech001`**: the technician ID.
* **`Mon`, `Wed`, `Fri`**: weekdays.
* **Time slots**: any subset of `[10:00, 12:00, 14:00, 16:00, 18:00]`.

### 2. Customer: Fetch Available Slots

Get the technician’s free slots for a specific date. Only dates **tomorrow** through **3 months out** are accepted.

```cmd
curl "http://localhost:3000/api/technicians/tech001/slots?date=2025-05-20"
```

* **Response**: JSON listing `availableSlots` for that date (or an error if outside the window or weekday not available).

### 3. Customer: Book a Reservation

Reserve a slot and optionally leave a note for the technician:

```cmd
curl -X POST http://localhost:3000/api/reservations/book  -H "Content-Type: application/json"  -d "{\"customerId\":\"cust123\",\"artistId\":\"tech001\",\"date\":\"2025-05-20\",\"time\":\"12:00\",\"note\":\"Please use blue glitter\"}"
```

* **`customerId`**: ID for the customer.
* **`artistId`** must match the technician.
* **Slot**: must appear in the fetched `availableSlots`.
* **Note**: optional string.

### 4. Verify Slot Removal

After booking, the slot is removed. Fetch again:

```cmd
curl "http://localhost:3000/api/technicians/tech001/slots?date=2025-05-20"
```

You should see that the previously booked time is no longer listed.

---
