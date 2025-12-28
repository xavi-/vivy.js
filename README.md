# Vivy.js

A lightweight, dependency-free, reactive DOM library.

## Quick Start

Include `vivy.js` in your HTML and bind data to the DOM:

```html
<script src="./vivy.js"></script>

<div id="app">
	<h1 .message></h1>
</div>

<script>
	const app = vivy(document.getElementById('app'), {
		message: "Hello World"
	});

	// Update the DOM by mutating the proxy
	app.message = "Hello Vivy!";
</script>
```

**Output:**
```html
<h1>Hello Vivy!</h1>
```

---

## Core Concepts

### How Vivy Works
Vivy scans the DOM for special attributes and class names, then creates reactive bindings between your data and the DOM. When data changes, the DOM updates automatically.

### Binding Resolution
- Bindings use dot notation (`.user.name`) to traverse your data object
- The `.` prefix indicates a data path (not a CSS class)
- Bindings are resolved relative to the current scope (see [Scope Control](#8-scope-control))
- All bindings (text, attributes, events, etc.) follow the same resolution rules

### Graceful Degradation

When bindings fail, Vivy attempts to continue:

- **Type mismatches**: Values are coerced to strings for display
- **Missing data**: Elements bound to undefined paths have their textContent set to ""
- **Null values**: Text content is set to ""; conditional elements are hidden

**Example:**
```html
<div id="app">
	<p .user.name></p>  <!-- Shows nothing if user is null -->
	<ul .items[]>
		<li></li>       <!-- Renders nothing if items is null/undefined -->
	</ul>
</div>
```

```javascript
const app = vivy(document.getElementById('app'), {
	user: null,   // .user.name → empty paragraph
	items: null   // .items[] → empty list (no <li> elements)
});

// Later, when data is available:
app.user = { name: "Alice" };  // Paragraph now shows "Alice"
app.items = ["One", "Two"];    // List now shows two items
```

---

## Features

- [Text Binding](#1-text-binding)
- [Attribute Binding](#2-attribute-binding)
- [Loops](#3-loops)
- [Conditionals](#4-conditionals)
- [Events](#5-events)
- [Form Inputs](#6-form-inputs)
- [Templates](#7-templates)
- [Scope Control](#8-scope-control)
- [Root Scope](#9-root-scope)
- [API Reference](#10-api-reference)

---

## 1. Text Binding

Bind text content using the `.property` class syntax.

> **Note:** The `.property` syntax has a dual nature - it can bind text content OR create a new scope for children. See [Scope Control](#8-scope-control) for details.

### Basic Text

**HTML:**
```html
<div id="app">
	<p .greeting></p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	greeting: "Hello!"
});

app.greeting = "Updated!";
```

**Output:**
```html
<p>Updated!</p>
```

---

### Nested Properties

Access nested objects with dot notation.

**HTML:**
```html
<div id="app">
	<p .user.name></p>
	<p .user.profile.bio></p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	user: {
		name: "Alice",
		profile: { bio: "Developer" }
	}
});
```

**Output:**
```html
<p>Alice</p>
<p>Developer</p>
```

---

## 2. Attribute Binding

Bind attributes using `attributeName.="path"` syntax.

### Basic Attributes

**HTML:**
```html
<div id="app">
	<a href.=".url">Link</a>
	<img src.=".image_src" alt.=".image_alt">
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	url: "https://example.com",
	image_src: "/photo.jpg",
	image_alt: "A photo"
});
```

**Output:**
```html
<a href="https://example.com">Link</a>
<img src="/photo.jpg" alt="A photo">
```

---

### Boolean Attributes

`true` sets the attribute, `false` removes it.

**HTML:**
```html
<div id="app">
	<button disabled.=".is_disabled">Submit</button>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	is_disabled: true
});

// Output: <button disabled="">Submit</button>

app.is_disabled = false;

// Output: <button>Submit</button>
```

---

### Class Arrays

Arrays become space-separated class lists.

**HTML:**
```html
<div id="app">
	<div class.=".classes"></div>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	classes: ["btn", "btn-primary", "active"]
});
```

**Output:**
```html
<div class="btn btn-primary active"></div>
```

---

### Style Objects

Objects become inline CSS.

**HTML:**
```html
<div id="app">
	<div style.=".styles"></div>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	styles: {
		color: "blue",
		"font-size": "14px",
		border: "1px solid red"
	}
});
```

**Output:**
```html
<div style="color: blue; font-size: 14px; border: 1px solid red"></div>
```

---

### Template Literals

Use backticks for dynamic attribute values. Access data with `_`.

**HTML:**
```html
<div id="app">
	<a href.="`mailto:${_.email}`">Email</a>
	<div title.="`Count: ${_.count}`"></div>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	email: "test@example.com",
	count: 42
});
```

**Output:**
```html
<a href="mailto:test@example.com">Email</a>
<div title="Count: 42"></div>
```

---

## 3. Loops

Iterate over arrays using `[]` suffix. Each iteration creates its own scope (the array item), allowing child bindings to access item properties.

### Basic Loop

**HTML:**
```html
<div id="app">
	<ul>
		<li .items[]></li>
	</ul>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	items: ["Apple", "Banana", "Cherry"]
});
```

**Output:**
```html
<ul>
	<li>Apple</li>
	<li>Banana</li>
	<li>Cherry</li>
</ul>
```

**Reactivity:**
```javascript
app.items.push("Date");      // Adds <li>Date</li>
app.items.pop();             // Removes last item
app.items[0] = "Apricot";    // Updates first item
```

---

### Array of Objects

Child elements bind to object properties. Each array item becomes the scope for its element and children.

**HTML:**
```html
<div id="app">
	<ul .users[]>
		<li>
			<strong .name></strong> - <span .email></span>
		</li>
	</ul>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	users: [
		{ name: "Alice", email: "alice@example.com" },
		{ name: "Bob", email: "bob@example.com" }
	]
});
```

**Output:**
```html
<ul>
	<li><strong>Alice</strong> - <span>alice@example.com</span></li>
	<li><strong>Bob</strong> - <span>bob@example.com</span></li>
</ul>
```

---

### Nested Arrays

Use multiple `[]` for nested structures.

**HTML:**
```html
<div id="app">
	<ul>
		<li .grid[][]></li>
	</ul>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	grid: [
		["A1", "A2"],
		["B1", "B2"]
	]
});
```

**Output:**
```html
<ul>
	<li>A1</li>
	<li>A2</li>
	<li>B1</li>
	<li>B2</li>
</ul>
```

---

### Array Index Access

Access specific indices with `.property.index`.

**HTML:**
```html
<div id="app">
	<p .colors.0></p>
	<p .colors.2></p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	colors: ["red", "green", "blue"]
});
```

**Output:**
```html
<p>red</p>
<p>blue</p>
```

---

## 4. Conditionals

Show or hide elements based on truthiness.

### Show-If Shorthand

Use `?` suffix for conditional rendering.

**HTML:**
```html
<div id="app">
	<p .is_logged_in?>Welcome back!</p>
	<p !.is_logged_in?>Please log in.</p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	is_logged_in: true
});
```

**Output when `is_logged_in: true`:**
```html
<p>Welcome back!</p>
<!-- Second <p> is removed from DOM -->
```

**After update:**
```javascript
app.is_logged_in = false;
```

**Output when `is_logged_in: false`:**
```html
<!-- First <p> is removed from DOM -->
<p>Please log in.</p>
```

---

### Show-If Binding

Use `:show-if` attribute for more explicit syntax.

**HTML:**
```html
<div id="app">
	<p :show-if=".has_items">Items found!</p>
	<p :show-if="!.has_items">No items.</p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	has_items: true
});
```

**Output:**
```html
<p>Items found!</p>
```

---

### Conditional with Array Length

Show/hide based on array contents.

**HTML:**
```html
<div id="app">
	<ul .items.length?>
		<li .items[]></li>
	</ul>
	<p !.items.length?>No items yet!</p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	items: []
});
```

**Output when empty:**
```html
<p>No items yet!</p>
```

**After adding items:**
```javascript
app.items.push("First");
```

**Output:**
```html
<ul>
	<li>First</li>
</ul>
```

---

## 5. Events

Bind event handlers using `@event="path"` syntax. Event handlers receive the original event as the first argument and the current scope as their second argument.

### Basic Events

**HTML:**
```html
<div id="app">
	<button @click=".handle_click">Click Me</button>
	<p .message></p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	message: "Not clicked",
	handle_click: (event, context) => {
		context.message = "Button clicked!";
	}
});
```

**Output after click:**
```html
<button>Click Me</button>
<p>Button clicked!</p>
```

---

### Event Context in Loops

The second argument (`context`) provides access to the current item's data.

**HTML:**
```html
<div id="app">
	<ul .items[]>
		<li>
			<span .done?>✅</span>
			<span .name></span>

			<!-- $ refers to the root scope -->
			<button @click="$.finish">Finish</button>
		</li>
	</ul>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	items: [
		{ name: "Task 1", done: false },
		{ name: "Task 2", done: false }
	],
	finish: (e, ctx) => {
		ctx.done = true;
	}
});
```

Each button's handler receives its own item as `ctx`, allowing item-specific actions.

---

### Multiple Events

Attach multiple event handlers to the same element.

**HTML:**
```html
<div id="app">
	<input @input=".on_input" @focus=".on_focus" @blur=".on_blur">
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	on_input: (e) => console.log('Input:', e.target.value),
	on_focus: () => console.log('Focused'),
	on_blur: () => console.log('Blurred')
});
```

---

### Preventing Default Behavior

Use `e.preventDefault()` to prevent default browser actions, such as form submission.

**HTML:**
```html
<div id="app">
	<form @submit=".handle_submit">
		<input name="email" type="email" placeholder="Email">
		<button type="submit">Subscribe</button>
	</form>
	<p .message></p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	email: "",
	message: "",
	handle_submit: (e, ctx) => {
		e.preventDefault();
		ctx.message = `Subscribed: ${ctx.email}`;
	}
});
```

The form submission is intercepted, preventing page reload, and the message is updated with the entered email.

---

## 6. Form Inputs

Vivy provides automatic two-way binding for form inputs.

### Text Inputs

**HTML:**
```html
<div id="app">
	<input .username>
	<p>Hello, <span .username></span>!</p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	username: "alice"
});
```

**Output:**
```html
<!-- Changing the input updates the span automatically -->
<input value="alice">
<p>Hello, <span>alice</span>!</p>
```

Typing in the input automatically updates `app.username` and the `<span>`.

---

### Named Inputs

Inputs with `name` attributes automatically bind to matching data properties.

**HTML:**
```html
<div id="app">
	<input name="email">
	<input name="password" type="password">
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	email: "test@example.com",
	password: ""
});
```

**Output:**
```html
<!-- Changing the inputs updates the `app.email` and `app.password` -->
<input name="email" value="test@example.com">
<input name="password" type="password" value="">
```

---

### Checkboxes

**HTML:**
```html
<div id="app">
	<label>
		<input type="checkbox" .subscribed> Subscribe to newsletter
	</label>
	<p .subscribed?>You are subscribed!</p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	subscribed: false
});

// Checking the box sets app.subscribed = true
```

---

### Group Checkboxes

Bind multiple checkboxes to an array.

**HTML:**
```html
<div id="app">
	<label><input type="checkbox" name="colors" value="red"> Red</label>
	<label><input type="checkbox" name="colors" value="green"> Green</label>
	<label><input type="checkbox" name="colors" value="blue"> Blue</label>
	<p>Selected: <span .colors></span></p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	colors: ["red", "blue"]
});
```

**Output:**
```html
<!-- Checkbox changes update `app.colors`.  Values are stored in DOM order -->
<label><input type="checkbox" name="colors" value="red" checked> Red</label>
<label><input type="checkbox" name="colors" value="green"> Green</label>
<label><input type="checkbox" name="colors" value="blue" checked> Blue</label>
<p>Selected: <span>red,blue</span></p>
```

---

### Radio Buttons

**HTML:**
```html
<div id="app">
	<label><input type="radio" name="size" value="small"> Small</label>
	<label><input type="radio" name="size" value="medium"> Medium</label>
	<label><input type="radio" name="size" value="large"> Large</label>
	<p>Selected: <span .size></span></p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	size: "medium"
});
```

**Output:**
```html
<label><input type="radio" name="size" value="small"> Small</label>
<label><input type="radio" name="size" value="medium" checked> Medium</label>
<label><input type="radio" name="size" value="large"> Large</label>
<p>Selected: <span>medium</span></p>
```

---

### Select Dropdowns

**HTML:**
```html
<div id="app">
	<select name="country">
		<option value="us">United States</option>
		<option value="uk">United Kingdom</option>
		<option value="ca">Canada</option>
	</select>
	<p>Selected: <span .country></span></p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	country: "uk"
});
```

**Output:**
```html
<select name="country">
	<option value="us">United States</option>
	<option value="uk" selected>United Kingdom</option>
	<option value="ca">Canada</option>
</select>
<p>Selected: <span>uk</span></p>
```

---

### Multiple Select

Add the `multiple` attribute to a select element to bind to an array of values.

**HTML:**
```html
<div id="app">
	<select name="toppings" multiple>
		<option value="cheese">Cheese</option>
		<option value="olives">Olives</option>
		<option value="mushrooms">Mushrooms</option>
	</select>
	<p>Selected: <span .toppings></span></p>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	toppings: ["cheese", "mushrooms"]
});
```

**Output:**
```html
<select name="toppings" multiple>
	<option value="cheese" selected>Cheese</option>
	<option value="olives">Olives</option>
	<option value="mushrooms" selected>Mushrooms</option>
</select>
<p>Selected: <span>cheese,mushrooms</span></p>
```

---

### Typed Inputs

Number and date inputs preserve their types.

**HTML:**
```html
<div id="app">
	<input type="number" name="age">
	<input type="date" name="birthday">
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	age: 25,                         // number type preserved
	birthday: new Date("1995-06-15") // Date object supported
});

// `app.age` remains a number, not a string, when the input changes
```

---

### Assign-To Binding

Use the `:assign-to` attribute to bind an input's value to a specific data property path, bypassing the implicit `name` binding or `.property` class shorthand. This is useful for binding to deep properties or when `name` attributes are reserved or used for other purposes.

**HTML:**
```html
<div id="app">
	<input :assign-to=".user.settings.theme">
	<p>Current Theme: <span .user.settings.theme></span></p>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	user: {
		settings: {
			theme: "dark"
		}
	}
});
```

**Output:**
```html
<input value="dark">
<p>Current Theme: <span>dark</span></p>
```

---

## 7. Templates

Define reusable components with templates.

### Defining and Using Templates

**HTML:**
```html
<div id="app">
	<vivy:template name="card">
		<div class="card">
			<h2 .title></h2>
			<p .content></p>
		</div>
	</vivy:template>

	<t:card :scope=".card1"></t:card>
	<t:card :scope=".card2"></t:card>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	card1: { title: "First Card", content: "Hello!" },
	card2: { title: "Second Card", content: "World!" }
});
```

**Output:**
```html
<div class="card">
	<h2>First Card</h2>
	<p>Hello!</p>
</div>
<div class="card">
	<h2>Second Card</h2>
	<p>World!</p>
</div>
```

---

### Alternative Template Definition

Use `:template` attribute on any element.

**HTML:**
```html
<div id="app">
	<p :template="greeting">Hello, <span .name></span>!</p>

	<t:greeting :scope=".user1"></t:greeting>
	<t:greeting :scope=".user2"></t:greeting>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	user1: { name: "Alice" },
	user2: { name: "Bob" }
});
```

**Output:**
```html
<p>Hello, <span>Alice</span>!</p>
<p>Hello, <span>Bob</span>!</p>
```

---

### Templates with Loops

Combine templates with array iteration.

**HTML:**
```html
<div id="app">
	<vivy:template name="user-row">
		<tr>
			<td .name></td>
			<td .email></td>
		</tr>
	</vivy:template>

	<table>
		<t:user-row .users[]></t:user-row>
	</table>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	users: [
		{ name: "Alice", email: "alice@example.com" },
		{ name: "Bob", email: "bob@example.com" }
	]
});
```

**Output:**
```html
<table>
	<tr><td>Alice</td><td>alice@example.com</td></tr>
	<tr><td>Bob</td><td>bob@example.com</td></tr>
</table>
```

---

### Recursive Templates

Templates can reference themselves for tree structures.

**HTML:**
```html
<div id="app">
	<vivy:template name="tree-node">
		<li>
			<span .name></span>
			<ul .children.length?>
				<t:tree-node .children[]></t:tree-node>
			</ul>
		</li>
	</vivy:template>

	<ul>
		<t:tree-node :scope=".root"></t:tree-node>
	</ul>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	root: {
		name: "Parent",
		children: [
			{ name: "Child 1", children: [] },
			{ name: "Child 2", children: [
				{ name: "Grandchild", children: [] }
			]}
		]
	}
});
```

**Output:**
```html
<ul>
	<li>
		<span>Parent</span>
		<ul>
			<li><span>Child 1</span></li>
			<li>
				<span>Child 2</span>
				<ul>
					<li><span>Grandchild</span></li>
				</ul>
			</li>
		</ul>
	</li>
</ul>
```

---
## 8. Scope Control

The `:scope` attribute (or its shorthand `.path`) allows you to change the data scope for an element and its children.

### Setting Scope

When applied to an element, any child bindings will be relative to that scope. This keeps your HTML clean by avoiding long paths.

**HTML:**
```html
<div id="app">
	<div .user>
		<h2 .name></h2>
		<p .email></p>
	</div>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	user: {
		name: "Alice",
		email: "alice@example.com"
	}
});
```

**Output:**
```html
<div>
	<h2>Alice</h2>
	<p>alice@example.com</p>
</div>
```

---

### Primitive vs Object Binding

Vivy intelligently handles different data types:
- **Objects:** The scope is shifted for children.
- **Primitives (String/Number/etc):** The value is bound to the element's `textContent`.

This dual nature is why `.property` can be used both for [Text Binding](#1-text-binding) AND for creating nested structures.

**HTML:**
```html
<div id="app">
	<!-- Acts as text binding -->
	<p .status></p>

	<!-- Acts as scope control -->
	<div .settings>
		<input type="checkbox" .notifications>
	</div>
</div>
```

---

### Explicit Attribute

While the `.path` shorthand is convenient, you can use the explicit `:scope` attribute for clarity or to avoid conflicts.

**HTML:**
```html
<div :scope=".user.profile">
	<span .bio></span>
</div>
```

---

### Attributes, Conditionals, and Scope

When you set a scope on an element, any [Attribute Bindings](#2-attribute-binding) (like `title.=".prop"`) and [Conditionals](#4-conditionals) (like `!.property?`) on that **same element** are relative to that new scope.

**HTML:**
```html
<div id="app">
	<!-- Attribute and conditional use the .user scope -->
	<div .user title.="`Profile of ${_.name}`" !.enabled?>
		<p .bio></p>
	</div>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	user: {
		name: "Alice",
		bio: "Explorer",
		enabled: true
	}
});
```

**Output:**
```html
<div title="Profile of Alice">
	<p>Explorer</p>
</div>
```

---

## 9. Root Scope

Use `$` to reference the root data object from within nested scopes.

### Accessing Root from Loops

**HTML:**
```html
<div id="app">
	<ul .books[]>
		<li>
			<span .name></span>
			<span>- by <span $.author></span></span>
		</li>
	</ul>
</div>
```

**JavaScript:**
```javascript
vivy(document.getElementById('app'), {
	author: "Arthur",
	books: [
		{ name: "Book 1" },
		{ name: "Book 2" }
	]
});
```

**Output:**
```html
<ul>
	<li><span>Book 1</span><span>- by <span>Arthur</span></span></li>
	<li><span>Book 2</span><span>- by <span>Arthur</span></span></li>
</ul>
```

---

### Root Events in Loops

**HTML:**
```html
<div id="app">
	<ul .items[]>
		<li>
			<span .name></span>
			<button @click="$.remove_item">Remove</button>
		</li>
	</ul>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	items: [
		{ name: "First" },
		{ name: "Second" }
	],
	remove_item: (event, item) => {
		const idx = app.items.indexOf(item);
		app.items.splice(idx, 1);
	}
});
```

The `$.remove_item` accesses the root-level function, while `item` in the callback is still the current loop item.

---

## 10. API Reference

### `vivy(element, data)` / `vivify(element, data)`

Initialize Vivy on an element with data. Returns a reactive proxy.

```javascript
const app = vivy(document.getElementById('app'), { count: 0 });
```

---

### Updating Data

```javascript
// Update properties
app.count = 5;
app.user.name = "Bob";

// Update arrays
app.items.push("new item");
app.items[0] = "updated";

// Replace entire state
app({ count: 10, items: ["a", "b", "c"] });

// Clear state
app(null);
app({});
```

---

### Proxy Features

The proxy supports standard JavaScript operations:

```javascript
// Spread operator
const copy = { ...app };

// JSON serialization
const json = JSON.stringify(app);

// Property checks
'name' in app;      // true if exists
Object.keys(app);   // returns all keys

// Delete properties
delete app.temp_value;
```

---

### Binding Summary

Quick reference for all Vivy bindings. See the corresponding sections for detailed examples.

| Syntax | Description | Example | See Section |
|--------|-------------|---------|-------------|
| `.property` | Text binding | `<p .name></p>` | [Text Binding](#1-text-binding) |
| `attr.=".path"` | Attribute binding | `<a href.=".url">` | [Attribute Binding](#2-attribute-binding) |
| `.property[]` | Array loop | `<li .items[]></li>` | [Loops](#3-loops) |
| `.property?` | Show if truthy | `<p .is_visible?></p>` | [Conditionals](#4-conditionals) |
| `!.property?` | Show if falsy | `<p !.is_hidden?></p>` | [Conditionals](#4-conditionals) |
| `:show-if=".path"` | Conditional binding | `<p :show-if=".active">` | [Conditionals](#4-conditionals) |
| `@event=".handler"` | Event binding | `<button @click=".on_click">` | [Events](#5-events) |
| `name="prop"` | Named input binding | `<input name="email">` | [Form Inputs](#6-form-inputs) |
| `:assign-to=".path"` | Explicit input binding | `<input :assign-to=".user.name">` | [Form Inputs](#6-form-inputs) |
| `:scope=".path"` | Set data scope | `<div :scope=".user">` | [Scope Control](#8-scope-control) |
| `$` | Root scope access | `<span $.global_value></span>` | [Root Scope](#9-root-scope) |
| `` `${_.prop}` `` | Template literal | ``<a href.="`mailto:${_.email}`">link</a>`` | [Attribute Binding](#2-attribute-binding) |

#### Binding Precedence

When multiple binding mechanisms could apply:
1. `:assign-to` (explicit) - highest priority
2. `name` attribute (for form inputs)
3. `.property` class (for text/scope)
4. Default behavior (no binding)

#### Input Binding Types

- **Text inputs**: Binds to string
- **Number inputs**: Binds to number (type preserved)
- **Checkbox (single)**: Binds to boolean
- **Checkbox (group)**: Binds to array of strings
- **Radio**: Binds to string (selected value)
- **Select (single)**: Binds to string
- **Select (multiple)**: Binds to array of strings

---

## 11. Limitations

Due to a browser limitation, HTML attributes are normalized to lowercase. This means that camelCase property names in bindings will be converted to lowercase, which can lead to subtle bugs.

**Example of the problem:**
```html
<!-- This will look for 'username' (lowercase) instead of 'userName' -->
<div .userName></div>
```

**Solution: Use snake_case instead**
```html
<!-- This works correctly -->
<div .user_name></div>
```

**We strongly recommend using snake_case for all property names** in your data model when using Vivy bindings. This ensures consistency and avoids attribute normalization issues.

```javascript
// ✅ Recommended: snake_case
const app = vivy(document.getElementById('app'), {
	user_name: "Alice",
	is_logged_in: true,
	handle_click: () => { /* ... */ }
});

// ❌ Avoid: camelCase (may cause bugs)
const app = vivy(document.getElementById('app'), {
	userName: "Alice",      // Attribute becomes 'username'
	isLoggedIn: true,       // Attribute becomes 'isloggedin'
	handleClick: () => { /* ... */ }  // Attribute becomes 'handleclick'
});
```

If you must use camelCase, you can use `:scope=".camelCase"`, `:show-if=".camelCase?"`, or `:assign-to=".camelCase"`.

**HTML:**
```html
<div :show-if=".isLoggedIn?">
	Welcome back, <span :scope=".userName"></span>!
	<label>
		<input type="checkbox" :assign-to=".isSubscribed"> Subscribe to newsletter
	</label>
</div>
```

**JavaScript:**
```javascript
const app = vivy(document.getElementById('app'), {
	userName: "Alice",
	isLoggedIn: true,
	isSubscribed: false
});
```

**Output:**
```html
<div>
	Welcome back, <span>Alice</span>!
	<label>
		<input type="checkbox" value="false"> Subscribe to newsletter
	</label>
</div>
```

You can also use `kebob-case` too, if you'd like

---

### Other Caveats

- **Map and Set:** `Map` and `Set` objects are not fully supported.
- **Getters/Setters:** Function setters and getters are not supported.
- **Proxy Mutation:** Always modify the *proxy* returned by `vivy()`, not the original data object. Changes to the original object will not trigger DOM updates.
- **Recursion Limit:** To prevent infinite loops (e.g. recursive templates), Vivy limits template insertions to 10,000 per update.
- **Unique Names:** Template names must be unique. Defining two templates with the same name will throw an error.
- **Manual DOM Manipulation:** Avoid manipulating the DOM manually within Vivy-controlled elements. Vivy will overwrite manual changes during updates.
