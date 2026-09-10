const { promisePool } = require('../config/db');

exports.scheduleAppointment = async (req, res, next) => {
  try {
    const { app_date, app_time, symptoms, concerns, p_name, p_email } = req.body;

    if (!app_date || !app_time || !symptoms || !concerns || !p_name || !p_email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const type = 'text';
    const status = 'booked';
    const sql = 'INSERT INTO appointment (p_name, p_email, app_date, app_time, symptoms, concerns, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [p_name, p_email, app_date, app_time, symptoms, concerns, status, type];

    const [result] = await promisePool.query(sql, values);
    return res.status(201).json({ success: true, message: 'Appointment scheduled successfully', data: result });
  } catch (err) {
    next(err);
  }
};

exports.scheduleVirtual = async (req, res, next) => {
  try {
    const { app_date, app_time, p_name, p_email, symptoms, concerns } = req.body;

    if (!app_date || !app_time || !p_name || !p_email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const type = 'virtual';
    const status = 'booked';
    const sql = 'INSERT INTO appointment (p_name, p_email, app_date, app_time, symptoms, concerns, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [
      p_name,
      p_email,
      app_date,
      app_time,
      symptoms || 'No symptoms specified',
      concerns || 'No concerns specified',
      status,
      type
    ];

    const [result] = await promisePool.query(sql, values);
    return res.status(201).json({ success: true, message: 'Virtual appointment scheduled successfully', data: result });
  } catch (err) {
    next(err);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const sql = "SELECT a_id, p_name, p_email, app_date, app_time, type FROM appointment WHERE status='booked' ORDER BY app_date ASC, app_time ASC";
    const [rows] = await promisePool.query(sql);
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentsDoc = async (req, res, next) => {
  try {
    const sql = 'SELECT a_id, p_name, p_email, app_date, app_time, type, status FROM appointment ORDER BY app_date DESC, app_time DESC';
    const [rows] = await promisePool.query(sql);
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentsText = async (req, res, next) => {
  try {
    const sql = 'SELECT * FROM appointment WHERE type = "text" AND status="booked"';
    const [rows] = await promisePool.query(sql);
    return res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentsVirtual = async (req, res, next) => {
  try {
    const sql = 'SELECT * FROM appointment WHERE type = "virtual" AND status="booked"';
    const [rows] = await promisePool.query(sql);
    return res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getAppointmentById = async (req, res, next) => {
  const { a_id } = req.params;
  try {
    const [appointmentResults] = await promisePool.query(
      'SELECT *, "appointment" as source FROM appointment WHERE a_id = ?',
      [a_id]
    );

    if (appointmentResults.length > 0) {
      return res.json(appointmentResults[0]);
    }

    const [historyResults] = await promisePool.query(
      'SELECT *, "history" as source FROM app_history WHERE a_id = ?',
      [a_id]
    );

    if (historyResults.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json(historyResults[0]);
  } catch (err) {
    next(err);
  }
};
