# CMD analog input module - YOBIIQ B.V.

Codec for the CMD series analog input modules with LoRaWAN (CMD-L-0D-4I: 4 inputs, 0-10 V or 4-20 mA).

## Files

File | Content
---|---
[IQ-AIM.js](IQ-AIM.js) | Codec, version 1.0.0
[IQ-AIM.txt](IQ-AIM.txt) | Downlink examples
`firmware/` | Signed firmware images for over-the-air updates

## Codec

- Version **1.0.0**, written for the CMD (AIM) firmware **v1.0.0**. The codec version follows the firmware version.
- Entry points: `decodeUplink` and `encodeDownlink` (LoRa Alliance TS013-1.0.0) for The Things Stack, ChirpStack v4, LORIOT, ThingPark; `Decode` and `Encode` for ChirpStack v3.
- Written in ES3 syntax without ES5+ library calls, so it runs on every network server engine, including the ChirpStack v3 one.
- Every decoded uplink also carries the codec information: `codecVersion`, `genericModel`, `manufacturer` (and `productCode` where the product has one).

The registers, their ranges, defaults and downlink commands are described in the Technical Reference Manual: [CMD](https://yobiiq.com/documentation/technical-guides/cmd-technical-reference-manual).

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

[IQ-AIM.txt](IQ-AIM.txt) lists ready to use examples: the JSON object to pass to the encoder and the bytes it produces.

## Firmware OTA package

Each released firmware version has its own folder:

```
firmware/
  v<x.y.z>/
    IQ-AIM_v<x.y.z>.bin    signed firmware image for LoRaWAN FUOTA
    SHA256SUMS             SHA-256 checksum of the image
    CHANGELOG.md           changes of this version
```

- Send the signed `.bin` image to the devices with the LoRa Alliance FUOTA packages, see [FUOTA deployment with ChirpStack](https://yobiiq.com/documentation/technical-guides/fuota-deployment-chirpstack). The device checks the signature of the image before it installs it.
- Check the image before sending it: `sha256sum -c SHA256SUMS` in its folder.
- Use the codec of the same version as the firmware: after an update, update the codec in the network server too.

Firmware | Codec | Image
---|---|---
v1.0.0 | 1.0.0 | Not published yet
