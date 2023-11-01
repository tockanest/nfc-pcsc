"use strict";

// #############
// Example: Writing data to NFC cards
// - Compatible with any PC/SC card reader.
// - Primarily demonstrates how to write data to NFC cards like MIFARE Ultralight.
// - What is covered in this example:
//   - Initializing the NFC reader.
//   - Detecting when a card is in proximity.
//   - Authenticating and writing specific data to predetermined blocks on the card.
// - Important: This example demonstrates writing to the card, not reading.
// #############

import PCSC, { KEYS, Reader } from "../src";

// Extract the KEY_TYPE_A constant from the KEYS module, representing the type A authentication key.
const { KEY_TYPE_A } = KEYS;

// This function handles the authentication process for a specific block on the card and writes the specified data to it.
async function authenticateAndWrite(
	reader: Reader,
	block: number,
	data: string
) {
	try {
		// Authenticate the block using the type A key and a predefined key value.
		await reader.authenticate(block, KEY_TYPE_A, "FFFFFFFFFFFF");

		// Prepare the data to be written. We're using a 16-byte buffer and filling it with our data.
		const bufferData = Buffer.allocUnsafe(16);
		bufferData.fill(0); // Initialize the buffer with zeros.
		bufferData.write(data); // Write our data string to the buffer.

		// Write the buffer data to the specified block on the card.
		await reader.write(block, bufferData, 16);
	} catch (error) {
		console.log(`Error writing to block ${block}`, error);
		throw error; // Rethrow the error so that it can be caught and handled by an outer scope, if necessary.
	}
}

(async () => {
	// Instantiate the PCSC object to interface with the NFC card reader.
	const nfc = new PCSC();

	// Event listener for detecting an NFC reader.
	//Reader can be type of ACR122 or Reader, so if you have a ACR122U/ACR1252U you can use the ACR122 type, otherwise use the Reader type.
	//import { ACR122 } from "../src/index";
	//nfc.on("reader", (reader: ACR122) => {...})

	//import { Reader } from "../src/index";
	//nfc.on("reader", (reader: Reader) => {...})
	nfc.on("reader", async (reader) => {
		// Event listener for detecting when a card is in proximity to the reader.
		reader.on("card", async () => {
			try {
				// Authenticate and write specific data to several blocks on the card.
				await authenticateAndWrite(reader, 4, "123456789123456");
				await authenticateAndWrite(reader, 5, "Nixy");
				await authenticateAndWrite(reader, 6, "Tocka");
				await authenticateAndWrite(reader, 8, "xxxxxxxxxxx");

				reader.close(); // Close the reader after completing the write operations.
				console.log("Write success"); // Log a message to indicate a successful write operation.
			} catch (error) {
				console.log("Write error", error); // Log any error that might occur during the write process.
			}
		});

		// Event listener for handling errors that are specific to the reader.
		reader.on("error", (err) => {
			console.log("Reader error", err);
		});
	});

	// Global event listener to catch any other NFC-related errors.
	nfc.on("error", (err) => {
		console.log("NFC error", err);
		throw err; // Rethrow the error to halt further execution or to be caught by a potential outer error handler.
	});
})();
