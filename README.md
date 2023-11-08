# NFC-PCSC

[![npm version](https://badge.fury.io/js/@tockawa%2Fnfc-pcsc.svg)](https://badge.fury.io/js/@tockawa%2Fnfc-pcsc)
[![Build](https://github.com/tockawaffle/nfc-pcsc/actions/workflows/build.yml/badge.svg)](https://github.com/tockawaffle/nfc-pcsc/actions/workflows/build.yml)
[![wakatime](https://wakatime.com/badge/user/e0979afa-f854-452d-b8a8-56f9d69eaa3b/project/018b871f-82a7-46da-97a1-95f6cfa9b9d8.svg)](https://wakatime.com/badge/user/e0979afa-f854-452d-b8a8-56f9d69eaa3b/project/018b871f-82a7-46da-97a1-95f6cfa9b9d8)

This library facilitates the easy interaction with NFC tags and cards in Node.js, now with the added benefit of TypeScript support!

It seamlessly integrates auto-reading of card UIDs and is compatible with tags emulated using [**Android HCE**](https://developer.android.com/guide/topics/connectivity/nfc/hce.html).

This is also a fork of [@pokusew/nfc-pcsc](https://github.com/pokusew), go check it out and give it a star!

---

## Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

-   [Installation](#installation)
-   [Usage](#usage)
    -   [Basic Reading](#basic-reading)
    -   [Writing](#writing)
    -   [More examples](#more-examples)
-   [F.A.Q.](#faq)
    -   [How do I use this library with TypeScript?](#how-do-i-use-this-library-with-typescript)
    -   [How do I use this library with React Native?](#how-do-i-use-this-library-with-react-native)
    -   [How do I use this library with Electron?](#how-do-i-use-this-library-with-electron)
    -   [Which Node versions are supported?](#which-node-versions-are-supported)
    -   [Can I read/write NDEF tags/cards?](#can-i-readwrite-ndef-tagscards)
-   [TODO:](#todo)
-   [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Installation

<details>
<summary>Installation Steps</summary>
</br>

> This library relies on Node Native Modules (C++ Addons), which are compiled automatically via node-gyp when you install the package using npm or yarn. To ensure a smooth installation, a C/C++ compiler toolchain and other tools must be pre-installed on your system.
>
> For a detailed list of prerequisites and installation instructions for your specific OS, please consult the [Node-Gyp Installation Guide](https://github.com/nodejs/node-gyp#installation).

1. **macOS and Windows**: No additional installations are necessary as the pcsclite API is natively provided by the operating systems.

1.1 **Linux/UNIX**: You may need to install the pcsclite library and daemon.

<details>

**For Debian/Ubuntu:**

```bash
sudo apt-get install libpcsclite1 libpcsclite-dev pcscd
```

This command installs the necessary library and daemon. If you are using a different Linux distribution, refer to its respective documentation for installation instructions.

</details>

2. With the prerequisites in place, you can install the package using npm or yarn:

```bash
npm install @tockawa/nfc-pcsc
```

or

```bash
yarn add @tockawa/nfc-pcsc
```

After installation, you're all set to include this package in your project!

</details>

---

## Usage

> The package has been thoroughly tested on **Windows** with an **ACR122U** reader. While it has not been tested on other platforms, it is designed to be compatible with both **macOS** and **Linux**.

Before you start using this package, make sure to configure your `package.json` correctly based on how you intend to use the package:

<details>
<summary>For CommonJS Modules</summary>

Ensure your `package.json` includes the following line:

```json
{
	"type": "commonjs"
}
```

This is crucial to prevent runtime errors. The package is compatible with both ESM and CJS modules, and specifying the module type helps avoid potential issues.

</details>

<details>
<summary>For ECMAScript Modules (ESM)</summary>

Ensure your `package.json` includes the following line:

```json
{
	"type": "module"
}
```

This is crucial to prevent runtime errors. The package is compatible with both ESM and CJS modules, and specifying the module type helps avoid potential issues.

</details>

While this package can be used without specifying the module type, it is highly recommended to do so to avoid potential runtime errors. You never know how JavaScript might behave, you know it's shenanigans.

### Basic Reading

You can read numerous NFC tags and cards, such as Mifare Classic 1k, MIFARE DESFire, MIFARE Ultralight and etc

You should also be able to read non-standard NFC tags and cards by sending APDU commands with the card's/tag's technical documentation via reader.transmit.

This is a simple example on how to read standard cards and tags:

<details>
<summary> Expand me! </summary>

This is a classic example on reading a Mifare Classic 1k NFC Card.

It might differ a bit from card to card, mainly on authentication and reading blocks, so you should check the documentation of your card to see how to authenticate and read blocks.

```js
// #############
// Example: Reading data from NFC cards
// - Compatible with any PC/SC card reader.
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
		reader.on("card", async (card) => {
			console.log("Card detected", card);

			try {
				// Function to authenticate and read a specific block from the card.
				async function readBlock(block: number): Promise<string> {
					//Notice that I am authenticating the requested blocks with the correct key type and key.
					//Not all cards/tags requires authentication, so you should check the documentation of your card/tag to see if it requires authentication and which blocks are usable.
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
```

</details>

---

### Writing

The same way you can read numerous NFC tags and cards, you can also write to them.

The logic of writing is similar to reading, but you should check the documentation of your card/tag to see how to authenticate and write blocks.

Please, be careful when writing to your card/tag, depending on the card/tag, you might write to a sector trailer block, which can cause the card/tag to either stop working, or changing the access keys, which can cause you to lose access to the card/tag.

And again, not all cards/tags requires authentication, so you should check the documentation of your card/tag to see if it requires authentication and which blocks are usable.

This is a simple example on how to write to standard cards and tags:

<details>
<summary> Expand me! </summary>

```js
"use strict";

// #############
// Example: Writing data to NFC cards
// - Compatible with any PC/SC card reader.
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
```

</details>

---

### More examples

You can find more examples, or the examples above in the examples folder:

-   [Read](https://github.com/tockawaffle/nfc-pcsc/blob/master/examples/read.ts)
-   [Write](https://github.com/tockawaffle/nfc-pcsc/blob/master/examples/write.ts)
-   [Basic Usage](https://github.com/tockawaffle/nfc-pcsc/blob/master/examples/basic.ts)
-   [Controlling Led](https://github.com/tockawaffle/nfc-pcsc/blob/master/examples/led.ts)

Also, there are some good examples on how to use this library in the [@pokeusew/nfc-pcsc](https://github.com/pokusew/nfc-pcsc) repository, it's pretty much the same thing, but be careful with types, as this library uses TypeScript and the other one doesn't.

## F.A.Q.

### How do I use this library with TypeScript?

This library was built with TypeScript in mind, so you can use it with TypeScript without any problems. You can find the typings inside the dist folder, on the types folder.

Just be careful with ESM/CJS modules, as this library supports both, so you should configure your `package.json` accordingly.

---

### How do I use this library with React Native?

This library is not compatible with React Native, as it uses Node Native Modules (C++ Addons), which are not supported by React Native. However, there are React Native libraries that can help you with that.

---

### How do I use this library with Electron?

You are able to use this library with Electron.

But note that since this library uses Node Native Modules (C++ Addons), you will need to rebuild the library for Electron.

How?

By using [electron-rebuild](https://github.com/electron/rebuild).

You can use a script similar to this one to rebuild the library for electron:

```json
{
	"scripts": {
		"electron-rebuild": "electron-rebuild @pokusew/pcsclite"
	}
}
```

This should work for most cases, but if you have any problems, you can check the [electron-rebuild](https://github.com/electron/rebuild) documentation for more information.

---

### Which Node versions are supported?

This library _should_ work with Node 12 and above, however, it was only tested with Node 18.

> Note: With pokusew's package, you can use it with Node 8, use it if you don't want to update.
> Why? Because some things might get broken with older versions of Node. So I recommend you to use up to date versions of Node (v12+).

---

### Can I read/write NDEF tags/cards?

Most likely, yes.

How? I've been trying that too, but I haven't been able to do it yet. If you have any information on how to do it, please, let me know by creating an issue or issueing a pull request.

## TODO:

-   [ ] Add support for NDEF tags/cards
-   [ ] Create a buzzer example (ACR122U).
-   [ ] Give better support to custom LEDs (ACR122U).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/tockawaffle/nfc-pcsc/blob/master/LICENSE) file for details.

Unchanged from the original [**@pokusew/nfc-pcsc**](https://github.com/pokusew) license.
