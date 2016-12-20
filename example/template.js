/* eslint-disable no-use-before-define */

import {compose} from '../index.js';

const Model = compose({
    constructor(value) {
        this.value = value;
    },
    value: '',
    get() {
        return this.value;
    },
    read(...args) {
        return this.transform(this.get(...args));
    },
    transform(value) {
        return value;
    }
});
const Constant = Model.compose();
const Variable = Model.compose({
    get(data) {
        return data[this.value];
    }
});
const HelloTemplate = compose({
    expressions: [
        Constant.construct('Hello '),
        Variable.compose({
            transform(value) {
                return value.toUpperCase();
            }
        }).construct('name'),
        Constant.construct('!')
    ],
    constructor(data) {
        this.data = data;
    },
    data: null,
    toString() {
        return this.expressions.reduce(function(previous, expression) {
            return previous + expression.read(this.data);
        }.bind(this), '');
    }
});

const damTemplate = HelloTemplate.construct({name: 'dam'});
console.log('dam:', damTemplate.toString()); // 'Hello DAM!'
const sebTemplate = HelloTemplate.construct({name: 'seb'});
console.log('seb:', sebTemplate.toString()); // 'Hello SEB!'
