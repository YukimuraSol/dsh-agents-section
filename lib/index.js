import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import z from "@deepseek-ai/schemastery";

/** Cordis plugin name. */
const name = "agents-section";

/** The prompt registry this row contributes to. */
const inject = ["systemPrompt"];

/**
 * Runtime schema for the AGENTS.md section row.
 *
 * `files` entries take two shapes:
 * - an absolute path (kept for backwards compatibility) is rendered for every
 *   session, exactly as before;
 * - a bare name such as `AGENTS.md` is resolved *per session* against the
 *   session's own working directory, so each workspace sees only its own file.
 */
const Config = z.object({
	order: z.number().default(400),
	sectionName: z.string().default("agents:instructions"),
	files: z.array(z.string()).default([]),
});

/**
 * Marker names that stop the upward directory walk.
 *
 * Mirrors `@deepseek-ai/dsh-agent-instructions`: the project root is the
 * nearest ancestor holding a marker, and when no ancestor has one the chain is
 * just the session's own directory. That is what keeps a session working in one
 * workspace from ever picking up a sibling workspace's AGENTS.md.
 * ponytail: `.git` only; add a `projectRootMarkers` config if a repo ever
 * needs another marker.
 */
const PROJECT_ROOT_MARKERS = [".git"];

/** Read one absolute path, or undefined when it is missing/unreadable/blank. */
function readInstructions(path) {
	try {
		const text = readFileSync(path, "utf8");
		if (text.trim().length === 0) return undefined;
		return `Instructions from: ${path}\n\n${text}`;
	} catch {
		return undefined;
	}
}

/**
 * Nearest ancestor of `cwd` that contains a project-root marker.
 * @param cwd - absolute session working directory.
 * @returns that ancestor, or `cwd` itself when no ancestor has a marker.
 */
function projectRootOf(cwd) {
	let current = resolve(cwd);
	for (;;) {
		for (const marker of PROJECT_ROOT_MARKERS) {
			if (existsSync(join(current, marker))) return current;
		}
		const parent = dirname(current);
		if (parent === current) return resolve(cwd);
		current = parent;
	}
}

/**
 * Inclusive root-to-cwd directory chain.
 * @param root - project root expected to contain or equal `cwd`.
 * @param cwd - most-specific directory in the chain.
 * @returns directories ordered from broadest to most specific.
 */
function chainOf(root, cwd) {
	const chain = [];
	let current = resolve(cwd);
	const stop = resolve(root);
	for (;;) {
		chain.push(current);
		if (current === stop) break;
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return chain.reverse();
}

/**
 * The session's current working directory.
 * @param ctx - the plugin context, used for the working-directory service.
 * @param context - this assembly's context (carries the owning agent).
 * @returns the absolute directory, or undefined when no agent owns this assembly.
 */
function cwdOf(ctx, context) {
	const agent = context?.agent;
	if (agent === undefined) return undefined;
	try {
		const directory = ctx.get("workingDirectory");
		if (directory !== undefined && typeof directory.get === "function") {
			return directory.get(agent.session);
		}
	} catch {}
	const header = agent.session?.header?.cwd;
	return typeof header === "string" ? header : undefined;
}

/**
 * Render every configured entry as one section body.
 * @param files - configured absolute paths and/or bare file names.
 * @param cwd - the session's working directory, when known.
 * @returns joined blocks, empty when nothing applies to this session.
 */
function render(files, cwd) {
	const blocks = [];
	const names = [];
	for (const file of files) {
		if (isAbsolute(file)) {
			const block = readInstructions(resolve(file));
			if (block !== undefined) blocks.push(block);
		} else {
			names.push(file);
		}
	}
	if (names.length === 0 || cwd === undefined) return blocks.join("\n\n");
	for (const directory of chainOf(projectRootOf(cwd), cwd)) {
		for (const name of names) {
			const block = readInstructions(join(directory, name));
			if (block !== undefined) blocks.push(block);
		}
	}
	return blocks.join("\n\n");
}

/**
 * Register the AGENTS.md section.
 * @param ctx - the mounting plugin context.
 * @param config - section placement and the instruction files to render.
 */
function apply(ctx, config) {
	const files = config.files ?? [];
	const reported = new Set();
	ctx.effect(() => ctx.systemPrompt.section({
		name: config.sectionName ?? "agents:instructions",
		order: config.order ?? 400,
		text: (context) => {
			const cwd = cwdOf(ctx, context);
			const text = render(files, cwd);
			if (text.length === 0 && cwd !== undefined && !reported.has(cwd)) {
				reported.add(cwd);
				console.debug(`[agents-section] no AGENTS.md applies to ${cwd}`);
			}
			return text;
		},
	}), "agents-section.section()");
}

export { Config, apply, inject, name };
