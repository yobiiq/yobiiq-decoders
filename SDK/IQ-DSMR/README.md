# DSMR P1 port smart meter reader - YOBIIQ B.V.

Codec for the DSMR reader with LoRaWAN, connected to the P1 port of a smart electricity meter. It decodes the three meter profiles of the firmware: DSMR 4/5 (NL), Smarty (LUX) and DSMR 2.2/3.0 (NL legacy).

## Files

File | Content
---|---
[IQ-DSMR.js](IQ-DSMR.js) | Codec, version 1.0.0
[IQ-DSMR.txt](IQ-DSMR.txt) | Downlink examples
`firmware/` | Signed firmware images for over-the-air updates

## Codec

- Version **1.0.0**, written for the DSMR firmware **v1.0.0**. The codec version follows the firmware version.
- Entry points: `decodeUplink` and `encodeDownlink` (LoRa Alliance TS013-1.0.0) for The Things Stack, ChirpStack v4, LORIOT, ThingPark; `Decode` and `Encode` for ChirpStack v3.
- Written in ES3 syntax without ES5+ library calls, so it runs on every network server engine, including the ChirpStack v3 one.
- Every decoded uplink also carries the codec information: `codecVersion`, `genericModel`, `manufacturer` (and `productCode` where the product has one).

No Technical Reference Manual is published for this device yet.

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

[IQ-DSMR.txt](IQ-DSMR.txt) lists ready to use examples: the JSON object to pass to the encoder and the bytes it produces.

## Firmware OTA package

Each released firmware version has its own folder:

```
firmware/
  v<x.y.z>/
    IQ-DSMR_v<x.y.z>.bin   signed firmware image for LoRaWAN FUOTA
    SHA256SUMS             SHA-256 checksums of the images
    CHANGELOG.md           changes of this version
```

- Send the signed `.bin` image to the devices with the LoRa Alliance FUOTA packages, see [FUOTA deployment with ChirpStack](https://yobiiq.com/documentation/technical-guides/fuota-deployment-chirpstack). The device checks the signature of the image before it installs it.
- Check the images before sending them: `sha256sum -c SHA256SUMS` in the version folder.
- Use the codec of the same version as the firmware: after an update, update the codec in the network server too.

Firmware | Codec | Image
---|---|---
v1.0.0 | 1.0.0 | Not published yet
