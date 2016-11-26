import {scan} from './lib/lab.js';
import './lib/primitive.js';
import {ObjectElement} from './lib/composite.js';

const baseElement = ObjectElement.create();
const compose = baseElement.compose.bind(baseElement);

export {compose};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('object composition', function() {
            const dam = {name: 'dam', item: {name: 'sword'}};
            const seb = {name: 'seb', item: {price: 10}, age: 10};
            const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

            const damElement = scan(dam);
            const sebElement = scan(seb);
            assert(damElement.value === dam);
            assert(sebElement.value === seb);

            const compositeElement = damElement.compose(sebElement);
            assert.deepEqual(compositeElement.value, expectedComposite);
            assert.deepEqual(dam, {name: 'dam', item: {name: 'sword'}});
        });

        this.add('array concatenation', function() {
            const damFriends = ['seb', 'clément'];
            const sandraFriends = ['sumaya'];
            const expectedComposite = ['seb', 'clément', 'sumaya'];
            // set some sparse properties on array to ensure they are composed as well
            damFriends.foo = 'foo';
            sandraFriends.bar = 'bar';
            expectedComposite.foo = damFriends.foo;
            expectedComposite.bar = sandraFriends.bar;

            const damFriendsElement = scan(damFriends);
            const sandraFriendsElement = scan(sandraFriends);
            const compositeFriendsElement = damFriendsElement.compose(sandraFriendsElement);

            assert.deepEqual(compositeFriendsElement.value, expectedComposite);
        });

        this.add('compose array', function() {
            const array = [0, 1];
            const arrayElement = scan(array);
            const composedArray = arrayElement.compose();
            assert(arrayElement.value === array);
            assert(composedArray.value === array);
            assert(composedArray === arrayElement);
        });

        // this.add('function ?', function() {
        //     // function have a circular structre because of prototype + constructor
        //     // for now we may ignore this until circular stucture are supported
        //     const functionElement = Lab.scan(function yep() {});
        //     console.log(functionElement);
        // });

        // this.add('element construct', function() {
        //     const dam = {name: 'dam', item: {name: 'sword'}};
        //     const damElement = Lab.scan(dam);
        //     const damInstanceA = damElement.construct();
        //     const damInstanceB = damElement.construct();

        //     // compile does the job but we want
        //     // element.construct that will call any .constructor method
        //     // and maybe do more

        //     assert.deepEqual(damInstanceA.item, dam.item);
        //     assert.deepEqual(damInstanceB.item, dam.item);
        //     assert(damInstanceA.item !== dam.item);
        //     assert(damInstanceB.item !== dam.item);
        // });
    }
};
