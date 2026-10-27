# Generic codec for current generation devices - YOBIIQ B.V.

Codec for the registers that every current generation YOBIIQ device shares (range 0xFF00-0xFFFF: device information, status, temperature and humidity, LoRaWAN settings and alarms) and for the common payload framing. Use it for a device that has no codec of its own yet: decoding stops with an "Unknown register" error at the first register outside the generic range. Every product codec also decodes the generic registers.

## Files

File | Content
---|---
[IQ-GENERIC.js](IQ-GENERIC.js) | Codec, version 1.0.0
[IQ-GENERIC.txt](IQ-GENERIC.txt) | Downlink examples

## Codec

- Version **1.0.0**, written for the YOBIIQ SDK firmware **v1.0.0**. The codec version follows the firmware version.
- Entry points: `decodeUplink` and `encodeDownlink` (LoRa Alliance TS013-1.0.0) for The Things Stack, ChirpStack v4, LORIOT, ThingPark; `Decode` and `Encode` for ChirpStack v3.
- Written in ES3 syntax without ES5+ library calls, so it runs on every network server engine, including the ChirpStack v3 one.
- Every decoded uplink also carries the codec information: `codecVersion`, `genericModel`, `manufacturer` (and `productCode` where the product has one).

The generic registers, their ranges, defaults and commands are described in the [YOBIIQ LoRaWAN Stack Information](https://yobiiq.com/documentation/technical-guides/iq-lorawan-stack) guide.

### Uplinks

fPort | Content
---|---
0 | MAC commands (reported as such, no data)
1-10 | Periodic uplinks: timestamp and the configured registers
11 | Alarms
50 | Device information sent after each join, answers to configuration commands
100 | Answers to register reads
200-202 | FUOTA session packages (reported as such, no data)
203 | Firmware Management Protocol answers (firmware version, image status)

A one byte answer (`00` or `01`) on the fPort of a downlink reports that the command succeeded or failed.

### Downlinks

fPort | `Type` | Content
---|---|---
50 | `Config` | Register writes (configuration and commands)
100 | `Reading` | Register reads, answered on fPort 100

[IQ-GENERIC.txt](IQ-GENERIC.txt) lists ready to use examples: the JSON object to pass to the encoder and the bytes it produces.

## Firmware

This codec has no firmware of its own: the firmware images are in the folder of each product codec.
