const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');

router.get('/tables', tableController.getTables);
router.get('/table/:tableName', tableController.getTableData);
router.put('/table/:tableName/:id', tableController.updateTableRow);
router.delete('/table/:tableName/:id', tableController.deleteTableRow);
router.post('/table/:tableName', tableController.insertTableRow);

module.exports = router;
