// dynamicDispatch
// polymorphism

// un polymorh dispatché dynamiquement signifique que
// l'implémentation du polymorph que l'on install sur l'objet est fait dynamiquement
// j'ai donc besoin d'un objet Polymorph avant tout
// comme on peut le voir ci dessus l'implémentation dépend de comment la fonction est appelé

/*
http://raganwald.com/2014/06/23/multiple-dispatch.html
https://en.wikipedia.org/wiki/Multiple_dispatch
Dynamic dispatch : decide which polymorphed function implementation to call dynamically
Single dispatch : the implementation to call depends on the object type the function is bound to
Double/Multiple dispatch: the implementation to call depends on object type & function arguments

Applied to JavaScript it means we'll have a polymorphed function that will decide what will be called
depending on this and arguments
to make it easyly configurable every implementation will be named to be able to change his behaviour later
*/

// pattern
// patternMatching
// select
// selectPattern
// characteristic
// multimethod, multifunction multidispatcj

import util from './util.js';

const Matcher = util.extend({
    constructor(match) {
        this.match = match;
    },

    clone() {
        const clone = this.createConstructor(this.match);
        return clone;
    }
});
const Variant = util.extend({
    constructor(matcher, implementation) {
        this.matcher = matcher;
        this.implementation = implementation;
    },

    match(...args) {
        return this.matcher.match(...args);
    },

    clone() {
        const clone = this.createConstructor(this.matcher.clone(), this.implementation);
        return clone;
    }
});
const Polymorph = util.extend({
    constructor() {
        this.variants = [];
    },

    clone() {
        const clone = this.createConstructor();
        this.variants.forEach(function(variant) {
            clone.variants.push(variant.clone());
        });
        return clone;
    },

    morph(match, implementation) {
        const variant = Variant.create(Matcher.create(match), implementation);
        this.variants.push(variant);
    },

    vary(...args) {
        return this.morph(...args);
    },

    match(...args) {
        return this.variants.find(function(variant) {
            return variant.match(...args);
        });
    },

    createDynamicMultipleDispatcher() {
        const polymorph = this;
        const dynamicMultipleDispatcher = function() {
            const macthingVariant = polymorph.match(this, arguments);
            return macthingVariant.implementation.apply(this, arguments);
        };
        // It would be convenient to exposed polymorph to be able to add/change/remove variant at runtime

        return dynamicMultipleDispatcher;
    }
});

const transformPolymorph = Polymorph.create();
const instantiationTransformPolymorph = transformPolymorph.clone();

var ObjectElement;
var Transformation;
var ObjectPropertyElement;
var CancelTransformation;

instantiationTransformPolymorph.vary(
    'delegateObject',
    function() {
        return ObjectElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill(element, elementModel) {
                element.value = Object.create(elementModel.value);
                element.importChildren(elementModel);
            }
        }).create(this, parentNode, index);
    }
);
instantiationTransformPolymorph.vary(
    'defineCompositeProperty',
    function() {
        if (ObjectPropertyElement.isPrototypeOf(this) === false) {
            return false;
        }
        if (this.descriptor.hasOwnProperty('value')) {
            const valueNode = this.valueNode;
            if (ObjectElement.isPrototypeOf(valueNode)) {
                return true;
            }
        }
        return false;
    },
    function(parentNode, index) {
        return Transformation.extend({
            fill() {

            }
        }).create(this, parentNode, index);
    }
);
instantiationTransformPolymorph.vary(
    'delegatePrimitiveProperty',
    function() {
        return ObjectPropertyElement.isPrototypeOf(this);
    },
    function(parentNode, index) {
        return CancelTransformation.create(this, parentNode, index);
    }
);

/*
dans le cas des éléménts transform est un polymorph ayant un comportement existant
ce que je souhaite faire c'est modifier ce comportement durant l'instantiation
pour se faire je pense qu'il y a plusieurs concept en jeux
le premier est de pouvoir modifier le comportement sans altérer celui qu'on a déjà
soit on récup le comportement actuel on le copie et on le modifie (il fau une méthode clone sur Polymorph)
soit on crée un polymorph de toute pièce

ensuite le deuxième concept, celui de l'infection est différent
lui consist à dire que cet élément et tout ses enfants récupère le polymorph peu importe ce qu'il y a dedans

mais bon je pense que chaque polymorph a son comportement propre je ne vois pas de raison
que transformByConstructPolymorph (autrement dit le polymoprh utilisé lorsqu'on apelle element.construct())
hérite ou veuille réutiliser transformByComposePolymorph (le polymorph utilisé lorsqu'on apelle element.compose())

il manque donc tout de même, à mon avis, un dernier petit truc pour que l'API finale puisse ressemble à ça:

il y a plusieurs couac ici:
- il manque un moyen de modifier/supprimer/ajouter des variants au runtime
- il manque encore une couche d'abstraction pour écrire kk chose comme
element.infect('transform').whenCalledBy('construct').vary(
    'BindMethod'
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
- et à ce moment comment empêcher 'DelegatePrimitiveProperty' de déléguer la propriété maintenant qu'on souhaite bind les méthodes
je pense qu'il faut modifier le patternMatcher de defineComposite pour y inclure les fonctions
- et comment préciser que 'Method' est plus prioritaire que 'Object'
on a "harcodé" que ObjectProperty est moins prio que DelegatedObjectProperty parcqu'il se trouve après mais on a le même souci de piorisation

-> pistes de réponses

-> une sorte de sélecteur CSS permettant d'avoir une priorisation automatique des patterns et donc de l'implémentation prioritaire
cela est envisageable tant qu'on garde des patterns simples mais ça peut vite se complexifier (suffit de voir CSS)

ça donnerait d'après ce qu'on a ci-dessus
- ['protoOf', ObjectElement] (crée un selecteur de prio 0)
- ['protoOf', ObjectPropertyElement, '+', 'property', 'valueNode', 'protoOf', ObjectElement] (créé un sélecteur de prio plus élevéé)
- ['protoOf', ObjectPropertyElement] (crée un selecteur de prio 0)
au vu du truc vaut mieux préciser une prio pour chaque pattern XD

-> donner manuellemnt une prio lorsque le pattern est un peu complexe
-> donner inderectement de la valeur au pattern genre

CalledOnInstanceOfMatcher = Pattern.extend({
    score: 0,
    constructor(prototype) {
        Pattern.constructor.call(this, function() {
            return Object.getPrototypeOf(this) === prototype;
        });
    }
});
CalledOnInstanceOfMatcher.create(ObjectElement)
et ensuite on ajoute une méthod AND sur pattern qui augmente son score d'autant que pattern.score + 1
et OR qui met le score au plus elevé des deux ou alors ajoutents les deux
const propertyLinkToCompositeMatcher = Matcher.create(function() {
     return Object.getPrototypeOf(this.valueNode) === ObjectElement;
});
CalledOnInstanceOfMatcher.create(ObjectPropertyElement).and(propertyLinkToCompositeMatcher);

on se retrouve avec pas mal d'objet à manipuler mais c'est le plus propres que je voye pour le moment
see also : http://clojure.github.io/clojure/clojure.core-api.html#clojure.core/prefer-method
*/
