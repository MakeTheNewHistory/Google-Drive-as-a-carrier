import { App, Modal } from "obsidian";
import { DriveFolderRecoveryModal } from "../../src/drive-carrier/DriveFolderRecoveryModal";
import { suite } from "../harness.ts";

const s = suite("drive-folder-recovery-modal");

class FakeElement {
	readonly children: FakeElement[] = [];
	readonly listeners = new Map<string, () => void>();
	value = "";
	disabled = false;
	constructor(readonly tag: string, readonly text = "") {}
	empty(): void { this.children.length = 0; }
	createEl(tag: string, options?: { text?: string }): FakeElement {
		const child = new FakeElement(tag, options?.text ?? "");
		this.children.push(child);
		return child;
	}
	createDiv(): FakeElement { return this.createEl("div"); }
	addEventListener(event: string, action: () => void): void { this.listeners.set(event, action); }
	setText(text: string): void { this.value = text; }
	click(): void { this.listeners.get("click")?.(); }
	find(text: string): FakeElement | undefined {
		return this.children.find((child) => child.text === text) ?? this.children.map((child) => child.find(text)).find((child) => child !== undefined);
	}
	findTag(tag: string): FakeElement | undefined {
		return this.children.find((child) => child.tag === tag) ?? this.children.map((child) => child.findTag(tag)).find((child) => child !== undefined);
	}
}

let mostRecent: Modal | null = null;
Object.defineProperty(Modal.prototype, "open", { configurable: true, value: function (this: Modal) {
	Object.defineProperty(this, "contentEl", { configurable: true, value: new FakeElement("content") });
	mostRecent = this;
	this.onOpen();
} });
Object.defineProperty(Modal.prototype, "close", { configurable: true, value: function (this: Modal) { this.onClose(); } });
const ui = (modal: Modal): FakeElement => modal.contentEl as unknown as FakeElement;
const tick = async (): Promise<void> => { await new Promise((resolve) => setTimeout(resolve, 0)); };

s.section("Recovery modal requires a folder ID and validates selection");
{
	const chosen: string[] = [];
	let closed = 0;
	const modal = new DriveFolderRecoveryModal(new App(), "Ambiguous vault", {
		choose: async (id) => { chosen.push(id); }, startNew: async () => {}, closed: () => { closed++; },
	});
	modal.open();
	ui(modal).find("Use verified folder")?.click();
	s.check(chosen.length === 0, "empty folder ID cannot be selected");
	const input = ui(modal).findTag("input");
	if (input) input.value = "folder-123";
	ui(modal).find("Use verified folder")?.click();
	await tick();
	s.check(chosen.join() === "folder-123" && closed === 1, "validated ID action closes the modal");
}

s.section("A rejected folder choice leaves recovery open");
{
	let closed = 0;
	const modal = new DriveFolderRecoveryModal(new App(), "Wrong vault", {
		choose: async () => { throw new Error("Wrong vault ID"); }, startNew: async () => {}, closed: () => { closed++; },
	});
	modal.open();
	const input = ui(modal).findTag("input");
	if (input) input.value = "wrong-folder";
	ui(modal).find("Use verified folder")?.click();
	await tick();
	s.check(closed === 0 && ui(modal).find("Use verified folder")?.disabled === false, "validation failure does not save or close the modal");
}

s.section("New history needs an additional explicit confirmation; cancel changes nothing");
{
	let created = 0;
	let closed = 0;
	const modal = new DriveFolderRecoveryModal(new App(), "Missing history", {
		choose: async () => {}, startNew: async () => { created++; }, closed: () => { closed++; },
	});
	modal.open();
	ui(modal).find("Start a new Drive history")?.click();
	s.check(created === 0 && mostRecent !== modal, "first click opens a separate warning, not a folder");
	const confirmation = mostRecent;
	if (confirmation) ui(confirmation).find("Keep sync paused")?.click();
	s.check(created === 0, "declining confirmation creates nothing");
	ui(modal).find("Start a new Drive history")?.click();
	const accepted = mostRecent;
	if (accepted) ui(accepted).find("Create separate history")?.click();
	await tick();
	s.check(created === 1 && closed === 1, "only the second confirmation creates a history");
}

s.section("Closing recovery leaves sync paused and changes nothing");
{
	let actions = 0;
	let closed = 0;
	const modal = new DriveFolderRecoveryModal(new App(), "No folder", {
		choose: async () => { actions++; }, startNew: async () => { actions++; }, closed: () => { closed++; },
	});
	modal.open();
	ui(modal).find("Cancel (keep sync paused)")?.click();
	s.check(actions === 0 && closed === 1, "cancel only closes the modal");
}

await s.done();
