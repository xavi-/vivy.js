function applyValueToDom(tree, data) {
    const isPrimitive = data != null && typeof data !== "object";

    for(const elem of tree.elements) {
        const tagName = elem.element.tagName;
        if(tagName == "INPUT" || tagName == "SELECT" || tagName == "TEXTAREA") {
            const { element, syncer } = elem;

            if(tagName == "INPUT" && element.type == "number") {
                element.valueAsNumber = data;
            } else if(tagName == "INPUT" && (
                element.type.startsWith("date") ||
                element.type == "month" || element.type == "week" || element.type == "time"
            )) {
                element.valueAsDate = data;
            } else if(tagName == "INPUT" && element.type == "radio") {
                element.checked = (`${data}` == element.value);
            } else if(tagName == "INPUT" && element.type == "checkbox") {
                element.checked = data != null && (
                    (data === true && element.value == "on") ||
                    `${data}` == element.value || data.includes?.(element.value)
                );
            } else if(tagName == "SELECT" && element.multiple) {
                if(data && data.length > 0) {
                    for(const option of element.options) {
                        option.selected = data.includes(option.value);
                    }
                }
            } else {
                element.value = `${data ?? ""}`;
            }
            element.addEventListener("change", syncer);
        }
        else if(isPrimitive) { elem.element.textContent = `${data}`; }
        else if(data == null) {
            if(tree.children.size > 0)
                console.warn("Can't populate elements because null found", elem.element)

            if(elem.element.children.length <= 0) elem.element.textContent = "";
        }
    }
}

function gatherElements(tree) {
    const rtn = [];

    let node, nodes = [ tree ];
    while((node = nodes.pop())) {
        if(node.elements) rtn.push(...node.elements.map(e => e.element));
        else nodes.push(...node.children.values());
    }

    return rtn;
}

function adjustArrayTree(subtree, data, path, hydrate) {
    const arr = Array.from(data ?? []);
    const children = subtree.children;
    const subtreeSize = [ ...children.keys() ].filter(key => /\d+/.test(key)).length;

    const toUpdated = [];

    if(subtreeSize !== arr.length && children.has("length")) {
        toUpdated.push([ "length", children.get("length") ]);
    }

    if (subtreeSize > arr.length) {
        const toRemoveProps = [], toRemoveElems = [];
        for(let idx = arr.length; idx < subtreeSize; idx++) {
            const prop = idx.toString();
            toRemoveProps.push(prop);
            toRemoveElems.push(...gatherElements(children.get(prop)));
        }

        toUpdated.push(...toRemoveProps.map(prop => [ prop, children.get(prop) ]));

        for(const elem of toRemoveElems) elem.remove();
        for(const idx of toRemoveProps) children.delete(idx);
    } else if(subtreeSize < arr.length) {
        for(let idx = subtreeSize; idx < arr.length; idx++) {
            const datum = arr[idx];
            const prop = idx.toString();
            const curPath = [ ...path, prop ];

            const elements = []
            for(const { placement, element } of subtree.templates) {
                const elem = element.cloneNode(true);

                placement.parentNode.insertBefore(elem, placement);
                elements.push(elem);
            }
            const datumTree = hydrate(elements, datum, curPath)
            children.set(prop, datumTree);
        }
    }

    for(let idx = 0; idx < arr.length; idx++) {
        const prop = idx.toString();
        toUpdated.push([ prop, children.get(prop) ]);
    }

    return toUpdated;
}

function updateDom(subtree, data, path, hydrate) {
    // queueDomUpdate(tree, data);
    let node, nodes = [ [ subtree, data, path ] ];
    while((node = nodes.pop())) {
        const [ subtree, data, path ] = node;

        const isArray = !!subtree.templates;
        if(isArray) {
            const toUpdate = adjustArrayTree(subtree, data, path, hydrate)
                .map(([ prop, child ]) => [ child, data?.[prop], [ ...path, prop ] ])
            ;
            nodes.push(...toUpdate);
        } else {
            applyValueToDom(subtree, data);

            for(const [ prop, child ] of subtree.children) {
                nodes.push([ child, data?.[prop], [ ...path, prop ] ]);
            }
        }
    }
}

function toParts(path) {
    return path?.split(/(?:\.|(?=\[]))/g).filter(p => p.length > 0) ?? [];
}
function parsePathParts(elem) {
    let scopePath = null, assignToPath = null;
    const attrPaths = [], eventPaths = [];

    const attrs = elem.attributes;
    for(const attr of attrs) {
        const name = attr.name;

        if (name == "bop" || name.charAt(0) == ".") {
            if (scopePath) console.warn(`Multiple scope paths found on element: ${attr}`, elem);
            else scopePath = toParts(name == "bop" ? attr.value : name);
        } else if(name.charAt(0) == "@") {
            eventPaths.push({ event: name.substr(1), path: toParts(attr.value) });
        } else if(name.charAt(name.length - 1) == ".") {
            attrPaths.push({ attribute: name.substr(0, -1), path: toParts(attr.value) });
        }
    }

    const tagName = elem.tagName;
    const isInput = (tagName == "INPUT" || tagName == "SELECT" || tagName == "TEXTAREA");
    if(!isInput && attrs[":assign-to"]?.value) {
        console.warn(`Assign-to path found on non-input element`, elem);
    } else if(isInput) {
        if(attrs[":assign-to"]?.value) { assignToPath = toParts(attrs[":assign-to"].value); }
        else if(scopePath != null) { assignToPath = scopePath; scopePath = null; }
        else if(attrs["name"]?.value) { assignToPath = toParts(attrs["name"].value); }
    }

    return { scopePath, assignToPath, attrPaths, eventPaths };
}

function getNode(tree, path) {
    let node = tree;

    for(const part of path) {
        node = node.children.get(part);
    }

    return node;
}

function getValue(data, path) {
    let rtn = data;

    for(const part of path) {
        if(rtn == null) break;

        rtn = rtn[part];
    }

    return rtn;
}

function createSyncerIfNecessary(root, path, elem) {
    const tagName = elem.tagName
    if(tagName != "INPUT" && tagName != "SELECT" && tagName != "TEXTAREA") return null;

    let syncer;
    if (path.length === 0) syncer = (val) => root.proxy(val);
    else {
        const prop = path[path.length - 1];
        const proxy = getNode(root, path.slice(0, -1)).proxy;
        syncer = (val => proxy[prop] = val)
    }

    if(elem.type == "number") {
        return event => syncer(event.target.valueAsNumber);
    }

    if(
        elem.type.startsWith("date") ||
        elem.type == "month" || elem.type == "week" || elem.type == "time"
    ) {
        return event => syncer(event.target.valueAsDate);
    }

    if(elem.type == "file") {
        return event => syncer(event.target.files);
    }

    // checkboxes and multi-selects are special
    if(elem.type != "checkbox" && !elem.multiple) {
        return event => syncer(event.target.value);
    }

    if(elem.multiple) {
        return event => {
            const val = [];

            for(const option of event.target.selectedOptions) {
                val.push(option.value);
            }

            syncer(val);
        }
    }

    // checkboxes
    const node = getNode(root, path);
    return _ => {
        const siblings = node.elements.filter(elem => elem.element.type == "checkbox");
        if(siblings.length === 1) {
            const hasValue = !!elem.value;
            syncer(elem.checked ? (hasValue ? elem.value : true) : (hasValue ? null : false));
        } else {
            const val = [];
            for(const { element } of siblings) {
                if(element.checked) val.push(element.value || "on");
            }
            syncer(val);
        }
    }
}

function createArraySubtrees(elem, subtree, array, path, suffix) {
    if(!Array.isArray(array)) console.warn(`Property type mismatch:`, elem, array);

    const comment = document.createComment("bop:[]");
    const placement = elem.parentNode.insertBefore(comment, elem);
    elem.remove();

    const pathAttr = [ ...elem.attributes ].find(attr => attr.name.charAt(0) == ".");
    if(pathAttr) elem.removeAttribute(pathAttr.name);
    elem.setAttribute("bop", suffix.join("."));

    subtree.elements = null;
    subtree.templates ??= [];
    subtree.templates.push({ placement, element: elem });

    const rtn = [], fragment = document.createDocumentFragment();
    for(const [ idx, datum ] of Array.from(array ?? []).entries()) {
        const prop = idx.toString()

        if(!subtree.children.has(prop)) {
            const child = { proxy: null, elements: [], children: new Map() };
            subtree.children.set(prop, child);
        }
        const datumTree = subtree.children.get(prop);
        const datumElem = elem.cloneNode(true);

        rtn.push([ datumElem, datumTree, datum, [ ...path, prop ] ]);

        fragment.appendChild(datumElem);
    }
    placement.parentNode.insertBefore(fragment, placement);

    return rtn;
}

function createProxyTree(elem, data) {
    if(!elem) throw new Error("Null element passed in");

    const createProxy = (path, initValue) => {
        const _updateDom = (node, value) => updateDom(node, value, path, hydrate);
        const updateValue = (value) => {
            if(path.length <= 0) data = value;
            else {
                const parent = getValue(data, path.slice(0, -1));
                parent[path[path.length - 1]] = value;
            }

            const node = getNode(tree, path);
            _updateDom(node, value);

            return node.proxy;
        }

        const target = updateValue;
        // Can't override name or length on functions
        for(const [ key, val ] of Object.entries(initValue ?? {})) {
            if(key != "name" && key != "length") { target[key] = val; }
        }
        const proxy = new Proxy(target, {
            get(_, prop) {
                const value = getValue(data, path);
                if(value == null) console.warn(`Read property of ${value} (reading '${prop}')`);

                return getNode(tree, [ ...path, prop ])?.proxy ?? value?.[prop];
            },
            set(_, prop, value) {
                const parent = getValue(data, path);
                if(parent == null)
                    throw new Error(`Cannot set properties of ${value} (reading '${prop}')`);

                const node = getNode(tree, path);
                const isArray = !!node.templates;

                const prevLength = (isArray ? parent.length : -1);
                parent[prop] = value;

                if(isArray && parent.length != prevLength) {
                    adjustArrayTree(node, parent, path, hydrate);
                    if(node.children.has("length")) {
                        _updateDom(node.children.get("length"), parent.length);
                    }
                } else if(node.children.has(prop)) {
                    _updateDom(node.children.get(prop), value);
                }

                // Here to update element's attributes
                if(node.elements) applyValueToDom(node, parent);

                return true;
            },
            deleteProperty(_, prop) {
                const parent = getValue(data, path);
                if(parent == null) return false;

                const rtn = delete parent[prop];

                if(!rtn) return false;

                const node = getNode(tree, path);
                if(node.children.has(prop)) {
                    _updateDom(node.children.get(prop), null);
                }

                return rtn;
            },
            ownKeys() { return Reflect.ownKeys(getValue(data, path)); },
            has(_, key) { return Reflect.has(getValue(data, path), key); },
        });

        return proxy;
    };

    const traverseToPath = (tree, data, path, traversal) => {
        let subtree = tree, subData = data, traversed = [ ...path ], idx = 0;
        for(const part of traversal) {
            if(subtree.proxy == null) {
                const isObject = (subData && typeof subData === "object");
                if(isObject) subtree.proxy = createProxy(traversed, subData);
            }

            if(part == "[]") break;

            if(!subtree.children.has(part)) {
                const child = { proxy: null, elements: [], children: new Map() };
                subtree.children.set(part, child);
            }

            subtree = subtree.children.get(part);
            traversed = [ ...traversed, part ];
            subData = subData?.[part];
            idx += 1;
        }
        const untraversed = traversal.slice(idx);

        return { subtree, subData, traversed, untraversed };
    };

    const hydrate = (elements, data, path) => {
        const root = { elements: [], proxy: null, children: new Map() };
        root.elements = elements.map(element => ({ element }));

        let node, nodes = elements.map(elem => [ elem, root, data, path ])
        while((node = nodes.shift())) {
            const [ elem, tree, data, path ] = node;

            const { scopePath, assignToPath, attrPaths, eventPaths } = parsePathParts(elem);

            let scopeTraversal = null;
            if(!scopePath) {
                const children = Array.from(elem.children);
                nodes.push(...children.map(child => [ child, tree, data, path ]));
            } else {
                scopeTraversal = traverseToPath(tree, data, path, scopePath);
                const { subtree, subData, traversed, untraversed } = scopeTraversal;

                if(untraversed[0] == "[]") { // Found array path
                    const suffix = untraversed.slice(1);
                    const trees = createArraySubtrees(elem, subtree, subData, traversed, suffix);

                    nodes.push(...trees);
                    continue;
                } else {
                    const children = Array.from(elem.children);
                    nodes.push(...children.map(child => [ child, subtree, subData, traversed ]));

                    const isObject = (subData && typeof subData === "object");
                    if(isObject && elem.children.length === 0) {
                        console.warn("Object never used?", elem, traversed);
                    }

                    subtree.elements.push({ element: elem });
                    applyValueToDom(subtree, subData, traversed);
                }
            }

            const scopedTree = scopeTraversal?.subtree ?? tree;
            const curData = scopeTraversal?.subData ?? data;
            const curPath = scopeTraversal?.traversed ?? path;
            if(assignToPath) {
                const { subtree, traversed, untraversed } =
                    traverseToPath(scopedTree, curData, curPath, assignToPath);

                if(untraversed.length !== 0) throw new Error(`Can't assign-to an array, ${elem}`);

                const syncer = createSyncerIfNecessary(root, traversed, elem);
                subtree.elements.push({ element: elem, syncer });
            }
        }

        return root;
    };

    const tree = hydrate([ elem ], data, []);
    if(!tree.proxy) {
        tree.proxy = createProxy([], data);
        tree.proxy(data);
    }
    tree.proxy(data); // This is not efficient or ideal

    window.tree = tree;

    return tree;
}

export function bop(elem, data) { return createProxyTree(elem, data).proxy; }
