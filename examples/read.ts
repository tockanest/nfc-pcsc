"use strict";

// #############
// Example: Reading data from NFC cards
// - Compatible with any PC/SC card reader.
// - Aimed at reading data from cards like MIFARE Ultralight but should be adaptable to many others.
// - Covered in this example:
//   - Initializing the NFC reader.
//   - Detecting when a card is in proximity.
//   - Authenticating and reading specific blocks from the card.
// - Important: This example demonstrates reading from the card, not writing.
// #############

import PCSC, { KEYS, Card } from "../src";

// Extract the KEY_TYPE_A constant from the KEYS module, which represents the type A authentication key.
const { KEY_TYPE_A } = KEYS;

(async () => {
	// Instantiate a new PCSC object to interface with the NFC card reader.
	const nfc = new PCSC();

	// Set up an event listener for when a new NFC reader is detected.
	//Reader can be type of ACR122 or Reader, so if you have a ACR122U/ACR1252U you can use the ACR122 type, otherwise use the Reader type.
	//import { ACR122 } from "../src/index";
	//nfc.on("reader", (reader: ACR122) => {...})

	//import { Reader } from "../src/index";
	//nfc.on("reader", (reader: Reader) => {...})
	nfc.on("reader", async (reader) => {
		// Set up an event listener for when a card is detected by the reader.
		reader.on("card", async (card: Card) => {
			console.log("Card detected", card);

			try {
				// Function to authenticate and read a specific block from the card.
				async function readBlock(block: number): Promise<string> {
					await reader.authenticate(
						block,
						KEY_TYPE_A,
						"FFFFFFFFFFFF"
					);
					const data = await reader.read(block, 16);
					return data.toString("utf8");
				}

				// Function to fetch data from a predefined set of blocks on the card.
				async function fetchData(): Promise<string[]> {
					// Note that I'm trying to authenticate the blocks in the order 4, 5, 6, 8.
					// Block 7 is not authenticated because normally it's a sector trailer block, which is used for storing access keys and other metadata.
					// You can read more about it here: https://github.com/pokusew/nfc-pcsc/issues/16#issuecomment-304989178
					const blocks = [4, 5, 6, 8];
					const payloads: string[] = [];

					for (const block of blocks) {
						payloads.push(await readBlock(block));
					}

					return payloads;
				}

				console.log("Payload", await fetchData());
				reader.close(); // Close the reader after reading the necessary data.
			} catch (error) {
				console.log("Authentication error", error);
			}
		});

		// Set up an event listener for handling errors related to the reader.
		reader.on("error", (err) => {
			console.log("Error", err);
		});
	});

	// Set up a global event listener for any other NFC-related errors.
	nfc.on("error", (err) => {
		console.log("Error", err);
		throw err;
	});
})();
