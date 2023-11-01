"use strict";

// Import required modules from the library.
import PCSC, { Card } from "../src/index";

// #####################################
// Introduction
// #####################################

// Initialize a new instance of the PCSC class.
// This is your main entry point for accessing NFC functionalities.
const nfc = new PCSC();

// #####################################
// Reader Attachment and Configuration
// #####################################

// Listen for when a new NFC reader is attached to the system. Reader can be type of ACR122 or Reader, so if you have a ACR122U/ACR1252U you can use the ACR122 type, otherwise use the Reader type.
//import { ACR122 } from "../src/index";
//nfc.on("reader", (reader: ACR122) => {...})

//import { Reader } from "../src/index";
//nfc.on("reader", (reader: Reader) => {...})
nfc.on("reader", (reader) => {
	console.log(`${reader.name} device attached`);

	// Application Identifier (AID) helps in uniquely identifying an application on the NFC card.
	// Setting the AID allows the reader to select and interact with the right application on the card.
	reader.aid = "F222222222"; // Here, we're setting a static HEX string as the AID.

	// #####################################
	// Card Events
	// #####################################

	// Listen for when a card is detected by the reader.
	// You can specify the type "Card" to get better typings.
	reader.on("card", (card: Card) => {
		// Logging the card details.
		console.log(`${reader.name} card detected`, card);
	});

	// Listen for when a card is removed from the reader's proximity.
	reader.on("card.off", (card: Card) => {
		console.log(`${reader.name} card removed`, card);
	});

	// #####################################
	// Error Handling
	// #####################################

	// It's crucial to handle errors gracefully, especially in hardware interactions.
	// Listen for any errors related to this specific reader (e.g., reading failures).
	reader.on("error", (err) => {
		console.log(`${reader.name} an error occurred`, err);
	});

	// Listen for when this reader device is removed or disconnected from the system.
	reader.on("end", () => {
		console.log(`${reader.name} device removed`);
	});
});

// #####################################
// General Error Handling
// #####################################

// Listen for any global errors not associated with a specific reader.
// These could be initialization errors or other global issues.
nfc.on("error", (err) => {
	console.log("an error occurred", err);
});
