import { ConnectError, ERRORS } from "../errors";
import Reader from "./Reader";

export default class ACR122 extends Reader {
    /**
     * @description - Controls the led and how the buzzer will behave on card detection
     * @param led - The led to be controlled
     * @argument Success is of green led with 1 bip from the buzzer. Each one lasting 100ms x 0ms
     * @argument SuccessMultiple is of green led with 5 bips from the buzzer. Each one lasting 100ms x 0ms
     * @argument Error is of red led with 1 bip from the buzzer. Each one lasting 200ms x 100ms
     * @argument ErrorSimple is of red led with 2 bips from the buzzer. Each one lasting 200ms x 100ms
     * @argument FatalError is a red light with 4 bips from the buzzer. Each one lasting 300ms x 200ms
     * @returns - The response from the this.reader, usually a Buffer
     */
    public async ledControl(
        led:
            | "SUCCESS"
            | "SUCCESS_MULTIPLE"
            | "ERROR_SIMPLE"
            | "FATAL_ERROR"
            | "ERROR",
        customBlinking?: number[]
    ): Promise<Buffer> {
        const leds = {
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

        const connect = async (): Promise<void> => {
            return new Promise((resolve, reject) => {
                this.reader.connect(
                    {
                        share_mode: this.reader.SCARD_SHARE_DIRECT,
                        protocol: 0,
                    },
                    (err) => {
                        if (err) {
                            reject(
                                new ConnectError(
                                    ERRORS.OPERATION_FAILED,
                                    "Failed to connect to this.reader",
                                    err.message
                                )
                            );
                        } else {
                            resolve();
                        }
                    }
                );
            });
        };

        await connect();

        const correctLed = leds[led];
        const ledState = correctLed.led;
        const blinkingState = correctLed.blinking || customBlinking;

        return new Promise((resolve, reject) => {
            this.reader.control(
                Buffer.from([
                    0xff,
                    0x00,
                    0x40,
                    ledState,
                    0x04,
                    ...blinkingState,
                ]),
                0x003136b0,
                2,
                (err, response) => {
                    if (err) {
                        reject(
                            new ConnectError(
                                ERRORS.OPERATION_FAILED,
                                "Failed to control led",
                                err.message
                            )
                        );
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }
}
