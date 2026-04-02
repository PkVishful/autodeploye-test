-- Delete all related data first, then tickets
DELETE FROM running_bed_maintenance_details WHERE ticket_id IN (SELECT id FROM maintenance_tickets);
DELETE FROM ticket_purchases WHERE ticket_id IN (SELECT id FROM maintenance_tickets);
DELETE FROM ticket_cost_estimates WHERE ticket_id IN (SELECT id FROM maintenance_tickets);
DELETE FROM ticket_logs WHERE ticket_id IN (SELECT id FROM maintenance_tickets);
DELETE FROM diagnostic_sessions WHERE ticket_id IN (SELECT id FROM maintenance_tickets);
DELETE FROM maintenance_tickets;