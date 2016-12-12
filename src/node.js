import util from './util.js';

const Node = util.extend({
    hooks: {
        created() {},
        added() {},
        changed() {},
        removed() {},
        childAdded() {},
        childRemoved() {}
    },

    constructor(value) {
        this.children = [];
        if (arguments.length > 0) {
            this.value = value;
        }
    },

    createNode(...args) {
        return this.createConstructor(...args);
    },

    appendChild(node) {
        return this.insertBefore(node, null);
    },

    insertBefore(node, referenceNode) {
        node.remove();
        node.parentNode = this;

        let index;
        if (referenceNode) {
            index = this.children.indexOf(referenceNode);
            if (index === -1) {
                index = this.children.length;
            }
        } else {
            index = this.children.length;
        }

        node.moveInto(this, index);
    },

    moveInto(parentNode, index) {
        parentNode.children.splice(index, 0, this);
        this.hook('added');
        parentNode.hook('childAdded', this);
    },

    hook(name, ...args) {
        const hooks = this.hooks;
        if (name in hooks) {
            hooks[name].call(this, ...args);
        }
    },

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
        return this;
    },

    replace(node) {
        const parentNode = this.parentNode;

        if (parentNode.parentNode) {
            parentNode.replaceChild(this, node);
        }

        return node;
    },

    getNextSibling() {
        const parent = this.parentNode;
        let previous = null;
        if (parent) {
            const index = parent.children.indexOf(this);
            const length = parent.children.length;
            if (index < (length - 1)) {
                previous = parent.children[index + 1];
            }
        }
        return previous;
    },

    replaceChild(supposedChildNode, node) {
        const nextNode = supposedChildNode.getNextSibling();
        this.removeChild(supposedChildNode);
        // put it at the same place (so before it's nextsibling)
        this.insertBefore(node, nextNode);
    },

    removeChild(supposedChildNode) {
        supposedChildNode.hook('removed');
        this.hook('childRemoved', supposedChildNode);
        supposedChildNode.parentNode = null;
        const index = this.children.indexOf(supposedChildNode);
        this.children.splice(index, 1);
        return supposedChildNode;
    },

    [Symbol.iterator]() {
        return this.children[Symbol.iterator]();
    }
});

const Fragment = Node.extend({
    moveInto(parentNode, index) {
        for (let childNode of this) {
            childNode.moveInto(parentNode, index);
            index++;
        }
    }
});

Node.refine({
    createFragment() {
        return Fragment.create();
    }
});

Node.refine({
    createAncestorIterable() {
        let constituent = this;

        return createIterable(function() {
            let parentNode = constituent.parentNode;
            constituent = parentNode;

            const result = {
                done: !parentNode,
                value: parentNode
            };

            return result;
        });
    }
});

function createIterable(nextMethod) {
    return {
        [Symbol.iterator]: function() {
            return this;
        },
        next: nextMethod
    };
}

export default Node;
