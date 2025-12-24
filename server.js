require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- RATE LIMIT ---------------- */
const trackerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});

/* ---------------- STATIC ---------------- */
app.use(express.static('public'));

/* ---------------- LOG SETUP ---------------- */
const logsDir = path.join(__dirname, 'logs');
const logFile = path.join(logsDir, 'visitors.json');

if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '[]');

/* ---------------- TRACK IMAGE ---------------- */
app.get('/track-image', trackerLimiter, (req, res) => {
  // This line now correctly gets the IP from the proxy header if it exists,
  // otherwise it falls back to the direct connection IP.
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress; // <-- CHANGED LINE

  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: clientIP,
    userAgent: req.get('User-Agent'),
    referrer: req.get('Referer') || 'Direct',
  };

  fs.readFile(logFile, 'utf8', (err, data) => {
    let logs = [];
    try {
      logs = data ? JSON.parse(data) : [];
    } catch {
      logs = [];
    }
    logs.push(logEntry);
    fs.writeFile(logFile, JSON.stringify(logs, null, 2), () => {});
  });

  res.sendFile(path.join(__dirname, 'public', 'bait.jpg'));
});

/* ---------------- VIEW LOGS ---------------- */
app.get('/view-logs', (req, res) => {
  fs.readFile(logFile, 'utf8', (err, data) => {
    let logs = [];
    try {
      logs = data ? JSON.parse(data) : [];
    } catch {
      logs = [];
    }
    logs.reverse();
    const html = logs
      .map(
        (l) => `
        <div>
          <b>${l.timestamp}</b><br>
          IP: ${l.ip}<br>
          Referrer: ${l.referrer}<br>
          UA: ${l.userAgent}
        </div>
        <hr>
      `
      )
      .join('');
    res.send(`
      <html>
        <body style="background:#121212;color:#e0e0e0;font-family:monospace;padding:20px">
          <h1>Visitor Logs</h1>
          ${html || '<p>No visitors yet</p>'}
        </body>
      </html>
    `);
  });
});

/* ---------------- START ---------------- */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});