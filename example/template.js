/* eslint-disable no-use-before-define */

import {compose} from '../index.js';

// const Constant = compose({
//     constructor(value) {
//         this.value = value;
//     },
//     value: '',
//     read() {
//         return this.value;
//     }
// });
// const Variable = compose({
//     constructor(value) {
//         this.value = value;
//     },
//     read(data) {
//         return this.transform(data[this.value]);
//     },
//     transform(value) {
//         return value;
//     }
// });
// const HelloTemplate = compose({
//     expressions: [
//         Constant.construct('Hello '),
//         Variable.compose({
//             transform(value) {
//                 return value.toUpperCase();
//             }
//         }).construct('name'),
//         Constant.construct('!')
//     ],
//     constructor(data) {
//         this.data = data;
//     },
//     data: null,
//     toString() {
//         return this.expressions.reduce(function(previous, expression) {
//             return previous + expression.read(this.data);
//         }.bind(this), '');
//     }
// });

// const damTemplate = HelloTemplate.construct({name: 'dam'});
//const sebTemplate = HelloTemplate.construct({name: 'seb'});
// console.log(damTemplate.toString()); // 'Hello DAM!'
// console.log(sebTemplate.toString()); // 'Hello SEB!'
