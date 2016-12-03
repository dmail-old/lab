# Customize composite behaviour

You can make composite behave as you want using infection.  
For instance you can force it to bind method to instance as shown below.

## bind method infection

The code below will demonstrates you can force `composite.construct()` to bind method to instance.

```javascript
import {compose, maladies} from '@dmail/lab';

// start from a user object with a method
const user = {
	name: 'dam',
	method() {
		console.log('My name is', this.name);
	}
};
// first we'll see that instance method are not bound
const composite = compose(user);
const instance = composite.construct();
const instanceMethod = instance.method;

instanceMethod(); // 'My name is undefined' -> instanceMethod not bound to instance

// now force composite to bind mehotd when calling composite.construct()
const constructBindMethodMalady = maladies.constructBindMethod;
composite.infect(constructBindMethodMalady);
const instanceFromInfectedConstruct = composite.construct();
const boundInstanceMethod = instanceFromInfectedConstruct.method;

boundInstanceMethod(); // 'My name is dam' -> boundInstanceMethod bound to instanceFromInfectedConstruct
```

## The recommended way to infect your composite

```javascript
import {compose, maladies} from '@dmail/lab';

const user = {
	name: 'dam',
	method() {
		console.log('My name is', this.name);
	}
};

const customCompose = compose().infect(maladies.constructBindMethod).compose;

// compose will not bind instance methods
compose(user).construct().method.call(null); // 'My name is null'

// customCompose will bind instance methods
customCompose(user).construct().method.call(null); // 'My name is dam'
```

## Existing maladies

You can use the following exported maladies.  
If what you want to do cannot be achieved with these you can [Create your own malady].

name                    | short description of the behaviour                | documentation link
----------------------- | ------------------------------------------------- | --------------------
default                 | Object.create in construct, immutable compose     | 
constructBindMethod     | default + bindMethod in construct                 | 

## Create your own malady

```javascript
import {compose} from '@dmail/lab';

const myMalady = {
	construct() {
		return 'Hello world';
	}
};

const composite = compose();
composite.infect(myMalady);
composite.construct(); // 'Hello world'
```

But you won't go very far with an 'Hello world' construct() method.  
To go further on the subject get your inspiration from existing custom malady source code, such as [constructBindMethod]().  
If you want to understand deeply how malady are transmitted to composite see How infection works section below.

## How infection works

A malady holds a list of properties that can be seen as symptoms of the malady. When the composite gets infected by a malady it contratcs it's symptoms. Concretely it means that malady properties are installed on the composite.

Basically `Object.assign(composite, malady)` would lead to the same result at this stage.

Infection do a bit more because :
- once a composite gets infected by a malady, this malady is transmitted to its descendants
- you can cure an infected composite from a specific malady to revert symptoms

*I'm aware infection transmission and ability to cure has no special meaning to the reader at this stage. It will be improved later*

## A final note

Something to be aware of is that **composite infection is used internally**.  
It means that composite behaviour is dicted by a default malady.

```javascript
import {compose, maladies} from '@dmail/lab';

const composite = compose();
const defaultMalady = maladies.default;
const defaultMaladyMethods = defaultMalady;

composite.construct === defaultMaladyMethods.construct; // true
composite.compose === defaultMaladyMethods.compose; // true
// as the above demonstrates composite behaviour is dicted by defaultMalady
// at your own risk, you can even cure defaultMalady, completely removing behaviour from the composite
composite.cure(defaultMalady);
'construct' in composite; // false
'compose' in composite; // false
```
