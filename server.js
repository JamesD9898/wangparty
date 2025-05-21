const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

function readTemdb() {
    const fileName = "tempdb.json"
    const filePath = path.join(__dirname, fileName);
  
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to read or parse temdb.json:', err);
      return null;
    }
  }
  
// middleware
app.use(express.json());

// sere static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// sends index.html if the user requests the route "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/api/servers', (req, res) => {
    const tempdb = readTemdb();
    res.json({
        "servers": tempdb.servers
    })
});

// starts the surver
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

