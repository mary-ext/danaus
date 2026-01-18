import fs from 'node:fs/promises';

import chokidar from 'chokidar';
import { rolldown } from 'rolldown';

const watchMode = process.argv.includes('--watch');

const run = async (): Promise<boolean> => {
	try {
		const inputs = await Array.fromAsync(fs.glob(`src/web/scripts/*.ts`));

		const build = await rolldown({
			input: inputs,
		});

		const { output: _output } = await build.write({
			dir: 'public/',
			minify: watchMode ? 'dce-only' : true,
		});

		console.log(`built ${inputs.length} scripts`);

		return true;
	} catch (err) {
		console.error(err);

		return false;
	}
};

const watch = async () => {
	let isBuilding = false;
	let rerun = false;
	let pendingTimer: NodeJS.Timeout | undefined;

	const rebuild = async () => {
		if (isBuilding) {
			rerun = true;
			return;
		}

		isBuilding = true;
		const success = await run();
		isBuilding = false;

		if (!success) {
			console.error('web assets build failed');
		}

		if (rerun) {
			rerun = false;
			void rebuild();
		}
	};

	const schedule = () => {
		if (pendingTimer) {
			clearTimeout(pendingTimer);
		}
		pendingTimer = setTimeout(() => {
			void rebuild();
		}, 50);
	};

	const watcher = chokidar.watch('src/web/scripts', { ignoreInitial: true, depth: 1 });

	watcher.on('add', schedule);
	watcher.on('change', schedule);
	watcher.on('unlink', schedule);
	watcher.on('error', (err) => {
		console.error('web assets watcher error:', err);
	});

	await run();
	console.log('watching web scripts for changes...');
};

if (watchMode) {
	await watch();
} else {
	const success = await run();
	if (!success) {
		process.exitCode = 1;
	}
}
