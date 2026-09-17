-- Additive cutover: the existing owner key is retained, never reassigned by signup.
CREATE TABLE app_users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','member')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE auth_identities (
 provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES app_users(id),
 PRIMARY KEY(provider,subject), UNIQUE(user_id,provider)
);
CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_flows (
 state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, invitation_hash TEXT,
 expires_at INTEGER NOT NULL
);
CREATE TABLE member_invitations (
 token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES app_users(id),
 expires_at INTEGER NOT NULL, used_by TEXT REFERENCES app_users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE friend_links (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), expires_at INTEGER NOT NULL);
CREATE TABLE friendships (
 user_id TEXT NOT NULL REFERENCES app_users(id), friend_id TEXT NOT NULL REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,friend_id), CHECK(user_id<>friend_id)
);
CREATE TABLE wine_shares (
 wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE, owner_id TEXT NOT NULL REFERENCES app_users(id),
 recipient_id TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(wine_id,recipient_id), CHECK(owner_id<>recipient_id)
);
CREATE INDEX idx_wine_shares_recipient ON wine_shares(recipient_id,created_at DESC,wine_id);
CREATE TABLE shared_photos (
 image_id TEXT PRIMARY KEY REFERENCES wine_images(id) ON DELETE CASCADE, owner_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE, byte_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE pilot_settings (id INTEGER PRIMARY KEY CHECK(id=1), value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE credit_prices (
 id TEXT PRIMARY KEY, action TEXT NOT NULL, credits INTEGER NOT NULL CHECK(credits>0),
 created_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES app_users(id)
);
CREATE INDEX idx_credit_prices_action ON credit_prices(action,created_at DESC,id);
CREATE TABLE credit_wallets (user_id TEXT PRIMARY KEY REFERENCES app_users(id), balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=balance));
CREATE TABLE credit_quotes (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, path TEXT NOT NULL, fingerprint TEXT NOT NULL, units_json TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total>=0), expires_at INTEGER NOT NULL
);
CREATE TABLE credit_operations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), request_key TEXT NOT NULL, quote_id TEXT NOT NULL UNIQUE REFERENCES credit_quotes(id),
 path TEXT NOT NULL, fingerprint TEXT NOT NULL, units_json TEXT NOT NULL, reserved INTEGER NOT NULL CHECK(reserved>=0),
 captured INTEGER NOT NULL DEFAULT 0 CHECK(captured>=0 AND captured<=reserved),
 status TEXT NOT NULL CHECK(status IN ('reserved','running','complete','failed','review')),
 response_json TEXT, response_status INTEGER, run_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(user_id,request_key)
);
CREATE INDEX idx_credit_operations_pending ON credit_operations(status,updated_at);
CREATE INDEX idx_credit_operations_owner ON credit_operations(user_id,created_at DESC);
CREATE TABLE credit_ledger (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), operation_id TEXT REFERENCES credit_operations(id),
 kind TEXT NOT NULL CHECK(kind IN ('grant','reserve','capture','release')), amount INTEGER NOT NULL CHECK(amount>=0),
 actor_id TEXT NOT NULL, reason TEXT NOT NULL, external_transaction_ref TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id,created_at DESC,id);
CREATE TRIGGER credit_ledger_no_update BEFORE UPDATE ON credit_ledger BEGIN SELECT RAISE(ABORT,'Credit ledger is append-only'); END;
CREATE TRIGGER credit_ledger_no_delete BEFORE DELETE ON credit_ledger BEGIN SELECT RAISE(ABORT,'Credit ledger is append-only'); END;
CREATE TRIGGER credit_grant AFTER INSERT ON credit_ledger WHEN new.kind='grant' BEGIN
 UPDATE credit_wallets SET balance=balance+new.amount WHERE user_id=new.user_id;
END;
CREATE TRIGGER credit_reserve AFTER INSERT ON credit_ledger WHEN new.kind='reserve' BEGIN
 UPDATE credit_wallets SET reserved=reserved+new.amount WHERE user_id=new.user_id;
END;
CREATE TRIGGER credit_capture AFTER INSERT ON credit_ledger WHEN new.kind='capture' BEGIN
 UPDATE credit_wallets SET balance=balance-new.amount,reserved=reserved-new.amount WHERE user_id=new.user_id;
END;
CREATE TRIGGER credit_release AFTER INSERT ON credit_ledger WHEN new.kind='release' BEGIN
 UPDATE credit_wallets SET reserved=reserved-new.amount WHERE user_id=new.user_id;
END;
CREATE TABLE queue_outbox (
 id TEXT PRIMARY KEY, operation_id TEXT REFERENCES credit_operations(id), body_json TEXT NOT NULL, due_at INTEGER NOT NULL,
 sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_queue_outbox_due ON queue_outbox(sent_at,due_at);
CREATE TABLE reusable_research (
 contributor_id TEXT NOT NULL, subject_key TEXT NOT NULL, scope TEXT NOT NULL, entry_json TEXT NOT NULL,
 quality_version INTEGER NOT NULL DEFAULT 1, researched_at TEXT NOT NULL,
 PRIMARY KEY(contributor_id,subject_key,scope)
);
CREATE INDEX idx_reusable_research_subject ON reusable_research(subject_key,scope,researched_at DESC);
-- No automatic invitation, credit grant, or price: launch requires owner configuration.
