const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

router.post('/scheduleappointment', appointmentController.scheduleAppointment);
router.post('/schedulevirtual', appointmentController.scheduleVirtual);
router.get('/appointments', appointmentController.getAppointments);
router.get('/appointmentsdoc', appointmentController.getAppointmentsDoc);
router.get('/appointmentstext', appointmentController.getAppointmentsText);
router.get('/appointmentsvirtual', appointmentController.getAppointmentsVirtual);
router.get('/appointments/:a_id', appointmentController.getAppointmentById);

module.exports = router;
