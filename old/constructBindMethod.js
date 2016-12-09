import {when, polymorph} from './polymorph.js';
import {FunctionElement} from './composite.js';
import {Transformation} from './transformation.js';
import {createObject, defineObjectProperty, delegateOtherProperty} from './default.js';

// exemple de comment faire en sorte que element.construct se comporte différent
// pour plus tard : pouvoir ne bind que les méthodes pour lesquelles une fonction custom retourne true
// pour cela il faudrais que la maladie puisse être configuré, c'est plutot simple à faire
// mais c'est pour plus tard
const bindMethod = when(
    function(elementModel, parentNode) {
        return parentNode && FunctionElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill(element, elementModel, parentNode) {
                element.value = elementModel.value.bind(parentNode.value);
                element.importChildren(elementModel);
            }
        }).create(this, parentNode, index);
    }
);
const defineObjectAndFunctionProperty = defineObjectProperty.when(
    // modifier le pattern pour y inclure les fonctions, pas besoin de changer l'implémentation
);
const bindMethodConstruct = polymorph(
    bindMethod,
    createObject,
    defineObjectAndFunctionProperty,
    delegateOtherProperty
);

export default bindMethodConstruct;
export {
	bindMethod,
	defineObjectAndFunctionProperty
};
