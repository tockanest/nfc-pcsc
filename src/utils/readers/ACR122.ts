import { ConnectError, ERRORS } from "../errors";
import Reader from "./Reader";

/**
 * Configuration for LED behavior corresponding to various states.
 */
const LED_CONFIGS = {
	ERROR: {
		led: 0b01011101,
		blinking: [0x02, 0x01, 0x03, 0x01],
	},
	FATAL_ERROR: {
		led: 0b01011101,
		blinking: [0x03, 0x01, 0x05, 0x01],
	},
	ERROR_SIMPLE: {
		led: 0b01011101,
		blinking: [0x02, 0x01, 0x03, 0x01],
	},
	SUCCESS: {
		led: 0b00101110,
		blinking: [0x01, 0x01, 0x02, 0x01],
	},
	SUCCESS_MULTIPLE: {
		led: 0b00101110,
		blinking: [0x05, 0x01, 0x03, 0x01],
	},
};

/**
 * ACR122 reader class that extends the functionality of a generic Reader to include
 * specialized methods for controlling LEDs and buzzers.
 * @extends Reader
 */
export default class ACR122 extends Reader {
	/**
	 * Handles errors by wrapping them in a ConnectError with a predefined message.
	 * @param {Error} err - The error object that was thrown.
	 */
	private handleError(err: Error) {
		return new ConnectError(
			ERRORS.OPERATION_FAILED,
			"Failed to communicate with reader",
			err.message
		);
	}

	/**
	 * Establishes a connection with the reader device.
	 * @returns {Promise<boolean>} - Promise that resolves with true if connection was successful, otherwise rejects with an error.
	 */
	private newConnect(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.reader.connect(
				{ share_mode: this.reader.SCARD_SHARE_DIRECT, protocol: 0 },
				(err) => {
					if (err) {
						reject(this.handleError(err));
					} else {
						resolve(true);
					}
				}
			);
		});
	}

	/**
	 * Sends a control command to the reader device.
	 * @param {Buffer} buffer - The buffer containing the command to send to the reader.
	 * @returns {Promise<Buffer>} - Promise that resolves with the response from the reader, otherwise rejects with an error.
	 */
	private newControl(buffer: Buffer): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			this.reader.control(buffer, 0x003136b0, 2, (err, response) => {
				if (err) {
					reject(this.handleError(err));
				} else {
					resolve(response);
				}
			});
		});
	}

	/**
	 * @description - Controls the led and how the buzzer will behave on card detection
	 * @param led - The led to be controlled
	 * @argument Success is of green led with 1 bip from the buzzer. Each one lasting 100ms x 0ms
	 * @argument SuccessMultiple is of green led with 5 bips from the buzzer. Each one lasting 100ms x 0ms
	 * @argument Error is of red led with 1 bip from the buzzer. Each one lasting 200ms x 100ms
	 * @argument ErrorSimple is of red led with 2 bips from the buzzer. Each one lasting 200ms x 100ms
	 * @argument FatalError is a red light with 4 bips from the buzzer. Each one lasting 300ms x 200ms
	 * @returns {Promise<Buffer>} - The response from the this.reader, usually a Promise with a Buffer
	 */
	public async ledControl(
		led: keyof typeof LED_CONFIGS,
		customBlinking?: number[]
	): Promise<Buffer> {
		await this.newConnect();

		const { led: ledState, blinking } = LED_CONFIGS[led];
		const blinkingState = customBlinking || blinking;

		return this.newControl(
			Buffer.from([0xff, 0x00, 0x40, ledState, 0x04, ...blinkingState])
		);
	}

	/**
	 * Controls the buzzer of the reader device.
	 * @param {boolean} enable - Whether to enable or disable the buzzer.
	 * @returns {Promise<Buffer>} - Promise that resolves with the response from the reader, usually a Buffer.
	 */
	public async buzzerControl(enable: boolean): Promise<Buffer> {
		await this.newConnect();

		return this.newControl(
			Buffer.from([0xff, 0x00, 0x52, enable ? 0xff : 0x00, 0x00])
		);
	}
}
