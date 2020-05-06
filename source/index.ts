import {EntitySimplified, Property} from 'wikidata-sdk-got/dist/source/wikibase-sdk-types';
import {getEntitiesSimplified} from 'wikidata-sdk-got';
import {KeyValueInMemory} from '@edjopato/datastore';
import * as yaml from 'js-yaml';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tableize = require('tableize-object');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {isEntityId} = require('wikibase-sdk');

type UnixTimestamp = number;
export interface EntityEntry {
	readonly entity: EntitySimplified;
	readonly lastUpdate: UnixTimestamp;
}

interface EntityStoreTyped<T> {
	readonly keys: () => readonly string[];
	readonly entries: () => Record<string, T | undefined>;
	readonly get: (qNumber: string) => T | undefined;
	readonly set: (qNumber: string, value: T) => void | Promise<void>;
}

export type EntityStore = EntityStoreTyped<EntityEntry>;

export interface Options {
	readonly properties?: Property[];
	readonly entityStore?: EntityStore;
}

const HOUR_IN_SECONDS = 60 * 60;

export default class WikidataEntityStore {
	private readonly _resourceKeys: Record<string, string> = {};

	private readonly _entities: EntityStore;

	private readonly _properties?: Property[];

	constructor(
		options: Options = {}
	) {
		this._properties = options.properties ?? [];
		this._entities = options.entityStore ?? new KeyValueInMemory<EntityEntry>();
	}

	async addResourceKeyDict(resourceKeys: Readonly<Record<string, string>>): Promise<void> {
		const entries = Object.keys(resourceKeys).map(o => ({key: o, qNumber: resourceKeys[o]}));
		return this.addResourceKeyArr(entries);
	}

	async addResourceKeyArr(entries: ReadonlyArray<{readonly key: string; readonly qNumber: string}>): Promise<void> {
		const qNumbers = entries.map(o => o.qNumber);
		await this.preloadQNumbers(...qNumbers);

		for (const {key, qNumber} of entries) {
			const existingValue = this._resourceKeys[key];
			if (existingValue && existingValue !== qNumber) {
				throw new Error(`key ${key} already exists with a different value: ${qNumber} !== ${existingValue}`);
			}

			this._resourceKeys[key] = qNumber;
		}
	}

	async addResourceKeyYaml(yamlString: string): Promise<void> {
		const yamlObject = yaml.safeLoad(yamlString);
		const dict: Record<string, string> = tableize(yamlObject);
		return this.addResourceKeyDict(dict);
	}

	async updateQNumbers(qNumbers: readonly string[], updateOldestNPercentage = 0.6): Promise<void> {
		await this.preloadQNumbers(...qNumbers);

		// Ensure to only update things which are at least 1 hour old
		const now = Date.now() / 1000;
		const updateWhenOlderThanUnixTimestamp = now - HOUR_IN_SECONDS;

		const neededQNumbers = qNumbers
			.filter(o => {
				const existingValue = this._entities.get(o);
				return existingValue && existingValue.lastUpdate < updateWhenOlderThanUnixTimestamp;
			});

		const update = neededQNumbers
			.sort(sortSmallestFirst(o => this._entities.get(o)!.lastUpdate))
			.slice(0, Math.ceil(neededQNumbers.length * updateOldestNPercentage));

		return this.forceloadQNumbers(...update);
	}

	async loadQNumbers(updateWhenOlderThanUnixTimestamp: UnixTimestamp, ...qNumbers: readonly string[]): Promise<void> {
		const neededQNumbers = qNumbers
			.filter(o => {
				const existingValue = this._entities.get(o);
				return !existingValue || existingValue.lastUpdate < updateWhenOlderThanUnixTimestamp;
			});

		return this.forceloadQNumbers(...neededQNumbers);
	}

	async preloadQNumbers(...qNumbers: readonly string[]): Promise<void> {
		const neededQNumbers = qNumbers
			.filter(o => !this._entities.get(o));

		return this.forceloadQNumbers(...neededQNumbers);
	}

	// Ensures the qNumbers are load even when they were already loaded
	async forceloadQNumbers(...qNumbers: readonly string[]): Promise<void> {
		const entities = await getEntitiesSimplified({
			ids: qNumbers,
			props: this._properties
		});

		const lastUpdate = Math.floor(Date.now() / 1000);

		await Promise.all(Object.keys(entities)
			.map(async qNumber => this._entities.set(qNumber, {
				entity: entities[qNumber],
				lastUpdate
			}))
		);
	}

	availableResourceKeys(): readonly string[] {
		return Object.keys(this._resourceKeys);
	}

	availableEntities(): readonly string[] {
		return this._entities.keys();
	}

	allEntities(): readonly EntitySimplified[] {
		const entries = this._entities.entries();
		return Object.values(entries).map(o => o!.entity);
	}

	qNumber(keyOrQNumber: string): string {
		if (this._resourceKeys[keyOrQNumber]) {
			return this._resourceKeys[keyOrQNumber];
		}

		if (!isEntityId(keyOrQNumber)) {
			throw new Error(`Argument is neither a resourceKey or an entity id: ${keyOrQNumber}`);
		}

		return keyOrQNumber;
	}

	entity(keyOrQNumber: string): EntitySimplified {
		const qNumber = this.qNumber(keyOrQNumber);
		const entry = this._entities.get(qNumber);
		if (entry) {
			return entry.entity;
		}

		return {
			id: qNumber,
			type: 'item'
		};
	}

	entityLastUpdate(keyOrQNumber: string): UnixTimestamp | undefined {
		const qNumber = this.qNumber(keyOrQNumber);
		const entry = this._entities.get(qNumber);
		return entry?.lastUpdate;
	}
}

function sortSmallestFirst<T>(selector: (obj: T) => number): (a: T, b: T) => number {
	return (a, b) => selector(a) - selector(b);
}

// For CommonJS default export support
module.exports = WikidataEntityStore;
module.exports.default = WikidataEntityStore;
