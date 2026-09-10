const { promisePool } = require('../config/db');

exports.submitMedication = async (req, res, next) => {
  const { a_id } = req.params;
  const { medications, precautions } = req.body;

  if (!medications || !precautions) {
    return res.status(400).json({ error: 'Medications and precautions are required' });
  }

  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.*, DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date, TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
       FROM appointment a WHERE a.a_id = ?`,
      [a_id]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }
    const appointment = rows[0];

    await connection.query('UPDATE appointment SET status = ? WHERE a_id = ?', ['diagnosed', a_id]);

    const [historyResult] = await connection.query(
      `INSERT INTO app_history (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
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

    const [medicationResult] = await connection.query(
      `INSERT INTO medication (a_id, medications, precautions, app_date, app_time)
       VALUES (?, ?, ?, ?, ?)`,
      [a_id, medications, precautions, appointment.formatted_date, appointment.formatted_time]
    );

    await connection.commit();

    return res.json({
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
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

exports.diagnoseAppointment = async (req, res, next) => {
  const { a_id } = req.params;
  let connection;

  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.*, DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date, TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
       FROM appointment a WHERE a.a_id = ?`,
      [a_id]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }
    const appointment = rows[0];

    if (appointment.status === 'diagnosed') {
      throw new Error('This appointment has already been diagnosed');
    }

    await connection.query('UPDATE appointment SET status = ? WHERE a_id = ?', ['diagnosed', a_id]);

    const [historyResult] = await connection.query(
      `INSERT INTO app_history (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
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

    return res.json({
      message: 'Appointment status updated and history created successfully',
      details: {
        appointmentId: a_id,
        historyId: historyResult.insertId,
        appointmentDate: appointment.formatted_date,
        appointmentTime: appointment.formatted_time
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

exports.cancelAppointment = async (req, res, next) => {
  const { a_id } = req.params;
  let connection;

  try {
    connection = await promisePool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT a.*, DATE_FORMAT(a.app_date, '%Y-%m-%d') as formatted_date, TIME_FORMAT(a.app_time, '%H:%i') as formatted_time
       FROM appointment a WHERE a.a_id = ?`,
      [a_id]
    );

    if (!rows || rows.length === 0) {
      throw new Error('Appointment not found');
    }
    const appointment = rows[0];

    if (appointment.status === 'cancelled' || appointment.status === 'diagnosed') {
      throw new Error('This appointment cannot be cancelled');
    }

    await connection.query('UPDATE appointment SET status = ? WHERE a_id = ?', ['cancelled', a_id]);

    await connection.query(
      `INSERT INTO app_history (p_name, p_email, app_date, app_time, symptoms, concerns, status, a_id)
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
    return res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

exports.getDiagnosedAppointments = async (req, res, next) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT a.*, m.medications, m.precautions
       FROM appointment a
       LEFT JOIN medication m ON a.a_id = m.a_id
       WHERE a.status = 'diagnosed'`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getAppointmentHistory = async (req, res, next) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT ah.*, m.medications, m.precautions
       FROM app_history ah
       LEFT JOIN medication m ON ah.a_id = m.a_id`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

exports.getPatientHistory = async (req, res, next) => {
  const { email } = req.params;
  try {
    const query = `
      SELECT ah.app_date, ah.app_time, ah.symptoms, ah.concerns, m.medications, m.precautions, a.type, a.status
      FROM app_history ah
      LEFT JOIN appointment a ON ah.a_id = a.a_id
      LEFT JOIN medication m ON a.a_id = m.a_id
      WHERE ah.p_email = ?
      ORDER BY ah.app_date DESC, ah.app_time DESC
    `;
    const [results] = await promisePool.query(query, [email]);
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No history found for this patient.' });
    }
    return res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};
