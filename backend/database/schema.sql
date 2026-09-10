-- CureNet AHMS Schema Definition
-- Clean, reproducible DDL for MySQL 8.x / 9.x

CREATE DATABASE IF NOT EXISTS curenet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE curenet;

-- 1. Doctor table
CREATE TABLE IF NOT EXISTS doctor (
    d_id INT AUTO_INCREMENT PRIMARY KEY,
    d_name VARCHAR(100) NOT NULL,
    d_email VARCHAR(120) NOT NULL UNIQUE,
    d_password VARCHAR(255) NOT NULL,
    d_gender VARCHAR(20),
    d_age INT,
    d_address VARCHAR(255),
    specialty VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patient table
CREATE TABLE IF NOT EXISTS patient (
    p_id INT AUTO_INCREMENT PRIMARY KEY,
    p_name VARCHAR(100) NOT NULL,
    p_email VARCHAR(120) NOT NULL UNIQUE,
    p_password VARCHAR(255) NOT NULL,
    p_gender VARCHAR(20),
    p_age INT,
    p_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Appointment table
CREATE TABLE IF NOT EXISTS appointment (
    a_id INT AUTO_INCREMENT PRIMARY KEY,
    p_name VARCHAR(100) NOT NULL,
    p_email VARCHAR(120) NOT NULL,
    app_date DATE NOT NULL,
    app_time TIME NOT NULL,
    symptoms TEXT,
    concerns TEXT,
    status ENUM('booked', 'diagnosed', 'cancelled') DEFAULT 'booked',
    type ENUM('text', 'virtual') DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appointment_status (status),
    INDEX idx_appointment_email (p_email)
);

-- 4. Appointment History table
CREATE TABLE IF NOT EXISTS app_history (
    h_id INT AUTO_INCREMENT PRIMARY KEY,
    a_id INT NOT NULL,
    p_name VARCHAR(100) NOT NULL,
    p_email VARCHAR(120) NOT NULL,
    app_date DATE,
    app_time TIME,
    symptoms TEXT,
    concerns TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_history_aid (a_id),
    INDEX idx_history_email (p_email)
);

-- 5. Medication table
CREATE TABLE IF NOT EXISTS medication (
    med_id INT AUTO_INCREMENT PRIMARY KEY,
    a_id INT NOT NULL,
    medications TEXT,
    precautions TEXT,
    app_date DATE,
    app_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medication_aid (a_id)
);

-- 6. Medical Analysis table
CREATE TABLE IF NOT EXISTS medical_analysis (
    analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    p_email VARCHAR(120) NOT NULL,
    analysis_type VARCHAR(50),
    prediction VARCHAR(255),
    probability FLOAT,
    image_path VARCHAR(255),
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_email (p_email)
);
