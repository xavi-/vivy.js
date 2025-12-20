/** biome-ignore-all lint/correctness/noUnusedVariables: false positive */
async function runTest(name, fn) {
	try {
		console.log(`RUNNING: ${name}`);
		const container = await fn();
		console.log(`PASS: ${name}`);
		const target = container instanceof HTMLElement ? container : document.body;
		target.insertAdjacentHTML(
			"beforeend",
			`<div style="color:green; font-weight:bold; margin: 4px 0; display: block;">PASS: ${name}</div>`,
		);
	} catch (e) {
		console.error(`FAIL: ${name}`, e);
		document.body.insertAdjacentHTML(
			"beforeend",
			`<div style="color:red; font-weight:bold; margin: 4px 0; display: block;">FAIL: ${name} - ${e.message}</div>`,
		);
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
