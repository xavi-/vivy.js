function applyValueToDom(elem, children, data) {
    const isPrimitive = data != null && typeof data !== "object";
    if(isPrimitive) { elem.textContent = `${data}`; }
    else if(data == null) {
        if(children.size > 0)
            console.warn("Can't populate elements because null found", elem)

        if(elem.children.length <= 0) elem.textContent = "";
    }
}

function updateDom(tree, data) {
    // queueDomUpdate(tree, data);
    let node, nodes = [ [ tree, data ] ];
    while((node = nodes.pop())) {
        const [ { elements, children }, data ] = node;

        for(const elem of elements) applyValueToDom(elem, children, data);

        for(const [ prop, child ] of children) {
            nodes.push([ child, data?.[prop] ]);
        }
    }
}

function getNode(tree, path) {
    let node = tree;

    for(const part of path) {
        node = node.children.get(part)
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

function createProxyTree(data) {
    const tree = { elements: [], proxy: null, children: new Map() };

    const createProxy = (path, initValue) => {
        const updateValue = (value) => {
            if(path.length <= 0) data = value;
            else {
                const parent = getValue(data, path.slice(0, -1));
                parent[path[path.length - 1]] = value;
            }

            const node = getNode(tree, path);
            updateDom(node, value);

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

                parent[prop] = value;

                const node = getNode(tree, [ ...path, prop ]);
                if(node) updateDom(node, value);

                return true;
            },
            deleteProperty(_, prop) {
                const value = getValue(data, path);
                if(value == null) return false;

                const rtn = delete value[prop];

                if(!rtn) return false;

                const node = getNode(tree, [ ...path, prop ]);
                if(node) updateDom(node, null);

                return rtn;
            },
            ownKeys() { return Reflect.ownKeys(getValue(data, path)); },
            has(_, key) { return Reflect.has(getValue(data, path), key); },
        });

        return proxy;
    };

    tree.proxy = createProxy([], data);

    window.tree = tree;

    return {
        get proxy() { return tree.proxy },
        bondElementWithPath(elem, path) {
            let node = tree, prefix = [], value = data;
            for(const part of path) {
                const isObject = (value && typeof value === "object");
                if(isObject) node.proxy ??= createProxy([ ...prefix ], value);

                if(!node.children.has(part)) {
                    node.children.set(part, { elements: [], proxy: null, children: new Map() });
                }

                node = node.children.get(part);
                value = value?.[part]
                prefix.push(part);
            }

            node.elements.push(elem);
        },
        refresh() { updateDom(tree, data); }
    };
}

export function bop(elem, data) {
    const tree = createProxyTree(data);
    tree.bondElementWithPath(elem, []);

    let node, nodes = [ [ elem, [] ] ];
    while((node = nodes.pop())) {
        const [ elem, path ] = node;

        let pathAttr
        for(const attr of elem.attributes) {
            if (attr.name.charAt(0) != ".") continue;

            if (pathAttr) {
                console.warn(`Multiple paths found on element: ${attr.name}`, elem);
                continue;
            }

            pathAttr = attr.name;
        }

        let nextPath = path;
        if(pathAttr != null) {
            const parts = pathAttr.split(".").filter(p => p.length > 0);
            if(path.length > 1 && elem.children.length === 0) {
                console.warn("Object never used?", elem, path);
            }

            nextPath = [ ...path, ...parts ];
            tree.bondElementWithPath(elem, nextPath);
        }

        nodes.push(...Array.from(elem.children).map(child => [ child, nextPath ]));
    }

    tree.refresh();

    return tree.proxy;
}
