const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const historyRoutes = require('./historyRoutes');
const analysisRoutes = require('./analysisRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const tableRoutes = require('./tableRoutes');
const chatRoutes = require('./chatRoutes');

router.use('/', authRoutes);
router.use('/', appointmentRoutes);
router.use('/', historyRoutes);
router.use('/', analysisRoutes);
router.use('/', dashboardRoutes);
router.use('/', tableRoutes);
router.use('/', chatRoutes);

module.exports = router;
