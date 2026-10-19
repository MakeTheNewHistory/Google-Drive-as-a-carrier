import { DriveError, FOLDER_MIME, type DriveApi } from "./driveApi";
import { driveFolderLabel } from "./carrierSettings";
import { DRIVE_LAYOUT_SCHEMA } from "./driveKeyring";
import { inspectFolderFingerprint } from "./folderFingerprint";

/** Inspect a user-selected ID without writing; never trust the folder's name alone. */
export async function verifyRecoveryFolder(api: DriveApi, vaultId: string, folderId: string): Promise<string> {
	const info = await api.getFile(folderId);
	if (info.trashed || info.mimeType !== FOLDER_MIME) throw new DriveError(400, "That Drive ID is not an accessible, active folder.");
	const identity = await inspectFolderFingerprint(api, folderId);
	if (identity.kind !== "identified" || identity.vaultId !== vaultId || identity.schema !== DRIVE_LAYOUT_SCHEMA || !identity.fingerprint) {
		throw new DriveError(400, "That folder does not have verified metadata for this Vault ID. No settings were changed.");
	}
	return identity.fingerprint;
}

/** Call only after the second user confirmation; do not delete or adopt others. */
export async function createRecoveryFolder(api: DriveApi, vaultId: string): Promise<string> {
	return (await api.createFolder(driveFolderLabel(vaultId))).id;
}
