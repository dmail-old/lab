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

To provide a more readable and robust solution to a common problem when you're creating object prototypes.  
Imagine you're asked to create a User model with the following requirements:

- First requirement: you must ensure every user have his own list of items
- Second requirement: you must provide a way to control which items are given to a user upon instantiation

Your solution must pass the following pseudo test 

```javascript
import assert from '@node/assert';
import User from './user.js';

const sword = {name: 'sword'};
const UserWithSwordFactory = User.asFactoryGiving(sword);
const firstUser = User.construct();
const secondUser = UserWithSwordFactory.construct();

assert(firstUser.hasOwnProperty('items'), 'user must have their own list of items');
const secondUserSword = secondUser.items[0];
assert.deepEqual(secondUserSword, sword, 'user sword item must be deepEqual to sword item');
assert(secondUserSword !== sword, 'a user with sword must have his own sword');
```

### Using Vanilla JavaScript

```javascript
const User = {
    construct() {
        const user = Object.create(this);
        user.constructor();
        return user;
    },
    constructor() {
        // ensure each user got his own list of items
        this.items = [];
    },
    
    // provide a way to create a factory of user already having one/many item
    asFactoryGiving(...items) {
        const CustomUserFactory = Object.create(User);
        CustomUserFactory.constructor = function() {
            User.constructor.apply(this, arguments);
            for (let item of items) {
                const itemPrototype = Object.getPrototypeOf(item);
                const itemProperties = Object.getOwnPropertyDescriptors(item);
                const userItem = Object.create(itemPrototype, itemProperties);
                this.items.push(userItem);
            }
        };
        return CustomUserFactory;
    }
};

export default User;
```

Vanilla JavaScript solution is ok but very specific to this use case. It means you cannot reuse it to create arbitrary factory of arbitrary object structure.  

### Using composition + immutability

```javascript
import {compose} from '@dmail/lab';

const User = compose({
    items: []
});
User.asFactoryGiving = function(...items) {
    return this.compose({
        items: items
    });
};

export default User;
```

There is not much to say about the code above :)

## Install

There is no public version for now and the code is written in ES6 and has no ES5 build.  
I recommend this commit as the latest "stable" version of lab.js `npm i --ignore-scripts --production https://github.com/dmail/lab.git#1a10f6d5cfa3b51aa5946188d546659c4cce0120`.

