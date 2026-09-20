# Apply a reviewed producer name to its linked wines

The producer profile's existing primary-name control changes its heading and directory entry only. Applying an LWIN suggestion to one wine changes that bottle, and an unfamiliar spelling can create a separate producer identity. Neither flow offers a producer-wide correction with automatic alias registration.

Needs review now offers **Apply producer name to all linked wines…** when the selected wine has a producer suggestion. Its read-only preview shows the existing producer, proposed name, count of linked wines, previous names, and sample bottles. **Apply to N wines** changes the profile name and every wine linked to that producer ID in the signed-in account. This is an explicit group action; the ordinary single-wine Apply and Keep controls remain available.

The operation registers old and new names as aliases of the same producer, including the research alias bridge. The stable producer ID, cuvée IDs, research, recognized bottle evidence, wine names, vintages, LWIN identifiers, and personal notes remain unchanged. Only producer suggestions equivalent to the accepted spelling are removed; other suggestions remain, with producer comparison snapshots updated where necessary. Real identity conflicts remain pending for an explicit identity decision.

If any affected name already belongs to another producer record, the preview links to Identity & aliases. The existing producer merge workflow must resolve that conflict first; the bulk correction does not silently merge producers or take over their aliases. Unlinked wines and wines attached to other producer IDs are excluded from the displayed count and update, even if their names look similar.

Confirmation revalidates the preview token and runs a transaction covering aliases, the primary producer name, and all wine updates. A SQL assertion checks group membership, relevant wine snapshots, the producer snapshot, and alias ownership inside the transaction. A failed assertion or later write rolls back the whole operation. No database migration is required.

SQLite tests cover 45 linked wines, preservation of research and wine data, alias reuse, other pending differences, account and producer boundaries, name collisions, stale previews, concurrent membership changes, and rollback. Mobile browser tests cover preview, cancellation, confirmation, queue refresh, and collision handling in light and dark modes.
