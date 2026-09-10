const { promisePool } = require('../config/db');

const ALLOWED_TABLES = new Set([
  'doctor',
  'patient',
  'appointment',
  'app_history',
  'medication',
  'medical_analysis'
]);

function validateTableName(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    const err = new Error(`Access denied: Table '${tableName}' is not in the allowlist.`);
    err.statusCode = 400;
    throw err;
  }
}

exports.getTables = async (req, res, next) => {
  try {
    const [tables] = await promisePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    const filtered = tables.filter((t) => ALLOWED_TABLES.has(t.TABLE_NAME || t.table_name));
    res.json({ success: true, data: filtered });
  } catch (err) {
    next(err);
  }
};

exports.getTableData = async (req, res, next) => {
  try {
    const { tableName } = req.params;
    validateTableName(tableName);

    const [columns] = await promisePool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const [rows] = await promisePool.query(`SELECT * FROM \`${tableName}\``);

    res.json({
      success: true,
      data: {
        columns,
        rows
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTableRow = async (req, res, next) => {
  try {
    const { tableName, id } = req.params;
    validateTableName(tableName);

    const updates = req.body;
    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const setClause = keys.map((key) => `\`${key.replace(/`/g, '')}\` = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const [primaryKey] = await promisePool.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
    if (!primaryKey.length) {
      return res.status(400).json({ success: false, message: 'Table has no primary key' });
    }
    const pkColumn = primaryKey[0].Column_name;

    await promisePool.query(`UPDATE \`${tableName}\` SET ${setClause} WHERE \`${pkColumn}\` = ?`, values);
    res.json({ success: true, message: 'Record updated successfully' });
  } catch (err) {
    next(err);
  }
};

exports.deleteTableRow = async (req, res, next) => {
  try {
    const { tableName, id } = req.params;
    validateTableName(tableName);

    const [primaryKey] = await promisePool.query(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
    if (!primaryKey.length) {
      return res.status(400).json({ success: false, message: 'Table has no primary key' });
    }
    const pkColumn = primaryKey[0].Column_name;

    await promisePool.query(`DELETE FROM \`${tableName}\` WHERE \`${pkColumn}\` = ?`, [id]);
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.insertTableRow = async (req, res, next) => {
  try {
    const { tableName } = req.params;
    validateTableName(tableName);

    const newRecord = req.body;
    const columns = Object.keys(newRecord);
    if (columns.length === 0) {
      return res.status(400).json({ success: false, message: 'Record body cannot be empty' });
    }

    const escapedColumns = columns.map((col) => `\`${col.replace(/`/g, '')}\``).join(', ');
    const values = Object.values(newRecord);
    const placeholders = values.map(() => '?').join(', ');

    const query = `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${placeholders})`;
    const [result] = await promisePool.query(query, values);

    res.json({
      success: true,
      message: 'Record added successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};
