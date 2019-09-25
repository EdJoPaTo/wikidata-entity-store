import {Dictionary, KeyValueInMemory} from '@edjopato/datastore';
import {EntitySimplified, Property, isEntityId} from 'wikidata-sdk';
import {getEntitiesSimplified} from 'wikidata-sdk-got';
import * as yaml from 'js-yaml';

/* eslint @typescript-eslint/no-var-requires: warn */
/* eslint @typescript-eslint/no-require-imports: warn */
const tableize = require('tableize-object');

type UnixTimestamp = number;
export interface EntityEntry {
	entity: EntitySimplified;
	lastUpdate: UnixTimestamp;
}

interface EntityStoreTyped<T> {
	keys(): readonly string[];
	entries(): Dictionary<T>;
	get(qNumber: string): T | undefined;
	set(qNumber: string, value: T): void | Promise<void>;
}

export type EntityStore = EntityStoreTyped<EntityEntry>;

export interface Options {
	properties?: Property[];
	entityStore?: EntityStore;
}

export default class WikidataEntityStore {
	private readonly _resourceKeys: Dictionary<string> = {};

	private readonly _entities: EntityStore;

	private readonly _properties?: Property[];

	constructor(
		options: Options = {}
	) {
		this._properties = options.properties || [];
		this._entities = options.entityStore || new KeyValueInMemory<EntityEntry>();
	}

	async addResourceKeyDict(resourceKeys: Dictionary<string>): Promise<void> {
		const entries = Object.keys(resourceKeys).map(o => ({key: o, qNumber: resourceKeys[o]}));
		return this.addResourceKeyArr(entries);
	}

	async addResourceKeyArr(entries: ReadonlyArray<{key: string; qNumber: string}>): Promise<void> {
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
		const dict: Dictionary<string> = tableize(yamlObject);
		return this.addResourceKeyDict(dict);
	}

	async preloadQNumbers(...qNumbers: string[]): Promise<void> {
		const neededQNumbers = qNumbers
			.filter(o => !this._entities.get(o));

		return this.forceloadQNumbers(...neededQNumbers);
	}

	// Ensures the qNumbers are load even when they were already loaded
	async forceloadQNumbers(...qNumbers: string[]): Promise<void> {
		const entities = await getEntitiesSimplified({
			ids: qNumbers,
			props: this._properties
		});

		const lastUpdate = Math.floor(Date.now() / 1000);
		for (const qNumber of Object.keys(entities)) {
			this._entities.set(qNumber, {
				entity: entities[qNumber],
				lastUpdate
			});
		}
	}

	availableResourceKeys(): readonly string[] {
		return Object.keys(this._resourceKeys);
	}

	availableEntities(): readonly string[] {
		return this._entities.keys();
	}

	allEntities(): readonly EntitySimplified[] {
		const entries = this._entities.entries();
		return Object.values(entries).map(o => o.entity);
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
}

// For CommonJS default export support
module.exports = WikidataEntityStore;
module.exports.default = WikidataEntityStore;
