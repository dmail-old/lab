# Customize composite behaviour

This doc explains how to customize the behaviour of composition.
The first example below shows how to bind method to their owner.

## Force method binding

By default composition does not ensure method are bound, as the following will show.

```javascript
import {compose} from '@dmail/lab';

const user = {
	name: 'dam',
	method() {
		console.log('My name is', this.name);
	}
};
const composite = compose(user);
const compositeValue = composite.value;
const compositeValueMethod = compositeValue.method;

compositeValueMethod(); // 'My name is undefined' -> because compositeValueMethod not bound
```

But you can have make the code above behave differently by creating your own compose function.

```javascript
import {composer} from '@dmail/lab';

const compose = composer({
	bindMethod: true
});
const composite = compose(user);
const compositeValue = customComposite.value;
const compositeValueMethod = customCompositeValue.method;

compositeValueMethod(); // 'My name is dam' -> because compositeValueMethod is bound

// please note the following
compositeValueMethod.call({name: 'seb'}); // 'My name is dam'
// that's because Function.prototype.bind make this === user even when you use .call or .apply
// there is a way to have both this === user when doing compositeValueMethod()
// and this === {name: 'seb'} when doing compositeValueMethod.call({name: 'seb'});
// but this is experimental and not documented yet
```

## Composer options

Here is the list options to influence composition behaviour.

name: defaultValue                   | description
------------------------------------ | -------------------------------------------------------------------------
handleFunctionAsPrimitive: true      | Force function to behave as primitives even if they are objects
bindMethod: false                    | Force this to be the function owner
bindMethodImplementation: 'absolute' | 'absolute' freeze this, 'relative' allows .call & .apply to override
concatArray: true					 | Array entries are concatened instead of conflicting
concatArrayLike: true                | Array like are concatened instead of conflicting
syncArrayLikeLength: true 	         | Ensure length property of arraylike object represents their amount of indexed properties

All thoose options needs an example showing how they influence composition behaviour.
