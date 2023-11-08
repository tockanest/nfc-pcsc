"use strict";

// #############
// Example: Using the LED with a custom buzzer pattern on the ACR122U NFC reader.
// - Compatible with ACR122U and ACR1252U (Needs to be tested on other readers).
// - Covered in this example:
//   - Initializing the NFC reader.
//   - Detecting when a card is in proximity.
//   - Authenticating (Might not be needed.) and reading specific blocks from the card.
//   - Setting the LED color and buzzer pattern.
//   - Closing the reader.
// - Important: This example demonstrates reading from the card, not writing.
// #############

import PCSC, { KEYS, Card, ACR122 } from "../src";

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
		reader.on("card", async (card) => {
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
					// Block 7 is not authenticated because normally it's a sector trailer block, which is used for storing access keys and other metadata. This on Mifare Classic 1k, you should
					//check for the documentation on your card for sector blocks and manufacturer blocks.
					// You can read more about it here: https://github.com/pokusew/nfc-pcsc/issues/16#issuecomment-304989178
					const blocks = [4, 5, 6, 8];
					const payloads: string[] = [];

					for (const block of blocks) {
						payloads.push(await readBlock(block));
					}

					return payloads;
				}

				//This is the function that sets the LED color and buzzer pattern, there is a JSDoc with it to explain the parameters.
				//This is only tested with ACR122U, so it might not work (most likely) with other readers.
				//Set the reader to the ACR122U Type if you want to use this function.

				//Check for the JSDoc on the function for more information on which LED you want to use that are preset.
				//Also check https://github.com/tockawaffle/nfc-pcsc/blob/master/src/utils/readers/docs/ACR122-LED.MD for more information on the LED Control.
				(reader as ACR122).ledControl("SUCCESS_MULTIPLE");
				//You can also set a custom Buzzer pattern, check the JSDoc for more information.
				//@TODO: "Rework" the LED Control to accept a custom LED/Buzzer pattern.
				// (reader as ACR122).ledControl("SUCCESS", [0x01, 0x00, 0x01, 0x00])

				console.log("Payload", await fetchData());

				// Close the reader after reading the necessary data.
				// Not closing the reader might give you trouble if you're using "on" instead of "once" for the event listener.
				reader.close();
			} catch (error) {
				//This is another example on how you can use the LED Control, to indicate that there was an error.
				(reader as ACR122).ledControl("FATAL_ERROR");

				console.log("Authentication error", error);
			}
		});

		// Set up an event listener for handling errors related to the reader.
		reader.on("error", (err) => {
			(reader as ACR122).ledControl("FATAL_ERROR");
			console.log("Error", err);
		});
	});

	// Set up a global event listener for any other NFC-related errors.
	nfc.on("error", (err) => {
		console.log("Error", err);
		throw err;
	});
})();
