import React, { useState, useEffect } from 'react';
import './Viewtables.css';

const Viewtables = () => {
  const [tables, setTables] = useState(['patient', 'doctor', 'appointment', 'app_history', 'medication']);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({});

  // Fetch table data
  const fetchTableData = async (tableName) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:8801/table/${tableName}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setTableData(data.data);
        setSelectedTable(tableName);
        // Initialize new record with empty values
        const initialRecord = {};
        data.data.columns.forEach(col => {
          initialRecord[col.Field] = '';
        });
        setNewRecord(initialRecord);
      }
    } catch (err) {
      setError(`Error fetching ${tableName} data: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:8801/table/${selectedTable}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecord)
      });

      if (!response.ok) throw new Error('Failed to add record');

      // Refresh table data
      await fetchTableData(selectedTable);
      setShowAddModal(false);
      // Reset form
      const initialRecord = {};
      tableData.columns.forEach(col => {
        initialRecord[col.Field] = '';
      });
      setNewRecord(initialRecord);
    } catch (err) {
      setError('Failed to add record: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    
    try {
      const response = await fetch(`http://localhost:8801/table/${selectedTable}/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete record');

      fetchTableData(selectedTable);
    } catch (err) {
      setError('Failed to delete record: ' + err.message);
    }
  };

  const getInputType = (column) => {
    if (column.Field.includes('password')) return 'password';
    if (column.Type.includes('int')) return 'number';
    if (column.Type.includes('date')) return 'date';
    if (column.Type.includes('time')) return 'time';
    return 'text';
  };

  return (
    <div className="database-container">
      <div className="side-panel">
        <h2>Manage Tables</h2>
        <div className="table-list">
          {tables.map((table) => (
            <button
              key={table}
              className={`table-button ${selectedTable === table ? 'active' : ''}`}
              onClick={() => fetchTableData(table)}
            >
              {table}
            </button>
          ))}
        </div>
      </div>

      <div className="main-content">
        {error && <div className="error-alert">{error}</div>}
        
        {selectedTable && tableData && (
          <div className="table-view">
            <div className="table-header">
              <h2>{selectedTable}</h2>
              <button 
                className="add-button"
                onClick={() => setShowAddModal(true)}
              >
                Add New Record
              </button>
            </div>
            
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {tableData.columns.map((column) => (
                      <th key={column.Field}>{column.Field}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row) => (
                    <tr key={row[tableData.columns[0].Field]}>
                      {tableData.columns.map((column) => (
                        <td key={column.Field}>{row[column.Field] || '-'}</td>
                      ))}
                      <td>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(row[tableData.columns[0].Field])}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedTable && !loading && (
          <div className="no-selection">
            Select a table from the sidebar to view its data
          </div>
        )}

        {/* Add Record Modal */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Add New Record to {selectedTable}</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowAddModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleAddRecord} className="add-form">
                {tableData.columns.map((column) => (
                  !column.Field.includes('id') && (
                    <div key={column.Field} className="form-group">
                      <label htmlFor={column.Field}>{column.Field}</label>
                      <input
                        type={getInputType(column)}
                        id={column.Field}
                        value={newRecord[column.Field] || ''}
                        onChange={(e) => setNewRecord({
                          ...newRecord,
                          [column.Field]: e.target.value
                        })}
                        required={!column.Null}
                      />
                    </div>
                  )
                ))}
                <div className="form-actions">
                  <button type="button" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-button">
                    Add Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewtables;