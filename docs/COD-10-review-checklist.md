# COD-10 — Main Drive vault folder identity: review checklist

**Scope:** only the main `YAOS <vaultId>` folder. Attachment/blob and snapshot folders have separate, existing lookup behavior and are out of scope by user decision. **Automated verification:** production and QA builds, test/QA typechecks, production-bundle guard and 143 regression suites pass. **Not verified here:** real Obsidian UI or real Google Drive/OAuth-client visibility; the following is a reviewer smoke checklist, not a claim of completion on actual devices.

## Safe setup

- Use a scratch vault and Google account. Back up local vaults and all relevant Drive folders first. Do not delete duplicates or edit `meta.json` to suppress warnings.
- Check the recorded Vault ID, Drive folder IDs, visible folder names and OAuth client identities on each device. `drive.file` cannot discover files inaccessible to the current OAuth client.

## Normal behavior (no regression)

- Fresh vault on two devices: both converge on the same main folder. Concurrent empty-folder creation still selects one deterministic folder. Text, attachments, snapshots, encryption and the Cloudflare/LAN carriers continue to work.
- Rename the main folder in Drive: the saved folder ID/fingerprint continues to follow it. A copied same-name folder is not silently adopted.
- Changing Vault ID or manually changing/clearing the Drive folder ID clears the old fingerprint and explicit-choice acknowledgment.

## Verified choice and pause

- Place an **older wrong-vault** and a newer correct-vault folder under the same expected name: the transport and wizard use the correct one. Confirm nothing is written to the wrong folder.
- Place two *initialized* same-vault folders with different histories: automatic sync pauses even when one was previously pinned without an explicit recovery choice. Cancel keeps settings and remote files unchanged. Choose a matching folder by its Drive ID, then reload: the choice remains acknowledged and only that folder is used.
- Enter a wrong-vault, trashed, nonexistent or inaccessible folder ID: validation refuses it. A transient network error must not be interpreted as permission to create a new folder.
- Change a pinned folder's metadata so its fingerprint differs: sync stops before uploads, and the recovery choices appear.
- Press **Start a new Drive history** but cancel the second confirmation: no folder is created. Confirming creates a separate empty folder; the other devices do not silently follow it. Reload is required to start using it.

## Legacy and encryption

- With exactly one older named vault folder lacking a permanent install ID, verify YAOS adds `folder-identity.json`, saves the fingerprint, and leaves the original `meta.json` byte-for-byte unchanged. Repeat startup: no second marker is needed.
- For an encrypted legacy folder, a wrong passphrase must not enroll a marker. With the correct passphrase, the old encryption settings remain unchanged and the vault still decrypts on another device.
- A renamed or duplicate legacy folder is **not** automatically enrolled; recovery requires an explicit, verifiable choice. If metadata cannot prove the Vault ID, do not force adoption.

## Review outcome

Record build/commit, Obsidian desktop/mobile versions, OAuth client configuration, test dates, any notice wording or screenshot, and the IDs/fingerprints of scratch folders (never tokens or passphrases). COD-10 can be marked Done only after the reviewer accepts the user-facing recovery behavior and real-device checks.
