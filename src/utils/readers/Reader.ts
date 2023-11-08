"use strict";

import EventEmitter from "events";
import {
	GetUIDError,
	ERRORS,
	ConnectError,
	DisconnectError,
	TransmitError,
	ControlError,
	LoadAuthenticationKeyError,
	WriteError,
	AuthenticationError,
	ReadError,
} from "../errors";

import { TAGS, MODES } from "./helpers/TMK";
import { CardReader } from "./Reader.typings";
import { Card } from "../..";

type ReaderEvents = {
	card: Card;
	"card.on": Card;
	"card.off": Card;
	error: Error;
	end: void;
};

export default class Reader extends EventEmitter {
	protected reader: CardReader;
	private connection?: {
		type?: number;
		protocol: number;
	} | null;
	private card?: {
		atr: Buffer;
		standard: string;
		uid?: string;
		data?: Buffer;
	} | null;
	private _aid?: Buffer | Function | string;
	private keyStorage: {
		[key: number]: any;
	} = {
		"0": null,
		"1": null,
	};

	on<K extends keyof ReaderEvents>(
		event: K,
		listener: (v: ReaderEvents[K]) => void
	): this {
		return super.on(event, listener);
	}

	emit<K extends keyof ReaderEvents>(
		event: K,
		arg: ReaderEvents[K]
	): boolean {
		return super.emit(event, arg);
	}

	static selectStandardByAtr(atr: Buffer) {
		return atr[5] === 0x4f ? TAGS.ISO_14443_3 : TAGS.ISO_14443_4;
	}

	private async processIso14443_3Tag() {
		if (!this.card || !this.connection) return;
		const packet = Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]);
		this.reader.transmit(
			packet,
			12,
			this.connection.protocol,
			(err, response) => {
				if (err) {
					this.emitError(
						new GetUIDError(ERRORS.OPERATION_FAILED, err)
					);
					return;
				}

				if (response && response.length >= 2) {
					const statusCode = response.readUInt16BE(
						response.length - 2
					);
					if (statusCode === 0x9000) {
						console.log(this.card);
						this.card!.uid = response
							.subarray(0, response.length - 2)
							.toString("hex");
						this.emit("card", { ...this.card! });
					} else {
						this.emitError(
							new GetUIDError(
								ERRORS.OPERATION_FAILED,
								"Could not get card UID."
							)
						);
					}
				} else {
					this.emitError(
						new GetUIDError(
							"invalid_response",
							"Invalid response length. Expected minimum length is 2 bytes."
						)
					);
				}
			}
		);
	}

	private async processIso14443_4Tag() {
		if (!this.card || !this.connection || !this.aid) return;
		const aid =
			typeof this.aid === "function" ? this.aid(this.card) : this.aid;
		const packet = Buffer.from([
			0x00,
			0xa4,
			0x04,
			0x00,
			aid.length,
			...aid,
			0x00,
		]);
		this.reader.transmit(
			packet,
			packet.length,
			this.connection.protocol,
			(err, response) => {
				if (response && response.length >= 2) {
					const statusCode = response.readUInt16BE(
						response.length - 2
					);
					if (statusCode === 0x9000) {
						this.emit("card", {
							...this.card!,
							data: response.subarray(0, response.length - 2),
						});
					} else {
						this.emitError(new Error(`Response status error.`));
					}
				} else {
					this.emitError(
						new Error(
							"Invalid response length. Expected minimum length is 2 bytes."
						)
					);
				}
			}
		);
	}

	private emitError(error: Error) {
		this.emit("error", error);
	}

	get aid() {
		return this._aid;
	}

	set aid(value) {
		if (typeof value === "function" || Buffer.isBuffer(value)) {
			this._aid = value;
		} else if (typeof value === "string") {
			this._aid = Buffer.from(value, "hex");
		} else {
			throw new Error(
				"AID must be a HEX string, an instance of Buffer, or a function."
			);
		}
	}

	get name() {
		return this.reader.name;
	}

	constructor(reader: CardReader) {
		super();
		this.reader = reader;
		this.reader.on("error", this.emitError.bind(this));
		this.reader.on("status", (status) => {
			const getChange = this.reader.state ^ status.state;
			if (
				getChange & this.reader.SCARD_STATE_EMPTY &&
				status.state & this.reader.SCARD_STATE_EMPTY
			) {
				this.card && this.emit("card.off", { ...this.card });
				this.card = null;
				this.connection &&
					this.reader.disconnect((err) => {
						err && this.emitError(err);
						this.connection = null;
					});
			} else if (
				getChange & this.reader.SCARD_STATE_PRESENT &&
				status.state & this.reader.SCARD_STATE_PRESENT
			) {
				this.card = {
					atr: status.atr!,
					standard: Reader.selectStandardByAtr(status.atr!),
				};
				this.reader.connect((err, protocol) => {
					if (err) {
						this.emitError(err);
						return;
					}
					this.connection = { protocol };
					this.emit("card.on", { ...this.card! });
					this.card!.standard === TAGS.ISO_14443_3
						? this.processIso14443_3Tag()
						: this.processIso14443_4Tag();
				});
			}
		});
		this.reader.on("end", () => {
			this.emit("end", undefined);
		});
	}

	public connect(mode = MODES.CARD) {
		const modes = {
			[MODES.DIRECT]: this.reader.SCARD_SHARE_DIRECT,
			[MODES.CARD]: this.reader.SCARD_SHARE_SHARED,
		};

		if (!modes[mode]) {
			throw new ConnectError("invalid_mode", "Invalid mode");
		}

		return new Promise((resolve, reject) => {
			this.reader.connect(
				{
					share_mode: modes[mode],
					protocol:
						mode === MODES.DIRECT
							? 0
							: //@ts-ignore: Property 'SCARD_PROTOCOL_UNDEFINED' does not exist on type 'CardReader'. It is being used on the original library though, so I'll keep it.
							  this.reader.SCARD_PROTOCOL_UNDEFINED,
				},
				(err, protocol) => {
					if (err) {
						const error = new ConnectError(
							ERRORS.FAILURE,
							"An error occurred while connecting.",
							err
						);

						return reject(error);
					}

					this.connection = {
						type: modes[mode],
						protocol: protocol,
					};

					return resolve(this.connection);
				}
			);
		});
	}

	public disconnect() {
		if (!this.connection) {
			throw new DisconnectError(
				"not_connected",
				"Reader in not connected. No need for disconnecting."
			);
		}

		return new Promise((resolve, reject) => {
			this.reader.disconnect(this.reader.SCARD_LEAVE_CARD, (err) => {
				if (err) {
					const error = new DisconnectError(
						ERRORS.FAILURE,
						"An error occurred while disconnecting.",
						err
					);
					return reject(error);
				}

				this.connection = null;

				return resolve(true);
			});
		});
	}

	public transmit(data: Buffer, responseMaxLength: number) {
		return new Promise((resolve, reject) => {
			if (!this.card || !this.connection) {
				throw new TransmitError(
					ERRORS.CARD_NOT_CONNECTED,
					"No card or connection available."
				);
			}
			this.reader.transmit(
				data,
				responseMaxLength,
				this.connection.protocol,
				(err, response) => {
					if (err) {
						const error = new TransmitError(
							ERRORS.FAILURE,
							"An error occurred while transmitting.",
							err
						);
						return reject(error);
					}

					return resolve(response);
				}
			);
		});
	}

	public control(data: Buffer, responseMaxLength: number): Promise<Buffer> {
		if (!this.connection) {
			throw new ControlError("not_connected", "No connection available.");
		}

		return new Promise<Buffer>((resolve, reject) => {
			this.reader.control(
				data,
				// @ts-ignore: Property 'IOCTL_CCID_ESCAPE' does not exist on type 'CardReader'. It is being used on the original library though: https://github.com/pokusew/nfc-pcsc/blob/877e83db9c2ea41e344f6fd04209e41672677875/src/Reader.js#L325
				this.reader.IOCTL_CCID_ESCAPE,
				responseMaxLength,
				(err: Error, response: Buffer) => {
					if (err) {
						const error = new ControlError(
							ERRORS.FAILURE,
							"An error occurred while transmitting control.",
							err.message
						);
						return reject(error);
					}

					return resolve(response);
				}
			);
		});
	}

	public async loadAuthenticationKey(
		keyNumber: number,
		key:
			| Buffer
			| WithImplicitCoercion<string>
			| { [Symbol.toPrimitive](hint: "string"): string }
	) {
		if (!(keyNumber === 0 || keyNumber === 1)) {
			throw new LoadAuthenticationKeyError("invalid_key_number");
		}

		if (!Buffer.isBuffer(key) && !Array.isArray(key)) {
			if (typeof key !== "string") {
				throw new LoadAuthenticationKeyError(
					"invalid_key",
					"Key must an instance of Buffer or an array of bytes or a string."
				);
			}

			key = Buffer.from(key, "hex");
		}

		if (key.length !== 6) {
			throw new LoadAuthenticationKeyError(
				"invalid_key",
				"Key length must be 6 bytes."
			);
		}

		// CMD: Load Authentication Keys
		const packet = Buffer.from([
			0xff, // Class
			0x82, // INS
			0x00, // P1: Key Structure (0x00 = Key is loaded into the reader volatile memory.)
			keyNumber, // P2: Key Number (00h ~ 01h = Key Location. The keys will disappear once the reader is disconnected from the PC)
			key.length, // Lc: Length of the key (6)
			...key, // Data In: Key (6 bytes)
		]);

		let response: any;

		try {
			response = await this.transmit(packet, 2);

			const statusCode = response.readUInt16BE(0);

			if (statusCode !== 0x9000) {
				throw new LoadAuthenticationKeyError(
					ERRORS.OPERATION_FAILED,
					`Load authentication key operation failed: Status code: ${statusCode}`
				);
			}

			this.keyStorage[keyNumber] = key;

			return keyNumber;
		} catch (err: any) {
			throw new LoadAuthenticationKeyError(err.message, err.message, err);
		}
	}

	private keyToString(
		key:
			| number
			| Buffer
			| WithImplicitCoercion<string>
			| { [Symbol.toPrimitive](hint: "string"): string }
	): string {
		if (Buffer.isBuffer(key)) {
			return key.toString("hex");
		} else if (typeof key === "number") {
			return key.toString();
		} else if (typeof key === "string") {
			return key;
		} else {
			// Use Symbol.toPrimitive to get a string representation
			return (key as { [Symbol.toPrimitive](hint: "string"): string })[
				Symbol.toPrimitive
			]("string");
		}
	}

	private pendingLoadAuthenticationKey: {
		[key: string]: Promise<number>;
	} = {};

	async authenticate(
		blockNumber: number,
		keyType: number,
		key:
			| number
			| Buffer
			| WithImplicitCoercion<string>
			| { [Symbol.toPrimitive](hint: "string"): string },
		obsolete = false
	) {
		const keyStr = this.keyToString(key);

		let keyNumber = Object.keys(this.keyStorage).find(
			(n) => this.keyStorage[parseInt(n)] === keyStr
		);

		if (!keyNumber) {
			if (!this.pendingLoadAuthenticationKey[keyStr]) {
				keyNumber = Object.keys(this.keyStorage)[0];
				if (this.keyStorage[parseInt(keyNumber)] !== null) {
					const freeNumber = Object.keys(this.keyStorage).find(
						(n) => this.keyStorage[parseInt(n)] === null
					);
					if (freeNumber) {
						keyNumber = freeNumber;
					}
				}
				this.pendingLoadAuthenticationKey[keyStr] =
					this.loadAuthenticationKey(
						parseInt(keyNumber),
						key as
							| Buffer
							| WithImplicitCoercion<string>
							| { [Symbol.toPrimitive](hint: "string"): string }
					);
			}

			try {
				keyNumber = Object.keys(this.keyStorage)[0].toString();
			} catch (err: any) {
				throw new AuthenticationError(
					"unable_to_load_key",
					"Could not load authentication key into reader.",
					err.previousError
				);
			} finally {
				delete this.pendingLoadAuthenticationKey[keyStr];
			}
		}

		const packet = !obsolete
			? Buffer.from([
					0xff,
					0x86,
					0x00,
					0x00,
					0x05,
					0x01,
					0x00,
					blockNumber,
					keyType,
					Number(keyNumber),
			  ])
			: Buffer.from([
					0xff,
					0x88,
					0x00,
					blockNumber,
					keyType,
					Number(keyNumber),
			  ]);

		let response: any;

		try {
			response = await this.transmit(packet, 2);
		} catch (err: any) {
			throw new AuthenticationError(
				"AUTH_ERR",
				err.message,
				err.previousError
			);
		}

		const statusCode = response.readUInt16BE(0);

		if (statusCode !== 0x9000) {
			throw new AuthenticationError(
				ERRORS.OPERATION_FAILED,
				`Authentication operation failed: Status code: 0x${statusCode.toString(
					16
				)}`
			);
		}

		return true;
	}

	async read(
		blockNumber: number,
		length: number,
		blockSize = 4,
		packetSize = 16,
		readClass = 0xff
	): Promise<Buffer> {
		if (!this.card) {
			throw new ReadError(ERRORS.CARD_NOT_CONNECTED);
		}

		if (length > packetSize) {
			const p = Math.ceil(length / packetSize);

			const commands: any[] = [];

			for (let i = 0; i < p; i++) {
				const block = blockNumber + (i * packetSize) / blockSize;

				const size =
					(i + 1) * packetSize < length
						? packetSize
						: length - i * packetSize;

				commands.push(
					this.read(block, size, blockSize, packetSize, readClass)
				);
			}

			return Promise.all(commands).then((values) => {
				return Buffer.concat(values, length);
			});
		}

		// APDU CMD: Read Binary Blocks
		const packet = Buffer.from([
			readClass, // Class
			0xb0, // Ins
			(blockNumber >> 8) & 0xff, // P1
			blockNumber & 0xff, // P2: Block Number
			length, // Le: Number of Bytes to Read (Maximum 16 bytes)
		]);

		let response: any = null;

		try {
			response = await this.transmit(packet, length + 2);
		} catch (err: any) {
			throw new ReadError(ERRORS.FAILURE, err.message, err.previousError);
		}

		if (response.length < 2) {
			throw new ReadError(
				ERRORS.OPERATION_FAILED,
				`Read operation failed: Invalid response length ${response.length}. Expected minimal length is 2 bytes.`
			);
		}

		const statusCode = response.slice(-2).readUInt16BE(0);

		if (statusCode !== 0x9000) {
			throw new ReadError(
				ERRORS.OPERATION_FAILED,
				`Read operation failed: Status code: 0x${statusCode.toString(
					16
				)}`
			);
		}

		const data = response.slice(0, -2);

		return data;
	}

	async write(
		blockNumber: number,
		data: Uint8Array,
		blockSize = 4
	): Promise<boolean> {
		if (!this.card) {
			throw new WriteError(ERRORS.CARD_NOT_CONNECTED);
		}

		if (data.length < blockSize || data.length % blockSize !== 0) {
			throw new WriteError(
				"invalid_data_length",
				"Invalid data length. You can only update the entire data block(s)."
			);
		}

		if (data.length > blockSize) {
			const p = data.length / blockSize;

			const commands: any[] = [];

			for (let i = 0; i < p; i++) {
				const block = blockNumber + i;

				const start = i * blockSize;
				const end = (i + 1) * blockSize;

				const part = data.slice(start, end);

				commands.push(this.write(block, part, blockSize));
			}

			return Promise.all(commands).then((values) => {
				return values.every((v) => v);
			});
		}

		// APDU CMD: Update Binary Block
		const packetHeader = Buffer.from([
			0xff, // Class
			0xd6, // Ins
			0x00, // P1
			blockNumber, // P2: Block Number
			blockSize, // Le: Number of Bytes to Update
		]);

		const packet = Buffer.concat([packetHeader, data]);

		let response: any = null;

		try {
			response = await this.transmit(packet, 2);
		} catch (err: any) {
			throw new WriteError(
				ERRORS.FAILURE,
				err.message,
				err.previousError
			);
		}

		if (response.length < 2) {
			throw new WriteError(
				ERRORS.OPERATION_FAILED,
				`Write operation failed: Invalid response length ${response.length}. Expected minimal length is 2 bytes.`
			);
		}

		const statusCode = response.slice(-2).readUInt16BE(0);

		if (statusCode !== 0x9000) {
			throw new WriteError(
				ERRORS.OPERATION_FAILED,
				`Write operation failed: Status code: 0x${statusCode.toString(
					16
				)}`
			);
		}

		return true;
	}

	public close() {
		console.log("Closing reader");
		this.reader.close();
	}
}
