const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json()); // parse JSON body

// Dummy login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Simple test — match your inserted users
  if (
    (email === 'admin@example.com' && password === 'adminpass') ||
    (email === 'scanner1@example.com' && password === 'scannerpass')
  ) {
    return res.json({
      token: 'fake-jwt-token-for-testing',
      user: { email, name: 'Test User', role: 'admin' }
    });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
