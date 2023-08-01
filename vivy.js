const vivy = (() => {
function applyValueToDom(tree, data) {
	const isPrimitive = data != null && typeof data !== "object" && typeof data !== "function";

	for(const elem of tree.elements) {
		if(elem.attribute) {
			const { element, attribute } = elem;

			if(data == null) {
				element.removeAttribute(attribute);
			} else if(typeof data == "boolean") {
				if(data) element.setAttribute(attribute, "");
				else element.removeAttribute(attribute);
			} else if(Array.isArray(data)) {
				element.setAttribute(attribute, data.join(" "));
			} else if(!isPrimitive) {
				const value = [];
				for(const [ key, val ] of data.entries?.() ?? Object.entries(data)) {
					value.push(`${key}: ${val}`);
				}

				element.setAttribute(attribute, value.join("; "));
			} else {
				element.setAttribute(attribute, `${data}`);
			}
		}

		if(elem.showIf) {
			const { element, showIf: { negated, placement, hydrate } } = elem;
			const showElem = ((negated ^ !!data) === 1);
			const isShowing = (element.parentNode != null);

			if(showElem) {
				hydrate();
				if(!isShowing) placement.parentNode.insertBefore(element, placement);
			} else if(!showElem && isShowing) {
				element.remove();
			}
		}

		if(elem.event) {
			const { element, event, handler } = elem;
			element.addEventListener(event, handler);
		}

		if(elem.syncer) {
			const { element, syncer } = elem;
			element.addEventListener("input", syncer);

			const tagName = element.tagName;
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
			} else if(tagName == "INPUT" && element.type == "file") {
				// skip unless null -- file inputs are read-only
				if(data == null) element.value = null;
			} else  if(tagName == "SELECT" && element.multiple) {
				if(data && data.length > 0) {
					for(const option of element.options) {
						option.selected = data.includes(option.value);
					}
				}
			} else {
				element.value = `${data ?? ""}`;
			}
		}

		if(elem.scope) {
			const { element, scope } = elem;

			if(data == null) {
				if(tree.children.size > 0 && document.contains(element))
					console.warn(`Hydration failure: null found at $.${scope.join(".")}`, element);

				if(element.children.length <= 0) { // No child elements
					element.childNodes.forEach(node => {
						// Vivy inserts comments to track where :show-if and array elements go
						if(node.nodeType === Node.TEXT_NODE) node.remove();
					});
				}
			} else if(isPrimitive) {
				const childCount = element.children.length;
				if(childCount === 0) { element.textContent = `${data}`; }
				else if(tree.children.size > 0) { // Edge case: object val replaced with primitive
					console.warn(`Expected object at $.${scope.join(".")}: ` +
						`found "${data}" which overrides ${childCount} child elements`, element
					);
					if(!tree.originalChildElements) {
						tree.originalChildElements = Array.from(element.children);
					}

					element.textContent = `${data}`;
				} else if(!tree.hydrating) {
					const path = "$." + scope.join(".")
					const anyReferencedChildren = tree.elements.some(
						el => el.element !== element && element.contains(el.element)
					);

					if(anyReferencedChildren) {
						// skip -- `data` value is not used by any children
					} else if(childCount === 0) {
						console.warn(`Value "${data}" from ${path} is unused`);
					} else { // `data` value is not used by any children
						console.warn(`Value "${data}" from ${path} removed ${childCount} elements`);
						element.textContent = `${data}`;
					}
				}
			} else if(tree.originalChildElements && element.children.length <= 0) {
				element.textContent = "";

				const fragment = document.createDocumentFragment();
				for(const child of tree.originalChildElements) {
					fragment.appendChild(child);
				}
				element.appendChild(fragment);
			}
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

function adjustArrayTree(subtree, dataRoot, arrData, path, hydrate) {
	const arr = Array.from(arrData ?? []);
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
			const prop = idx.toString();
			const curPath = [ ...path, prop ];

			const elements = []
			for(const { placement, element } of subtree.templates) {
				const elem = element.cloneNode(true);

				placement.parentNode.insertBefore(elem, placement);
				elements.push(elem);
			}

			const datumTree = emptyTreeNode();
			children.set(prop, datumTree);

			hydrate(elements, dataRoot, datumTree, curPath);
		}
	}

	for(let idx = 0; idx < arr.length; idx++) {
		const prop = idx.toString();
		toUpdated.push([ prop, children.get(prop) ]);
	}

	return toUpdated;
}

function updateDom(subtree, rootData, data, path, hydrate) {
	// queueDomUpdate(tree, data);
	let node, nodes = [ [ subtree, data, path ] ];
	while((node = nodes.pop())) {
		const [ subtree, data, path ] = node;

		const isArray = !!subtree.templates;
		if(isArray) {
			const toUpdate = adjustArrayTree(subtree, rootData, data, path, hydrate)
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
function parseAttributesToPaths(elem) {
	let scopePath = null, assignToPath = null, showIfPath = null;
	const attrPaths = [], eventPaths = [];

	const attrs = elem.attributes;
	for(const attr of attrs) {
		const name = attr.name, value = attr.value;

		if ((
			name == ":scope" || name.charAt(0) == "." ||
			(name.charAt(0) == "$" && name.charAt(1) == ".")
		) && name.at(-1) != "?") {
			if (scopePath) console.warn(`Multiple scope paths found on element: ${attr}`, elem);
			else scopePath = toParts(name == ":scope" ? value : name);
		} else if(name.charAt(0) == "@") {
			eventPaths.push({ event: name.substr(1), path: toParts(value) });
		} else if(name.charAt(0) == "!" || name.at(-1) == "?") {
			const negated = name.charAt(0) == "!";
			const start = (negated ? 1 : 0), end = (name.at(-1) == "?" ? -1 : name.length);
			showIfPath = { negated, path: toParts(name.slice(start, end)), attr: name };
		} else if(name.charAt(name.length - 1) == ".") {
			attrPaths.push({ attribute: name.slice(0, -1), path: toParts(value) });
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
		else {
			const attrIdx = attrPaths.findIndex(a => a.attribute == "value");
			if(attrIdx > -1) {
				assignToPath = attrPaths[attrIdx].path;
				attrPaths.splice(attrIdx, 1);
			}
		}
	}

	if(attrs[":show-if"]?.value) {
		if(showIfPath) console.warn(`Multiple show-if specifier found`, elem);

		const value = attrs[":show-if"].value;
		const negated = value.charAt(0) == "!";
		const start = (negated ? 1 : 0), end = (value.at(-1) == "?" ? -1 : value.length);
		showIfPath = { negated, path: toParts(value.slice(start, end)), attr: ":show-if" };
	}

	return { scopePath, assignToPath, showIfPath, attrPaths, eventPaths };
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

function createSyncer(root, path, elem) {
	const tagName = elem.tagName
	if(tagName != "INPUT" && tagName != "SELECT" && tagName != "TEXTAREA") return null;

	let syncer;
	if (path.length === 0) syncer = (val) => root.proxy(val);
	else {
		const prop = path[path.length - 1];
		const node = getNode(root, path.slice(0, -1));
		syncer = (val => node.proxy[prop] = val);
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
		return event => syncer([ ...event.target.files ]);
	}

	// text, email, password, etc... inputs
	if(elem.type != "checkbox" && !elem.multiple) {
		return event => syncer(event.target.value);
	}

	// checkboxes and multi-selects are special
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
	if(!Array.isArray(array)) console.warn(`Non-array found at $.${path.join(".")}:`, array, elem);

	const comment = document.createComment("vivy:[]");
	const placement = elem.parentNode.insertBefore(comment, elem);
	elem.remove();

	const pathAttr = [ ...elem.attributes ].find(attr => attr.name.charAt(0) == ".");
	if(pathAttr) elem.removeAttribute(pathAttr.name);
	elem.setAttribute(":scope", suffix.join("."));

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

function findTemplates(elemRoot) {
	const rtn = new Map();
	const elems = [ elemRoot ];

	let elem;
	while((elem = elems.pop())) {
		if(elem.tagName == "VIVY:TEMPLATE") {
			const name = elem.getAttribute("name");

			if(!name) throw new Error(`Template missing name attribute: ${elem}`);
			if(rtn.has(name)) throw new Error(`Duplicate template name found: ${name}`);

			const fragment = document.createRange().createContextualFragment(elem.innerHTML.trim());
			elem.remove();

			rtn.set(name, fragment);
			continue;
		}

		const attr = elem.attributes[":template"];
		if(attr) {
			const name = attr.value.toLowerCase();

			if(rtn.has(name)) throw new Error(`Duplicate template name found: ${name}`);

			const cloned = elem.cloneNode(true);
			cloned.removeAttribute(":template");
			cloned.removeAttribute(":scope");
			for(const attr of cloned.attributes) {
				const name = attr.name;
				if ((name.charAt(0) == "." || name.charAt(0) == "$") && name.at(-1) != "?") {
					cloned.removeAttribute(name);
				}
			}
			rtn.set(name, cloned);
		}

		elems.push(...elem.children);
	}

	return rtn;
}

function insertTemplate(placement, template, scopePath, showIfPath) {
	let clone = template.cloneNode(true);
	let isFragment = (clone.nodeType == Node.DOCUMENT_FRAGMENT_NODE);

	if(scopePath?.length > 0) {
		if(isFragment) {
			if(clone.lastChild === clone.firstChild) clone = clone.firstChild;
			else {
				const tmp = document.createElement("vivy-template");
				tmp.appendChild(clone);
				clone = tmp;
			}
			isFragment = false;
		}
	}

	const existing = (isFragment ? {} : parseAttributesToPaths(clone));
	if(scopePath?.length > 0) {
		const templateScope = [ ...scopePath ];
		if(existing.scopePath) {
			clone.removeAttribute("." + existing.scopePath.join("."));
			templateScope.push(...existing.scopePath);
		}

		clone.setAttribute(":scope", "." + templateScope.join("."));
	}
	if(showIfPath != null) {
		if(existing.showIf) {
			console.warn(
				"Warning: two show-if attributes found on template",
				clone, existing.showIf.path, showIfPath
			);
		}

		const { negate, path } = showIfPath;
		clone.setAttribute(":show-if", (negate ? "!": ".") + path.join("."));
	}

	const insertedElements = (isFragment ? Array.from(clone.children) : [ clone ]);

	placement.parentNode.insertBefore(clone, placement);
	placement.remove();

	return insertedElements;
}

const templateUsageCount = new Map();
function throwOnExcessiveTemplateUsage(name) {
	if(templateUsageCount.size == 0) setTimeout(() => templateUsageCount.clear(), 0);

	const count = templateUsageCount.get(name) ?? 0;

	if(count > 10_000) {
		throw new Error(`Template "${name}" inserted >10_000 times (possible infinite loop)`);
	}

	templateUsageCount.set(name, count + 1);
}

function emptyTreeNode() {
	return { proxy: null, elements: [], children: new Map() };
}

function createProxyTree(elem, rootData) {
	if(!elem) throw new Error("Null element passed in");

	let treeRoot = null;

	const templates = findTemplates(elem);

	const createProxy = (path, initValue) => {
		const _updateDom = (node, prop, value) =>
			updateDom(node, rootData, value, [ ...path, prop ], hydrate);
		const updateSelf = (value) => {
			if(path.length <= 0) rootData = value;
			else {
				const parent = getValue(rootData, path.slice(0, -1));
				parent[path[path.length - 1]] = value;
			}

			const node = getNode(treeRoot, path);
			updateDom(node, rootData, value, path, hydrate);

			return node.proxy;
		}

		const target = updateSelf;
		// Can't override name or length on functions
		for(const [ key, val ] of Object.entries(initValue ?? {})) {
			if(key != "name" && key != "length") { target[key] = val; }
		}
		const proxy = new Proxy(target, {
			get(_, prop) {
				const value = getValue(rootData, path);
				if(value == null) console.warn(`Read property of ${value} (reading '${prop}')`);

				if(prop == "toJSON") return value?.toJSON ?? (() => value);

				let rtn = getNode(treeRoot, [ ...path, prop ])?.proxy;
				if(rtn != null && value?.[prop] != null) return rtn;

				rtn = value?.[prop];
				if(Array.isArray(value)) return rtn;
				if(rtn instanceof Function) rtn = rtn.bind(value);

				return rtn;
			},
			set(_, prop, value) {
				const parent = getValue(rootData, path);
				if(parent == null)
					throw new Error(`Cannot set properties of ${value} (reading '${prop}')`);
				if(Object.is(parent[prop], value)) return true;

				const node = getNode(treeRoot, path);
				if(value && node.children.get(prop)?.proxy === value) return true;

				const prevLength = parent.length;
				parent[prop] = value;

				if(node.templates && parent.length !== prevLength) {
					adjustArrayTree(node, rootData, parent, path, hydrate);
					if(node.children.has("length")) {
						_updateDom(node.children.get("length"), "length", parent.length);
					}
				} else if(node.children.has(prop)) {
					const valNode = node.children.get(prop);

					_updateDom(valNode, prop, value);

					if(valNode.proxy == null) {
						populateProxySubtree([ ...path, prop ], valNode, value);
					}
				} else if(parent.length !== prevLength && node.children.has("length")) {
					_updateDom(node.children.get("length"), "length", value)
				}

				// Here to update element's attributes
				if(node.elements) applyValueToDom(node, parent);

				return true;
			},
			deleteProperty(_, prop) {
				const parent = getValue(rootData, path);
				if(parent == null) return false;

				const rtn = delete parent[prop];

				if(!rtn) return false;

				const node = getNode(treeRoot, path);
				if(node.children.has(prop)) {
					_updateDom(node.children.get(prop), prop, null);
				}

				return rtn;
			},
			ownKeys() { return Reflect.ownKeys(getValue(rootData, path)); },
			has(_, key) { return Reflect.has(getValue(rootData, path), key); },
			getOwnPropertyDescriptor(_, key) {
				return Reflect.getOwnPropertyDescriptor(getValue(rootData, path), key);
			}
		});

		return proxy;
	};

	const populateProxySubtree = (path, subtree, value) => {
		const nodes = [ [ path, subtree, value] ];

		let node;
		while((node = nodes.pop())) {
			let [ path, subtree, value ] = node;

			if(value == null) continue;
			if(subtree.children.size <= 0) continue;

			subtree.proxy = createProxy(path, value);

			for(const [ prop, child ] of subtree.children) {
				nodes.push([ [ ...path, prop ], child, value[prop] ]);
			}
		}
	};

	const createEventHandler = (elem, handlerPath, contextPath) => {
		return (event) => {
			const handler = getValue(rootData, handlerPath);
			let context = getNode(treeRoot, contextPath).proxy
			context ??= getNode(treeRoot, contextPath.slice(0, -1)).proxy;

			if(handler instanceof Function) {
				handler.call(elem, event, context);
			} else {
				const path = handlerPath.join(".");
				console.warn(`Non-function event-handler: "${handler}" found at $.${path}`, elem);
			}
		};
	};

	const traverseToPath = (root, tree, data, path, traversal) => {
		let subtree = tree, subData = data, traversed = [ ...path ], idx = 0;

		if(traversal[0] == "$") {
			subtree = root;
			subData = rootData;
			traversed = [];
			traversal = traversal.slice(1);
		}

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

			if(subData && typeof subData === "object" && !(part in subData)) {
				const nearMiss = Object.keys(subData).find(key => key.toLowerCase() == part);
				if(nearMiss != null) {
console.warn(`!!!
Near miss found -- "${part}" (html attribute) vs "${nearMiss}" (data property)
HTML attributes are lowercased by the browser so mixed-case scope references aren't possible.
Consider using :scope="${traversal.join(".")}" instead
!!!`);
				}
			}
			subData = subData?.[part];
			idx += 1;
		}
		const untraversed = traversal.slice(idx);

		return { subtree, subData, traversed, untraversed };
	};

	const hydrate = (elements, dataRoot, hydrateRoot, path) => {
		// Bootstrapping issue: the `hydrate` function is used to populate `treeRoot`.
		// On the first call of `hydrate`, `treeRoot` is null.  The `root` value is need to
		// properly support paths that start with `$.`
		const root = treeRoot ?? hydrateRoot;

		const initialData = getValue(dataRoot, path);
		const initialNode = getNode(root, path) ?? hydrateRoot;
		let node, nodes = elements.map(elem => [ elem, initialNode, initialData, path ])
		while((node = nodes.shift())) {
			const [ elem, tree, data, path ] = node;

			const {
				scopePath, assignToPath, showIfPath, attrPaths, eventPaths
			} = parseAttributesToPaths(elem);

			if(elem.tagName.startsWith("T:") || elem.tagName.startsWith("TEMPLATE:")) {
				const name = elem.tagName.split(":")[1].toLowerCase();
				if(!templates.has(name)) throw new Error(`Unknown template name: ${name}`);
				throwOnExcessiveTemplateUsage(name);

				const template = templates.get(name);
				const insertedElems = insertTemplate(elem, template, scopePath, showIfPath);

				nodes.unshift(...insertedElems.map(elem => [ elem, tree, data, path ]));

				continue;
			}

			const scopeTraversal = scopePath && traverseToPath(root, tree, data, path, scopePath);

			const curTree = scopeTraversal?.subtree ?? tree;
			const curData = scopeTraversal?.subData ?? data;
			const curPath = scopeTraversal?.traversed ?? path;
			const untraversed = scopeTraversal?.untraversed ?? [];

			if(untraversed[0] == "[]") { // Found array path, short-circuit
				const suffix = untraversed.slice(1);
				const trees = createArraySubtrees(elem, curTree, curData, curPath, suffix);

				nodes.push(...trees);
				continue;
			}

			if(showIfPath) {
				const { subtree, subData, untraversed } =
					traverseToPath(root, curTree, curData, curPath, showIfPath.path);

				if(untraversed.length !== 0) throw new Error(`Can't show-if an array, ${elem}`);

				const comment = document.createComment("vivy:show-if");
				const negated = showIfPath.negated;
				const placement = elem.parentNode.insertBefore(comment, elem);

				elem.removeAttribute(showIfPath.attr);

				let isHydrated = false;
				const params = {
					negated, placement, hydrate: () => {
						if(isHydrated) return;
						isHydrated = true;

						// Ignore scopeTraversal to ensure arrays are handled correctly
						hydrate([ elem ], dataRoot, root, path);
					},
				};
				subtree.elements.push({ element: elem, showIf: params });
				applyValueToDom(subtree, subData);
				continue; // Lazy hydrate elements with `:show-if` attributes
			}

			if(assignToPath) {
				const { subtree, subData, traversed, untraversed } =
					traverseToPath(root, curTree, curData, curPath, assignToPath);

				if(untraversed.length !== 0) throw new Error(`Can't assign-to an array, ${elem}`);

				const syncer = createSyncer(root, traversed, elem);
				subtree.elements.push({ element: elem, syncer });
				applyValueToDom(subtree, subData);
			}

			for(const { attribute, path } of attrPaths) {
				const { subtree, subData, traversed, untraversed } =
					traverseToPath(root, curTree, curData, curPath, path);

				if(untraversed.length !== 0)
					throw new Error(`Attribute path can't reference arrays, ${elem}`);

				elem.removeAttribute(`${attribute}.`);

				subtree.elements.push({ element: elem, attribute })
				if(subtree.proxy == null) {
					const isObject = (subData && typeof subData === "object");
					if(isObject) subtree.proxy = createProxy(traversed, subData);
				}

				applyValueToDom(subtree, subData);
			}

			for(const { event, path } of eventPaths) {
				const { subtree, subData, traversed, untraversed } =
					traverseToPath(root, curTree, curData, curPath, path);

				if(untraversed.length !== 0)
					throw new Error(`Event handler path can't reference arrays, ${elem}`);
				if(!(subData instanceof Function))
					console.warn(
						`Non-function found for event handler at $.${traversed.join(".")}:`,
						subData, elem
					);

				elem.removeAttribute(`@${event}`);

				const contextPath = (path[0] == "$" ? curPath : traversed.slice(0, -1));
				const handler = createEventHandler(elem, traversed, contextPath);
				subtree.elements.push({ element: elem, event, handler })
				applyValueToDom(subtree, subData);
			}

			if(!scopePath) {
				const children = Array.from(elem.children);
				nodes.push(...children.map(child => [ child, tree, data, path ]));
			} else {
				const { subtree, subData, traversed } = scopeTraversal;

				const children = Array.from(elem.children);
				nodes.push(...children.map(child => [ child, subtree, subData, traversed ]));

				const isObject = (subData && typeof subData === "object");
				if(isObject && elem.children.length === 0 && subtree.children.length === 0) {
					console.warn("Object never used?", elem, traversed);
				}

				const element = { element: elem, scope: traversed };
				subtree.elements.push(element);

				subtree.hydrating = true;
				applyValueToDom(subtree, subData);
				subtree.hydrating = false;;
			}
		}

		return hydrateRoot;
	};

	const initialNode = emptyTreeNode();
	initialNode.elements.push({ element: elem, scope: [] });

	treeRoot = hydrate([ elem ], rootData, initialNode, []);
	if(!treeRoot.proxy) { treeRoot.proxy = createProxy([], rootData); }
	treeRoot.proxy(rootData); // Here to make sure DOM is completely synced with data

	window.tree = treeRoot;

	return treeRoot;
}

return function vivy(elem, data) {
	if(!(elem instanceof HTMLElement)) throw new Error("First vivy.js arg must be a HTMLElements");
	return createProxyTree(elem, data).proxy;
};
})();
const vivify = vivy;
