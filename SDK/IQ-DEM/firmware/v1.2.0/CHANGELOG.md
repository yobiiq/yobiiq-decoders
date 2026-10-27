# DEM firmware v1.2.0

Release date: 8 October 2026. Images: `IQ-DEM1_v1.2.0.bin`, `IQ-DEM2_v1.2.0.bin`,
`IQ-DEM4_v1.2.0.bin` (one per meter model, send each device the image of its own model). Codec:
IQ-DEM 1.2.0. The registers are described in the
[DEM1](https://yobiiq.com/documentation/technical-guides/dem1-technical-reference-manual),
[DEM2](https://yobiiq.com/documentation/technical-guides/dem2-technical-reference-manual) and
[DEM4](https://yobiiq.com/documentation/technical-guides/dem4-technical-reference-manual)
Technical Reference Manuals.

## Changes since v1.0.1

- The values of DO2 Source (0x1020) are now 5 Remote, 6 Instantaneous Current, 7 Voltage. With
  each of them the device sets the meter up for remote control and switches digital output 2 over
  the meter link.
- LoRaWAN relay watchdog: Watchdog Enabled (0xB0EE) holds digital output 2 at its Initial State
  from the loss of the network until the next join.
- The serial communication alarm is no longer raised by spurious errors of the meter link.
- Protection Delay (0xB0ED) accepts 1 to 600 seconds.
- Confirmed uplinks are sent again until acknowledged, up to 3 attempts; join and link check fixes
  of the YOBIIQ LoRaWAN Stack.
- DEM4: a write to the CT ratio keeps the voltage transformer ratio, nominal frequency and
  connection type of the meter.
- Meter settings written before the meter has answered are kept and written to the meter.
- Firmware Version (0xFF69) is the firmware version of the LoRaWAN module; the firmware version of
  the meter is in the new Meter Firmware Version (0xEE3E).
- After each read of the max demand register, the device clears the demand data of the meter, so
  each logged value is the maximum demand of its logging interval. A logged value stays in the
  queue until its uplink is sent; a full queue is sent.
- The max demand configuration needs each of its five fields once; it can be written over BLE.
- Alarms raised while the device is not joined are sent right after the join.
- The first join is sent once the meter has answered, also when it answers after the start of the
  LoRaWAN module.
- A meter command is sent to the meter once; all the digital output 2 fields (DEM4: and digital
  input 2 fields) written in one command are applied.
- Stop Bits (0x6002) accepts 1 or 2; the LoRaWAN module starts even when the meter link cannot.
- Register values are rounded to the nearest step of their resolution.
- DEM4: the settings of digital input 1, DI1 Source (0x2000), DI1 Delay (0x2004) and DI1 Edge
  (0x2008), are written to the meter, like those of digital input 2.
- A momentary toggle of digital output 2 lasts its duration, and a protection trips at most 10
  seconds after its condition has lasted the Protection Delay (0xB0ED), never earlier.
- BLE advertising no longer stops until the next restart when the device applies the BLE name,
  address and passkey read from the meter.
- YOBIIQ LoRaWAN Stack: periodic uplinks are sent at their interval or skipped, never late; the
  registers of a periodic transmission that do not fit in one uplink are sent in the next uplinks
  of its fPort; the first time synchronization after a join is retried every 10 minutes.
