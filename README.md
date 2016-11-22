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

// composed objects are frozen and their properties are not altered by compose()
assert(Object.isFrozen(dam));
assert(Object.isFrozen(seb));
assert(Object.isFrozen(actualComposite));
assert(dam.item.hasOwnProperty('price') === false);

// every composite got a construct method to create instance
const compositeInstance = composite.construct();
assert.deepEqual(compositeInstance, actualComposite);

// instance are not frozen and got their own properties
compositeInstance.item.name = 'hammer';
assert(actualComposite.item.name === 'sword');
```
