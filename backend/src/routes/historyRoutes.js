const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');

router.post('/medication/:a_id', historyController.submitMedication);
router.post('/appointments/:a_id/diagnose', historyController.diagnoseAppointment);
router.post('/appointments/:a_id/cancel', historyController.cancelAppointment);
router.get('/diagnosed-appointments', historyController.getDiagnosedAppointments);
router.get('/appointment-history', historyController.getAppointmentHistory);
router.get('/history/:email', historyController.getPatientHistory);

module.exports = router;
