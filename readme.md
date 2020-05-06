# wikidata-entity-store

[![NPM Version](https://img.shields.io/npm/v/wikidata-entity-store.svg)](https://www.npmjs.com/package/wikidata-entity-store)
[![node](https://img.shields.io/node/v/wikidata-entity-store.svg)](https://www.npmjs.com/package/wikidata-entity-store)
[![Build Status](https://travis-ci.com/EdJoPaTo/wikidata-entity-store.svg?branch=master)](https://travis-ci.com/EdJoPaTo/wikidata-entity-store)
[![Dependency Status](https://david-dm.org/EdJoPaTo/wikidata-entity-store/status.svg)](https://david-dm.org/EdJoPaTo/wikidata-entity-store)
[![Dev Dependency Status](https://david-dm.org/EdJoPaTo/wikidata-entity-store/dev-status.svg)](https://david-dm.org/EdJoPaTo/wikidata-entity-store?type=dev)

> Handles loading and caching of Wikidata Entities for you

This library is meant to be used in a NodeJS environment.
Internally [got](https://github.com/sindresorhus/got) is used to get the wikidata entities which is a library meant for NodeJS usage.


## Install

```
$ npm install wikidata-entity-store
```


## Usage

```js
const WikidataEntityStore = require('wikidata-entity-store');

const store = new WikidataEntityStore();

// cache Q2 and Q5 into the store
await store.addResourceKeyDict({human: 'Q5', earth: 'Q2'});

store.qNumber('human');
//=> 'Q5'

store.entity('human')
//=> {id: 'Q5', …}

// or use it for unnamed entities
await store.preloadQNumbers('Q42', 'Q1337')

store.entity('Q42')
//=> {id: 'Q42', …}
```


## API

### new WikidataEntityStore
```js
const store = new WikidataEntityStore([options])
```

#### options

Type: `Object`

##### properties

Type: `Array<Property>`

[Properties (props)](https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities) to be loaded for each Entity.
If not supplied it defaults to everything.
Its strongly advised to limit it to only what you need in order to save bandwidth and storage space.

##### entityStore

Type: `Map<string, EntitySimplified>`

Supply your own persistant cache for entities.
Per default entities are cached in memory.


### store.addResourceKeyDict

```js
await store.addResourceKeyDict(resourceKeys);
await store.addResourceKeyDict({human: 'Q5', earth: 'Q2'});
```

#### resourceKeys

Type: `Record<string, string>`

- Key: human readable key for easier development of your tool
- Value: Q-Number


### store.addResourceKeyArr

```js
await store.addResourceKeyArr(resourceKeys);
await store.addResourceKeyArr([
	{key: 'human', qNumber: 'Q5'},
	{key: 'earth', qNumber: 'Q2'}
]);
```

#### resourceKeys

Type: `ReadonlyArray<{key: string; qNumber: string}>`

- `key`: human readable key for easier development of your tool
- `qNumber`: Q-Number


### store.preloadQNumbers

Load Q-Numbers into cache. If a Q-Number is already cached it **is not** loaded again.

```js
await store.preloadQNumbers(...qNumbers)
await store.preloadQNumbers('Q42', 'Q1337')
```


### store.forceloadQNumbers

Load Q-Numbers into cache. If a Q-Number is already cached it **is** loaded again.

```js
await store.forceloadQNumbers(...qNumbers)
await store.forceloadQNumbers('Q42', 'Q1337')
```


### store.qNumber

Get the qNumber of the given key or Q-Number

```js
const qNumber = store.qNumber(keyOrQNumber);
const qNumber = store.qNumber('human');
const qNumber = store.qNumber('Q42');
```


### store.entity

Get the entity of the given key or Q-Number.

This is currently the simplified version of the entity (`EntitySimplified`) in order to have a smaller cache.
See [wikibase-sdk](https://github.com/maxlath/wikibase-sdk) for more information about it.

```js
const entity = store.entity(keyOrQNumber);
const entity = store.entity('human');
const entity = store.entity('Q42');
```


### store.availableResourceKeys

List of all available resource keys specified with `addResourceKeyDict` or `addResourceKeyArr`.

```js
const results = store.availableResourceKeys();
//=> ['human', 'earth']
```


### store.availableEntities

List all cached entity Q-Numbers.

```js
const results = store.availableEntities()
//=> ['Q5', 'Q2', 'Q42', 'Q1337']
```


### store.allEntities

Get all `EntitySimplified` currently cached.

```js
const results = store.allEntities()
//=> [{id: 'Q5', …}, …]
```

## License

MIT © [EdJoPaTo](https://github.com/EdJoPaTo)
