const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/docsignup', authController.docSignup);
router.post('/doclogin', authController.docLogin);
router.post('/signup', authController.patientSignup);
router.post('/login', authController.patientLogin);

module.exports = router;
