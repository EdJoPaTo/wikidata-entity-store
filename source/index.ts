import {EntitySimplified, Property} from 'wikidata-sdk-got/dist/source/wikibase-sdk-types';
import {getEntitiesSimplified} from 'wikidata-sdk-got';
import {KeyValueInMemory} from '@edjopato/datastore';
import * as yaml from 'js-yaml';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tableize = require('tableize-object');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {isEntityId} = require('wikibase-sdk');

interface Store<T> {
	readonly keys: () => readonly string[];
	readonly get: (qNumber: string) => T | undefined;
	readonly set: (qNumber: string, value: T, ttl?: number) => unknown;
}

export type EntityStore = Store<EntitySimplified>;

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
		this._entities = options.entityStore ?? new KeyValueInMemory<EntitySimplified>();
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

		await Promise.all(Object.keys(entities)
			.map(async qNumber => this._entities.set(qNumber, entities[qNumber], HOUR_IN_SECONDS * 1000))
		);
	}

	availableResourceKeys(): readonly string[] {
		return Object.keys(this._resourceKeys);
	}

	availableEntities(): readonly string[] {
		return this._entities.keys();
	}

	allEntities(): readonly EntitySimplified[] {
		const allKeys = this._entities.keys();
		return allKeys
			.map(o => this._entities.get(o)!)
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
			return entry;
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
