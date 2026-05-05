const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthController {
    async register(req, res) {
        const { email, password } = req.body;
        // Basic logic (you would normally save to DB here)
        const hashedPassword = await bcrypt.hash(password, 10);
        res.status(201).json({ message: 'User registered successfully', email, hashedPassword });
    }

    async login(req, res) {
        const { email, password } = req.body;
        // Basic logic (you would check DB here)
        const token = jwt.sign({ email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ message: 'Login successful', token });
    }
}

module.exports = new AuthController();
