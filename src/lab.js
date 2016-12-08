/* eslint-disable no-use-before-define */

// https://github.com/Yomguithereal/baobab
import util from './util.js';
import Node from './node.js';

const Lab = util.extend({
    match(value) {
        const ElementMatchingValue = this.findElementByValueMatch(value);
        const element = ElementMatchingValue.create(value);
        return element;
    },

    findElementByValueMatch(value) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByValueMatch expect one arguments');
        }
        let ElementMatchingValue = this.Elements.find(function(Element) {
            return Element.match(value);
        });
        if (!ElementMatchingValue) {
            throw new Error('no registered element matches value ' + value);
        }
        return ElementMatchingValue;
    },
    Elements: [],

    compareSpecificity(elementA, elementB) {
        const elementAPrototype = Object.getPrototypeOf(elementA);
        const elementBPrototype = Object.getPrototypeOf(elementB);

        if (elementAPrototype === elementBPrototype) {
            return 0;
        }

        for (let Element of this.Elements) {
            // elementAPrototype comes first, it's more sepcific
            if (Element === elementAPrototype) {
                return 1;
            }
            // elementB comes first it's more specific
            if (Element === elementBPrototype) {
                return -1;
            }
        }
        throw new Error('cannot compare specificity of unknow element');
    },

    // createElement(tagName, value) {
    //     const ElementMatchingName = this.findElementByTagName(tagName);
    //     const element = ElementMatchingName.create(value);
    //     return element;
    // },

    findElementByTagName(tagName) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByName expect one arguments');
        }
        let ElementUsingTagName = this.Elements.find(function(Element) {
            return Element.tagName === tagName;
        });
        if (!ElementUsingTagName) {
            throw new Error('no registered element using tagName ' + tagName);
        }
        return ElementUsingTagName;
    },

    register(Element, ExtendedElement) {
        let ExtendedElementIndex;

        if (ExtendedElement) {
            ExtendedElementIndex = this.Elements.indexOf(ExtendedElement);
        } else {
            ExtendedElementIndex = -1;
        }

        if (ExtendedElementIndex === -1) {
            this.Elements.push(Element);
        } else {
            this.Elements.splice(ExtendedElementIndex, 0, Element);
        }
    }
});

const Element = Node.extend({
    extend(tagName, ...args) {
        const Element = util.extend.apply(this, args);
        Element.tagName = tagName;
        Lab.register(Element, this);
        return Element;
    }
});

// infection

/*
Une infection est transmise
dès lors elle peut te contaminer ->

transmittable
communicable
contamine
infect
manifest
cure
purify
propagate
propagation
*/
/*
const debugInfection = !true;
const debugInfectionTranmission = debugInfection && false;
const Infection = util.extend({
    constructor(symptoms) {
        if (symptoms) {
            this.symptoms = symptoms;
        }
        this.vulnerableOrganisms = [];
        this.compatibleOrganisms = [];
    },
    symptoms: {},

    installSymptoms(organism) {
        const symptoms = this.symptoms;
        const treatments = {};
        Object.keys(symptoms).forEach(function(key) {
            if (organism.hasOwnProperty(key)) {
                treatments[key] = organism[key];
            }
            organism[key] = symptoms[key];
        });
        return treatments;
    },

    cureSymtoms(organism, treatments) {
        const symptoms = this.symptoms;
        Object.keys(symptoms).forEach(function(key) {
            if (treatments.hasOwnProperty(key)) {
                organism[key] = treatments[key];
            } else {
                delete organism[key];
            }
        });
    },

    from(arg) {
        let infection;
        if (Infection.isPrototypeOf(arg)) {
            infection = arg;
        } else {
            infection = Infection.create(arg);
        }
        return infection;
    },

    canInfect(organismPrototype) {
        return this.vulnerableOrganisms.some(function(vulnerableOrganism) {
            return organismPrototype === vulnerableOrganism;
        });
    },

    canBeHostedBy(organismPrototype) {
        // an healthy carrier of the infection (it has the infection without its symptoms)
        return this.compatibleOrganisms.some(function(compatibleOrganism) {
            return organismPrototype === compatibleOrganism;
        });
    }
});
const Health = util.extend({
    constructor(organism) {
        this.organism = organism;
        this.maladies = [];
    },
    maladies: [],

    [Symbol.iterator]() {
        return this.maladies[Symbol.iterator]();
    },

    createPropagationIterable() {
        return this.maladies;
    },

    createOriginIterable() {
        return this.maladies.reverse().map(function(malady) {
            return malady.infection;
        });
    },

    createMalady(infection) {
        const malady = {
            infection: infection,
            treatments: null,
            hurting: false,
            hurt(organism) {
                if (this.hurting === false) {
                    this.treatments = this.infection.installSymptoms(organism);
                    this.hurting = true;
                }
            },
            heal(organism) {
                if (this.hurting === true) {
                    this.infection.cureSymtoms(organism, this.treatments);
                    this.hurting = false;
                }
            }
        };
        return malady;
    },

    infect(infection) {
        const malady = this.host(infection);
        malady.hurt(this.organism);
        return malady;
    },

    // put infection into the organism
    host(infection) {
        // we could check if a malady already use this infection and if so prevent duplicate

        // si l'infection n'a aucune espèce connues sur laquelle est peut se propager
        // il faudrait créer une infection qui peut alors se propager sur cette espèce
        if (infection.vulnerableOrganisms.length === 0) {
            infection.vulnerableOrganisms.push(Object.getPrototypeOf(this.organism));
        }

        const malady = this.createMalady(infection);
        this.maladies.push(malady);
        return malady;
    },

    // make the infection hurt the organism
    hurt(infection) {
        // get the malady corresponding to this element and make it invade the element
        // infect is a shortcut for adding a malady & infecting it right away
        const malady = this.maladies.find(function(malady) {
            return malady.infection === infection;
        });
        malady.hurt(this.organism);
        return malady;
    },

    cure(infection) {
        this.heal(infection);
        this.expel(infection);
    },

    // heal the infection, keeping it in the organism without hurting it
    heal(infection) {
        const maladies = this.maladies;
        const indexOfMaladyToHeal = maladies.findIndex(function(malady) {
            return malady.infection === infection;
        });

        if (indexOfMaladyToHeal === -1) {
            throw new Error('not infected');
        }
        let malady = maladies[indexOfMaladyToHeal];
        if (malady.hurting) {
            // healing an infection is bit complex because of supported malady interaction
            // healing from a malady must also remove thoose interaction
            // it's why we first heal the organism from all malady after the healed one
            // and make them rehurt the organism to remove possible malady interaction during hurting of the organism
            const maladiesLength = maladies.length;
            let indexOfNextMalady = maladiesLength - 1;

            // as said above, first heal all malady after the healed on
            const nextHurtingMaladies = [];
            while (indexOfNextMalady > indexOfMaladyToHeal) {
                const nextMalady = maladies[indexOfNextMalady];
                if (nextMalady.hurting) {
                    nextHurtingMaladies.push(nextMalady);
                    nextMalady.heal(this.organism);
                }
                indexOfNextMalady--;
            }
            // heal the desired malady
            malady.heal(this.organism);
            // make next malady re-hurt the organism (reverse loop using while -- to preserve order)
            let hurtingMaladiesCount = nextHurtingMaladies.length;
            while (hurtingMaladiesCount--) {
                const hurtingMalady = nextHurtingMaladies[hurtingMaladiesCount];
                hurtingMalady.hurt(this.organism);
            }
        }
    },

    // remove the infection from this organism
    expel(infection) {
        const maladyIndex = this.findIndex(function(malady) {
            return malady.infection === infection;
        });
        this.maladies.splice(maladyIndex, 1);
    },

    // heal & remove all infection from this organism
    purify() {
        const maladies = this.maladies;
        let malady = maladies.pop();
        while (malady) {
            malady.cure(this.organism);
            malady = maladies.pop();
        }
    },

    // transmit all infection from this organism to an other
    // depending on each infection behaviour otherOrganism will host/be hurted by this organism infections
    transmit(otherOrganism) {
        const otherOrganismPrototype = Object.getPrototypeOf(otherOrganism);

        for (let malady of this.createPropagationIterable()) {
            const infection = malady.infection;

            if (infection.canInfect(otherOrganismPrototype)) {
                let transmittedMalady = otherOrganism.health.host(infection);
                if (debugInfectionTranmission) {
                    console.log('transmit infection to', otherOrganism);
                }
                if (malady.hurting) {
                    console.log('make malady hurt right now');
                    transmittedMalady.hurt(otherOrganism);
                }
            } else if (infection.canBeHostedBy(otherOrganismPrototype)) {
                otherOrganism.health.host(infection);
                if (debugInfectionTranmission) {
                    console.log('transmit infection to', otherOrganism);
                }
            } else if (debugInfectionTranmission) {
                console.log('infection cannot be transmitted to', otherOrganism);
            }
        }
    }
});
Element.reconstruct(function() {
    this.health = Health.create(this);
});
Element.refine({
    infect(arg) {
        const infection = Infection.from(arg);
        this.health.infect(infection);
        return this;
    },

    host(infection) {
        this.health.host(infection);
        return this;
    },

    transmit(element) {
        this.health.transmit(element);
    },

    cure(infection) {
        this.health.cure(infection);
        return this;
    },

    purify() {
        this.health.purify();
        return this;
    }
});
Element.hooks.childAdded = function(child) {
    // parent propagate his health to child
    // problem: infection happens to late
    this.transmit(child);
};
Element.refine({
    procreate() {
        const progeny = this.createConstructor.apply(this, arguments);
        // sthing is missing : every appendChild must result in health propagation
        // so that readProperties would create property with an infected health
        this.transmit(progeny);
        return progeny;
    }
});

export {Infection};
*/

/*
const ElementInfection = Infection.extend({
    constructor(elementPrototype, symptoms) {
        this.elementPrototype = elementPrototype;
        this.symptoms = symptoms;
    },

    canInfect(elementPrototype) {
        return this.elementPrototype === elementPrototype;
    },

    canBeHostedBy(elementPrototype) {
        // no need for a primitive to host the infection (it has nothing beyong it to transmist)
        if (elementPrototype.primitiveMark === true) {
            return false;
        }
        // object property can always host infection
        if (ObjectPropertyElement.isPrototypeOf(elementPrototype)) {
            return true;
        }
        return false;
    }
});

pour l'instantiation voici ce qu'on aurait à faire niv infection

const InstantiationInfection = ElementInfection.extend();
-> il manque un moyen de dire comment l'infection est censé se déclenché
-> il faut préciser qu'ici c'est lorsqu'on fait construct()

// ce que ça m'évoque ce que je vois
// c'est qu'on peut modifier le comportement d'une méthode de manière puissante via les infections
// on peut y mettre un comportement par défaut qu'on override
// a-t-on besoin de heal?
// pourquoi cette override se fait de manière temporaire par contre ?
// a-t-on seulement besoin des symptomes il suffirait de récup l'infection qui correspond et d'apeller ses méthode a elle
// le fait d'installer la méthode sur l'objet est bien pratique quand même
// est ce qu'on ets daccord que là si construct est appelé sur un objet
// seulement objectInstantiation infection sera hurt() puisque sinon il ne recoit pas l'infection
// pas vraiment vrai : si l'élément host la maladie mais ne peut pas la contracter
// le code ci-dessous le force à contracter la maladie alors qu'on ne le veut pas
Element.refine({
    construct() {
        const constructMaladies = this.health.maladies.filter(function(malady) {
            return malady.infection.trigger === 'construct';
        });
        for (let malady of constructMaladies) {
            malady.hurt();
        }
        // now I can construct
        const result = this.compose();
        for (let malady of constructMaladies) {
            malady.heal();
        }
        return result;
    }
});

comment faire en sorte d'avoir sa propre logique d'instantiation
il n'y a pas d'infection par défaut puisque pas de santé par défaut pour ObjectElement
cela signifique qu'on doit garder quelque part la liste des infections liées à construct
lorsque construct est appelé on met les infection par défaut dans l'organisme (en début de chaine)
puis on déclenche toutes les infections de sorte que s'il existe déjà des infections sur lorganisme
elle se feront en dernier et seront donc prioritaire ?

le moyen d'avoir des infections par défaut est juste d'infecter le baseElement qui sers à composer
en l'infectant lui il va infecter ses descendants, reste qu'il faut pouvoir définir des infections fortes et faible
parce que mes infections à moi sont faible, bah c'est juste géré tout seul par le fait que les infections du user
arrive après dans le tableau

const ObjectInstantiationInfection = InstantiationInfection.create(ObjectElement, {
    fill(element) {
        this.value = Object.create(element.value);
        // then put all the properties from element into this
        // but the properties must be infected so that they are ignored if their value are primitive
        this.importChildren(element);
    }
});
baseElement.health.host(ObjectInstantiationInfection);

const PropertyInstantiationInfection = InstantiationInfection.create(ObjectPropertyElement, {
    mustBeImported() {
        // they have to be imported if one of their children is non primitive
        return this.children.some(function(child) {
            return child.primitiveMark !== true;
        });
    }
});
baseElement.health.host(PropertyInstantiationInfection);

// pour la composition
const CompositionInfection = Infection.extend();
// -> il faut préciser qu'ici c'est lorsqu'on fait compose()

const ObjectCompositionInfection = CompositionInfection.create(ObjectElement, {

});

ce qu'on va faire:

Transformation aura
make(elementModel, parentElement) -> retourne un élément depuis élémentModel, interdit de retourner le même
move(element, elementModel, parentElement) -> met l'élément dans parentElement si existe
fill(element, elementModel, parentElement) -> définit element.value et optionellement element.children
pack(element, elementModel, parentElement) -> fait certaines choses une fois tout ceci fait

l'infection consisteras juste à set la propriété transformation/reaction de l'élément
pour l'instantiation on auras donc un truc du genre
Reusable composable infectable structure RCIS R6
RCIP Polymorph
// on pourrait soit avoir cette approche d'avoir une infection capble de modifier plusieurs méthodes
// soit une approche méthode par méthode genre
composite.transform.infect(
    Object,
    function(parentNode, index) {
        return Transformation.extend({
            fill(element, elementModel) {
                element.value = Object.create(elementModel.value);
                element.importChildren(elementModel);
            }
        }).create(this, parentNode, index);
    },
    [ObjectProperty, function(element) {
        // si tous les enfants de la propriété sont non composite
        // comment savoir ça sachant que l'info est non constante puisque
        // un object peut se comporter comme un primitif (function)
        // pour savoir il faudrais savoir si la transformation du child
        // va créer un nouvel élément (et je ne parle pas de copie)
        // ou alors on doit explicitement dire ce qu'on hérite
        // tout ce qui n'est pas hérité est copié
        if (property.descriptor.hasOwnProperty('value')) {
            const valueNode = property.valueNode;
            return ObjectElement.isPrototypeOf(valueNode) === false;
        }
        // const node = property.getterNode || property.setterNode;
        return true;
    }],
    function(parentNode, index) {
        return CancelTransformation.create(this, parentNode, index);
    },
    ObjectProperty,
    function(parentNode, index) {
        return Transformation.extend({
            fill() {

            }
        }).create(this, parentNode, index);
    }
);
// on peut modifier le comportement de la méthode reactWith comme ceci
composite.reactWith.infect(

);

// l'avantage de l'écriture avec
composite.infect(
    Object,
    {
        transformation: {

        }
    }
);
// c'est qu'on peut modifier une propriété, pas que une méthode
// et qu'on évite de réécrire .create(this, parentNode, index)
// par contre on ne sait pas quand ni comment déclencher l'infection
// bah soit l'élément match il est infecté avec la dite propriété
// soit il ne match pas et est porteur sain de l'infection

// intervertir malady et infection: une infection s'applique à un organism et une maladie c'est plus générique
// il faut aussi un truc genre infectWeak qui ne peut infecter que l'objet lui même mais pas ses descendants

en gros ça donne:

un objet qui sers à gérer une méthode avec des cas nommé d'utilisation genre

match()
*/

export {
    Element,
    Lab
};
export default Lab;
