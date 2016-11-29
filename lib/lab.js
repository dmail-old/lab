/* eslint-disable no-use-before-define */

// https://github.com/Yomguithereal/baobab
import util from './util.js';
import Node from './node.js';

const Lab = util.extend({
    scan(value) {
        const element = this.match(value);
        element.fill(value);
        return element;
    },

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

const scan = Lab.scan.bind(Lab);

const Element = Node.extend({
    match() {
        return false;
    },

    extend(tagName, ...args) {
        const Element = util.extend.apply(this, args);
        Element.tagName = tagName;
        Lab.register(Element, this);
        return Element;
    }
});

Element.refine({
    reactWith(secondElement, parentNode) {
        const firstElement = this.asElement();
        let reaction = firstElement.reaction;

        if (secondElement.primitiveMark) {
            return secondElement.transform(parentNode);
        }

        return reaction.create(firstElement, secondElement, parentNode);
    },

    transform(parentNode, index) {
        const transformation = this.transformation.create(this, parentNode, index);
        return transformation;
    },

    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    },

    effect() {}
});

Element.refine({
    compose() {
        let composite;
        if (arguments.length === 0) {
            let transformation = this.transform();
            let product = transformation.produce();
            transformation.transform();
            transformation.refine();
            composite = product;
        } else {
            let i = 0;
            let j = arguments.length;
            composite = this;
            for (;i < j; i++) {
                const arg = arguments[i];
                let element;
                if (Element.isPrototypeOf(arg)) {
                    element = arg;
                } else {
                    element = scan(arg);
                }
                let reaction = composite.reactWith(element);
                let product = reaction.produce();
                reaction.transform();
                reaction.refine();
                composite = product;
            }
        }

        return composite;
    }
});

// infection
const debugInfection = !true;
const Infection = util.extend({
    carriageable: false,
    constructor(symptoms) {
        if (symptoms) {
            this.symptoms = symptoms;
        }
        this.vulnerableElements = [];
    },
    symptoms: {},

    transmittableTo(element) {
        const elementPrototype = Object.getPrototypeOf(element);

        return this.vulnerableElements.some(function(vulnerableElement) {
            return elementPrototype === vulnerableElement;
        });
    },

    infect(element) {
        const symptoms = this.symptoms;
        const treatments = {};
        Object.keys(symptoms).forEach(function(key) {
            if (element.hasOwnProperty(key)) {
                treatments[key] = element[key];
            }
            element[key] = symptoms[key];
        });
        return treatments;
    },

    cure(element, treatments) {
        const symptoms = this.symptoms;
        Object.keys(symptoms).forEach(function(key) {
            if (treatments.hasOwnProperty(key)) {
                element[key] = treatments[key];
            } else {
                delete element[key];
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
    }
});
const Health = util.extend({
    constructor() {
        this.maladies = [];
    },
    maladies: [],

    createPropagationIterable() {
        return this.maladies.map(function(malady) {
            return malady.infection;
        });
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
            infected: false,
            infect(element) {
                if (this.infected === false) {
                    this.treatments = this.infection.infect(element);
                    this.infected = true;
                }
            },
            cure(element) {
                if (this.infected) {
                    this.infection.cure(element, this.treatments);
                    this.infected = false;
                }
            }
        };
        return malady;
    },

    infect(element, infection) {
        // we could check if a diagnostic already use this infection, if so prevent duplicate ?

        // si l'infection n'a aucune espèce connues sur laquelle est peut se propager
        // il faudrait créer une infection qui peut alors se propager sur cette espèce
        if (infection.vulnerableElements.length === 0) {
            infection.vulnerableElements.push(Object.getPrototypeOf(element));
        }

        const malady = this.createMalady(infection);
        this.maladies.push(malady);
        malady.infect(element);
    },

    contamine(element, infection) {
        const malady = this.createMalady(infection);
        this.maladies.push(malady);
    },

    propagate(infectedElement, healthyElement) {
        for (let infection of this.createPropagationIterable()) {
            if (infection.transmittableTo(healthyElement)) {
                healthyElement.infect(infection);
                if (debugInfection) {
                    console.log('propagate infection from', infectedElement.value, 'to', healthyElement.value);
                }
            } else if (infection.carriageable) {
                // si l'infection peut être transmise par un porteur sain
                // fait en sorte que healthyElement soit porteur sain de l'infection
                // je suppose qu'il suffit de lui donner infectionHistory sans appeler infect()
                // le problème c'est que infectionHistory pars du principe que l'élément est forcément infecté
                // donc faudrais modifier ça pour pouvoir être porteur sain
                // et en gros on manipule soit une infection non transmise soit une infection transmise
                // la différence se jouera sur un boolean et une propriété treatments pour guérir de l'infection
                // asymtomatique
                // contamination -> on a l'infection
                // infection -> elle se multiplie (donc les symptome apparaissent)
                // on peut jouer la dessu ptet
                healthyElement.contamine(infection);
                if (debugInfection) {
                    console.log('healthy infection carriage from', infectedElement.value, 'to', healthyElement.value);
                }
            } else if (debugInfection) {
                console.log('infection cannot be propaged from', infectedElement.value, 'to', healthyElement.value);
            }
        }
    },

    cure(element, infection) {
        const maladies = this.maladies;
        const indexOfMaladyToRemove = maladies.findIndex(function(malady) {
            return malady.infection === infection;
        });

        if (indexOfMaladyToRemove === -1) {
            throw new Error('not infected');
        }
        let malady = maladies[indexOfMaladyToRemove];
        if (malady.infected) {
            const finalMaladies = maladies.slice(0, indexOfMaladyToRemove);
            const length = maladies.length;
            let indexOfMaladyToCure = length - 1;

            // soigne toutes les infections y compris celle qu'on veut enlever
            while (indexOfMaladyToCure >= indexOfMaladyToRemove) {
                const maladyToCure = maladies[indexOfMaladyToCure];
                maladyToCure.cure(element);
                indexOfMaladyToCure--;
            }
            // réinfecte les infection après celle qu'on a enlevé
            const finalAmountOfMaladies = length - 1; // le nombre de diagnostic final diminue de 1
            let indexOfMaladyToReinfect = indexOfMaladyToRemove + 1; // l'index du premier diagnostic après celui qu'on supprime
            while (indexOfMaladyToReinfect < finalAmountOfMaladies) {
                const maladyToReInfect = maladies[indexOfMaladyToReinfect];
                maladyToReInfect.infect(element);
                finalMaladies.push(maladyToReInfect);
                indexOfMaladyToReinfect++;
            }

            this.maladies = finalMaladies;
        } else {
            // element is an healthy carrier of the infection
            // removing the infection is simpler
            maladies.splice(indexOfMaladyToRemove, 1);
        }
    },

    purify(element) {
        const maladies = this.maladies;
        let malady = maladies.pop();
        while (malady) {
            malady.cure(element);
            malady = maladies.pop();
        }
    }
});
Element.reconstruct(function() {
    this.health = Health.create();
});
Element.refine({
    infect(arg) {
        const infection = Infection.from(arg);
        this.health.infect(this, infection);
        return this;
    },

    contamine(infection) {
        this.health.contamine(this, infection);
        return this;
    },

    propagate(element) {
        this.health.propagate(this, element);
    },

    cure(infection) {
        this.health.cure(this, infection);
        return this;
    },

    purify() {
        this.health.purify(this);
        return this;
    }
});
Element.hooks.childAdded = function(child) {
    // parent propagate his health to child
    // problem: infection happens to late
    this.propagate(child);
};
Element.refine({
    procreate() {
        const progeny = this.createConstructor.apply(this, arguments);
        // sthing is missing : every appendChild must result in health propagation
        // so that readProperties would create property with an infected health
        this.propagate(progeny);
        return progeny;
    }
});

export {
    Element,
    Lab,
    scan,
    Infection
};
export default Lab;
