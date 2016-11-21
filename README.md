# lab

Lab helps to compose JavaScript values.  
It's under active developement.  

## Example

```javascript
import compose from '@dmail/lab';
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

// compose have no side effect so dam is not modified and next assertion is verified
assert(dam.item.hasOwnProperty('price') === false);

// every composite got a construct method to create instance
const compositeInstance = composite.construct();
assert.deepEqual(compositeInstance, actualComposite);

// and each construct() instantiate nested composite so that the both assertion below are verified 
assert(compositeInstance.item !== actualComposite.item);
compositeInstance.item.name = 'hammer';
assert(actualComposite.item.name === 'sword');
```
