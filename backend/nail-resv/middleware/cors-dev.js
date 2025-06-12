const devOrigins = [
  'http://localhost:5173',
  'http://172.28.64.1:5173',
  'http://192.168.56.1:5173',
  'http://10.110.181.124:5173'
];

const prodOrigins = ['https://nail-it-frontend.up.railway.app']; 

const allowedOrigins =
  process.env.NODE_ENV === 'production' ? prodOrigins : devOrigins;

module.exports = function corsDev(req, res, next) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
};