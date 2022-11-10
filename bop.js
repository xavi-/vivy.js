function applyValueToDom(tree, data) {
    const isPrimitive = data != null && typeof data !== "object";

    for(const elem of tree.elements) {
        if(isPrimitive) { elem.textContent = `${data}`; }
        else if(data == null) {
            if(tree.children.size > 0)
                console.warn("Can't populate elements because null found", elem)

            if(elem.children.length <= 0) elem.textContent = "";
        }
    }
}

function gatherElements(tree) {
    const rtn = [];

    let node, nodes = [ tree ];
    while((node = nodes.pop())) {
        if(node.elements) rtn.push(...node.elements);
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
            applyValueToDom(subtree, data, path, hydrate);

            for(const [ prop, child ] of subtree.children) {
                nodes.push([ child, data?.[prop], [ ...path, prop ] ]);
            }
        }
    }
}

function parsePathParts(elem) {
    let pathAttr = null;
    for(const attr of elem.attributes) {
        if (attr.name != "bop" && attr.name.charAt(0) != ".") continue;

        if (pathAttr) {
            console.warn(`Multiple paths found on element: ${attr}`, elem);
            continue;
        }

        pathAttr = (attr.name == "bop" ? attr.value : attr.name);
    }

    const parts = pathAttr?.split(/(?:\.|(?=\[]))/g).filter(p => p.length > 0) ?? [];

    return { parts, pathAttr };
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

function createProxyTree(elem, data) {
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

        const target = Object.assign(updateValue, initValue ?? {});
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

    const hydrate = (elements, data, path) => {
        const tree = { elements, proxy: null, children: new Map() }

        let node, nodes = elements.map(elem => [ elem, tree, data, path ])
        while((node = nodes.pop())) {
            const [ elem, tree, data, path ] = node;

            const { parts, pathAttr } = parsePathParts(elem);

            let subtree = tree, curData = data, curPath = [ ...path ], idx = 0;
            for(const part of parts) {
                if(subtree.proxy == null) {
                    const isObject = (curData && typeof curData === "object");
                    if(isObject) subtree.proxy = createProxy(curPath, curData);
                }

                if(part == "[]") break;

                if(!subtree.children.has(part)) {
                    const child = { proxy: null, elements: [], children: new Map() };
                    subtree.children.set(part, child);
                }

                subtree = subtree.children.get(part);
                curPath = [ ...curPath, part ];
                curData = curData?.[part];
                idx += 1;
            }

            const foundArray = (idx < parts.length && parts[idx] === "[]");
            if(!foundArray) {
                nodes.push(...Array.from(elem.children).map(e => [ e, subtree, curData, curPath ]));

                if(pathAttr != null) {
                    const isObject = (curData && typeof curData === "object");
                    if(isObject && elem.children.length === 0) {
                        console.warn("Object never used?", elem, path);
                    }

                    subtree.elements.push(elem);
                    applyValueToDom(subtree, curData);
                }
            } else {
                if(!Array.isArray(curData)) console.warn(`Property type mismatch:`, elem, curData);

                const comment = document.createComment("bop:[]");
                const placement = elem.parentNode.insertBefore(comment, elem);
                elem.remove();

                const suffix = parts.slice(idx + 1);
                elem.removeAttribute(pathAttr);
                elem.setAttribute("bop", suffix.join("."));

                subtree.elements = null;
                subtree.templates ??= [];
                subtree.templates.push({ placement, element: elem });

                const fragment = document.createDocumentFragment();
                for(const [ idx, datum ] of Array.from(curData ?? []).entries()) {
                    const prop = idx.toString()

                    if(!subtree.children.has(prop)) {
                        const child = { proxy: null, elements: [], children: new Map() };
                        subtree.children.set(prop, child);
                    }
                    const datumTree = subtree.children.get(prop);
                    const datumElem = elem.cloneNode(true);

                    nodes.push([ datumElem, datumTree, datum, [ ...curPath, prop ] ]);

                    fragment.appendChild(datumElem);
                }
                placement.parentNode.insertBefore(fragment, placement);
            }
        }

        return tree;
    };

    const tree = hydrate([ elem ], data, []);
    if(!tree.proxy) {
        tree.proxy = createProxy([], data);
        tree.proxy(data);
    }

    window.tree = tree;

    return tree;
}

export function bop(elem, data) { return createProxyTree(elem, data).proxy; }
