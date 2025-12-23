export interface BlobStore {
	putTemp(data: Request): Promise<string>;
	putPermanent(cid: string, data: Request): Promise<void>;

	makePermanent(tempKey: string, cid: string): Promise<void>;

	hasTemp(tempKey: string): Promise<boolean>;
	hasPermanent(cid: string): Promise<boolean>;

	getBlob(cid: string): Promise<Blob>;

	delete(cid: string): Promise<void>;
	deleteMany(cid: string[]): Promise<void>;
}
