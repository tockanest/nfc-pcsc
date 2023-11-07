import pcsc from "@pokusew/pcsclite";
import { EventEmitter } from "events";
import ACR122 from "./utils/readers/ACR122";
import Reader from "./utils/readers/Reader";

type PCSCEvents = {
	reader: ACR122 | Reader;
	error: Error;
};

export type Card = {
	atr: Buffer;
	standard: string;
	uid: string;
	data?: Buffer;
};

import { KEYS, MODES, TAGS } from "./utils/readers/helpers/TMK";
export { Reader, ACR122, KEYS, MODES, TAGS };

export default class PCSC extends EventEmitter {
	private pcsc = pcsc();

	constructor() {
		super();

		this.pcsc.on("reader", (reader) => {
			if (
				reader.name.toLowerCase().indexOf("acr122") !== -1 ||
				reader.name.toLowerCase().indexOf("acr125") !== -1
			) {
				const device = new ACR122(reader);
				this.emit("reader", device);
				return;
			}

			const device = new Reader(reader);
			this.emit("reader", device);
		});

		this.pcsc.on("error", (err) => {
			this.emit("error", err);
		});
	}

	on<K extends keyof PCSCEvents>(
		event: K,
		listener: (v: PCSCEvents[K]) => void
	): this {
		return super.on(event, listener);
	}

	emit<K extends keyof PCSCEvents>(event: K, arg: PCSCEvents[K]): boolean {
		return super.emit(event, arg);
	}

	get readers() {
		//@ts-ignore: This does exist, but it's not in the typings for some reason
		return this.pcsc.readers;
	}

	close() {
		try {
			this.pcsc.close();
			return true;
		} catch (error: any) {
			throw new Error(error.message);
		}
	}
}
