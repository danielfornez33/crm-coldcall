try { require('dotenv').config(); } catch {}
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const callRoutes = require('./routes/calls');
const reportRoutes = require('./routes/reports');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Highfil CRM running on http://localhost:${PORT}`);
});
