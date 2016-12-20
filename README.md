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

## Pros and cons

Pros
- Logic can be splitted into composable and reusable unit
Note : Putting a list of benefits without explaining how to use them is not optimal but I'll do that later.

Cons
- todo


