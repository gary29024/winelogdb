-- One failed producer in a campaign must not fence every other producer.
-- Empty namespaces are legacy receipts and conservatively hold the whole operation.
ALTER TABLE provider_operations ADD COLUMN namespace TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_provider_operations_namespace ON provider_operations(operation_id,namespace,state);
