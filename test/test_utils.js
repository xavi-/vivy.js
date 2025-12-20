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

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
