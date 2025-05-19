const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route to serve index.html for "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
