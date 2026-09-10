const { promisePool } = require('../config/db');

exports.docSignup = async (req, res, next) => {
  try {
    const { username, email, gender, age, address, speciality, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }

    const sql = 'INSERT INTO doctor (d_name, d_email, d_gender, d_age, d_address, specialty, d_password) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [username, email, gender || null, age ? parseInt(age, 10) : null, address || null, speciality || null, password];

    const [result] = await promisePool.query(sql, values);
    return res.status(201).json({ success: true, message: 'Doctor registered successfully', data: result });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email already exists. Please use a different email.' });
    }
    next(err);
  }
};

exports.docLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const sql = 'SELECT * FROM doctor WHERE d_email = ? AND d_password = ?';
    const [rows] = await promisePool.query(sql, [email, password]);

    if (rows.length > 0) {
      return res.status(200).json({ success: true, message: 'Doctor login successful', user: rows[0] });
    }
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  } catch (err) {
    next(err);
  }
};

exports.patientSignup = async (req, res, next) => {
  try {
    const { p_name, p_email, p_age, p_gender, p_password, p_address } = req.body;
    const requiredFields = ['p_name', 'p_email', 'p_password'];
    const missing = requiredFields.filter((f) => !req.body[f]);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    const sql = 'INSERT INTO patient (p_name, p_email, p_age, p_gender, p_password, p_address) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [p_name, p_email, p_age ? parseInt(p_age, 10) : null, p_gender || null, p_password, p_address || null];

    const [result] = await promisePool.query(sql, values);
    return res.status(201).json({ success: true, message: 'Patient registered successfully', data: result });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email already exists. Please use a different email.' });
    }
    next(err);
  }
};

exports.patientLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const sql = 'SELECT * FROM patient WHERE p_email = ? AND p_password = ?';
    const [rows] = await promisePool.query(sql, [email, password]);

    if (rows.length > 0) {
      return res.status(200).json({ success: true, message: 'Login successful', user: rows[0] });
    }
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  } catch (err) {
    next(err);
  }
};
