-- Seed data for CureNet local development

USE curenet;

-- 1. Demo Doctor
INSERT INTO doctor (d_name, d_email, d_password, d_gender, d_age, d_address, specialty)
VALUES 
  ('Dr. Sarah Jenkins', 'doctor@curenet.com', 'doctor123', 'Female', 42, '100 Medical Plaza, Suite 400', 'Cardiology'),
  ('Dr. Alan Turing', 'turing@curenet.com', 'doctor123', 'Male', 45, '200 Science Ave', 'Neurology')
ON DUPLICATE KEY UPDATE d_name = VALUES(d_name);

-- 2. Demo Patient
INSERT INTO patient (p_name, p_email, p_password, p_gender, p_age, p_address)
VALUES 
  ('John Doe', 'patient@curenet.com', 'patient123', 'Male', 32, '456 Elm Street, Cityville'),
  ('Jane Smith', 'jane@curenet.com', 'patient123', 'Female', 28, '789 Oak Ave, Cityville')
ON DUPLICATE KEY UPDATE p_name = VALUES(p_name);

-- 3. Initial Appointments
INSERT INTO appointment (p_name, p_email, app_date, app_time, symptoms, concerns, status, type)
VALUES
  ('John Doe', 'patient@curenet.com', CURDATE(), '10:00:00', 'Persistent headache and dizziness', 'Concerned about recurring migraines', 'booked', 'text'),
  ('Jane Smith', 'jane@curenet.com', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:30:00', 'Shortness of breath after mild exertion', 'Need review of recent lab results', 'booked', 'virtual')
ON DUPLICATE KEY UPDATE p_name = VALUES(p_name);
