import assert from "node:assert/strict";
import test from "node:test";
import type { Card } from "../../src";
import type PCSC from "../../src";
import type Reader from "../../src/utils/readers/Reader";

type HardwareConfig = {
	readerName: string;
	timeoutMs: number;
	mifareKey: string;
	mifareBlock: number;
	mifareWriteText: string;
	phoneAid: string;
	phoneCommand?: Buffer;
	phoneResponseMaxLength: number;
};

const config: HardwareConfig = {
	readerName: process.env.NFC_READER_NAME ?? "ACR122",
	timeoutMs: Number(process.env.NFC_HARDWARE_TIMEOUT_MS ?? 30000),
	mifareKey: process.env.NFC_MIFARE_KEY ?? "FFFFFFFFFFFF",
	mifareBlock: Number(process.env.NFC_MIFARE_BLOCK ?? 4),
	mifareWriteText: process.env.NFC_MIFARE_WRITE_TEXT ?? "nfc-pcsc hw test",
	phoneAid: process.env.NFC_PHONE_AID ?? "F222222222",
	phoneCommand: process.env.NFC_PHONE_COMMAND
		? Buffer.from(process.env.NFC_PHONE_COMMAND, "hex")
		: undefined,
	phoneResponseMaxLength: Number(process.env.NFC_PHONE_RESPONSE_MAX_LENGTH ?? 256),
};

const runHardwareTests = process.env.NFC_HARDWARE_TEST === "1";

const hardwareTest = runHardwareTests ? test : test.skip;

const withTimeout = <T>(promise: Promise<T>, message: string) =>
	new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), config.timeoutMs);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});

const waitForReader = (nfc: PCSC) =>
	withTimeout(
		new Promise<Reader>((resolve, reject) => {
			nfc.on("reader", (reader) => {
				if (reader.name.toLowerCase().includes(config.readerName.toLowerCase())) {
					resolve(reader);
				}
			});
			nfc.on("error", reject);
		}),
		`Timed out waiting for a reader matching "${config.readerName}".`
	);

const waitForCard = (reader: Reader, message: string) =>
	withTimeout(
		new Promise<Card>((resolve, reject) => {
			reader.once("card", resolve);
			reader.once("error", reject);
		}),
		message
	);

const closeNfc = (nfc: PCSC) => {
	try {
		nfc.close();
	} catch {
		// pcsclite may already be closed after hardware errors.
	}
};

hardwareTest("ACR122U reads and writes a MIFARE Classic block", async () => {
	const [{ default: PCSC }, { KEYS, TAGS }] = await Promise.all([
		import("../../src"),
		import("../../src/utils/readers/helpers/TMK"),
	]);
	const nfc = new PCSC();

	try {
		const reader = await waitForReader(nfc);
		reader.autoProcessing = true;

		const card = await waitForCard(
			reader,
			"Timed out waiting for a MIFARE Classic tag. Place the tag on the ACR122U."
		);

		assert.equal(card.standard, TAGS.ISO_14443_3);
		assert.ok(card.uid, "Expected the reader to return a tag UID.");

		await reader.authenticate(config.mifareBlock, KEYS.KEY_TYPE_A, config.mifareKey);

		const original = await reader.read(config.mifareBlock, 16);
		assert.equal(original.length, 16);

		const writeData = Buffer.alloc(16);
		writeData.write(config.mifareWriteText.slice(0, 16), "utf8");

		await reader.write(config.mifareBlock, writeData, 16);
		const written = await reader.read(config.mifareBlock, 16);

		assert.deepEqual(written, writeData);
	} finally {
		closeNfc(nfc);
	}
});

hardwareTest("ACR122U selects an Android HCE AID and can exchange APDUs", async () => {
	const [{ default: PCSC }, { TAGS }] = await Promise.all([
		import("../../src"),
		import("../../src/utils/readers/helpers/TMK"),
	]);
	const nfc = new PCSC();

	try {
		const reader = await waitForReader(nfc);
		reader.aid = config.phoneAid;

		const card = await waitForCard(
			reader,
			"Timed out waiting for an Android HCE phone. Unlock the phone and hold it to the ACR122U."
		);

		assert.equal(card.standard, TAGS.ISO_14443_4);
		assert.ok(card.data, "Expected the phone to return SELECT AID response data.");

		if (config.phoneCommand) {
			const response = await reader.transmit(
				config.phoneCommand,
				config.phoneResponseMaxLength
			);

			assert.ok(
				Buffer.isBuffer(response) && response.length >= 2,
				"Expected a status-word APDU response from the phone."
			);
			assert.equal(response.slice(-2).readUInt16BE(0), 0x9000);
		}
	} finally {
		closeNfc(nfc);
	}
});
