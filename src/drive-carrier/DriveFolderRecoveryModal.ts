import { type App, Modal } from "obsidian";
import { ConfirmModal } from "../ui/ConfirmModal";

export interface DriveFolderRecoveryActions {
	/** Validates the user's choice before changing settings. */
	choose(id: string): Promise<void>;
	/** Called only after the user confirms a separate, new remote history. */
	startNew(): Promise<void>;
	/** Lets the owner clear its one-modal-at-a-time flag. */
	closed(): void;
}

/** Explicit recovery; closing or cancelling never changes a folder binding. */
export class DriveFolderRecoveryModal extends Modal {
	constructor(app: App, private readonly reason: string, private readonly actions: DriveFolderRecoveryActions) {
		super(app);
	}

	onOpen(): void {
		const content = this.contentEl;
		content.empty();
		content.createEl("h3", { text: "Choose your Drive vault folder" });
		content.createEl("p", { text: this.reason });
		content.createEl("p", { text: "Sync is paused. Nothing will be read or written to a different folder until you choose. Find a folder's ID in its Google Drive URL; the chosen folder must already contain verified metadata for this Vault ID." });
		const input = content.createEl("input", { type: "text", attr: { placeholder: "Google Drive folder ID", "aria-label": "Google Drive folder ID" } });
		const error = content.createEl("p", { cls: "mod-warning" });
		const buttons = content.createDiv({ cls: "modal-button-container" });
		const choose = buttons.createEl("button", { text: "Use verified folder" });
		choose.addEventListener("click", () => { void (async () => {
			const id = input.value.trim();
			if (!id) { error.setText("Enter the folder ID first."); return; }
			choose.disabled = true;
			try { await this.actions.choose(id); this.close(); }
			catch (err) { error.setText(err instanceof Error ? err.message : String(err)); }
			finally { choose.disabled = false; }
		})(); });
		const fresh = buttons.createEl("button", { text: "Start a new Drive history", cls: "mod-warning" });
		fresh.addEventListener("click", () => {
			new ConfirmModal(this.app, "Start a separate Drive history?",
				"This creates a NEW folder and a separate remote history. Existing devices will NOT switch to it automatically. Your current folder and its files are not deleted. Proceed only if you intend to start over on Drive; keep a backup of every device first.",
				async () => {
					fresh.disabled = true;
					try { await this.actions.startNew(); this.close(); }
					catch (err) { error.setText(err instanceof Error ? err.message : String(err)); }
					finally { fresh.disabled = false; }
				}, "Create separate history", "Keep sync paused").open();
		});
		buttons.createEl("button", { text: "Cancel (keep sync paused)" }).addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
		this.actions.closed();
	}
}
