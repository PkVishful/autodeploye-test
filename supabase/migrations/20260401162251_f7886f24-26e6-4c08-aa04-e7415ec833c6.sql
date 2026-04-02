ALTER TABLE electricity_readings 
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN locked_by uuid DEFAULT NULL;