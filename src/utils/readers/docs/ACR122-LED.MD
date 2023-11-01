---

## ACS ACR122: LED & Buzzer Control

### LED State Control (P2)

This control is represented as an 8-bit byte where each bit has a specific function.

| Bit | Item                              | Description                             |
|-----|-----------------------------------|-----------------------------------------|
| 0   | Final Red LED State               | 1 = On; 0 = Off                         |
| 1   | Final Green LED State             | 1 = On; 0 = Off                         |
| 2   | Red LED State Mask                | 1 = Update the State; 0 = No change     |
| 3   | Green LED State Mask              | 1 = Update the State; 0 = No change     |
| 4   | Initial Red LED Blinking State    | 1 = On; 0 = Off                         |
| 5   | Initial Green LED Blinking State  | 1 = On; 0 = Off                         |
| 6   | Red LED Blinking Mask             | 1 = Blink; 0 = Not Blink                |
| 7   | Green LED Blinking Mask           | 1 = Blink; 0 = Not Blink                |

#### Example: 

To set the green LED to be always ON and red LED to blink:

```javascript
const led = 0b01000110;  // This means: Green LED ON, Red LED initial state ON and Red LED should blink.
```

### Blinking Duration Control

This control is described by an array of 4 bytes:

- **Byte 0:** `T1 Duration` - Initial Blinking State (in units of 100 ms)
- **Byte 1:** `T2 Duration` - Toggle Blinking State (in units of 100 ms)
- **Byte 2:** Number of repetitions
- **Byte 3:** Link to Buzzer
  - `0x00`: The buzzer will not turn on
  - `0x01`: The buzzer will turn on during the T1 Duration
  - `0x02`: The buzzer will turn on during the T2 Duration
  - `0x03`: The buzzer will turn on during both T1 and T2 Durations

#### Example:

To make the buzzer beep twice, with each beep lasting 200 ms and a pause of 500 ms between the beeps:

```javascript
const blinking = [0x02, 0x05, 0x02, 0x01];
```

---

With this documentation, you can now create various combinations to control the LED and buzzer behaviors of the ACS ACR122 according to your requirements. Always make sure to test in a controlled environment before implementing any changes in a production scenario.

You can also refer to the ACR122.ts file in the [src/utils/readers/ACR122.ts](../ACR122.ts) file for a working example of how to use these controls.
