import { DriveError, type DriveApi } from "./driveApi";
import { driveFolderLabel } from "./carrierSettings";
import { fingerprintForInstallId, FOLDER_IDENTITY_NAME } from "./folderFingerprint";
import { META_NAME } from "./fileFormat";
import { randomId } from "../utils/randomId";

/**
 * Add an identity marker to one unambiguous legacy main-vault folder. Never
 * replace or delete meta.json: its encryption details and the old client's
 * interpretation remain untouched. Concurrent marker creators converge on
 * the oldest visible marker. This does not authenticate a different client.
 */
export async function enrollLegacyFolder(api: DriveApi, folderId: string, vaultId: string): Promise<string> {
	const candidates = await api.findFolders(driveFolderLabel(vaultId));
	if (candidates.length !== 1 || candidates[0]?.id !== folderId) {
		throw new DriveError(409, "The legacy Drive folder is ambiguous or renamed; choose it explicitly before enrolling an identity.");
	}
	const files = await api.listFiles(folderId);
	const metas = files.filter((f) => f.name === META_NAME).sort((a, b) => a.createdTime - b.createdTime || a.id.localeCompare(b.id));
	const old = metas[0];
	if (!old) throw new DriveError(409, "The legacy folder has no metadata to enroll.");
	let record: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(await api.readFile(old.id)));
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid metadata");
		record = parsed as Record<string, unknown>;
	} catch {
		throw new DriveError(409, "The legacy metadata is unreadable. Nothing was changed.");
	}
	if (record.schema !== 1 || (record.vaultId !== undefined && record.vaultId !== vaultId)) {
		throw new DriveError(409, "The legacy metadata does not match this vault. Nothing was changed.");
	}
	if (record.vaultId === vaultId && typeof record.installId === "string" && record.installId.length > 0) {
		return fingerprintForInstallId(record.installId);
	}
	let markers = files.filter((f) => f.name === FOLDER_IDENTITY_NAME).sort((a, b) => a.createdTime - b.createdTime || a.id.localeCompare(b.id));
	if (markers.length === 0) {
		const installId = typeof record.installId === "string" && record.installId.length > 0 ? record.installId : randomId(16);
		const body = new TextEncoder().encode(JSON.stringify({ schema: 1, vaultId, installId }));
		const created = await api.createFile(folderId, FOLDER_IDENTITY_NAME, body);
		const readback = await api.readFile(created.id);
		if (readback.length !== body.length || readback.some((byte, i) => byte !== body[i])) {
			throw new DriveError(502, "Drive did not return the identity marker unchanged. The original metadata was kept.");
		}
		markers = (await api.listFiles(folderId)).filter((f) => f.name === FOLDER_IDENTITY_NAME)
			.sort((a, b) => a.createdTime - b.createdTime || a.id.localeCompare(b.id));
	}
	const canonical = markers[0];
	if (!canonical) throw new DriveError(502, "The new folder identity is not visible yet. The original metadata was kept; retry later.");
	let winner: unknown;
	try { winner = JSON.parse(new TextDecoder().decode(await api.readFile(canonical.id))); }
	catch { throw new DriveError(502, "The folder identity marker could not be read back."); }
	const verified = typeof winner === "object" && winner !== null ? winner as Record<string, unknown> : {};
	if (verified.vaultId !== vaultId || typeof verified.installId !== "string" || verified.schema !== 1) {
		throw new DriveError(502, "The enrolled folder identity could not be verified.");
	}
	return fingerprintForInstallId(verified.installId);
}
