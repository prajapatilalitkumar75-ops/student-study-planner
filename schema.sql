CREATE DATABASE IF NOT EXISTS study_planner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE study_planner;

CREATE TABLE IF NOT EXISTS tasks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(160) NOT NULL,
    subject VARCHAR(100) NULL,
    priority ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
    due_date DATE NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_tasks_completed_due (completed, due_date)
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id INT NOT NULL AUTO_INCREMENT,
    day_of_week ENUM(
        'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday', 'Sunday'
    ) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(160) DEFAULT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_study_sessions_day_time (day_of_week, start_time)
);
