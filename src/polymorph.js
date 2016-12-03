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
        if (match) {
            this.match = match;
        }
    },

    match() {
        return false;
    },

    clone() {
        const clone = this.createConstructor(this.match);
        return clone;
    },

    from(...args) {
        if (Matcher.isPrototypeOf(arguments[0])) {
            return arguments[0];
        }
        return Matcher.create(...args);
    }
});
const Variant = util.extend({
    constructor(matcher, implementation) {
        // we should check matcher & implementation are of the right type
        this.matcher = Matcher.from(matcher);
        this.implementation = implementation;
    },
    matcher: Matcher.create(),
    implementation() {},

    match(...args) {
        return this.matcher.match(...args);
    },

    when(matcher, implementation) {
        if (matcher === undefined || matcher === null) {
            matcher = this.matcher;
        }
        if (implementation === undefined || implementation === null) {
            implementation = this.implementation;
        }
        const copy = this.createConstructor(matcher, implementation);
        return copy;
    }
});
const Polymorph = util.extend({
    constructor() {
        // c'est vraiment un DynamicSwitch en fait
        // c'est comme écrire un switch mais là on contrôle l'éxécution le nombre de case etc

        /*
        je pense qu'il faudras supprimer le fait qu'on utiilser un tableau
        parce qu'on va avoir besoin qu'une méthode puisse hériter du comportement d'une autre
        parce que sinon lorsque j'ai ma méthode par défaut
        qui compose mais n'a pas de variante pour MapEntry
        et qu'ensuite j'ajoute une variante pour mapEntry
        si j'ai une maladie qui modifie un peu le comportement de compose par défaut
        elle n'hérite pas de l'ajout de la variante

        bon il reste le problème de l'ordre dans lequel les variantes marchents parce que
        bindMethodConstruct redéfinissait l'ordre parce que sinon c'est la merde
        hors si on hérite bah on est encore plus dans la merde niveau ordre des variantes

        le truc c'est de réfléchir à quand les gens (moi y compris)
        voudront rajouter des cas au polymorpah actuel
        il faudras que ces cas soit pris en compte par les polymorph custom

        const construct = polymorph();
        const bindMethodConstruct = construct.derive();
        construct.when(isANumber, doStuffWithNumber);
        // et hop bindMethodConstruct récupèrera isANumber
        // par contre que fait-on si le dérivé sdu polymorph ne souhaite pas récupérer le comportement du polymorph parent
        // en gros c'est un peu tôt pour décider
        */

        this.variants = [];
        this.when = this.when.bind(this);
    },

    when(match, implementation) {
        // note :
        // si implementation existe on modifie son match et on replace variante existant par la nouvelle (ou on mutate la variante existante ?)
        // si match existe on modifie implementation et on replace variante existante par la nouvelle (ou on mutate la variante existante?)
        // si aucun n'existe on l'ajoute ça c'est ce qui est fait ci-dessous
        const variant = Variant.create(Matcher.create(match), implementation);
        this.variants.push(variant);
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
        // It would be convenient to expose polymorph or some method to be able to add/change/remove variant at runtime
        dynamicMultipleDispatcher.when = polymorph.when;

        return dynamicMultipleDispatcher;
    }
});
const polymorph = function(...args) {
    const poly = Polymorph.create();
    poly.variants.push(...args);
    return poly.createDynamicMultipleDispatcher();
};
const when = Variant.create.bind(Variant);

export default polymorph;
export {polymorph, when};
