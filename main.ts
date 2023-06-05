import {App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

// Remember to rename these classes and interfaces!

interface AsideTableSettings {
	headerColor: string;
}

interface Thumbnail {
	url: string;
	description?: string;
}

interface TableEntry {
	key: string;
	value: string | string[];
}

interface Group {
	name: string;
	entries: TableEntry[];
}

interface AsyncTable {
	thumbnails?: Thumbnail[];
	groups: Group[];
}

const DEFAULT_SETTINGS: AsideTableSettings = {
	headerColor: '#1000ff'
}

export default class AsideTable extends Plugin {
	settings: AsideTableSettings;

	async onload() {
		await this.loadSettings();

		// Markdown Code Block Processor
		this.registerMarkdownCodeBlockProcessor("aside", (source, el, ctx) => {
			const table = this.formatTable(source);
			const container = el.createSpan({cls: "aside-table-container", });

			// Draw the thumbnails
			const thumbnails = container.createDiv({cls: "aside-table-thumbnails"});
			for (const thumbnail of table.thumbnails ?? []) {
				const thumbnailDiv = thumbnails.createDiv({cls: "aside-table-thumbnail"});
				const thumbnailImage = thumbnailDiv.createEl("img", {attr: {src: thumbnail.url}});
				if (thumbnail.description) thumbnailImage.title = thumbnail.description;
			}

			// Draw the groups
			for (const group of table.groups) {
				const groupHeader = container.createDiv({
					cls: "aside-table-group-header",
					text: group.name,
					attr: {
						style: `background-color: ${this.settings.headerColor}`
					}
				});
				for (const entry of group.entries){
					const entryDiv = container.createDiv({cls: "aside-table-entry"});
					const entryKey = entryDiv.createEl("strong", {cls: "aside-table-entry-key", text: entry.key});
					if (typeof entry.value === "string") {
						const isLink = entry.value.match(/^\[\[(.*?)(?:(?<!\\)\|(.*?))?]]$/);
						if (isLink) {
							const note = this.getNoteLink(isLink[1]);
							const link = entryDiv.createEl("a", {
								cls: "internal-link aside-table-entry-value",
								text: isLink[2] ?? note,
								attr: {
									href: note,
									"data-href": note,
									target: "_blank",
									rel: "noopener"
								}
							});
							continue;
						}
						const entryValue = entryDiv.createEl("span", {cls: "aside-table-entry-value", text: entry.value});
					} else {
						const entryValue = entryDiv.createEl("ul", {cls: "aside-table-entry-value aside-table-entry-list"});
						for (const value of entry.value) {
							entryValue.createEl("li", {text: value});
						}
					}
				}
			}
		}, 100);

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	formatTable(source: string): AsyncTable {
		/**
		 * This function takes the source code and prepares it for the table.
		 * The syntax is as follows:
		 * At the very top, there can be one or more thumbnails, each starting on a new line with a `!` and a URL.
		 * 	After the URL, there can be a description, which is separated from the URL by a `|`.
		 * 	Example: `!https://example.com/image.png|This is an example image.`
		 * Each group starts with a header, which is a line starting with a `#` and a name.
		 * 	Example: `#Group Name`
		 * After the header, there can be one or more entries, each starting on a new line with a `-`, key name, `:` and the value.
		 * 	Example: `-Key:Value`
		 * The value can be a single string or a list of strings, which are separated by a `;`.
		 * 	Example: `-Key:Value 1;Value 2;Value 3`
		 * The value can also be a link, which is a string starting with `[[` and ending with `]]`.
		 * 	Example: `-Key:[[Link]]`
		 * The value can also be a link with a description, which is a string starting with `[[` and ending with `]]` and a description, which is separated from the link by a `|`.
		 * 	Example: `-Key:[[Link|Link Description]]`
		 * All the special characters can be escaped with a `\`.
		 * 	Example: `-Key:This is a \;`
		 */
		// Retrieve the thumbnails
		const thumbnails = [...source.matchAll(/^!(.*?)(?:(?<!\\)\|(.*))?$/gm)].map(match => {
			// Return the thumbnail
			return {url: this.getImageLink(match[1]), description: match[2]};
		});
		// Use regex to split the source into groups
		const groups = [...source.matchAll(/^#(.*)\n-((?:[^#]|\n)*)(?=#|$)/gm)].map(groupMatch => {
			const entries = [...groupMatch[2].matchAll(/^-(.*?)(?<!\\):(.*)$/gm)].map(entryMatch => {
				const key = entryMatch[1].replace("\\:", ":");
				const value = entryMatch[2].split(/(?<!\\);/g).map(value => value.replace("\\;", ";"));
				// Return the entry
				return {key, value: value.length === 1 ? value[0] : value};
			});
			// Return the group
			return {name: groupMatch[1], entries} as Group;
		});
		// Return the thumbnails and groups
		return {thumbnails, groups};
	}

	getNoteLink(noteName: string): string {
		const note = this.app.metadataCache.getFirstLinkpathDest(noteName, "");
		return note ? this.app.metadataCache.fileToLinktext(note, "") : noteName;
	}

	getImageLink(imageName: string): string {
		const image = this.app.metadataCache.getFirstLinkpathDest(imageName, "");
		// @ts-ignore
		return image ? `app://local/${image?.vault.adapter.basePath}/${image?.path}` : imageName;
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: AsideTable;

	constructor(app: App, plugin: AsideTable) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Aside Table Settings'});

		new Setting(containerEl)
			.setName('Header color')
			.setDesc('Sets the color of the headers in the aside table.')
			.addColorPicker(color => color
				.setValue(this.plugin.settings.headerColor)
				.onChange(async (value) => {
					this.plugin.settings.headerColor = value;
					await this.plugin.saveSettings();
				})
			)
	}
}
