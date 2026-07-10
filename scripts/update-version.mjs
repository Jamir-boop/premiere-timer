#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function relativePath(path) {
	return relative(root, path).replaceAll('\\', '/');
}

async function collectWrites(newVersion) {
	const writes = [];

	const pkgContent = await readFile(pkgPath, 'utf8');
	const pkg = JSON.parse(pkgContent);
	const currentVersion = pkg.version;

	if (currentVersion !== newVersion) {
		pkg.version = newVersion;
		writes.push({
			path: pkgPath,
			content: `${JSON.stringify(pkg, null, 2)}\n`,
			from: currentVersion,
		});
	}

	return { currentVersion, writes };
}

async function confirm(currentVersion, newVersion, writes) {
	console.log(`Current version: ${currentVersion}`);
	console.log(`New version:     ${newVersion}`);
	console.log('Files:');
	writes.forEach((write) => {
		const suffix = write.from ? ` (${write.from} -> ${newVersion})` : '';
		console.log(`- ${relativePath(write.path)}${suffix}`);
	});

	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question('Proceed? [y/N] ');
		return answer.toLowerCase() === 'y';
	} finally {
		rl.close();
	}
}

async function main() {
	const newVersion = process.argv[2];

	if (!newVersion || !SEMVER_RE.test(newVersion)) {
		console.error('Usage: node scripts/update-version.mjs <semver>');
		console.error('Example: node scripts/update-version.mjs 1.10.8');
		process.exit(1);
	}

	const { currentVersion, writes } = await collectWrites(newVersion);
	if (!writes.length) {
		console.log(`Already at version ${newVersion}`);
		return;
	}

	if (!(await confirm(currentVersion, newVersion, writes))) {
		console.log('Aborted');
		process.exit(2);
	}

	await Promise.all(writes.map((write) => writeFile(write.path, write.content)));
	console.log(`Updated ${writes.length} file(s) to ${newVersion}`);
}

main().catch((error) => {
	console.error('Error:', error.message);
	process.exit(3);
});
