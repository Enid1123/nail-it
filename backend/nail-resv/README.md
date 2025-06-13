# Nail Reservation Backend

This is a simple Node.js/Express backend for a nail-artist reservation system. It allows:

* **Technicians** to define weekly availability by **weekday** with fixed time slots (e.g., Monday at 10:00, Wednesday at 14:00).
* **Customers** to fetch available slots for a given date.
* **Users** to register and log in (as either a customer or an artist).
* **Customers** to book slots, which will be removed for that specific date.

All data is stored in **Supabase**, including user authentication and profile details.

---

## Prerequisites

* Node.js v14+
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

   The server will listen on `http://localhost:4000` by default.

## Python Dependencies & Image Search

The image search feature relies on a small Python helper found in
`backend/python`. Install the required packages with `pip`:

```bash
cd ../python
pip install -r requirements.txt
```

Run the script in **extract** or **search** mode:

```bash
# Extract embeddings for an image
python image_search.py extract IMAGE_PATH IMAGE_ID --supabase-url YOUR_URL --supabase-key YOUR_KEY

# Search similar nail images
python image_search.py search QUERY_IMAGE --supabase-url YOUR_URL --supabase-key YOUR_KEY
```

---

## API Endpoints & Testing

Use these **Windows CMD–compatible** `curl` one-liners to interact.

### 1. User Authentication

#### Login

```cmd
curl -X POST http://localhost:4000/api/login -H "Content-Type: application/json" -d "{\"email\":\"customer@example.com\",\"password\":\"customerpass\"}"
```

#### Customer Registration

```cmd
curl -X POST http://localhost:4000/api/register -H "Content-Type: application/json" -d "{\"role\":\"customer\",\"email\":\"customer@example.com\",\"password\":\"customerpass\",\"username\":\"customer_one\"}"
```

#### Artist Registration

```cmd
curl -X POST http://localhost:4000/api/register -H "Content-Type: application/json" -d "{\"role\":\"artist\",\"email\":\"artist@example.com\",\"password\":\"artistpass\",\"studio_name\":\"Studio Flower\",\"city\":\"Taipei\",\"district\":\"Xinyi\",\"bio\":\"Specializes in minimalist designs.\",\"styles\":[\"#minimalist\",\"#gel\",\"#cute\"]}"
```

---

### 2. Technician: Set Weekly Availability

Define which weekdays and time slots the artist is available:

```cmd
curl -X POST http://localhost:4000/api/technicians/yunchen/availability   -H "Content-Type: application/json"   -d "{\"availability\":{\"Mon\":[\"10:00\"],\"Wed\":[\"12:00\",\"14:00\"],\"Fri\":[\"10:00\",\"18:00\"]}}"
```

* `yunchen`: just a testing artist name.
* `Mon`, `Wed`, `Fri`: weekdays.
* Time slots: any subset of `[10:00, 12:00, 14:00, 16:00, 18:00]`.

### 3. Customer: Fetch Available Slots

Get the technician’s free slots for a specific date. Only dates after **tomorrow** are accepted.

```cmd
curl "http://localhost:4000/api/technicians/yunchen/slots?date=2025-06-06"
```

* **Response**: JSON listing `availableSlots` for that date (or an error if outside the window or weekday not available).

### 4. Customer: Book a Reservation

Reserve a slot and optionally leave a note for the technician:

```cmd
curl -X POST http://localhost:4000/api/reservations/book   -H "Content-Type: application/json"   -d "{\"username\":\"ying\",\"studio\":\"yunchen\",\"date\":\"2025-06-06\",\"time\":\"12:00:00\",\"note\":\"Hi I am a flower\"}"
```

* `username`: customer ID.
* `studio`: must match the technician's studio name.
* `date` and `time`: must match available slots.
* `note`: optional.

### 5. Verify Slot Removal

After booking, the slot is removed. Fetch again:

```cmd
curl "http://localhost:4000/api/technicians/yunchen/slots?date=2025-06-06"
```

You should see that the previously booked time is no longer listed.

---

## Notes

* Supabase handles authentication and user profile storage.
* Use consistent usernames and studio names for reliable testing.
* Handle time slots and date validations carefully in client code.

---