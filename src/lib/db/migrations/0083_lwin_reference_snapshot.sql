-- Reference facts and attribution are separate from the user's wine fields.
ALTER TABLE wines ADD COLUMN lwin_reference_json TEXT;
