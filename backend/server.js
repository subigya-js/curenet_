const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require('body-parser');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { spawn } = require('child_process');
const FormData = require('form-data');

// Initialize express app
const app = express();
const router = express.Router();

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Database configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'curenet',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'curenet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create promise pool for transactions
const promisePool = pool.promise();
const db = pool;

// Verify database connection
db.getConnection((err, connection) => {
  if (err) {
    console.log('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
  connection.release();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// In your server.js, update the analyze-image endpoint
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: "No image uploaded" 
    });
  }

  try {
    // Check if ML server is running first
    try {
      await axios.get('http://localhost:8000/health');
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "ML server is not running. Please start the FastAPI server."
      });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('analysis_type', req.body.type || 'stroke');

    const response = await axios.post('http://localhost:8000/predict', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error removing uploaded file:', err);
    });

    return res.json({ 
      success: true, 
      result: response.data.message,
      probability: response.data.probability,
      prediction: response.data.prediction
    });

  } catch (error) {
    console.error('Error during image analysis:', error);
    
    // Clean up uploaded file in case of error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error removing uploaded file:', err);
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.detail || error.message || "Error processing image"
    });
  }
});

// Add specific handling for laboratory route errors
app.use((err, req, res, next) => {
  if (req.url.startsWith('/laboratory')) {
    console.error('Laboratory route error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred in the laboratory service',
      error: err.message
    });
  }
  next(err);
});

// Get analysis history for a patient
app.get('/analysis-history/:email', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT * FROM medical_analysis 
       WHERE p_email = ? 
       ORDER BY analysis_date DESC`,
      [req.params.email]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching analysis history" 
    });
  }
});


// Doctor signup
app.post('/docsignup', (req, res) => {
  const sql = "INSERT INTO doctor (d_name, d_email, d_gender, d_age, d_address, specialty, d_password) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const values = [
    req.body.username,
    req.body.email,
    req.body.gender,
    req.body.age,
    req.body.address,
    req.body.speciality,
    req.body.password
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: "Email already exists. Please use a different email." });
      }
      console.log("Error during doctor signup:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return res.status(201).json({ success: true, message: "Doctor registered successfully", data: result });
  });
});

// Patient Signup Route
app.post('/signup', (req, res) => {
  // Log the received data
  console.log('Received signup data:', req.body);

  // Validate required fields
  const requiredFields = ['p_name', 'p_email', 'p_age', 'p_gender', 'p_password', 'p_address'];
  const missingFields = requiredFields.filter(field => req.body[field] === undefined || req.body[field] === '');
  
  if (missingFields.length > 0) {
    console.log('Missing fields:', missingFields); // Debug log
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`
    });
  }

  // SQL query
  const sql = `
    INSERT INTO patient 
    (p_name, p_email, p_age, p_gender, p_password, p_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [
    req.body.p_name,
    req.body.p_email,
    parseInt(req.body.p_age),
    req.body.p_gender,
    req.body.p_password,
    req.body.p_address
  ];

  // Log the SQL and values
  console.log('SQL Query:', sql);
  console.log('Values to be inserted:', values);

  // Execute query
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: "Email already exists. Please use a different email."
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message
      });
    }

    console.log('Insert successful:', result); // Debug log
    
    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      data: result
    });
  });
});

// Doctor login

app.post('/doclogin', (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM doctor WHERE d_email = ? AND d_password = ?";

  db.query(sql, [email, password], (err, result) => {
    if (err) {
      console.log("Error during doctor login:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    if (result.length > 0) {
      return res.status(200).json({ success: true, message: "Doctor login successful", user: result[0] });
    } else {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
  });
});

// Patient Login

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM patient WHERE p_email = ? AND p_password = ?";

  db.query(sql, [email, password], (err, result) => {
    if (err) {
      console.log("Error during login:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }

    if (result.length > 0) {
      return res.status(200).json({ success: true, message: "Login successful", user: result[0] });
    } else {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
  });
});

// Schedule appointment

app.post('/schedule', (req, res) => {
  const { app_date, app_time, symptoms, concerns, p_name, p_email } = req.body;

  // Validate input data
  if (!app_date || !app_time || !symptoms || !concerns || !p_name || !p_email ) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const type = "text"; // Assuming you want to set it as "text"
  const status = "booked";
  
  const sql = "INSERT INTO appointment (p_name, p_email, app_date, app_time, symptoms, concerns, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [p_name, p_email, app_date, app_time, symptoms, concerns, status, type];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error scheduling appointment:", err.message || err);
      return res.status(500).json({ success: false, message: "Internal server error", error: err.message || err });
    }

    return res.status(201).json({ success: true, message: "Appointment scheduled successfully", data: result });
  });
});

// schedule virtual appointment 

app.post('/schedulevirtual', (req, res) => {
  const { app_date, app_time, p_name, p_email, symptoms, concerns } = req.body;

  const type = "virtual";
  const status = "booked";

  // Validate all required inputs
  if (!app_date || !app_time || !p_name || !p_email) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required fields" 
    });
  }

  // SQL query with symptoms and concerns
  const sql = `
    INSERT INTO appointment 
    (p_name, p_email, app_date, app_time, symptoms, concerns, status, type) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    p_name, 
    p_email, 
    app_date, 
    app_time, 
    symptoms || "No symptoms specified", 
    concerns || "No concerns specified",
    status, 
    type
  ];

  // Execute query
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error scheduling Virtual appointment:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to schedule appointment", 
        error: err.message 
      });
    }

    return res.status(201).json({
      success: true,
      message: "Virtual Appointment scheduled successfully",
      data: result
    });
  });
});

// Dashboard page count of data 

app.get('/dashboard-stats', async (req, res) => {
  try {
      // Get total number of doctors
      const [doctorResults] = await promisePool.query(
          'SELECT COUNT(*) as doctorCount FROM doctor'
      );

      // Get total number of patients
      const [patientResults] = await promisePool.query(
          'SELECT COUNT(*) as patientCount FROM patient'
      );

      // Get total number of appointments
      const [appointmentResults] = await promisePool.query(
          'SELECT COUNT(*) as appointmentCount FROM appointment WHERE status = "booked"'
      );

      // Return the stats
      res.json({
          success: true,
          data: {
              doctorCount: doctorResults[0].doctorCount,
              patientCount: patientResults[0].patientCount,
              appointmentCount: appointmentResults[0].appointmentCount
          }
      });

  } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch dashboard statistics',
          error: error.message
      });
  }
});

// Fetch appointments

app.get('/appointments', (req, res) => {
  const sql = "SELECT a_id, p_name, p_email, app_date, app_time, type FROM appointment WHERE status='booked' ORDER BY app_date ASC, app_time ASC";
   
  db.query(sql, (err, result) => {
    if (err) {
      console.log("Error fetching appointments:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return res.status(200).json({ success: true, data: result });
  });
});

// fetch appointment for doctor dashboard 

app.get('/appointmentsdoc', (req, res) => {
  const sql = "SELECT a_id, p_name, p_email, app_date, app_time, type, status FROM appointment  ORDER BY app_date DESC, app_time DESC";
   
  db.query(sql, (err, result) => {
    if (err) {
      console.log("Error fetching appointments:", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
    return res.status(200).json({ success: true, data: result });
  });
});

// Get all appointments with type 'text'

app.get('/appointmentstext', (req, res) => {
  const query = 'SELECT * FROM appointment WHERE type = "text" and status="booked"';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }
    res.json(results);
  });
});

// Get all  appointments with type 'virtual'

app.get('/appointmentsvirtual', (req, res) => {
  const query = 'SELECT * FROM appointment WHERE type = "virtual" and status="booked"';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }
    res.json(results);
  });
});

// Fetch appointment by ID (checks both tables)

app.get('/appointments/:a_id', async (req, res) => {
  const { a_id } = req.params;

  try {
    // First try to get from appointments table
    const [appointmentResults] = await promisePool.query(
      'SELECT *, "appointment" as source FROM appointment WHERE a_id = ?',
      [a_id]
    );

    console.log('Appointment data:', appointmentResults); // Debug log

    if (appointmentResults.length > 0) {
      return res.json(appointmentResults[0]);
    }

    // If not found in appointments, check app_history
    const [historyResults] = await promisePool.query(
      'SELECT *, "history" as source FROM app_history WHERE a_id = ?',
      [a_id]
    );

    if (historyResults.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(historyResults[0]);
  } catch (err) {
    console.error('Error fetching appointment details:', err);
    res.status(500).json({ error: 'Failed to fetch appointment details' });
  }
});

// Handle medication submission

app.post('/medication/:a_id', async (req, res) => {
  const { a_id } = req.params;
  const { medications, precautions } = req.body;

  // Input validation
  if (!medications || !precautions) {
    return res.status(400).json({ error: 'Medications and precautions are required' });
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();
    console.log('Transaction started for appointment:', a_id);

    // 1. Get appointment details first
    const [rows] = await connection.query(
      `SELECT 
        a.*, 
        DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date,
        TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
      FROM appointment a 
      WHERE a.a_id = ?`,
      [a_id]
    );
    console.log('Appointment query result:', rows);

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }

    const appointment = rows[0];

    // Check if appointment is already diagnosed
    if (appointment.status === 'diagnosed') {
      throw new Error('This appointment has already been diagnosed');
    }

    // 2. Update appointment status to 'diagnosed'
    await connection.query(
      'UPDATE appointment SET status = ? WHERE a_id = ?',
      ['diagnosed', a_id]
    );
    console.log('Appointment status updated to diagnosed');

    // 3. Insert into app_history
    const [historyResult] = await connection.query(
      `INSERT INTO app_history 
       (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.p_name,
        appointment.p_email,
        appointment.formatted_date,
        appointment.formatted_time,
        appointment.symptoms || null,
        appointment.concerns || null,
        'diagnosed',
        a_id
      ]
    );
    console.log('History insert result:', historyResult);

    // 4. Insert into medication table with app_date and app_time
    const [medicationResult] = await connection.query(
      `INSERT INTO medication 
       (a_id, medications, precautions, app_date, app_time) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        a_id, 
        medications, 
        precautions,
        appointment.formatted_date,
        appointment.formatted_time
      ]
    );
    console.log('Medication insert result:', medicationResult);

    await connection.commit();
    console.log('Transaction committed successfully');

    res.json({
      message: 'Diagnosis completed successfully',
      details: {
        appointmentId: a_id,
        historyId: historyResult.insertId,
        medicationId: medicationResult.insertId,
        appointmentDate: appointment.formatted_date,
        appointmentTime: appointment.formatted_time
      }
    });

  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      errno: error.errno,
      sql: error.sql
    });

    if (connection) {
      try {
        await connection.rollback();
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }

    res.status(500).json({
      error: 'Failed to complete diagnosis',
      details: error.message
    });

  } finally {
    if (connection) {
      try {
        connection.release();
        console.log('Connection released');
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
});

// Add this endpoint to get diagnosed appointments

app.get('/diagnosed-appointments', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT 
        a.*, 
        m.medications, 
        m.precautions
      FROM 
        appointment a
        LEFT JOIN medication m ON a.a_id = m.a_id
      WHERE 
        a.status = 'diagnosed'`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching diagnosed appointments:', error);
    res.status(500).json({ error: 'Failed to fetch diagnosed appointments' });
  }
});

// Add this endpoint to get appointment history

app.get('/appointment-history', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT 
        ah.*,
        m.medications,
        m.precautions
      FROM 
        app_history ah
        LEFT JOIN medication m ON ah.a_id = m.a_id`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching appointment history:', error);
    res.status(500).json({ error: 'Failed to fetch appointment history' });
  }
});

// diagnose virtual appointment 

app.post('/appointments/:a_id/diagnose', async (req, res) => {
  const { a_id } = req.params;
  let connection;

  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    // 1. Get appointment details
    const [rows] = await connection.query(
      `SELECT 
        a.*,
        DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date,
        TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
      FROM appointment a 
      WHERE a.a_id = ?`,
      [a_id]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }

    const appointment = rows[0];

    // Check if appointment is already diagnosed
    if (appointment.status === 'diagnosed') {
      throw new Error('This appointment has already been diagnosed');
    }

    // 2. Update appointment status to 'diagnosed'
    await connection.query(
      'UPDATE appointment SET status = ? WHERE a_id = ?',
      ['diagnosed', a_id]
    );

    // 3. Insert into app_history
    const [historyResult] = await connection.query(
      `INSERT INTO app_history 
        (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.p_name,
        appointment.p_email,
        appointment.formatted_date,
        appointment.formatted_time,
        appointment.symptoms || null,
        appointment.concerns || null,
        'diagnosed',
        a_id
      ]
    );

    await connection.commit();

    res.json({
      message: 'Appointment status updated and history created successfully',
      details: {
        appointmentId: a_id,
        historyId: historyResult.insertId,
        appointmentDate: appointment.formatted_date,
        appointmentTime: appointment.formatted_time
      }
    });

  } catch (error) {
    console.error('Error:', error);
    
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }

    res.status(500).json({
      error: 'Failed to update appointment status and history',
      details: error.message
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// virtual appointment cancel 
app.post('/appointments/:a_id/cancel', async (req, res) => {
  const { a_id } = req.params;
  let connection;

  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    // 1. Get appointment details
    const [rows] = await connection.query(
      `SELECT 
        a.*,
        DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date,
        TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
      FROM appointment a 
      WHERE a.a_id = ?`,
      [a_id]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }

    const appointment = rows[0];

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled' || appointment.status === 'diagnosed') {
      throw new Error('This appointment cannot be cancelled');
    }

    // 2. Update appointment status to 'cancelled'
    await connection.query(
      'UPDATE appointment SET status = ? WHERE a_id = ?',
      ['cancelled', a_id]
    );

    // 3. Insert into app_history
    const [historyResult] = await connection.query(
      `INSERT INTO app_history 
        (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.p_name,
        appointment.p_email,
        appointment.formatted_date,
        appointment.formatted_time,
        appointment.symptoms || null,
        appointment.concerns || null,
        'cancelled',
        a_id
      ]
    );

    await connection.commit();

    res.json({
      message: 'Appointment cancelled successfully',
      details: {
        appointmentId: a_id,
        historyId: historyResult.insertId,
        appointmentDate: appointment.formatted_date,
        appointmentTime: appointment.formatted_time,
        status: 'cancelled'
      }
    });

  } catch (error) {
    console.error('Error:', error);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }

    res.status(500).json({
      error: 'Failed to cancel appointment',
      details: error.message
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Chatbot endpoint
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question || question.trim() === '') {
    return res.status(400).json({
      success: false,
      response: "Please provide symptoms"
    });
  }

  try {
    // Sanitize the input to prevent command injection
    const sanitizedQuestion = question.replace(/"/g, '\\"');

    exec(`python "${path.join(__dirname, 'recommend.py')}" "${sanitizedQuestion}"`, 
      { maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          console.error(`Error executing python script: ${stderr}`);
          return res.status(500).json({ 
            success: false, 
            response: "Error in processing the model" 
          });
        }

        try {
          // Parse the predictions from Python script
          const predictions = JSON.parse(stdout.trim());
          
          // Format the response to match your frontend expectations
          const formattedResponse = formatPredictionResponse(predictions);
          
          res.json({
            success: true,
            response: formattedResponse
          });
        } catch (parseError) {
          console.error('Error parsing prediction:', parseError);
          res.status(500).json({
            success: false,
            response: "Error processing the prediction results"
          });
        }
    });
  } catch (error) {
    console.error("Error communicating with the ML model:", error);
    res.status(500).json({ 
      success: false, 
      response: "Error fetching prediction" 
    });
  }
});

// Helper function to format predictions into a readable response
function formatPredictionResponse(predictions) {
  if (!predictions || predictions.length === 0) {
    return "I couldn't determine any potential conditions based on these symptoms.";
  }

  const formattedPredictions = predictions.map((pred, index) => {
    const confidence = (pred.confidence).toFixed(1);
    return `${index + 1}. ${pred.disease} (${confidence}%)`;
  });

  // Join with double line breaks for better visual separation
  return `Based on your symptoms, you might have:\n\n${formattedPredictions.join('\n')}\n\nAlso consult your doctor for this.\n The diseases mentioned are based on your symptoms, if you want more clarity provide your entire symptoms.`;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    response: "Something went wrong! Please try again."
  });
});


// fetch patient history 
app.get('/history/:email', async (req, res) => {
  const { email } = req.params;
  
  try {
    const query = `
      SELECT 
        ah.app_date,
        ah.app_time,
        ah.symptoms,
        ah.concerns,
        m.medications,
        m.precautions,
        a.type,
        a.status
      FROM app_history ah
      LEFT JOIN appointment a ON ah.a_id = a.a_id
      LEFT JOIN medication m ON a.a_id = m.a_id
      WHERE ah.p_email = ?
      ORDER BY ah.app_date DESC, ah.app_time DESC
    `;

    const [results] = await promisePool.query(query, [email]);

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No history found for this patient.' 
      });
    }

    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Error fetching patient history:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching patient history.' 
    });
  }
});

// Get all table names
app.get('/tables', async (req, res) => {
  try {
    const [tables] = await promisePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'curenet'
    `);
    res.json({ success: true, data: tables });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ success: false, message: 'Error fetching tables' });
  }
});

// Get table data

app.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    // Get table structure
    const [columns] = await promisePool.query(`
      SHOW COLUMNS FROM ${tableName}
    `);
    
    // Get table data
    const [rows] = await promisePool.query(`
      SELECT * FROM ${tableName}
    `);

    res.json({
      success: true,
      data: {
        columns,
        rows
      }
    });
  } catch (err) {
    console.error('Error fetching table data:', err);
    res.status(500).json({ success: false, message: 'Error fetching table data' });
  }
});

// Update table row

app.put('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const updates = req.body;

    // Create SET clause
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), id];

    // Determine primary key column
    const [primaryKey] = await promisePool.query(`
      SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'
    `);
    const pkColumn = primaryKey[0].Column_name;

    const query = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE ${pkColumn} = ?
    `;

    await promisePool.query(query, values);
    res.json({ success: true, message: 'Record updated successfully' });
  } catch (err) {
    console.error('Error updating record:', err);
    res.status(500).json({ success: false, message: 'Error updating record' });
  }
});

// Delete table row

app.delete('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;

    // Determine primary key column
    const [primaryKey] = await promisePool.query(`
      SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'
    `);
    const pkColumn = primaryKey[0].Column_name;

    await promisePool.query(
      `DELETE FROM ${tableName} WHERE ${pkColumn} = ?`,
      [id]
    );
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ success: false, message: 'Error deleting record' });
  }
});


app.post('/table/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const newRecord = req.body;

  try {
    // Create columns and values strings for the query
    const columns = Object.keys(newRecord).join(', ');
    const values = Object.values(newRecord);
    const placeholders = values.map(() => '?').join(', ');

    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    
    const [result] = await promisePool.query(query, values);
    
    res.json({
      success: true,
      message: 'Record added successfully',
      data: result
    });
  } catch (err) {
    console.error('Error adding record:', err);
    res.status(500).json({
      success: false,
      message: 'Error adding record',
      error: err.message
    });
  }
});

// Start the server
app.listen(8801, () => {
  console.log("Server is running on port 8801");
});
