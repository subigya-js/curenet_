const { promisePool } = require('../config/db');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const [[doctorRows], [patientRows], [appointmentRows]] = await Promise.all([
      promisePool.query('SELECT COUNT(*) as doctorCount FROM doctor'),
      promisePool.query('SELECT COUNT(*) as patientCount FROM patient'),
      promisePool.query('SELECT COUNT(*) as appointmentCount FROM appointment WHERE status = "booked"')
    ]);

    res.json({
      success: true,
      data: {
        doctorCount: doctorRows[0].doctorCount,
        patientCount: patientRows[0].patientCount,
        appointmentCount: appointmentRows[0].appointmentCount
      }
    });
  } catch (error) {
    next(error);
  }
};
