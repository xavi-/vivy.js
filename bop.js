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
            if(node.proxy) {
                node.proxy.revoke();
                node.proxy = createProxy(path, value);
            }
            updateDom(node, value);

            return node.proxy.proxy;
        }

        const target = Object.assign(updateValue, initValue ?? {});
        const proxy = Proxy.revocable(target, {
            get(_, prop) {
                if(initValue == null)
                    throw new Error(`Cannot read properties of ${value} (reading '${prop}')`);

                const fullPath = [ ...path, prop ];

                return getNode(tree, fullPath)?.proxy.proxy ?? getValue(data, fullPath);
            },
            set(_, prop, value, receiver) {
                if(initValue == null) return false;

                const parent = getValue(data, path);
                parent[prop] = value;

                const fullPath = [ ...path, prop ];
                const node = getNode(tree, fullPath);
                if(!node) return true;

                if(node.proxy) {
                    node.proxy.revoke();
                    node.proxy = createProxy(fullPath, value);
                }
                updateDom(node, value);

                return true;
            },
            deleteProperty(_, prop) {
                if(value == null) return false;

                const value = getValue(data, path);
                const rtn = delete value[prop];

                if(!rtn) return false;

                const fullPath = [ ...path, prop ];
                const node = getNode(tree, fullPath);
                if(!node) return rtn;

                if(node.proxy) {
                    node.proxy.revoke();
                    node.proxy = createProxy(fullPath, null);
                }
                updateDom(node, null);
            },
        });

        return proxy;
    };

    tree.proxy = createProxy([], data);

    window.tree = tree;

    return {
        get proxy() { return tree.proxy.proxy },
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
