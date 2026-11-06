# UFC underfloor heating and cooling controller - YOBIIQ B.V.

Codec for the UFC underfloor heating and cooling controller with LoRaWAN (iQ UFHCC, device model UFC-1002029, product code P1002029).

## Files

File | Content
---|---
[IQ-UFC.js](IQ-UFC.js) | Codec, version 1.3.0
[IQ-UFC.txt](IQ-UFC.txt) | Downlink examples
[IQ-UFC.examples.json](IQ-UFC.examples.json) | Payload examples: uplinks with their decoded output, downlinks with their bytes

## Codec

- Version **1.3.0**, written for the UFC firmware **v1.3.0**. The codec version follows the firmware version.
- Entry points: `decodeUplink` and `encodeDownlink` (LoRa Alliance TS013-1.0.0) for The Things Stack, ChirpStack v4, LORIOT, ThingPark; `Decode` and `Encode` for ChirpStack v3.
- Written in ES3 syntax without ES5+ library calls, so it runs on every network server engine, including the ChirpStack v3 one.
- Every decoded uplink also carries the codec information: `codecVersion`, `genericModel`, `productCode` and `manufacturer`.
- The UFC runs LoRaWAN class C, always.

The UFC follows the register layout of the YOBIIQ SDK devices: a payload is a list of records, a 2-byte register address (big endian) followed by its value. Its registers:

Range | Registers | Names in the codec
---|---|---
`0x0000`-`0x0006` | System: operating mode, heating and cooling setpoints and limits, flow temperature limits | `systemOperatingMode`, `heatingSetpoint`, ...
`0x0100`-`0x0C1A` | Outputs CH1 to CH12: state, current, voltage, power, alarms and settings | `channel1OutputState` to `channel12EnableCurrentDraw`
`0x1100`-`0x1C0C` | Groups GR1 to GR12: thermostat type, mode, setpoint, name, temperature and settings | `group1ThermostatType` to `group12Alarm`
`0x2001`-`0x2003` | Main 24 V power input: current, voltage, power | `mainCurrent`, `mainVoltage`, `mainPower`
`0x3100`-`0x3403` | Thermostats: TH1 and TH2 (OpenTherm), the Internal thermostat, outdoor and flow temperature | `th1RoomTemperature`, `internalRoomSetpoint`, ...
`0x4000`-`0x4008` | Network settings: Modbus, DHCP, BACnet, LoRaWAN, IP addresses | `enableModbus`, `deviceIpAddress`, ...
`0xFF32`-`0xFFA7` | Generic registers of the YOBIIQ SDK served by the UFC | `deviceName`, `firmwareVersion`, `adr`, ...

Units: temperatures and setpoints in °C (the device sends °C × 100), the group deadband in °C (sent as °C × 10), currents in mA, voltages in mV, powers in mW, IP addresses as `"192.168.1.100"`.

The DevEUI, AppEUI, AppKey and the iQ D2D key have no register: they are not served over LoRaWAN.

### Uplinks

fPort | Content
---|---
0 | MAC commands (reported as such, no data)
1-10 | Periodic uplinks: timestamp and the configured registers
50 | Device information sent after each join, answers to configuration commands
100 | Answers to register reads

A one byte answer (`00` or `01`) on the fPort of a downlink reports that the command succeeded or failed. A read is answered `00`, then the uplinks with the registers read.

### Downlinks

fPort | `Type` | Content
---|---|---
1-10 | `Periodic` | Periodic uplink of that fPort: interval, confirmed or not, active or not, registers
50 | `Config` | Register writes (configuration and commands)
100 | `Reading` | Register reads, answered on fPort 100

The UFC checks a whole `Config` downlink as one session: when one value is refused, nothing is saved and the answer is `01`. A downlink holds at most 51 bytes.

> **Warning:** the system, output, group and network settings, the generic names and the periodic
> uplink settings are saved to the internal flash memory. Writing different values to them often
> shortens the flash memory's lifespan; writing the same values again does not write the flash.
> The group setpoints and temperatures (`group<n>Setpoint`, `group<n>Temperature`) and the
> thermostat values (`internalRoomTemperature`, `internalRoomSetpoint`, `outdoorTemperature`,
> `flowTemperature`) are kept in RAM only, so they can be sent as often as needed.

[IQ-UFC.txt](IQ-UFC.txt) lists ready to use commands: the JSON object to pass to the encoder, with notes on the parameters.

[IQ-UFC.examples.json](IQ-UFC.examples.json) lists payload examples checked against the codec: each uplink (`payload`, also as `payloadHex` without spaces, ready to paste) with its decoded output, and each downlink command with the bytes it encodes to.

## Firmware

The UFC firmware is updated over ThingsBoard OTA; its images are not published in this repository. Use the codec of the same version as the firmware.

Firmware | Codec | Changes
---|---|---
v1.3.0 | 1.3.0 | First codec of the UFC
