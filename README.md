# lab

Lab compose values into composite, providing composable and reusable behaviour.  
It's under active developement.  

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

## How to use composite ?

Composite are not meant to be consumed directly.  
The purpose is to call composite construct method to produce a consumable instance. 

```javascript
import {compose} from '@dmail/lab';

const value = {};
const composite = compose(value);
const instance = composite.construct();
Object.getPrototypeOf(instance) === value; // true
```

## What are the benefits ?

- Support property descriptors
- Will support infected composition
- Will support circular structure
- Will support composition of non native values (a custom object prototype or constructor)

Note : Putting a list of feature without explaining how to use them is not optimal but I'll do that later.
