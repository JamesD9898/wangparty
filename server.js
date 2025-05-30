const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const app = express();
const PORT = 3000;
const Server = require('./models/servers.js'); // adjust path as needed

function readServers() {
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
app.get('/api/servers', async (req, res) => {
    //const tempdb = readServers();
    try {
    const servers = await Server.find({});
    res.json({ servers });
  } catch (error) {
    console.error('Failed to fetch servers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/api/servers/join', (req, res) => {
  const serverToJoin = req.serverID
  const player = req.PlayerID
});
app.post('/api/servers/add', (req, res) => {
  const serverJSON = req.server
});


function getLocalIP(){
// i didnt write this bro
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; 
}

const myIP = getLocalIP();
console.log('Local IP address:', myIP);
// start the server 
app.listen(PORT, () => {
  console.log(`Server is running on http://${myIP}:${PORT}`);
});

