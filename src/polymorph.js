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

/*
// https://en.wikipedia.org/wiki/Branch_(computer_science)
api finale :

const behaviour = polymorph();

behaviour.branch(condition, sequence);
behaviour.branch(null, sequence); (unconditional branch)
behaviour.when(condition, sequence); (conditional sequences but not a branch!)
behaviour.when(null, sequence); (unconditional sequence))

behaviour.match(...args) // return array of instruction matching (unconditionals are also returned)
behaviour.prefer(...instructions) // change l'ordre des instructions
behaviour.without(...instructions) // enlève certaines instructions
behaviour.with(...instructions) // ajoute des instructions créé en amont

// pattern
// patternMatching
// select
// selectPattern
// characteristic
// multimethod, multifunction multidispatcj
*/

import util from './util.js';

const Instruction = util.extend({
    constructor(sequence) {
        if (sequence) {
            this.sequence = sequence;
        }
    },
    exclusive: false,
    match() {
        throw new Error('must be implemented');
    },
    sequence() {
        // noop
    }
});

const ConditionnableInstructionProperties = {
    // cannot make constructor a shared properties (I think)
    // because every objet must have its own constructor
    match(bind, args) {
        const condition = this.condition;
        if (condition === null) {
            return true;
        }
        return condition.apply(bind, args);
    },

    when(condition) {
        this.condition = condition;
        return this;
    }
};

const Sequence = Instruction.extend(ConditionnableInstructionProperties, {
    exclusive: false,
    constructor(condition, sequence) {
        this.condition = condition;
        Instruction.constructor.call(this, sequence);
    }
});

const Branch = Instruction.extend(ConditionnableInstructionProperties, {
    exclusive: true,
    constructor(condition, sequence) {
        this.condition = condition;
        Instruction.constructor.call(this, sequence);
    }
});

const Behaviour = util.extend({
    constructor() {
        /*
        je pense qu'il faudras supprimer le fait qu'on utilise un tableau
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

        for (let methodName of this.methodToBind) {
            this[methodName] = this[methodName].bind(this);
        }
        this.instructions = [];
    },

    // create a branch, you go into that branch if
    branch(condition, sequence) {
        // note :
        // si implementation existe on modifie son match et on replace variante existant par la nouvelle (ou on mutate la variante existante ?)
        // si match existe on modifie implementation et on replace variante existante par la nouvelle (ou on mutate la variante existante?)
        // si aucun n'existe on l'ajoute ça c'est ce qui est fait ci-dessous
        const branchInstruction = Branch.create(condition, sequence);
        this.instructions.push(branchInstruction);
        return branchInstruction;
    },

    when(condition, sequence) {
        const sequenceInstruction = Sequence.create(condition, sequence);
        this.instructions.push(sequenceInstruction);
        return sequenceInstruction;
    },

    prefer(...instructions) {
        this.instructions = this.instructions.sort(function(a, b) {
            const aIndex = instructions.indexOf(a);
            const bIndex = instructions.indexOf(b);
            if (aIndex > bIndex) {
                return -1;
            }
            if (bIndex > aIndex) {
                return 1;
            }
            return 0;
        });
        return this;
    },

    with(...instructions) {
        return this.createConstructor(this.instructions.push(...instructions));
    },

    without(...instructions) {
        return this.createConstructor(this.instructions.filter(function(instruction) {
            return instructions.indexOf(instruction) === -1;
        }));
    },

    match(...args) {
        return this.instructions.filter(function(instruction) {
            return instruction.match(...args);
        });
    },

    list() {
        return this.instructions;
    },

    createExecutionFlowController() {
        const behaviour = this;
        const executionFlowController = function() {
            let result;
            for (let instruction of behaviour.instructions) {
                if (instruction.match(this, arguments)) {
                    result = instruction.sequence.apply(this, arguments);
                    if (instruction.exclusive) {
                        break;
                    }
                }
            }
            return result;
        };
        for (let methodName of this.methodToBind) {
            executionFlowController[methodName] = this[methodName];
        }
        return executionFlowController;
    }
});
Behaviour.methodToBind = Object.keys(Behaviour).filter(function(name) {
    return (
        name !== 'constructor' &&
        name !== 'createExecutionFlowController' &&
        typeof Behaviour[name] === 'function'
    );
});

const polymorph = function(...args) {
    const behaviour = Behaviour.create();
    behaviour.instructions.push(...args);
    return behaviour.createExecutionFlowController();
};
const when = Sequence.create.bind(Sequence);
const branch = Branch.create.bind(Branch);

export default polymorph;
export {polymorph, when, branch};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('branch', function() {
            const method = polymorph();

            method.branch(
                function() {
                    return this.name === 'dam';
                },
                function() {
                    return 'yo';
                }
            );
            method.branch(
                function() {
                    return this.name === 'seb';
                },
                function() {
                    return 'hey';
                }
            );

            var dam = {
                name: 'dam',
                method: method
            };
            var seb = {
                name: 'seb',
                method: method
            };

            assert(dam.method() === 'yo');
            assert(seb.method() === 'hey');
        });

        this.add('branch + sequence', function() {
            // ensure sequence are executed in serie when they match

            const method = polymorph();

            method.when(
                function() {
                    return this.name === 'dam';
                },
                function() {
                    this.gender = 'male';
                }
            );
            method.when(
                function() {
                    return this.name === 'sandra';
                },
                function() {
                    this.gender = 'female';
                }
            );
            method.when(
                function() {
                    return this.gender === 'male';
                },
                function() {
                    this.strength++;
                }
            );
            method.branch(
                function() {
                    return this.gender === 'male';
                },
                function() {
                    return 'male';
                }
            );
            var dam = {
                name: 'dam',
                strength: 0,
                method: method
            };
            var sandra = {
                name: 'sandra',
                strength: 0,
                method: method
            };

            assert(dam.method() === 'male');
            assert(dam.gender === 'male');
            assert(dam.strength === 1);
            assert(sandra.method() === undefined);
            assert(sandra.gender === 'female');
            assert(sandra.strength === 0);
        });
    }
};
