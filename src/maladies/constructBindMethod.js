import {when, polymorph} from './polymorph.js';
import {FunctionElement} from './composite.js';
import {Transformation} from './transformation.js';
import {createObject, defineObjectProperty, delegateOtherProperty} from './default.js';

// exemple de comment faire en sorte que element.construct se comporte différent
// du comportement par défaut
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
