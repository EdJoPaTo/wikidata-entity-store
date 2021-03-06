import {EntitySimplified} from 'wikidata-sdk-got/dist/source/wikibase-sdk-types';
import {KeyValueInMemory} from '@edjopato/datastore';
import test from 'ava';

import WikidataEntityStore, {EntityStore} from '../source';

function createEntityStore(): EntityStore {
	const human: EntitySimplified = {
		type: 'item',
		id: 'Q5'
	};

	const earth: EntitySimplified = {
		type: 'item',
		id: 'Q2'
	};

	const store = new KeyValueInMemory<EntitySimplified>();
	store.set('Q5', human);
	store.set('Q2', earth);
	return store;
}

test('can addResourceKeyDict', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await t.notThrowsAsync(async () =>
		store.addResourceKeyDict({human: 'Q5', earth: 'Q2'})
	);

	t.deepEqual(store.availableResourceKeys(), ['human', 'earth']);
});

test('can addResourceKeyArr', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await t.notThrowsAsync(async () =>
		store.addResourceKeyArr([
			{key: 'human', qNumber: 'Q5'},
			{key: 'earth', qNumber: 'Q2'}
		])
	);

	t.deepEqual(store.availableResourceKeys(), ['human', 'earth']);
});

test('can addResourceKeyYaml', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	const yaml = `human: Q5
earth: Q2`;

	await t.notThrowsAsync(async () =>
		store.addResourceKeyYaml(yaml)
	);

	t.deepEqual(store.availableResourceKeys(), ['human', 'earth']);
});

test('can not add same resourceKey twice', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await store.addResourceKeyDict({human: 'Q5'});

	await t.throwsAsync(
		async () => store.addResourceKeyDict({human: 'Q2'}),
		{message: /key.+exist/}
	);
});

test('can add the same resourceKey twice', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await store.addResourceKeyDict({human: 'Q5'});

	await t.notThrowsAsync(
		async () => store.addResourceKeyDict({human: 'Q5'})
	);
});

test('can preloadQNumbers', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await t.notThrowsAsync(async () =>
		store.preloadQNumbers('Q5')
	);

	t.deepEqual(store.availableEntities(), ['Q5', 'Q2']);
});

test('qNumber of resourceKey', async t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	await store.addResourceKeyDict({human: 'Q5'});
	t.is(store.qNumber('human'), 'Q5');
});

test('qNumber of qNumber', t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	t.is(store.qNumber('Q5'), 'Q5');
});

test('qNumber of not a qNumber does not work', t => {
	const store = new WikidataEntityStore();
	t.throws(() => {
		store.qNumber('bob');
	}, {message: /argument.+bob/i});
});

test('entity of cached', t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	t.deepEqual(store.entity('Q5'), {
		type: 'item',
		id: 'Q5'
	});
});

test('entity of not cached', t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	t.deepEqual(store.entity('Q666'), {
		type: 'item',
		id: 'Q666'
	});
});

test('allEntities', t => {
	const store = new WikidataEntityStore({
		entityStore: createEntityStore()
	});

	t.deepEqual(store.allEntities(), [
		{
			type: 'item',
			id: 'Q5'
		},
		{
			type: 'item',
			id: 'Q2'
		}
	]);
});
