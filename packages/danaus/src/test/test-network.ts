import { TestPlc } from '@danaus/dev-env';

import { SeedClient } from './seed-client.ts';
import { TestPds, type TestPdsConfig } from './test-pds.ts';

export interface PlcConfig {
	port?: number;
	version?: string;
}

export interface TestNetworkConfig {
	plc?: PlcConfig;
	pds?: Partial<TestPdsConfig>;
}

/**
 * test network with just PLC + PDS (no appview).
 * useful for sequencer and core functionality tests.
 */
export class TestNetworkNoAppView implements AsyncDisposable {
	constructor(
		public plc: TestPlc,
		public pds: TestPds,
		private disposables: AsyncDisposableStack,
	) {}

	static async create(cfg: TestNetworkConfig = {}): Promise<TestNetworkNoAppView> {
		await using stack = new AsyncDisposableStack();

		const plc = await TestPlc.create(cfg.plc ?? {});
		stack.use(plc);

		const pds = await TestPds.create({
			plcUrl: plc.url,
			...cfg.pds,
		});
		stack.use(pds);

		return new TestNetworkNoAppView(plc, pds, stack.move());
	}

	async dispose(): Promise<void> {
		await this.disposables.disposeAsync();
	}

	async [Symbol.asyncDispose]() {
		await this.dispose();
	}

	/**
	 * process background work.
	 */
	async processAll(): Promise<void> {
		await this.pds.processAll();
	}

	/**
	 * close network resources.
	 */
	async close(): Promise<void> {
		await this.dispose();
	}

	/**
	 * gets a seed client for creating test data.
	 * @returns seed client instance
	 */
	getSeedClient(): SeedClient {
		return new SeedClient(this, this.pds.adminAuth());
	}
}
