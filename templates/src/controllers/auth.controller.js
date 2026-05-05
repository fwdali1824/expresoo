const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

class AuthController {
    async register(req, res) {
        try {
            const { username, email, password } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Logic to save user would go here:
            // const user = await User.create({ username, email, password: hashedPassword });
            
            res.status(201).json({ message: 'User registered successfully', email });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            // Logic to find user and check password would go here
            
            const token = jwt.sign({ email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
            res.json({ message: 'Login successful', token });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AuthController();
