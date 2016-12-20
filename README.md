# lab

Provide object composition with enforced immutability to manipulate prototype used as class.
This repository is under dev, nothing is stable or meant to be used by anyone for now.

## Example

```javascript
import {compose} from '@dmail/lab';
import assert from '@node/assert';

const dam = {
    name: 'dam',
    item: {
        name: 'sword'
    }
};
const seb = {
    name: 'seb',
    item: {
        price: 10
    },
    age: 10
};
// you can compose dam & seb to obtain something like expectedComposite below
const expectedComposite = {
    name: 'seb',
    item: {
        name: 'sword',
        price: 10
    },
    age: 10
};
const composite = compose(dam, seb);
const actualComposite = composite.value;

assert.deepEqual(actualComposite, expectedComposite);
```

## Instantiation

By calling a composite construct method you'll get a consumable instance.

```javascript
import {compose} from '@dmail/lab';

const value = {};
const composite = compose(value);
const instance = composite.construct();
Object.getPrototypeOf(instance) === composite.value; // true
```

## Why ?

Mainly to solve the class/instance mutability problem.
To illustrate imagine you're asked to create a User model with two requirements.
- First requirement: every user have its own list of items
- Second requirement: you must be able to control which items are given to a user once for all

### VanillaJS solution

```javascript
function construct(proto) {
    const instance = Object.create(proto)
    instance.constructor();
    return instance;
}
// the first naive way of writing it is as follow
const sword = {name: 'sword'};
const User = {
    constructor() {},
    items: []
};
// however it comes with a problem: items are share by user instance
const firstUser = construct(User);
user.items.push(sword);
const secondUser = construct(User);
secondUser.items[0]; // sword
// it's because secondUser.items === firstUser.items
// to fix this you must change User.constructor to give user instance their own items array
User.constructor = function() {
    this.items = [];
};
// now the following is verified construct(User).items !== construct(User).items
// in other words our first requirement is met : every user have its own list of items

// the second requirement is way harder to achieve with vanillaJS
// To rephrase it: you may decide every user is given a "sword" item on instantiation
// you can get something close to that with the following code
User.constructor = function() {
    this.items = User.items.slice();
};
User.items.push(sword);
construct(User).items[0]; // sword
// but here is the problem: construct(User).items[0] === construct(User).items[0];
// in other words: every user share the same sword

// the right User.constructor implementation regarding the requirements would be
User.constructor = function() {
    this.items = User.items.map(function(item) {
        const itemPrototype = Object.getPrototypeOf(item);
        const itemProperties = Object.getOwnPropertyDescriptors(item);
        return Object.create(itemPrototype, itemProperties);
    });
};
```

### Lab.js solution

lab.js help you to implement the above problem with ease.

```javascript
import {compose} from '@dmail/lab';
import assert from '@node/assert';

const User = compose({
    items: [],
    constructor() {
        // nothing to do there, you could omit the constructor method
    }
});
// add a sword to that User prototype
const sword = {name: 'sword'};
User.items.push(sword);

// let's ensure every user get a sword
const firstUserSword = User.construct().items[0];
const secondUserSword = User.construct().items[0];
assert.deepEqual(firstUserSword, sword);
assert.deepEqual(secondUserSword, sword);
// and his own sword of course
assert(firstUserSword !== secondUserSword);
```
