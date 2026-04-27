import assert from "node:assert/strict";
import EventEmitter from "node:events";
import test from "node:test";
import type { Card } from "../src";
import Reader from "../src/utils/readers/Reader";
import { KEYS, TAGS } from "../src/utils/readers/helpers/TMK";
import { CardReader } from "../src/utils/readers/Reader.typings";

type Transmit = {
	data: Buffer;
	responseMaxLength: number;
	protocol: number;
};

class MockCardReader extends EventEmitter implements CardReader {
	SCARD_SHARE_SHARED = 2;
	SCARD_SHARE_EXCLUSIVE = 1;
	SCARD_SHARE_DIRECT = 3;
	SCARD_PROTOCOL_T0 = 1;
	SCARD_PROTOCOL_T1 = 2;
	SCARD_PROTOCOL_RAW = 4;
	SCARD_STATE_UNAWARE = 0;
	SCARD_STATE_IGNORE = 1;
	SCARD_STATE_CHANGED = 2;
	SCARD_STATE_UNKNOWN = 4;
	SCARD_STATE_UNAVAILABLE = 8;
	SCARD_STATE_EMPTY = 16;
	SCARD_STATE_PRESENT = 32;
	SCARD_STATE_ATRMATCH = 64;
	SCARD_STATE_EXCLUSIVE = 128;
	SCARD_STATE_INUSE = 256;
	SCARD_STATE_MUTE = 512;
	SCARD_LEAVE_CARD = 0;
	SCARD_RESET_CARD = 1;
	SCARD_UNPOWER_CARD = 2;
	SCARD_EJECT_CARD = 3;
	IOCTL_CCID_ESCAPE = 0;
	name = "Mock PC/SC reader";
	state = this.SCARD_STATE_EMPTY;
	connected = false;
	transmits: Transmit[] = [];

	private responses: Buffer[] = [];

	constructor(private readonly atr: Buffer) {
		super();
	}

	queueResponse(response: Buffer) {
		this.responses.push(response);
	}

	present() {
		this.emit("status", {
			state: this.SCARD_STATE_PRESENT,
			atr: this.atr,
		});
		this.state = this.SCARD_STATE_PRESENT;
	}

	SCARD_CTL_CODE(code: number): number {
		return code;
	}

	get_status(cb: (err: null, state: number, atr?: Buffer) => void): void {
		cb(null, this.state, this.atr);
	}

	connect(...args: any[]): void {
		const callback = args.at(-1);
		this.connected = true;
		callback(null, this.SCARD_PROTOCOL_T1);
	}

	disconnect(...args: any[]): void {
		const callback = args.at(-1);
		this.connected = false;
		callback(null);
	}

	transmit(
		data: Buffer,
		responseMaxLength: number,
		protocol: number,
		cb: (err: null, response: Buffer) => void
	): void {
		this.transmits.push({ data, responseMaxLength, protocol });
		cb(null, this.responses.shift() ?? Buffer.from([0x90, 0x00]));
	}

	control(
		_data: Buffer,
		_controlCode: number,
		_resLen: number,
		cb: (err: null, response: Buffer) => void
	): void {
		cb(null, Buffer.from([0x90, 0x00]));
	}

	close(): void {}
}

const waitForCard = (reader: Reader) =>
	new Promise<Card>((resolve) => reader.once("card", resolve));

test("detects a MIFARE-style ISO 14443-3 tag and supports block read/write", async () => {
	const mock = new MockCardReader(Buffer.from([0x3b, 0x00, 0x00, 0x00, 0x00, 0x4f]));
	const reader = new Reader(mock);

	mock.queueResponse(Buffer.from([0x04, 0xa1, 0xb2, 0xc3, 0x90, 0x00]));
	const cardPromise = waitForCard(reader);
	mock.present();
	const card = await cardPromise;

	assert.equal(card.standard, TAGS.ISO_14443_3);
	assert.equal(card.uid, "04a1b2c3");
	assert.deepEqual(mock.transmits[0].data, Buffer.from([0xff, 0xca, 0x00, 0x00, 0x00]));

	mock.queueResponse(Buffer.from([0x90, 0x00]));
	mock.queueResponse(Buffer.from([0x90, 0x00]));
	await reader.authenticate(4, KEYS.KEY_TYPE_A, "FFFFFFFFFFFF");

	assert.deepEqual(
		mock.transmits[1].data,
		Buffer.from([0xff, 0x82, 0x00, 0x00, 0x06, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
	);
	assert.deepEqual(
		mock.transmits[2].data,
		Buffer.from([0xff, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 0x04, KEYS.KEY_TYPE_A, 0x00])
	);

	const payload = Buffer.from("hello mifare tag!");
	mock.queueResponse(Buffer.concat([payload, Buffer.from([0x90, 0x00])]));
	assert.deepEqual(await reader.read(4, 16), payload);
	assert.deepEqual(mock.transmits[3].data, Buffer.from([0xff, 0xb0, 0x00, 0x04, 0x10]));

	const writeData = Buffer.from("write mifare tag");
	mock.queueResponse(Buffer.from([0x90, 0x00]));
	assert.equal(await reader.write(4, writeData, 16), true);
	assert.deepEqual(
		mock.transmits[4].data,
		Buffer.concat([Buffer.from([0xff, 0xd6, 0x00, 0x04, 0x10]), writeData])
	);
});

test("emits ISO 14443-4 tags normally when no mobile AID is configured", async () => {
	const mock = new MockCardReader(Buffer.from([0x3b, 0x00, 0x00, 0x00, 0x00, 0x00]));
	const reader = new Reader(mock);

	const cardPromise = waitForCard(reader);
	mock.present();
	const card = await cardPromise;

	assert.equal(card.standard, TAGS.ISO_14443_4);
	assert.equal(mock.transmits.length, 0);
});

test("selects Android HCE AID and exposes the phone response payload", async () => {
	const mock = new MockCardReader(Buffer.from([0x3b, 0x00, 0x00, 0x00, 0x00, 0x00]));
	const reader = new Reader(mock);
	reader.aid = "F222222222";

	const phonePayload = Buffer.from("hello from phone");
	mock.queueResponse(Buffer.concat([phonePayload, Buffer.from([0x90, 0x00])]));

	const cardPromise = waitForCard(reader);
	mock.present();
	const card = await cardPromise;

	assert.equal(card.standard, TAGS.ISO_14443_4);
	assert.deepEqual(card.data, phonePayload);
	assert.deepEqual(
		mock.transmits[0].data,
		Buffer.from([0x00, 0xa4, 0x04, 0x00, 0x05, 0xf2, 0x22, 0x22, 0x22, 0x22, 0x00])
	);
	assert.equal(mock.transmits[0].responseMaxLength, 40);
});
