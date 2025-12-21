/** biome-ignore-all lint/correctness/noUnusedVariables: false positive */
async function runTest(name, elem, fn) {
	try {
		console.log(`RUNNING: ${name}`);
		await fn(elem);
		console.log(`PASS: ${name}`);
		elem.insertAdjacentHTML(
			"beforeend",
			`<div style="color:green; font-weight:bold; margin: 4px 0; display: block;">PASS: ${name}</div>`,
		);
	} catch (e) {
		console.log(`FAIL: ${name}`, e);
		elem.insertAdjacentHTML(
			"beforeend",
			`<div style="color:red; font-weight:bold; margin: 4px 0; display: block;">FAIL: ${name} - ${e.message}</div>`,
		);
		document.body.style.backgroundColor = "#fff0f0";
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message || "Assertion failed");
	}
}

function eq(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

window.addEventListener("error", (e) => {
	const message = [e.message, e.filename, e.lineno, e.colno, e.error?.stack]
		.filter(Boolean)
		.join("\n");

	console.error(e);
	document.body.style.backgroundColor = "#fff0f0";
	document.body.insertAdjacentHTML(
		"afterbegin",
		`<div style="color:red; font-weight:bold; margin: 4px 0; display: block;">UNCAUGHT EXCEPTION: ${message}</div>`,
	);
});

window.addEventListener("unhandledrejection", (e) => {
	const message = [e.reason, e.promise, e.reason?.stack].filter(Boolean).join("\n");

	console.error(e);
	document.body.style.backgroundColor = "#fff0f0";
	document.body.insertAdjacentHTML(
		"afterbegin",
		`<div style="color:red; font-weight:bold; margin: 4px 0; display: block;">UNHANDLED REJECTION: ${message}</div>`,
	);
});
