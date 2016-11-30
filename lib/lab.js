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
                composite = product;
            }
        }

        return composite;
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

    transmit(organism) {
        const organismPrototype = Object.getPrototypeOf(organism);

        if (this.canInfect(organismPrototype)) {
            organism.health.infect(this);
            if (debugInfectionTranmission) {
                console.log('transmit propaged infection to', organism);
            }
        } else if (this.canBeHostedBy(organismPrototype)) {
            organism.health.host(this);
            if (debugInfectionTranmission) {
                console.log('transmit confined infection to', organism);
            }
        } else if (debugInfectionTranmission) {
            console.log('infection cannot be transmitted to', organism);
        }
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
        this.host(infection);
        this.hurt(infection);
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
    },

    // make the infection hurt the organism
    hurt(infection) {
        // get the malady corresponding to this element and make it invade the element
        // infect is a shortcut for adding a malady & infecting it right away
        const malady = this.maladies.find(function(malady) {
            return malady.infection === infection;
        });
        malady.hurt(this.organism);
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
        for (let infection of this.createPropagationIterable()) {
            infection.transmit(otherOrganism);
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

export {
    Element,
    Lab,
    scan,
    Infection
};
export default Lab;
