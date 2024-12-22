const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const SECRET_KEY = '/cTFigjrKOOlRA7S1bI1Pxk809ZAN4gi5FJ3gmc4jKcQjfJST27NeZv6n8OJP6sU0+N7JJUAkc+DdsXwOIkQaw=='; // Use a secure key

// Routes
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
        res.status(201).send({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).send({ error: 'Registration failed' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!result.rows.length) return res.status(404).send({ error: 'User not found' });

        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).send({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, SECRET_KEY);
        res.status(200).send({ token });
    } catch (err) {
        res.status(400).send({ error: 'Login failed' });
    }
});

app.get('/led', async (req, res) => {
    try {
        const result = await pool.query('SELECT state FROM led_state LIMIT 1');
        res.status(200).send(result.rows[0]);
    } catch (err) {
        res.status(400).send({ error: 'Failed to fetch LED state' });
    }
});

app.post('/led', async (req, res) => {
    const { state } = req.body;
    try {
        await pool.query('UPDATE led_state SET state = $1', [state]);
        res.status(200).send({ message: `LED turned ${state}` });
    } catch (err) {
        res.status(400).send({ error: 'Failed to update LED state' });
    }
});

app.post('/wifi', (req, res) => {
    const { ssid, password } = req.body;

    // Forward the request to the ESP32
    const espUrl = `http://<ESP32-IP-Address>/change_wifi`;
    fetch(espUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ssid, password }),
    })
        .then((response) => response.text())
        .then((data) => res.status(200).send({ message: data }))
        .catch((error) => res.status(500).send({ error: 'Failed to update Wi-Fi credentials' }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
