# lab

Provide object composition with enforced immutability to manipulate prototype used as class.

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

## Why ?

The main feature is to provide a readable and robust solution to create your object prototypes.  
I'll show you how composition + immutability can enchance how you implement an expected behaviour.  
First I'll describe the expected behaviour, then implement it with VanillaJS, then using lab.js.  
I won't comment much on the differences between the two implementations hoping code will speak for itself. 

### Expected behaviour

You must provide a User object behaving as follow:

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

## Install

There is no public version for now and the code is written in ES6 and has no ES5 build.  
It means you have to use lab.js inside an ES6 environment with module loader & transpilation.  
I recommend this command to get the latest "stable" version of lab.js.

`npm i --ignore-scripts --production https://github.com/dmail/lab.git#5aa6f70d5a72431632409b19978a58d790eb91e8`.

