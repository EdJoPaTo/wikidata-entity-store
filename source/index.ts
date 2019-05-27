import {EntitySimplified, Property, isEntityId} from 'wikidata-sdk';
import {getEntitiesSimplified} from 'wikidata-sdk-got';

type Dictionary<T> = {[key: string]: T};

export interface Options {
	properties?: Property[];
	entityStore?: Map<string, EntitySimplified>;
}

export default class WikidataEntityStore {
	private readonly _resourceKeys: Map<string, string> = new Map();

	private readonly _entities: Map<string, EntitySimplified>;

	private readonly _properties?: Property[];

	constructor(
		options: Options = {}
	) {
		this._properties = options.properties || [];
		this._entities = options.entityStore || new Map();
	}

	async addResourceKeyDict(resourceKeys: Dictionary<string>): Promise<void> {
		const entries = Object.keys(resourceKeys).map(o => ({key: o, qNumber: resourceKeys[o]}));
		return this.addResourceKeyArr(entries);
	}

	async addResourceKeyArr(entries: ReadonlyArray<{key: string; qNumber: string}>): Promise<void> {
		const keys = entries.map(o => o.key);
		const qNumbers = entries.map(o => o.qNumber);

		const existingKeys = this.availableResourceKeys();
		for (const key of keys) {
			if (existingKeys.includes(key)) {
				throw new Error(`key already existing: ${key}`);
			}
		}

		await this.preloadQNumbers(...qNumbers);

		for (const {key, qNumber} of entries) {
			this._resourceKeys.set(key, qNumber);
		}
	}

	async preloadQNumbers(...qNumbers: string[]): Promise<void> {
		const neededQNumbers = qNumbers
			.filter(o => !this._entities.has(o));

		return this.forceloadQNumbers(...neededQNumbers);
	}

	// Ensures the qNumbers are load even when they were already loaded
	async forceloadQNumbers(...qNumbers: string[]): Promise<void> {
		const entities = await getEntitiesSimplified({
			ids: qNumbers,
			props: this._properties
		});

		for (const qNumber of Object.keys(entities)) {
			this._entities.set(qNumber, entities[qNumber]);
		}
	}

	availableResourceKeys(): ReadonlyArray<string> {
		return Array.from(this._resourceKeys.keys());
	}

	availableEntities(): ReadonlyArray<string> {
		return Array.from(this._entities.keys());
	}

	allEntities(): ReadonlyArray<EntitySimplified> {
		return Array.from(this._entities.values());
	}

	qNumber(keyOrQNumber: string): string {
		if (this._resourceKeys.has(keyOrQNumber)) {
			return this._resourceKeys.get(keyOrQNumber) as string;
		}

		if (!isEntityId(keyOrQNumber)) {
			throw new Error(`Argument is neither a resourceKey or an entity id: ${keyOrQNumber}`);
		}

		return keyOrQNumber;
	}

	entity(keyOrQNumber: string): EntitySimplified {
		const qNumber = this.qNumber(keyOrQNumber);

		const fallback: EntitySimplified = {
			id: qNumber,
			type: 'item'
		};

		return this._entities.get(qNumber) || fallback;
	}
}

// For CommonJS default export support
module.exports = WikidataEntityStore;
module.exports.default = WikidataEntityStore;
