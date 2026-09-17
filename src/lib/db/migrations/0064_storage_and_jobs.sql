CREATE TABLE stored_objects(object_key TEXT PRIMARY KEY,owner_id TEXT NOT NULL,byte_size INTEGER NOT NULL CHECK(byte_size>=0),updated_at TEXT NOT NULL);
CREATE INDEX idx_stored_objects_owner ON stored_objects(owner_id);
CREATE TABLE storage_totals(owner_id TEXT PRIMARY KEY,byte_size INTEGER NOT NULL DEFAULT 0 CHECK(byte_size>=0));
INSERT INTO storage_totals(owner_id,byte_size) VALUES('*',0);
CREATE TRIGGER storage_insert AFTER INSERT ON stored_objects BEGIN
 INSERT INTO storage_totals(owner_id,byte_size) VALUES(new.owner_id,new.byte_size) ON CONFLICT(owner_id) DO UPDATE SET byte_size=byte_size+new.byte_size;
 UPDATE storage_totals SET byte_size=byte_size+new.byte_size WHERE owner_id='*';
END;
CREATE TRIGGER storage_update AFTER UPDATE ON stored_objects BEGIN
 UPDATE storage_totals SET byte_size=byte_size+new.byte_size-old.byte_size WHERE owner_id=new.owner_id;
 UPDATE storage_totals SET byte_size=byte_size+new.byte_size-old.byte_size WHERE owner_id='*';
END;
CREATE TRIGGER storage_delete AFTER DELETE ON stored_objects BEGIN
 UPDATE storage_totals SET byte_size=byte_size-old.byte_size WHERE owner_id=old.owner_id;
 UPDATE storage_totals SET byte_size=byte_size-old.byte_size WHERE owner_id='*';
END;
CREATE TABLE rollout_state(name TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE queue_deliveries(id TEXT PRIMARY KEY,lease_until INTEGER NOT NULL,done INTEGER NOT NULL DEFAULT 0);
ALTER TABLE credit_operations ADD COLUMN budget_hold_usd REAL NOT NULL DEFAULT 0 CHECK(budget_hold_usd>=0);
CREATE INDEX idx_ai_usage_monthly_billing ON ai_usage_monthly(month,model,tier);
CREATE TABLE research_work(subject_key TEXT NOT NULL,operation_id TEXT NOT NULL REFERENCES credit_operations(id),owner_id TEXT NOT NULL,PRIMARY KEY(subject_key,owner_id));
CREATE TABLE research_followers(operation_id TEXT PRIMARY KEY REFERENCES credit_operations(id),sponsor_operation_id TEXT NOT NULL REFERENCES credit_operations(id),sponsor_id TEXT NOT NULL);
